package httpapi

import (
	"net/http"
	"strconv"

	"tippani/internal/search"
)

type bookHit struct {
	ID     int64    `json:"id"`
	Title  string   `json:"title"`
	Author string   `json:"author"`
	Genres []string `json:"genres"` // array, matching GET /books (the UI maps over it)
}

type annotationHit struct {
	ID        int64  `json:"id"`
	BookID    int64  `json:"book_id"`
	BookTitle string `json:"book_title"`
	Quote     string `json:"quote"`
	Note      string `json:"note"`
}

type movieHit struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	Director    string `json:"director"`
	ReleaseYear int    `json:"release_year"`
}

type dialogueHit struct {
	ID         int64  `json:"id"`
	MovieID    int64  `json:"movie_id"`
	MovieTitle string `json:"movie_title"`
	Quote      string `json:"quote"`
	Character  string `json:"character"`
	Actor      string `json:"actor"`
	Timestamp  string `json:"timestamp"`
}

// handleSearch implements
// GET /search?q=&scope=all|books|annotations|movies|dialogues&limit=
// (PLAN §4). Structured filters (tag/color/book_id/movie_id) live on the
// list endpoints instead — not duplicated here (KISS).
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
		Movies      []movieHit      `json:"movies"`
		Dialogues   []dialogueHit   `json:"dialogues"`
	}{
		Books: []bookHit{}, Annotations: []annotationHit{},
		Movies: []movieHit{}, Dialogues: []dialogueHit{},
	}

	if scope == "all" || scope == "books" {
		rows, err := s.Store.DB.Query(`
			SELECT b.id, b.title, COALESCE(b.author, '')
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
			h := bookHit{Genres: []string{}}
			if err := rows.Scan(&h.ID, &h.Title, &h.Author); err == nil {
				resp.Books = append(resp.Books, h)
			}
		}
		rows.Close()
		// Genre names as an array (genre_text is space-joined and can't be split
		// safely — names contain spaces). Reuse the list-endpoint helper.
		if byBook, err := s.genreNames(uid, "book"); err == nil {
			for i := range resp.Books {
				if gs := byBook[resp.Books[i].ID]; gs != nil {
					resp.Books[i].Genres = gs
				}
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

	if scope == "all" || scope == "movies" {
		rows, err := s.Store.DB.Query(`
			SELECT m.id, m.title, COALESCE(m.director, ''), COALESCE(m.release_year, 0)
			FROM movies_fts
			JOIN movies m ON m.id = movies_fts.rowid
			WHERE movies_fts MATCH ? AND m.user_id = ?
			ORDER BY bm25(movies_fts)
			LIMIT ?`, match, uid, limit)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "search failed")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var h movieHit
			if err := rows.Scan(&h.ID, &h.Title, &h.Director, &h.ReleaseYear); err == nil {
				resp.Movies = append(resp.Movies, h)
			}
		}
	}

	if scope == "all" || scope == "dialogues" {
		rows, err := s.Store.DB.Query(`
			SELECT d.id, d.movie_id, m.title, d.quote,
			       COALESCE(d.character, ''), COALESCE(d.actor, ''), COALESCE(d.timestamp, '')
			FROM dialogues_fts
			JOIN dialogues d ON d.id = dialogues_fts.rowid
			JOIN movies m ON m.id = d.movie_id
			WHERE dialogues_fts MATCH ? AND m.user_id = ?
			ORDER BY bm25(dialogues_fts)
			LIMIT ?`, match, uid, limit)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "search failed")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var h dialogueHit
			if err := rows.Scan(&h.ID, &h.MovieID, &h.MovieTitle, &h.Quote,
				&h.Character, &h.Actor, &h.Timestamp); err == nil {
				resp.Dialogues = append(resp.Dialogues, h)
			}
		}
	}

	writeJSON(w, http.StatusOK, resp)
}
