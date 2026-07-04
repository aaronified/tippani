package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"tippani/internal/metadata"
)

type bookReq struct {
	Title         string   `json:"title"`
	Author        string   `json:"author"`
	ISBN          string   `json:"isbn"`
	ASIN          string   `json:"asin"`
	Description   string   `json:"description"`
	PublishedYear int      `json:"published_year"`
	Genres        []string `json:"genres"`
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
	if b.Title == "" {
		return "title is required"
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
	CreatedAt     string   `json:"created_at"`
}

func (s *Server) fetchBook(uid, id int64) (*bookDetail, error) {
	var b bookDetail
	err := s.Store.DB.QueryRow(`
		SELECT id, title, COALESCE(author, ''), COALESCE(isbn, ''), COALESCE(asin, ''),
		       COALESCE(description, ''), COALESCE(published_year, 0), COALESCE(cover_path, ''), created_at
		FROM books WHERE id = ? AND user_id = ?`, id, uid).
		Scan(&b.ID, &b.Title, &b.Author, &b.ISBN, &b.ASIN,
			&b.Description, &b.PublishedYear, &b.CoverPath, &b.CreatedAt)
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
		if err := rows.Scan(&n); err == nil {
			b.Genres = append(b.Genres, n)
		}
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
		if name, err := s.fetchImage(r.Context(), req.CoverURL, s.coversDir()); err == nil {
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
	tx, err := s.Store.DB.Begin()
	if err != nil {
		s.removeCoverFile(coverPath)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`
		INSERT INTO books (user_id, title, author, isbn, asin, cover_path,
		                   description, published_year, google_id, openlibrary_id, source_metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
		uid, req.Title, nullable(req.Author), nullable(req.ISBN), nullable(req.ASIN),
		nullable(coverPath), nullable(req.Description), nullableInt(req.PublishedYear),
		googleID, openlibraryID, sourceMeta)
	if err != nil {
		s.removeCoverFile(coverPath)
		writeErr(w, http.StatusInternalServerError, "internal error")
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
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		s.removeCoverFile(coverPath)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	b, err := s.fetchBook(uid, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
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
		AnnotationCount int      `json:"annotation_count"`
	}
	uid := userID(r)
	rows, err := s.Store.DB.Query(`
		SELECT b.id, b.title, COALESCE(b.author, ''), COALESCE(b.isbn, ''),
		       COALESCE(b.published_year, 0), COALESCE(b.cover_path, ''),
		       (SELECT count(*) FROM annotations a WHERE a.book_id = b.id)
		FROM books b WHERE b.user_id = ?
		ORDER BY b.created_at DESC, b.id DESC`, uid)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()
	items := []item{}
	for rows.Next() {
		it := item{Genres: []string{}}
		if err := rows.Scan(&it.ID, &it.Title, &it.Author, &it.ISBN,
			&it.PublishedYear, &it.CoverPath, &it.AnnotationCount); err == nil {
			items = append(items, it)
		}
	}
	byBook, err := s.genreNames(uid, "book")
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
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
		if err := rows.Scan(&id, &n); err == nil {
			out[id] = append(out[id], n)
		}
	}
	return out, nil
}

func (s *Server) handleGetBook(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid book id")
		return
	}
	b, err := s.fetchBook(userID(r), id)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "book not found")
	case err != nil:
		writeErr(w, http.StatusInternalServerError, "internal error")
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
	// Surface an isbn/asin collision with another of the user's books as a 409
	// instead of a constraint error.
	var clash bool
	if err := s.Store.DB.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM books WHERE user_id = ? AND id <> ?
		              AND ((isbn IS NOT NULL AND isbn = ?) OR (asin IS NOT NULL AND asin = ?)))`,
		uid, id, req.ISBN, req.ASIN).Scan(&clash); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
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
			writeErr(w, http.StatusInternalServerError, "internal error")
		}
		return
	}
	changeCover, newCover := false, ""
	if req.ClearCover {
		changeCover = true
	} else if req.CoverURL != "" {
		name, ferr := s.fetchUserImage(r.Context(), req.CoverURL, s.coversDir())
		if ferr != nil {
			writeErr(w, http.StatusBadGateway,
				"couldn't fetch that cover image — check the URL points directly at a JPG/PNG/WebP/GIF under 2 MB")
			return
		}
		newCover, changeCover = name, true
	}
	fail := func(code int, msg string) { // roll back the just-fetched file too
		s.removeCoverFile(newCover)
		writeErr(w, code, msg)
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		fail(http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`
		UPDATE books SET title = ?, author = ?, isbn = ?, asin = ?, description = ?, published_year = ?
		WHERE id = ? AND user_id = ?`,
		req.Title, nullable(req.Author), nullable(req.ISBN), nullable(req.ASIN),
		nullable(req.Description), nullableInt(req.PublishedYear), id, uid)
	if err != nil {
		fail(http.StatusInternalServerError, "internal error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fail(http.StatusNotFound, "book not found")
		return
	}
	if changeCover {
		if _, err := tx.Exec(`UPDATE books SET cover_path = ? WHERE id = ? AND user_id = ?`,
			nullable(newCover), id, uid); err != nil {
			fail(http.StatusInternalServerError, "internal error")
			return
		}
	}
	if err := setGenres(tx, "book", uid, id, req.Genres); err != nil {
		fail(http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		fail(http.StatusInternalServerError, "internal error")
		return
	}
	if changeCover && oldCover.String != newCover {
		s.removeCoverFile(oldCover.String) // best-effort; new cover is committed
	}
	b, err := s.fetchBook(uid, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
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
	var cover sql.NullString
	err := s.Store.DB.QueryRow(
		`SELECT cover_path FROM books WHERE id = ? AND user_id = ?`, id, uid).Scan(&cover)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "book not found")
		return
	case err != nil:
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	// Annotations cascade with the book; GC the genres they held. Tags persist
	// (managed vocabulary, §10) — only their join rows cascade away.
	if _, err := tx.Exec(`DELETE FROM books WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := gcGenres(tx, uid); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	s.removeCoverFile(cover.String) // best-effort
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
