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
	Title         string   `json:"title"`
	Author        string   `json:"author"`
	ISBN          string   `json:"isbn"`
	ASIN          string   `json:"asin"`
	Description   string   `json:"description"`
	PublishedYear int      `json:"published_year"`
	Genres        []string `json:"genres"`
	Series        string   `json:"series"`
	SeriesIndex   float64  `json:"series_index"`
	Favorite      bool     `json:"favorite"`
	Rating        int      `json:"rating"` // 0 = unrated, else 1-5 (PLAN §3)
	CoverURL      string   `json:"cover_url"`
	ClearCover    bool     `json:"clear_cover"` // update: drop the current cover
	Source        string   `json:"source"`
	SourceID      string   `json:"source_id"`
}

// validate trims the shared create/update fields and normalizes the ISBN
// (PLAN §3: everything stored as ISBN-13). Returns an error message, "" if ok.
func (b *bookReq) validate() string {
	b.Title = strings.TrimSpace(b.Title)
	b.Author = strings.TrimSpace(b.Author)
	b.ASIN = strings.TrimSpace(b.ASIN)
	b.Description = strings.TrimSpace(b.Description)
	b.Series = strings.TrimSpace(b.Series)
	if b.Title == "" {
		return "title is required"
	}
	if b.Rating < 0 || b.Rating > 5 {
		return "rating must be between 0 and 5"
	}
	if raw := strings.TrimSpace(b.ISBN); raw == "" {
		b.ISBN = ""
	} else if b.ISBN = metadata.NormalizeISBN(raw); b.ISBN == "" {
		return "invalid isbn"
	}
	if !validYear(b.PublishedYear) {
		return "published_year must be between 1000 and 3000"
	}
	return ""
}

// bookDetail is the single-book response shape (POST/GET/PUT /books).
type bookDetail struct {
	ID            int64    `json:"id"`
	Title         string   `json:"title"`
	Author        string   `json:"author"`
	ISBN          string   `json:"isbn"`
	ASIN          string   `json:"asin"`
	Description   string   `json:"description"`
	PublishedYear int      `json:"published_year"`
	CoverPath     string   `json:"cover_path"`
	Genres        []string `json:"genres"`
	Series        string   `json:"series"`
	SeriesIndex   float64  `json:"series_index"`
	Favorite      bool     `json:"favorite"`
	Rating        int      `json:"rating"`
	CreatedAt     string   `json:"created_at"`
}

func (s *Server) fetchBook(uid, id int64) (*bookDetail, error) {
	var b bookDetail
	err := s.Store.DB.QueryRow(`
		SELECT id, title, COALESCE(author, ''), COALESCE(isbn, ''), COALESCE(asin, ''),
		       COALESCE(description, ''), COALESCE(published_year, 0), COALESCE(cover_path, ''),
		       COALESCE(series, ''), COALESCE(series_index, 0), favorite, rating, created_at
		FROM books WHERE id = ? AND user_id = ?`, id, uid).
		Scan(&b.ID, &b.Title, &b.Author, &b.ISBN, &b.ASIN,
			&b.Description, &b.PublishedYear, &b.CoverPath,
			&b.Series, &b.SeriesIndex, &b.Favorite, &b.Rating, &b.CreatedAt)
	if err != nil {
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

	uid := userID(r)
	olog.Tracef("[book] handleCreateBook uid=%v title=%q", uid, req.Title)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		s.removeCoverFile(coverPath)
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`
		INSERT INTO books (user_id, title, author, isbn, asin, cover_path,
		                   description, published_year, google_id, openlibrary_id, source_metadata,
		                   series, series_index, favorite, rating)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
		uid, req.Title, nullable(req.Author), nullable(req.ISBN), nullable(req.ASIN),
		nullable(coverPath), nullable(req.Description), nullableInt(req.PublishedYear),
		googleID, openlibraryID, sourceMeta,
		nullable(req.Series), nullableFloat(req.SeriesIndex), req.Favorite, req.Rating)
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
	id, _ := res.LastInsertId()
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
		ID              int64    `json:"id"`
		Title           string   `json:"title"`
		Author          string   `json:"author"`
		ISBN            string   `json:"isbn"`
		PublishedYear   int      `json:"published_year"`
		CoverPath       string   `json:"cover_path"`
		Genres          []string `json:"genres"`
		Series          string   `json:"series"`
		SeriesIndex     float64  `json:"series_index"`
		Favorite        bool     `json:"favorite"`
		Rating          int      `json:"rating"`
		AnnotationCount int      `json:"annotation_count"`
	}
	uid := userID(r)
	olog.Tracef("[book] handleListBooks uid=%v", uid)
	rows, err := s.Store.DB.Query(`
		SELECT b.id, b.title, COALESCE(b.author, ''), COALESCE(b.isbn, ''),
		       COALESCE(b.published_year, 0), COALESCE(b.cover_path, ''),
		       COALESCE(b.series, ''), COALESCE(b.series_index, 0), b.favorite, b.rating,
		       (SELECT count(*) FROM annotations a WHERE a.book_id = b.id)
		FROM books b WHERE b.user_id = ?
		ORDER BY b.created_at DESC, b.id DESC`, uid)
	if err != nil {
		internalError(w, r, "list books", err)
		return
	}
	defer rows.Close()
	items := []item{}
	for rows.Next() {
		it := item{Genres: []string{}}
		if err := rows.Scan(&it.ID, &it.Title, &it.Author, &it.ISBN,
			&it.PublishedYear, &it.CoverPath, &it.Series, &it.SeriesIndex,
			&it.Favorite, &it.Rating, &it.AnnotationCount); err != nil {
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
	for i := range items {
		if gs := byBook[items[i].ID]; gs != nil {
			items[i].Genres = gs
		}
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
		UPDATE books SET title = ?, author = ?, isbn = ?, asin = ?, description = ?, published_year = ?,
		                 series = ?, series_index = ?, favorite = ?, rating = ?
		WHERE id = ? AND user_id = ?`,
		req.Title, nullable(req.Author), nullable(req.ISBN), nullable(req.ASIN),
		nullable(req.Description), nullableInt(req.PublishedYear),
		nullable(req.Series), nullableFloat(req.SeriesIndex), req.Favorite, req.Rating, id, uid)
	if err != nil {
		failErr("update book", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fail(http.StatusNotFound, "book not found")
		return
	}
	if changeCover {
		if _, err := tx.Exec(`UPDATE books SET cover_path = ? WHERE id = ? AND user_id = ?`,
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
			if _, err := tx.Exec(`UPDATE books SET google_id = ? WHERE id = ? AND user_id = ?`, req.SourceID, id, uid); err != nil {
				failErr("update book", err)
				return
			}
		}
	case "openlibrary":
		if req.SourceID != "" {
			if _, err := tx.Exec(`UPDATE books SET openlibrary_id = ? WHERE id = ? AND user_id = ?`, req.SourceID, id, uid); err != nil {
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

func (s *Server) handleDeleteBook(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid book id")
		return
	}
	uid := userID(r)
	olog.Tracef("[book] handleDeleteBook uid=%v id=%v", uid, id)
	var cover sql.NullString
	err := s.Store.DB.QueryRow(
		`SELECT cover_path FROM books WHERE id = ? AND user_id = ?`, id, uid).Scan(&cover)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "book not found")
		return
	case err != nil:
		internalError(w, r, "load book cover", err)
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	// Annotations cascade with the book; GC the genres they held. Tags persist
	// (managed vocabulary, §10) — only their join rows cascade away.
	if _, err := tx.Exec(`DELETE FROM books WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		internalError(w, r, "delete book", err)
		return
	}
	if err := gcGenres(tx, uid); err != nil {
		internalError(w, r, "gc genres", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	s.removeCoverFile(cover.String) // best-effort
	s.gcOrphanPeople(uid, "author") // last book by an author gone → drop its metadata
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
