package httpapi

import (
	"bytes"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"

	"tippani/internal/importer"
	"tippani/internal/metadata"
	"tippani/internal/store"
)

// maxImportBody caps uploads before any parsing happens (PLAN §5).
const maxImportBody = 5 << 20

func (s *Server) handleImportMarkdown(w http.ResponseWriter, r *http.Request) {
	// Markdown is dual-format: a catalogue (movie/show) export or a book export,
	// each possibly multi-item. Peek to route; both round-trip our own exports.
	data, ok := readUpload(w, r)
	if !ok {
		return
	}
	if importer.LooksLikeMovieMarkdown(data) {
		results, err := importer.MovieMarkdownAll(bytes.NewReader(data))
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(results) == 0 {
			writeErr(w, http.StatusBadRequest, "no titles found in file")
			return
		}
		s.persistMovies(w, r, results)
		return
	}
	results, err := importer.MarkdownAll(bytes.NewReader(data))
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(results) == 0 {
		writeErr(w, http.StatusBadRequest, "no books found in file")
		return
	}
	s.persistBooks(w, r, "md", results)
}

func (s *Server) handleImportBookcision(w http.ResponseWriter, r *http.Request) {
	s.handleImport(w, r, "bookcision", importer.Bookcision)
}

func (s *Server) handleImportHardcover(w http.ResponseWriter, r *http.Request) {
	s.handleImport(w, r, "hardcover_html", importer.HardcoverHTML) // PLAN §5e
}

func (s *Server) handleImportGoodreads(w http.ResponseWriter, r *http.Request) {
	s.handleImport(w, r, "goodreads_html", importer.Goodreads)
}

func (s *Server) handleImportKindleNotebook(w http.ResponseWriter, r *http.Request) {
	s.handleImport(w, r, "kindle_notebook", importer.AmazonNotebook) // read.amazon.com/notebook (PLAN §5)
}

// importClientError marks a parse-result problem that's the uploaded file's
// fault (a 400), not a server fault (a 500) — e.g. an invalid annotation colour.
type importClientError struct{ msg string }

func (e importClientError) Error() string { return e.msg }

// handleImport adapts a single-book parser to the multi-book flow so every
// source funnels through one persistence path.
func (s *Server) handleImport(w http.ResponseWriter, r *http.Request, source string,
	parse func(io.Reader) (*importer.Result, error)) {
	s.handleImportN(w, r, source, func(rd io.Reader) ([]*importer.Result, error) {
		res, err := parse(rd)
		if err != nil {
			return nil, err
		}
		return []*importer.Result{res}, nil
	})
}

// handleImportN is the shared multipart import flow: cap -> parse (one or many
// books) -> one transaction for every book's upsert + annotation inserts (PLAN
// §5, §8). dedupe_hash duplicates are counted as skipped, so re-imports are
// idempotent; a multi-book file lands every book (export round-trip).
func (s *Server) handleImportN(w http.ResponseWriter, r *http.Request, source string,
	parseAll func(io.Reader) ([]*importer.Result, error)) {

	data, ok := readUpload(w, r)
	if !ok {
		return
	}
	results, err := parseAll(bytes.NewReader(data))
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(results) == 0 {
		writeErr(w, http.StatusBadRequest, "no books found in file")
		return
	}
	s.persistBooks(w, r, source, results)
}

// readUpload pulls the multipart "file" field's bytes (capped) — shared by every
// import handler; a peek-then-parse handler (markdown, which routes book vs
// catalogue) needs the bytes in hand rather than a one-shot reader.
func readUpload(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxImportBody)
	f, _, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, `multipart "file" field required (max 5 MB)`)
		return nil, false
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large or malformed")
		return nil, false
	}
	return data, true
}

// persistBooks writes a parsed batch of books (one or many) into the store in a
// single transaction and answers with the aggregate + per-book breakdown.
func (s *Server) persistBooks(w http.ResponseWriter, r *http.Request, source string, results []*importer.Result) {
	uid := userID(r)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()

	type bookSummary struct {
		BookID   int64  `json:"book_id"`
		Title    string `json:"title"`
		Added    int    `json:"added"`
		Skipped  int    `json:"skipped"`
		Enriched int    `json:"enriched"`
	}
	var (
		books     []bookSummary
		bookIDs   []int64
		allDupes  []dupHint
		tAdd, tEn int
	)
	for _, res := range results {
		bookID, added, enriched, dupes, err := s.importOneBook(tx, uid, source, res)
		if err != nil {
			var ce importClientError
			if errors.As(err, &ce) {
				writeErr(w, http.StatusBadRequest, ce.msg)
			} else {
				writeErr(w, http.StatusInternalServerError, "internal error")
			}
			return
		}
		books = append(books, bookSummary{bookID, res.Book.Title, added, len(res.Annotations) - added, enriched})
		bookIDs = append(bookIDs, bookID)
		allDupes = append(allDupes, dupes...)
		tAdd += added
		tEn += enriched
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if allDupes == nil {
		allDupes = []dupHint{}
	}
	total := 0
	for _, res := range results {
		total += len(res.Annotations)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"book_id":             bookIDs[0], // back-compat: the first (usually only) book
		"book_ids":            bookIDs,
		"books":               books,
		"added":               tAdd,
		"skipped":             total - tAdd,
		"enriched":            tEn,
		"possible_duplicates": allDupes,
	})
}

// importOneBook upserts one parsed book and inserts/enriches its annotations
// inside the caller's transaction. It returns the book id, how many annotations
// were added and enriched, and any look-alike hints for a freshly-created book.
// A bad annotation colour comes back as an importClientError (a 400).
func (s *Server) importOneBook(tx *sql.Tx, uid int64, source string, res *importer.Result) (int64, int, int, []dupHint, error) {
	bookID, created, err := upsertImportBook(tx, uid, res.Book)
	if err != nil {
		return 0, 0, 0, nil, err
	}
	// When a new book row was created, flag look-alikes already in the library
	// so the review UI can offer to merge (PLAN §5): "Homo Deus" landing beside
	// "Homo Deus: The million-copy bestseller…".
	var dupes []dupHint
	if created {
		if dupes, err = findSimilarBooks(tx, uid, res.Book.Title, bookID); err != nil {
			return 0, 0, 0, nil, err
		}
	}
	added, enriched := 0, 0
	for _, a := range res.Annotations {
		color := a.Color
		if color == "" {
			color = "yellow" // Kindle sources carry no colour (PLAN §3)
		}
		if !validColor(color) {
			return 0, 0, 0, nil, importClientError{fmt.Sprintf("invalid color %q", a.Color)}
		}
		text := a.Quote
		if text == "" {
			text = a.Note
		}
		ins, err := tx.Exec(`
			INSERT OR IGNORE INTO annotations
			  (book_id, quote, note, color, chapter, location, favorite, rating, source, dedupe_hash, noted_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			bookID, nullable(a.Quote), nullable(a.Note), color,
			nullable(a.Chapter), nullable(a.Location), a.Favorite, a.Rating,
			source, store.DedupeHash(text), nullable(a.NotedAt))
		if err != nil {
			return 0, 0, 0, nil, err
		}
		if n, _ := ins.RowsAffected(); n == 0 {
			// Duplicate (same dedupe hash): enrich instead of discarding — the
			// incoming copy donates whatever the existing row lacks (PLAN §5).
			// Fill-empty-only, so user edits and earlier imports always win:
			// chapter/location/note when NULL, color when still the yellow
			// default, favorite only upward, rating only when unrated; tags
			// union below. updated_at bumps only when something changed (the
			// WHERE guard also keeps no-op re-imports write-free, PLAN §8).
			upd, err := tx.Exec(`
				UPDATE annotations SET
				  chapter    = COALESCE(chapter, ?),
				  location   = COALESCE(location, ?),
				  note       = COALESCE(note, ?),
				  noted_at   = COALESCE(noted_at, ?),
				  color      = CASE WHEN color = 'yellow' AND ? <> 'yellow' THEN ? ELSE color END,
				  favorite   = MAX(favorite, ?),
				  rating     = CASE WHEN rating = 0 THEN ? ELSE rating END,
				  updated_at = datetime('now')
				WHERE book_id = ? AND dedupe_hash = ?
				  AND (   (chapter IS NULL AND ? IS NOT NULL)
				       OR (location IS NULL AND ? IS NOT NULL)
				       OR (note IS NULL AND ? IS NOT NULL)
				       OR (noted_at IS NULL AND ? IS NOT NULL)
				       OR (color = 'yellow' AND ? <> 'yellow')
				       OR (favorite = 0 AND ?)
				       OR (rating = 0 AND ? > 0))`,
				nullable(a.Chapter), nullable(a.Location), nullable(a.Note), nullable(a.NotedAt),
				color, color, a.Favorite, a.Rating,
				bookID, store.DedupeHash(text),
				nullable(a.Chapter), nullable(a.Location), nullable(a.Note), nullable(a.NotedAt),
				color, a.Favorite, a.Rating)
			if err != nil {
				return 0, 0, 0, nil, err
			}
			if n, _ := upd.RowsAffected(); n > 0 {
				enriched++
			}
			if len(a.Tags) > 0 {
				var annID int64
				if err := tx.QueryRow(`SELECT id FROM annotations WHERE book_id = ? AND dedupe_hash = ?`,
					bookID, store.DedupeHash(text)).Scan(&annID); err == nil {
					if err := addTags(tx, "annotation", uid, annID, a.Tags); err != nil {
						return 0, 0, 0, nil, err
					}
				}
			}
			continue
		}
		added++
		if len(a.Tags) > 0 {
			annID, _ := ins.LastInsertId()
			if err := setTags(tx, "annotation", uid, annID, a.Tags); err != nil {
				return 0, 0, 0, nil, err
			}
		}
	}
	return bookID, added, enriched, dupes, nil
}

// upsertImportBook finds or creates the import target. Identity falls through
// normalized ISBN → ASIN → lower(title)+lower(author): the same book arrives
// with an ISBN from one tool and bare title/author from another, and both must
// land in one row for cross-source quote dedupe to work (PLAN §3). A match via
// a weaker identity backfills the row's missing identifiers so the next import
// matches on the cheap key.
func upsertImportBook(tx *sql.Tx, uid int64, b importer.Book) (int64, bool, error) {
	isbn := metadata.NormalizeISBN(b.ISBN) // "" when absent or implausible
	var id int64
	find := func(query string, args ...any) (bool, error) {
		err := tx.QueryRow(query, args...).Scan(&id)
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return err == nil, err
	}
	// Try each identity in turn; a match on ANY of them backfills the row's
	// missing identifiers so the next import (which may carry only one of them,
	// with a differently-formatted title) still matches on the cheap key.
	matched := false
	for _, q := range []struct {
		cond string
		args []any
	}{
		{`isbn = ?`, []any{isbn}},
		{`asin = ?`, []any{b.ASIN}},
		{`lower(title) = lower(?) AND lower(COALESCE(author, '')) = lower(?)`, []any{b.Title, b.Author}},
	} {
		// Skip identity keys we don't have (empty isbn/asin would match the wrong row).
		if q.args[0] == "" {
			continue
		}
		ok, err := find(`SELECT id FROM books WHERE user_id = ? AND `+q.cond, append([]any{uid}, q.args...)...)
		if err != nil {
			return 0, false, err
		}
		if ok {
			matched = true
			break
		}
	}
	if matched {
		// Backfill every identifier/field the matched row is missing from this
		// import (fill-empty-only, so existing data always wins). OR IGNORE skips
		// rather than fails if another row already owns this isbn/asin (partial
		// unique indexes on (user_id, isbn/asin)).
		if _, err := tx.Exec(
			`UPDATE OR IGNORE books SET isbn = COALESCE(isbn, ?), asin = COALESCE(asin, ?),
			                            author = COALESCE(author, ?) WHERE id = ?`,
			nullable(isbn), nullable(b.ASIN), nullable(b.Author), id); err != nil {
			return 0, false, err
		}
		return id, false, nil
	}
	res, err := tx.Exec(
		`INSERT INTO books (user_id, title, author, isbn, asin) VALUES (?, ?, ?, ?, ?)`,
		uid, b.Title, nullable(b.Author), nullable(isbn), nullable(b.ASIN))
	if err != nil {
		return 0, false, err
	}
	id, err = res.LastInsertId()
	return id, true, err
}
