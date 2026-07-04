package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
)

// statsTop is a "most annotated/quoted" superlative (null when the user has
// no annotations/dialogues yet).
type statsTop struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
	Count int    `json:"count"`
}

// handleStats implements GET /stats (§10): user-scoped library counts plus
// three superlatives for the Settings page tiles. A fixed handful of
// aggregate queries — nothing per-row.
func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)

	var books, annotations, movies, dialogues, tags, favorites int
	err := s.Store.DB.QueryRow(`
		SELECT
		  (SELECT count(*) FROM books WHERE user_id = ?),
		  (SELECT count(*) FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?),
		  (SELECT count(*) FROM movies WHERE user_id = ?),
		  (SELECT count(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?),
		  (SELECT count(*) FROM tags WHERE user_id = ?),
		  (SELECT count(*) FROM annotations a JOIN books b ON b.id = a.book_id
		     WHERE b.user_id = ? AND a.favorite = 1)
		+ (SELECT count(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		     WHERE m.user_id = ? AND d.favorite = 1)`,
		uid, uid, uid, uid, uid, uid, uid).
		Scan(&books, &annotations, &movies, &dialogues, &tags, &favorites)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}

	topOf := func(query string) (*statsTop, error) {
		var t statsTop
		err := s.Store.DB.QueryRow(query, uid).Scan(&t.ID, &t.Title, &t.Count)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		return &t, nil
	}
	mostAnnotated, err := topOf(`
		SELECT b.id, b.title, count(*) FROM annotations a JOIN books b ON b.id = a.book_id
		WHERE b.user_id = ? GROUP BY b.id ORDER BY count(*) DESC, b.id LIMIT 1`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	mostQuoted, err := topOf(`
		SELECT m.id, m.title, count(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		WHERE m.user_id = ? GROUP BY m.id ORDER BY count(*) DESC, m.id LIMIT 1`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}

	// Busiest month: annotations + dialogues bucketed by created_at month
	// (datetime('now') stores "YYYY-MM-DD …", so the bucket is substr 1–7).
	// Ties break to the most recent month.
	type monthTop struct {
		Month string `json:"month"`
		Count int    `json:"count"`
	}
	var busiest *monthTop
	{
		var m monthTop
		err := s.Store.DB.QueryRow(`
			SELECT substr(created_at, 1, 7) AS month, count(*)
			FROM (SELECT a.created_at FROM annotations a JOIN books b ON b.id = a.book_id
			        WHERE b.user_id = ?
			      UNION ALL
			      SELECT d.created_at FROM dialogues d JOIN movies m ON m.id = d.movie_id
			        WHERE m.user_id = ?)
			GROUP BY month ORDER BY count(*) DESC, month DESC LIMIT 1`, uid, uid).
			Scan(&m.Month, &m.Count)
		switch {
		case errors.Is(err, sql.ErrNoRows):
			// leave busiest nil -> JSON null
		case err != nil:
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		default:
			busiest = &m
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"books":          books,
		"annotations":    annotations,
		"movies":         movies,
		"dialogues":      dialogues,
		"tags":           tags,
		"favorites":      favorites,
		"most_annotated": mostAnnotated,
		"most_quoted":    mostQuoted,
		"busiest_month":  busiest,
	})
}
