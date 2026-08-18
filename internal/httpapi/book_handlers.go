package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

type bookReq struct {
	Title  string `json:"title"`
	Author string `json:"author"`
	// The other two people a book is by (0034). Verbatim credit strings like
	// `author`, so "Richard Pevear, Larissa Volokhonsky" splits into two people
	// through the same separator preference the author line uses.
	Translator     string   `json:"translator"`
	Editor         string   `json:"editor"`
	ISBN           string   `json:"isbn"`
	ASIN           string   `json:"asin"`
	Description    string   `json:"description"`
	PublishedYear  int      `json:"published_year"`
	PublishedCirca bool     `json:"published_circa"`
	Genres         []string `json:"genres"`
	Series         string   `json:"series"`
	SeriesIndex    float64  `json:"series_index"`
	Favorite       bool     `json:"favorite"`
	CoverURL       string   `json:"cover_url"`
	ClearCover     bool     `json:"clear_cover"` // update: drop the current cover
	Source         string   `json:"source"`
	SourceID       string   `json:"source_id"`
	// Both provider ids, for a candidate assembled from both of them. Source and
	// SourceID still carry the primary, so a client that sends only those keeps
	// working exactly as before.
	GoogleID      string `json:"google_id"`
	OpenLibraryID string `json:"openlibrary_id"`
}

// validate trims the shared create/update fields and normalizes the ISBN
// (PLAN §3: everything stored as ISBN-13). Returns an error message, "" if ok.
func (b *bookReq) validate() string {
	b.Title = strings.TrimSpace(b.Title)
	b.Author = strings.TrimSpace(b.Author)
	b.Translator = strings.TrimSpace(b.Translator)
	b.Editor = strings.TrimSpace(b.Editor)
	b.ASIN = strings.TrimSpace(b.ASIN)
	b.Description = strings.TrimSpace(b.Description)
	b.Series = strings.TrimSpace(b.Series)
	if b.Title == "" {
		return "title is required"
	}
	if raw := strings.TrimSpace(b.ISBN); raw == "" {
		b.ISBN = ""
	} else if why := metadata.ISBNProblem(raw); why != "" {
		// The reason, not "invalid isbn". A refusal that does not say which of four
		// mistakes you made is a refusal you argue with — and the commonest of the
		// four, a wrong number of digits, was completely invisible.
		return why
	} else {
		b.ISBN = metadata.NormalizeISBN(raw)
	}
	if !validYear(b.PublishedYear) {
		return "published_year must be between 4000 BCE and 3000 CE"
	}
	return ""
}

// bookDetail is the single-book response shape (POST/GET/PUT /books).
//
// status / progress / reads are read-only here: they are owned by
// PUT /books/:id/status, which is the only path that keeps the status and the
// read log consistent with each other. A full-state PUT that carried them would
// let an ordinary Edit-form save silently rewrite reading history.
type bookDetail struct {
	ID     int64  `json:"id"`
	Title  string `json:"title"`
	Author string `json:"author"`
	// Present HERE and absent from the list row on purpose — see the list
	// handler's own note. This is the shape the work's own page reads.
	Translator     string    `json:"translator"`
	Editor         string    `json:"editor"`
	ISBN           string    `json:"isbn"`
	ASIN           string    `json:"asin"`
	Description    string    `json:"description"`
	PublishedYear  int       `json:"published_year"`
	PublishedCirca bool      `json:"published_circa"`
	CoverPath      string    `json:"cover_path"`
	Genres         []string  `json:"genres"`
	Series         string    `json:"series"`
	SeriesIndex    float64   `json:"series_index"`
	Favorite       bool      `json:"favorite"`
	Status         string    `json:"status"`   // "" | reading | paused | abandoned | completed
	Progress       int       `json:"progress"` // 0-100, derived from the position when one is set
	position                 // pos_unit ('' | page) · pos · pos_total
	Reads          []readRow `json:"reads"` // oldest first
	CreatedAt      string    `json:"created_at"`
}

func (s *Server) fetchBook(uid, id int64) (*bookDetail, error) {
	var b bookDetail
	err := s.Store.DB.QueryRow(`
		SELECT id, title, COALESCE(author, ''), translator, editor, COALESCE(isbn, ''), COALESCE(asin, ''),
		       COALESCE(description, ''), COALESCE(published_year, 0), published_circa, COALESCE(cover_path, ''),
		       COALESCE(series, ''), COALESCE(series_index, 0), favorite, status, progress,
		       pos_unit, pos, pos_total, created_at
		FROM books WHERE id = ? AND user_id = ?`, id, uid).
		Scan(&b.ID, &b.Title, &b.Author, &b.Translator, &b.Editor, &b.ISBN, &b.ASIN,
			&b.Description, &b.PublishedYear, &b.PublishedCirca, &b.CoverPath,
			&b.Series, &b.SeriesIndex, &b.Favorite, &b.Status, &b.Progress,
			&b.Unit, &b.Pos, &b.PosTotal, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	if b.Reads, err = loadReads(s.Store.DB, uid, "book", id); err != nil {
		return nil, err
	}
	b.Genres = []string{}
	rows, err := s.Store.DB.Query(`
		SELECT g.name FROM book_genres bg JOIN genres g ON g.id = bg.genre_id
		WHERE bg.book_id = ? ORDER BY g.name`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeBookRowScan, "[book] genre row scan failed: %v", err)
			continue
		}
		b.Genres = append(b.Genres, n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeBookRowScan, "[book] genre row iteration failed: %v", err)
	}
	return &b, nil
}

func (s *Server) handleCreateBook(w http.ResponseWriter, r *http.Request) {
	// The raw body is kept because source_metadata caches it verbatim for
	// API-sourced books (PLAN §6).
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxCRUDBody))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	var req bookReq
	if err := json.Unmarshal(raw, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}

	// Cover fetch runs before the write tx (it can take up to 10 s) and is
	// non-fatal: on failure the book is saved without a cover.
	var coverPath string
	if req.CoverURL != "" {
		if name, err := s.fetchImage(r.Context(), req.CoverURL, s.coversDir()); err != nil {
			olog.Warnf(olog.CodeBookCover, "[book] cover fetch failed: %v", err)
		} else {
			coverPath = name
		}
	}
	var sourceMeta, googleID, openlibraryID any
	if req.Source != "" {
		sourceMeta = string(raw)
	}
	switch req.Source {
	case "google":
		googleID = nullable(req.SourceID)
	case "openlibrary":
		openlibraryID = nullable(req.SourceID)
	}
	// A candidate assembled from both providers has two identities, and the
	// switch above can only record one of them. Keeping both is what lets
	// re-verify re-check either supplier later; pinning only the primary would
	// half-orphan a record the moment it was created.
	if req.GoogleID != "" {
		googleID = req.GoogleID
	}
	if req.OpenLibraryID != "" {
		openlibraryID = req.OpenLibraryID
	}

	uid := userID(r)
	olog.Tracef("[book] handleCreateBook uid=%v title=%q", uid, req.Title)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		s.removeCoverFile(coverPath)
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	// Allocated, not left to SQLite: a deleted book's id must never be reused
	// while its bin entry still holds it (id_floor.go).
	id, err := nextID(tx, "books")
	if err != nil {
		s.removeCoverFile(coverPath)
		internalError(w, r, "reserve book id", err)
		return
	}
	res, err := tx.Exec(`
		INSERT INTO books (id, updated_at, user_id, title, author, translator, editor, isbn, asin, cover_path,
		                   description, published_year, published_circa, google_id, openlibrary_id, source_metadata,
		                   series, series_index, favorite)
		VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
		id, uid, req.Title, nullable(req.Author), req.Translator, req.Editor, nullable(req.ISBN), nullable(req.ASIN),
		nullable(coverPath), nullable(req.Description), nullableInt(req.PublishedYear), req.PublishedCirca,
		googleID, openlibraryID, sourceMeta,
		nullable(req.Series), nullableFloat(req.SeriesIndex), req.Favorite)
	if err != nil {
		s.removeCoverFile(coverPath)
		internalError(w, r, "insert book", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 { // (user_id, isbn) or (user_id, asin) collision
		s.removeCoverFile(coverPath)
		writeErr(w, http.StatusConflict, "book already in your library")
		return
	}
	if err := setGenres(tx, "book", uid, id, req.Genres); err != nil {
		s.removeCoverFile(coverPath)
		internalError(w, r, "set genres", err)
		return
	}
	if err := tx.Commit(); err != nil {
		s.removeCoverFile(coverPath)
		internalError(w, r, "commit tx", err)
		return
	}
	b, err := s.fetchBook(uid, id)
	if err != nil {
		internalError(w, r, "reload book", err)
		return
	}
	writeJSON(w, http.StatusCreated, b)
}

func (s *Server) handleListBooks(w http.ResponseWriter, r *http.Request) {
	type item struct {
		ID             int64    `json:"id"`
		Title          string   `json:"title"`
		Author         string   `json:"author"`
		ISBN           string   `json:"isbn"`
		PublishedYear  int      `json:"published_year"`
		PublishedCirca bool     `json:"published_circa"`
		CoverPath      string   `json:"cover_path"`
		Genres         []string `json:"genres"`
		Series         string   `json:"series"`
		SeriesIndex    float64  `json:"series_index"`
		Favorite       bool     `json:"favorite"`
		Status         string   `json:"status"`     // "" | reading | paused | abandoned | completed
		Progress       int      `json:"progress"`   // 0-100; fills the status bar under the cover
		ReadCount      int      `json:"read_count"` // finished reads, for the "×2" chip
		// The most recent date this was read, for the "Last read" sort. Empty
		// when it has never been read or the reads carry no dates — which is a
		// real and common state, and the reason the sort has to say where those
		// go rather than leaving them wherever a comparator drops them.
		LastReadAt      string `json:"last_read_at"`
		AnnotationCount int    `json:"annotation_count"`
		// Books carry no tags of their own — annotation_tags joins ANNOTATIONS to
		// tags — so "tagged" on a book row means "has at least one tagged quote".
		// Counts rather than bools: same cost, and the list page can say how many.
		//
		// The "Wishlist" state needs nothing here either: annotation_count == 0 IS
		// the wishlist, so the board derives it from the count it already draws.
		TaggedCount int `json:"tagged_count"`
		NotedCount  int `json:"noted_count"`
		// 0033. Whether the quiz draws on this work's quotes at all. On the WORK
		// rather than only on its quotes, so a highlight added tomorrow inherits it.
		ReviewExcluded bool `json:"review_excluded"`
	}
	uid := userID(r)
	olog.Tracef("[book] handleListBooks uid=%v", uid)
	q := `
		SELECT b.id, b.title, COALESCE(b.author, ''), COALESCE(b.isbn, ''),
		       COALESCE(b.published_year, 0), b.published_circa, COALESCE(b.cover_path, ''),
		       COALESCE(b.series, ''), COALESCE(b.series_index, 0), b.favorite, b.status, b.progress,
		       (SELECT count(*) FROM annotations a WHERE a.book_id = b.id),
		       (SELECT count(*) FROM annotations a WHERE a.book_id = b.id
		          AND EXISTS (SELECT 1 FROM annotation_tags at WHERE at.annotation_id = a.id)),
		       (SELECT count(*) FROM annotations a WHERE a.book_id = b.id
		          AND a.note IS NOT NULL AND TRIM(a.note) <> ''),
		       b.review_excluded
		FROM books b WHERE b.user_id = ?
		ORDER BY b.created_at DESC, b.id DESC`
	args := []any{uid}
	// Optional paging for clients that mirror the library (mobile/); the SPA
	// sends neither parameter and still gets the whole list.
	if !applyPaging(w, r, &q, &args) {
		return
	}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		internalError(w, r, "list books", err)
		return
	}
	defer rows.Close()
	items := []item{}
	for rows.Next() {
		it := item{Genres: []string{}}
		if err := rows.Scan(&it.ID, &it.Title, &it.Author, &it.ISBN,
			&it.PublishedYear, &it.PublishedCirca, &it.CoverPath, &it.Series, &it.SeriesIndex,
			&it.Favorite, &it.Status, &it.Progress, &it.AnnotationCount, &it.TaggedCount, &it.NotedCount,
			&it.ReviewExcluded); err != nil {
			olog.Warnf(olog.CodeBookRowScan, "[book] list book row scan failed: %v", err)
			continue
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeBookRowScan, "[book] list book row iteration failed: %v", err)
	}
	byBook, err := s.genreNames(uid, "book")
	if err != nil {
		internalError(w, r, "list book genres", err)
		return
	}
	reads, err := s.readCounts(uid, "book")
	if err != nil {
		internalError(w, r, "list book read counts", err)
		return
	}
	lastRead, err := s.lastReadAt(uid, "book")
	if err != nil {
		internalError(w, r, "list book last read", err)
		return
	}
	for i := range items {
		if gs := byBook[items[i].ID]; gs != nil {
			items[i].Genres = gs
		}
		items[i].ReadCount = reads[items[i].ID]
		items[i].LastReadAt = lastRead[items[i].ID]
	}
	writeJSON(w, http.StatusOK, map[string]any{"books": items})
}

// genreNames maps owner id -> sorted genre names for all the user's books or
// movies in one query (avoids N+1 on list endpoints).
func (s *Server) genreNames(uid int64, kind string) (map[int64][]string, error) {
	rows, err := s.Store.DB.Query(`
		SELECT j.`+kind+`_id, g.name FROM `+kind+`_genres j
		JOIN genres g ON g.id = j.genre_id
		WHERE g.user_id = ? ORDER BY g.name`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64][]string{}
	for rows.Next() {
		var id int64
		var n string
		if err := rows.Scan(&id, &n); err != nil {
			olog.Warnf(olog.CodeBookRowScan, "[book] genre names row scan failed: %v", err)
			continue
		}
		out[id] = append(out[id], n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeBookRowScan, "[book] genre names row iteration failed: %v", err)
	}
	return out, nil
}

func (s *Server) handleGetBook(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid book id")
		return
	}
	olog.Tracef("[book] handleGetBook uid=%v id=%v", userID(r), id)
	b, err := s.fetchBook(userID(r), id)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "book not found")
	case err != nil:
		internalError(w, r, "get book", err)
	default:
		writeJSON(w, http.StatusOK, b)
	}
}

func (s *Server) handleUpdateBook(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid book id")
		return
	}
	var req bookReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[book] handleUpdateBook uid=%v id=%v", uid, id)
	// Surface an isbn/asin collision with another of the user's books as a 409
	// instead of a constraint error.
	var clash bool
	if err := s.Store.DB.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM books WHERE user_id = ? AND id <> ?
		              AND ((isbn IS NOT NULL AND isbn = ?) OR (asin IS NOT NULL AND asin = ?)))`,
		uid, id, req.ISBN, req.ASIN).Scan(&clash); err != nil {
		internalError(w, r, "check isbn clash", err)
		return
	}
	if clash {
		writeErr(w, http.StatusConflict, "book already in your library")
		return
	}

	// Cover: an explicit clear wins; otherwise a provided cover_url is fetched
	// (user-typed, so any host — private IPs are still blocked) and replaces the
	// stored file. With neither field the cover is left untouched. The old file
	// is deleted only after the row commits to the new one.
	var oldCover sql.NullString
	if err := s.Store.DB.QueryRow(
		`SELECT cover_path FROM books WHERE id = ? AND user_id = ?`, id, uid).Scan(&oldCover); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, http.StatusNotFound, "book not found")
		} else {
			internalError(w, r, "load book cover", err)
		}
		return
	}
	changeCover, newCover := false, ""
	if req.ClearCover {
		changeCover = true
	} else if req.CoverURL != "" {
		name, ferr := s.fetchUserImage(r.Context(), req.CoverURL, s.coversDir())
		if ferr != nil {
			olog.Errorf(olog.CodeBookCoverUpdate, "[book] update id=%d cover fetch failed: %v", id, ferr)
			writeErr(w, http.StatusBadGateway,
				"couldn't fetch that cover image — check the URL points directly at a JPG/PNG/WebP/GIF under 10 MB")
			return
		}
		newCover, changeCover = name, true
	}
	fail := func(code int, msg string) { // roll back the just-fetched file too
		s.removeCoverFile(newCover)
		writeErr(w, code, msg)
	}
	// failErr is fail for the 500 path: it logs the real cause (visible in the
	// server / docker logs) instead of swallowing it behind a bare "internal
	// error", so a save that fails is diagnosable.
	failErr := func(context string, err error) {
		s.removeCoverFile(newCover)
		internalError(w, r, context, err)
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		failErr("update book", err)
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`
		UPDATE books SET title = ?, author = ?, translator = ?, editor = ?, isbn = ?, asin = ?,
		                 description = ?, published_year = ?, published_circa = ?,
		                 series = ?, series_index = ?, favorite = ?, updated_at = datetime('now')
		WHERE id = ? AND user_id = ?`,
		req.Title, nullable(req.Author), req.Translator, req.Editor, nullable(req.ISBN), nullable(req.ASIN),
		nullable(req.Description), nullableInt(req.PublishedYear), req.PublishedCirca,
		nullable(req.Series), nullableFloat(req.SeriesIndex), req.Favorite, id, uid)
	if err != nil {
		failErr("update book", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fail(http.StatusNotFound, "book not found")
		return
	}
	if changeCover {
		if _, err := tx.Exec(`UPDATE books SET cover_path = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
			nullable(newCover), id, uid); err != nil {
			failErr("update book", err)
			return
		}
	}
	if err := setGenres(tx, "book", uid, id, req.Genres); err != nil {
		failErr("update book", err)
		return
	}
	// Adopting a looked-up candidate links the book to its source, so the
	// "no source" gap actually clears (the create path does this; update didn't).
	switch req.Source {
	case "google":
		if req.SourceID != "" {
			if _, err := tx.Exec(`UPDATE books SET google_id = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`, req.SourceID, id, uid); err != nil {
				failErr("update book", err)
				return
			}
		}
	case "openlibrary":
		if req.SourceID != "" {
			if _, err := tx.Exec(`UPDATE books SET openlibrary_id = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`, req.SourceID, id, uid); err != nil {
				failErr("update book", err)
				return
			}
		}
	}
	if err := tx.Commit(); err != nil {
		failErr("update book", err)
		return
	}
	if changeCover && oldCover.String != newCover {
		s.removeCoverFile(oldCover.String) // best-effort; new cover is committed
	}
	s.gcOrphanPeople(uid, "author") // a renamed author's stale metadata shouldn't linger
	b, err := s.fetchBook(uid, id)
	if err != nil {
		internalError(w, r, "update book: reload", err)
		return
	}
	writeJSON(w, http.StatusOK, b)
}

// handleDeleteBook bins the book and everything under it — its quotes, their tag
// joins, their review schedule, its genre joins and its read log — then deletes it
// (see trash.go). The cover is PARKED rather than removed, so a restore brings the
// picture back too.
//
// Annotations still cascade with the book and the genres they held are still
// garbage-collected; both happen after the snapshot, so the restore can put the
// genre rows back by name.
func (s *Server) handleDeleteBook(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	s.binDelete(w, r, "book", "book not found",
		func(tx *sql.Tx) error { return gcGenres(tx, uid) },
		func() { s.gcOrphanPeople(uid, "author") }) // last book by an author gone → drop its metadata
}
