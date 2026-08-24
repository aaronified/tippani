package httpapi

import (
	"bytes"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"tippani/internal/importer"
	"tippani/internal/metadata"
	"tippani/internal/store"
)

// maxImportBody caps uploads before any parsing happens (PLAN §5).
const maxImportBody = 5 << 20

// Every import endpoint parses the upload and then STAGES it (ROADMAP 1.2.0):
// nothing reaches annotations/dialogues until the pending queue is approved. The
// reply is therefore a batch id and a staged count, not added/skipped/enriched —
// those counters now come back from POST /import/staged/approve, which is where
// the writing actually happens.

func (s *Server) handleImportMarkdown(w http.ResponseWriter, r *http.Request) {
	// Markdown is dual-format: a catalogue (movie/show) export or a book export,
	// each possibly multi-item. Peek to route; both round-trip our own exports.
	data, filename, ok := readUpload(w, r)
	if !ok {
		return
	}
	// An anthology file (0043) is a quotes file with prose and an order around it,
	// so it stages through the SAME queue: one group, one row per entry, in the
	// file's order. What it carries extra is the anthology's title on every row and
	// the commentary on each — resolved to a row at approval time, which is where an
	// import is allowed to write to the library.
	if importer.MarkdownKind(data) == importer.KindAnthology {
		an, err := importer.AnthologyMarkdown(bytes.NewReader(data))
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		s.stageQuotesFile(w, r, "md", filename, an.Entries)
		return
	}
	if importer.MarkdownKind(data) == importer.KindQuotes {
		us, err := importer.QuoteMarkdownAll(bytes.NewReader(data))
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(us) == 0 {
			writeErr(w, http.StatusBadRequest, "no quotes found in file")
			return
		}
		s.stageQuotesFile(w, r, "md", filename, us)
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
		s.stageMovies(w, r, "md", filename, results, nil)
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
	s.stageBooks(w, r, "md", filename, results, nil)
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

// handleImportKindleClippings takes the Kindle device's own My Clippings.txt —
// every book at once, rather than the one-book-at-a-time notebook page. The
// format is undocumented and localised, so the parser is best-effort by design:
// it reports what it skipped instead of failing the whole file, and the UI
// labels the source experimental.
func (s *Server) handleImportKindleClippings(w http.ResponseWriter, r *http.Request) {
	data, filename, ok := readUpload(w, r)
	if !ok {
		return
	}
	results, stats, err := importer.KindleClippings(bytes.NewReader(data))
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(results) == 0 {
		writeErr(w, http.StatusBadRequest, "no books found in file")
		return
	}
	s.stageBooks(w, r, "kindle_clippings", filename, results, map[string]any{
		"bookmarks_skipped": stats.Bookmarks,
		"blocks_malformed":  stats.Malformed,
		"notes_merged":      stats.NotesMerged,
		"near_duplicates":   stats.Duplicates,
	})
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
// books) -> one transaction that stages every book and its quotes (PLAN §5, §8).
// A multi-book file stages every book, so an export round-trip is preserved; the
// dedupe that makes a re-import idempotent runs at approval, against the library.
func (s *Server) handleImportN(w http.ResponseWriter, r *http.Request, source string,
	parseAll func(io.Reader) ([]*importer.Result, error)) {

	data, filename, ok := readUpload(w, r)
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
	s.stageBooks(w, r, source, filename, results, nil)
}

// readUpload pulls the multipart "file" field's bytes (capped) and its name —
// shared by every import handler; a peek-then-parse handler (markdown, which
// routes book vs catalogue) needs the bytes in hand rather than a one-shot
// reader. The filename is kept because the staging queue groups and filters by
// the file a batch came from, so "the Kindle export" and "the Goodreads page"
// stay distinguishable in one pending list.
func readUpload(w http.ResponseWriter, r *http.Request) ([]byte, string, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxImportBody)
	f, hdr, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, `multipart "file" field required (max 5 MB)`)
		return nil, "", false
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large or malformed")
		return nil, "", false
	}
	name := ""
	if hdr != nil {
		// Take the base name only: a browser sends "notes.md", but a scripted
		// client may send a path, and this string is displayed back in the queue.
		// It is never used AS a path — nothing here touches the filesystem — but
		// stripping the directories keeps a hostile name from rendering as one.
		name = strings.TrimSpace(filepath.Base(filepath.ToSlash(hdr.Filename)))
		if name == "." || name == "/" || name == string(filepath.Separator) {
			name = ""
		}
		// Truncate rather than reject: a long name is not a reason to refuse the
		// file. trimCap reports an overflow without cutting, so cut it here.
		if r := []rune(name); len(r) > 128 {
			name = string(r[:128])
		}
	}
	return data, name, true
}

// bookSummary is one book's outcome in an approval reply — the shape the import
// endpoints used to answer with directly, before staging moved the write behind
// an explicit approve step.
type bookSummary struct {
	BookID   int64  `json:"book_id"`
	Title    string `json:"title"`
	Created  bool   `json:"created"`
	Added    int    `json:"added"`
	Skipped  int    `json:"skipped"`
	Enriched int    `json:"enriched"`
}

// workExclusion reads a work's quiz opt-out so a batch insert can seed every
// child row it writes from it.
//
// WHY EVERY CREATE PATH HAS TO DO THIS. 0033 made the flag that gates the deck the
// quote's OWN column, deliberately — a highlight barred by a flag that was not on
// it made the control that clears its flag report an outcome that did not happen.
// The price of that decision is that "skip this book" has to be written onto the
// quotes, and therefore onto each new quote at the moment it is created. Miss it in
// one path and the opt-out silently stops holding on that path only, which is
// exactly what happened here: `POST /annotations` inherited and the importer did
// not, so re-importing a clippings file put an excluded manual back in the deck.
//
// READ ONCE PER BATCH rather than as the correlated subquery `POST /annotations`
// uses. Inside one transaction the parent's flag cannot move, so the two are
// equivalent — and a clippings file is thousands of rows, which would be thousands
// of lookups of a value that cannot have changed between them.
//
// A missing parent reads as included rather than failing the import. It cannot
// happen (the caller resolved the work first) and refusing an import over it would
// trade a whole file for a flag.
func workExclusion(tx *sql.Tx, table string, id int64) (int, error) {
	var excluded int
	err := tx.QueryRow(`SELECT COALESCE(review_excluded, 0) FROM `+table+` WHERE id = ?`, id).Scan(&excluded)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return excluded, err
}

// writeBookAnnotations inserts/enriches a batch of parsed annotations against a
// book that has ALREADY been resolved, inside the caller's transaction. It
// returns how many were added and how many enriched an existing copy. A bad
// annotation colour comes back as an importClientError (a 400).
//
// The split from upsertImportBook (which resolves the target) is what lets the
// staging queue hand this loop a book the *user* picked — retargeting a
// misdetected file — while the dedupe, fill-empty enrichment and tag-union rules
// below stay the single implementation for every path into the library.
func writeBookAnnotations(tx *sql.Tx, uid int64, source string, bookID int64, anns []importer.Annotation) (int, int, error) {
	added, enriched := 0, 0
	// The work's quiz opt-out, inherited by every row this loop writes. See
	// workExclusion: without it, excluding a book and then importing into it put
	// the new highlights straight back in the deck.
	excluded, err := workExclusion(tx, "books", bookID)
	if err != nil {
		return 0, 0, err
	}
	// One id reservation for the batch rather than one per quote: a clippings file
	// is thousands of rows, and ids skipped by the dedupe below cost nothing (see
	// idBlock in id_floor.go).
	ids := newIDBlock(tx, "annotations", len(anns))
	for _, a := range anns {
		color := a.Color
		if color == "" {
			color = "yellow" // Kindle sources carry no colour (PLAN §3)
		}
		if !validColor(color) {
			return 0, 0, importClientError{fmt.Sprintf("invalid color %q", a.Color)}
		}
		text := a.Quote
		if text == "" {
			text = a.Note
		}
		annID, err := ids.take()
		if err != nil {
			return 0, 0, err
		}
		ins, err := tx.Exec(`
			INSERT OR IGNORE INTO annotations
			  (id, book_id, quote, note, translation, color, chapter, chapter_no, location, character, favorite,
			   source, dedupe_hash, noted_at, review_excluded)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			annID, bookID, nullable(a.Quote), nullable(a.Note),
			// 0051, and a plain string for the reason `character` below is. Out of the
			// dedupe hash as well, and for a sharper reason: whether somebody has
			// translated a passage cannot decide whether it is the same passage.
			a.Translation, color,
			nullable(a.Chapter), nullableFloat(a.ChapterNo), nullable(a.Location),
			// 0047, and a plain string: `character` is NOT NULL DEFAULT '' here, so
			// nullable("") would send the NULL the column refuses. It stays OUT of the
			// dedupe hash — a locator does not discriminate for a book (store.DedupeHash),
			// so the same passage saved once bare and once with a speaker is one highlight
			// that the enrichment below fills in.
			a.Character, a.Favorite,
			source, store.DedupeHash(text), nullable(a.NotedAt), excluded)
		if err != nil {
			return 0, 0, err
		}
		if n, _ := ins.RowsAffected(); n == 0 {
			// Duplicate (same dedupe hash): enrich instead of discarding — the
			// incoming copy donates whatever the existing row lacks (PLAN §5).
			// Fill-empty-only, so user edits and earlier imports always win:
			// chapter/location/note when NULL, color when still the yellow
			// default, favorite only upward; tags union below. updated_at bumps
			// only when something changed (the WHERE guard also keeps no-op
			// re-imports write-free, PLAN §8).
			upd, err := tx.Exec(`
				UPDATE annotations SET
				  chapter    = COALESCE(chapter, ?),
				  chapter_no = COALESCE(chapter_no, ?),
				  location   = COALESCE(location, ?),
				  note       = COALESCE(note, ?),
				  noted_at   = COALESCE(noted_at, ?),
				  character  = CASE WHEN character = '' THEN ? ELSE character END,
				  translation = CASE WHEN translation = '' THEN ? ELSE translation END,
				  color      = CASE WHEN color = 'yellow' AND ? <> 'yellow' THEN ? ELSE color END,
				  favorite   = MAX(favorite, ?),
				  updated_at = datetime('now')
				WHERE book_id = ? AND dedupe_hash = ?
				  AND (   (chapter IS NULL AND ? IS NOT NULL)
				       OR (chapter_no IS NULL AND ? IS NOT NULL)
				       OR (location IS NULL AND ? IS NOT NULL)
				       OR (note IS NULL AND ? IS NOT NULL)
				       OR (noted_at IS NULL AND ? IS NOT NULL)
				       OR (character = '' AND ? <> '')
				       OR (translation = '' AND ? <> '')
				       OR (color = 'yellow' AND ? <> 'yellow')
				       OR (favorite = 0 AND ?))`,
				nullable(a.Chapter), nullableFloat(a.ChapterNo), nullable(a.Location), nullable(a.Note), nullable(a.NotedAt),
				// CASE WHEN rather than COALESCE, and `<> ''` rather than IS NOT NULL in
				// the guard: on a NOT NULL DEFAULT '' column COALESCE('', x) is '' and
				// `'' IS NOT NULL` is true, so the obvious spelling of both would donate
				// nothing while reporting an enrichment. See enrichStagedQuote.
				a.Character, a.Translation,
				color, color, a.Favorite,
				bookID, store.DedupeHash(text),
				nullable(a.Chapter), nullableFloat(a.ChapterNo), nullable(a.Location), nullable(a.Note), nullable(a.NotedAt),
				a.Character, a.Translation,
				color, a.Favorite)
			if err != nil {
				return 0, 0, err
			}
			if n, _ := upd.RowsAffected(); n > 0 {
				enriched++
			}
			if len(a.Tags) > 0 {
				// The row that holds the slot, which is NOT the id reserved above:
				// this insert was ignored, so that id belongs to nothing.
				var existingID int64
				if err := tx.QueryRow(`SELECT id FROM annotations WHERE book_id = ? AND dedupe_hash = ?`,
					bookID, store.DedupeHash(text)).Scan(&existingID); err == nil {
					if err := addTags(tx, "annotation", uid, existingID, a.Tags); err != nil {
						return 0, 0, err
					}
				}
			}
			continue
		}
		added++
		if len(a.Tags) > 0 {
			if err := setTags(tx, "annotation", uid, annID, a.Tags); err != nil {
				return 0, 0, err
			}
		}
	}
	return added, enriched, nil
}

// findImportBook resolves a parsed book to a row the user already owns, without
// writing anything. Identity falls through normalized ISBN → ASIN →
// lower(title)+lower(author): the same book arrives with an ISBN from one tool
// and bare title/author from another, and both must land in one row for
// cross-source quote dedupe to work (PLAN §3). Returns 0 when nothing matches.
//
// Read-only so the staging queue can ask "where would this land?" — that answer
// drives the look-alike warning shown before anything is written — while
// upsertImportBook keeps using it for the resolution that does write.
func findImportBook(tx *sql.Tx, uid int64, b importer.Book) (int64, error) {
	isbn := metadata.NormalizeISBN(b.ISBN) // "" when absent or implausible
	// Try each identity in turn; the caller backfills the row's missing
	// identifiers on a match so the next import (which may carry only one of
	// them, with a differently-formatted title) still matches on the cheap key.
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
		var id int64
		err := tx.QueryRow(`SELECT id FROM books WHERE user_id = ? AND `+q.cond,
			append([]any{uid}, q.args...)...).Scan(&id)
		switch {
		case errors.Is(err, sql.ErrNoRows):
			continue
		case err != nil:
			return 0, err
		}
		return id, nil
	}
	return 0, nil
}

// upsertImportBook finds or creates the import target, returning the row id and
// whether it had to be created.
func upsertImportBook(tx *sql.Tx, uid int64, b importer.Book) (int64, bool, error) {
	isbn := metadata.NormalizeISBN(b.ISBN)
	id, err := findImportBook(tx, uid, b)
	if err != nil {
		return 0, false, err
	}
	if id != 0 {
		// Backfill every identifier/field the matched row is missing from this
		// import (fill-empty-only, so existing data always wins). OR IGNORE skips
		// rather than fails if another row already owns this isbn/asin (partial
		// unique indexes on (user_id, isbn/asin)).
		if _, err := tx.Exec(
			// translator/editor are NOT NULL DEFAULT '' (0034), so COALESCE cannot
			// express fill-empty-only for them — COALESCE('', x) is ''. NULLIF turns
			// the stored empty string back into the NULL that COALESCE understands,
			// which keeps the rule identical to the four columns above it: what is
			// already there always wins, and an import can only fill a blank.
			`UPDATE OR IGNORE books SET isbn = COALESCE(isbn, ?), asin = COALESCE(asin, ?),
			                            author = COALESCE(author, ?), series = COALESCE(series, ?),
			                            series_index = COALESCE(series_index, ?),
			                            translator = COALESCE(NULLIF(translator, ''), ?),
			                            editor = COALESCE(NULLIF(editor, ''), ?),
			                            language = COALESCE(NULLIF(language, ''), ?),
			                            orig_language = COALESCE(NULLIF(orig_language, ''), ?)
			                        WHERE id = ?`,
			nullable(isbn), nullable(b.ASIN), nullable(b.Author),
			nullable(b.Series), nullableFloat(b.SeriesIndex),
			// The two languages (0047) join the two credits, in the same NULLIF form and
			// under the same rule: what is already on the row wins, and an import can
			// only fill a blank. A reader who corrected a bad `orig_language` by hand
			// must not have the old file's value put back on the next re-import.
			b.Translator, b.Editor, b.Language, b.OrigLanguage, id); err != nil {
			return 0, false, err
		}
		// Shelf state is its own backfill (fill-empty-only, never clearing) so a
		// re-import of an older export cannot un-mark a book you are reading now.
		if err := applyImportedShelf(tx, "book", "", uid, id, bookShelf(b)); err != nil {
			return 0, false, err
		}
		return id, false, nil
	}
	// Allocated, not left to SQLite — see id_floor.go. An import creates works and
	// quotes like any other path, so it reserves ids like any other path.
	id, err = nextID(tx, "books")
	if err != nil {
		return 0, false, err
	}
	if _, err := tx.Exec(
		`INSERT INTO books (id, updated_at, user_id, title, author, translator, editor,
		                    language, orig_language, isbn, asin, series, series_index)
		 VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, uid, b.Title, nullable(b.Author), b.Translator, b.Editor,
		b.Language, b.OrigLanguage, // plain strings: NOT NULL DEFAULT '' (0047)
		nullable(isbn), nullable(b.ASIN),
		nullable(b.Series), nullableFloat(b.SeriesIndex)); err != nil {
		return 0, false, err
	}
	if err := applyImportedShelf(tx, "book", "", uid, id, bookShelf(b)); err != nil {
		return 0, false, err
	}
	return id, true, nil
}
