package httpapi

import (
	"net/http"
	"strconv"

	"tippani/internal/search"
)

type bookHit struct {
	ID     int64  `json:"id"`
	Title  string `json:"title"`
	Author string `json:"author"`
	Genres string `json:"genres"`
}

type annotationHit struct {
	ID        int64  `json:"id"`
	BookID    int64  `json:"book_id"`
	BookTitle string `json:"book_title"`
	Quote     string `json:"quote"`
	Note      string `json:"note"`
}

// handleSearch implements GET /search?q=&scope=all|books|annotations&limit=
// (PLAN §4). Structured filters (genre/author/tag/color) arrive with the
// annotations CRUD milestone.
func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		writeErr(w, http.StatusBadRequest, "q is required")
		return
	}
	scope := r.URL.Query().Get("scope")
	if scope == "" {
		scope = "all"
	}
	limit := 20
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= 100 {
		limit = n
	}

	match := search.Query(q) // never pass raw input to MATCH
	uid := userID(r)
	resp := struct {
		Books       []bookHit       `json:"books"`
		Annotations []annotationHit `json:"annotations"`
	}{Books: []bookHit{}, Annotations: []annotationHit{}}

	if scope == "all" || scope == "books" {
		rows, err := s.Store.DB.Query(`
			SELECT b.id, b.title, COALESCE(b.author, ''), b.genre_text
			FROM books_fts
			JOIN books b ON b.id = books_fts.rowid
			WHERE books_fts MATCH ? AND b.user_id = ?
			ORDER BY bm25(books_fts)
			LIMIT ?`, match, uid, limit)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "search failed")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var h bookHit
			if err := rows.Scan(&h.ID, &h.Title, &h.Author, &h.Genres); err == nil {
				resp.Books = append(resp.Books, h)
			}
		}
	}

	if scope == "all" || scope == "annotations" {
		rows, err := s.Store.DB.Query(`
			SELECT a.id, a.book_id, b.title, COALESCE(a.quote, ''), COALESCE(a.note, '')
			FROM annotations_fts
			JOIN annotations a ON a.id = annotations_fts.rowid
			JOIN books b ON b.id = a.book_id
			WHERE annotations_fts MATCH ? AND b.user_id = ?
			ORDER BY bm25(annotations_fts)
			LIMIT ?`, match, uid, limit)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "search failed")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var h annotationHit
			if err := rows.Scan(&h.ID, &h.BookID, &h.BookTitle, &h.Quote, &h.Note); err == nil {
				resp.Annotations = append(resp.Annotations, h)
			}
		}
	}

	writeJSON(w, http.StatusOK, resp)
}
