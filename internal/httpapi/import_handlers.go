package httpapi

import (
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
	s.handleImport(w, r, "md", importer.Markdown)
}

func (s *Server) handleImportBookcision(w http.ResponseWriter, r *http.Request) {
	s.handleImport(w, r, "bookcision", importer.Bookcision)
}

func (s *Server) handleImportHardcover(w http.ResponseWriter, r *http.Request) {
	s.handleImport(w, r, "hardcover_html", importer.HardcoverHTML) // PLAN §5e
}

// handleImport is the shared multipart import flow: cap -> parse -> one
// transaction for the book upsert and every annotation insert (PLAN §5, §8).
// dedupe_hash duplicates are counted as skipped, so re-imports are idempotent.
func (s *Server) handleImport(w http.ResponseWriter, r *http.Request, source string,
	parse func(io.Reader) (*importer.Result, error)) {

	r.Body = http.MaxBytesReader(w, r.Body, maxImportBody) // before parsing
	f, _, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, `multipart "file" field required (max 5 MB)`)
		return
	}
	defer f.Close()
	res, err := parse(f)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}

	uid := userID(r)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	bookID, created, err := upsertImportBook(tx, uid, res.Book)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	// When a new book row was created, flag look-alikes already in the library
	// so the review UI can offer to merge (PLAN §5): "Homo Deus" landing beside
	// "Homo Deus: The million-copy bestseller…".
	var dupes []dupHint
	if created {
		if dupes, err = findSimilarBooks(tx, uid, res.Book.Title, bookID); err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
	}
	added, enriched := 0, 0
	for _, a := range res.Annotations {
		color := a.Color
		if color == "" {
			color = "yellow" // Kindle sources carry no colour (PLAN §3)
		}
		if !validColor(color) {
			writeErr(w, http.StatusBadRequest, fmt.Sprintf("invalid color %q", a.Color))
			return
		}
		text := a.Quote
		if text == "" {
			text = a.Note
		}
		ins, err := tx.Exec(`
			INSERT OR IGNORE INTO annotations
			  (book_id, quote, note, color, chapter, location, favorite, rating, source, dedupe_hash)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			bookID, nullable(a.Quote), nullable(a.Note), color,
			nullable(a.Chapter), nullable(a.Location), a.Favorite, a.Rating,
			source, store.DedupeHash(text))
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
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
				  color      = CASE WHEN color = 'yellow' AND ? <> 'yellow' THEN ? ELSE color END,
				  favorite   = MAX(favorite, ?),
				  rating     = CASE WHEN rating = 0 THEN ? ELSE rating END,
				  updated_at = datetime('now')
				WHERE book_id = ? AND dedupe_hash = ?
				  AND (   (chapter IS NULL AND ? IS NOT NULL)
				       OR (location IS NULL AND ? IS NOT NULL)
				       OR (note IS NULL AND ? IS NOT NULL)
				       OR (color = 'yellow' AND ? <> 'yellow')
				       OR (favorite = 0 AND ?)
				       OR (rating = 0 AND ? > 0))`,
				nullable(a.Chapter), nullable(a.Location), nullable(a.Note),
				color, color, a.Favorite, a.Rating,
				bookID, store.DedupeHash(text),
				nullable(a.Chapter), nullable(a.Location), nullable(a.Note),
				color, a.Favorite, a.Rating)
			if err != nil {
				writeErr(w, http.StatusInternalServerError, "internal error")
				return
			}
			if n, _ := upd.RowsAffected(); n > 0 {
				enriched++
			}
			if len(a.Tags) > 0 {
				var annID int64
				if err := tx.QueryRow(`SELECT id FROM annotations WHERE book_id = ? AND dedupe_hash = ?`,
					bookID, store.DedupeHash(text)).Scan(&annID); err == nil {
					if err := addTags(tx, "annotation", uid, annID, a.Tags); err != nil {
						writeErr(w, http.StatusInternalServerError, "internal error")
						return
					}
				}
			}
			continue
		}
		added++
		if len(a.Tags) > 0 {
			annID, _ := ins.LastInsertId()
			if err := setTags(tx, "annotation", uid, annID, a.Tags); err != nil {
				writeErr(w, http.StatusInternalServerError, "internal error")
				return
			}
		}
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if dupes == nil {
		dupes = []dupHint{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"book_id":             bookID,
		"added":               added,
		"skipped":             len(res.Annotations) - added,
		"enriched":            enriched,
		"possible_duplicates": dupes,
	})
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
		// OR IGNORE: skip the backfill rather than fail if another row already
		// owns this isbn/asin (partial unique indexes on (user_id, isbn/asin)).
		if _, err := tx.Exec(
			`UPDATE OR IGNORE books SET isbn = COALESCE(isbn, ?), asin = COALESCE(asin, ?) WHERE id = ?`,
			nullable(isbn), nullable(b.ASIN), id); err != nil {
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
