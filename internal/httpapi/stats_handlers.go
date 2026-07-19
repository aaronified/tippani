package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"time"

	"tippani/internal/olog"
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
	olog.Tracef("[stats] handleStats uid=%v", uid)

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
		internalError(w, r, "scan stats", err)
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
		internalError(w, r, "load most annotated", err)
		return
	}
	mostQuoted, err := topOf(`
		SELECT m.id, m.title, count(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		WHERE m.user_id = ? GROUP BY m.id ORDER BY count(*) DESC, m.id LIMIT 1`)
	if err != nil {
		internalError(w, r, "load most quoted", err)
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
			internalError(w, r, "scan busiest month", err)
			return
		default:
			busiest = &m
		}
	}

	// Monthly activity for the last 12 calendar months (annotations + dialogues
	// bucketed by created_at month), oldest first, zero-filled for quiet months —
	// drives the Stats page activity chart. Counts are read once and bucketed in Go.
	const activityMonths = 12
	type monthCount struct {
		Month string `json:"month"`
		Count int    `json:"count"`
	}
	monthly := make([]monthCount, activityMonths)
	first := time.Now().UTC()
	first = time.Date(first.Year(), first.Month(), 1, 0, 0, 0, 0, time.UTC)
	byMonth := map[string]int{}
	for i := 0; i < activityMonths; i++ {
		monthly[i] = monthCount{Month: first.AddDate(0, -(activityMonths-1-i), 0).Format("2006-01")}
	}
	arows, err := s.Store.DB.Query(`
		SELECT substr(created_at, 1, 7) AS month, count(*)
		FROM (SELECT a.created_at FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?
		      UNION ALL
		      SELECT d.created_at FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?)
		GROUP BY month`, uid, uid)
	if err != nil {
		internalError(w, r, "query monthly activity", err)
		return
	}
	for arows.Next() {
		var m string
		var n int
		if err := arows.Scan(&m, &n); err != nil {
			olog.Warnf(olog.CodeStatsRowScan, "[stats] monthly activity row scan failed: %v", err)
			continue
		}
		byMonth[m] = n
	}
	if err := arows.Err(); err != nil {
		olog.Warnf(olog.CodeStatsRowScan, "[stats] monthly activity row iteration failed: %v", err)
	}
	arows.Close()
	for i := range monthly {
		monthly[i].Count = byMonth[monthly[i].Month]
	}

	// ---- richer insights for the dedicated Stats page ----

	// Breadth: distinct author lines, and genres actually attached to something.
	var authors, genres int
	if err := s.Store.DB.QueryRow(
		`SELECT count(*) FROM (SELECT DISTINCT author FROM books
		   WHERE user_id = ? AND author IS NOT NULL AND trim(author) <> '')`, uid).Scan(&authors); err != nil {
		internalError(w, r, "count authors", err)
		return
	}
	if err := s.Store.DB.QueryRow(`
		SELECT count(*) FROM (
		  SELECT bg.genre_id AS gid FROM book_genres bg JOIN books b ON b.id = bg.book_id WHERE b.user_id = ?
		  UNION
		  SELECT mg.genre_id FROM movie_genres mg JOIN movies m ON m.id = mg.movie_id WHERE m.user_id = ?
		)`, uid, uid).Scan(&genres); err != nil {
		internalError(w, r, "count genres", err)
		return
	}

	// Highlight-colour breakdown of book annotations (the four fixed colours).
	colors := map[string]int{"yellow": 0, "blue": 0, "pink": 0, "orange": 0}
	if crows, err := s.Store.DB.Query(`
		SELECT a.color, count(*) FROM annotations a JOIN books b ON b.id = a.book_id
		WHERE b.user_id = ? GROUP BY a.color`, uid); err != nil {
		internalError(w, r, "query colours", err)
		return
	} else {
		for crows.Next() {
			var c string
			var n int
			if err := crows.Scan(&c, &n); err != nil {
				olog.Warnf(olog.CodeStatsRowScan, "[stats] colour row scan failed: %v", err)
				continue
			}
			if _, ok := colors[c]; ok {
				colors[c] = n
			}
		}
		crows.Close()
	}

	// Leaderboards: top authors by book count, top tags by usage.
	type nameCount struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}
	listOf := func(query string, args ...any) ([]nameCount, error) {
		rows, err := s.Store.DB.Query(query, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []nameCount{}
		for rows.Next() {
			var nc nameCount
			if err := rows.Scan(&nc.Name, &nc.Count); err != nil {
				olog.Warnf(olog.CodeStatsRowScan, "[stats] top-list row scan failed: %v", err)
				continue
			}
			out = append(out, nc)
		}
		return out, rows.Err()
	}
	topAuthors, err := listOf(`
		SELECT author, count(*) AS c FROM books
		WHERE user_id = ? AND author IS NOT NULL AND trim(author) <> ''
		GROUP BY author ORDER BY c DESC, author LIMIT 5`, uid)
	if err != nil {
		internalError(w, r, "top authors", err)
		return
	}
	topTags, err := listOf(`
		SELECT t.name, count(*) AS c FROM tags t JOIN (
		  SELECT at.tag_id FROM annotation_tags at
		    JOIN annotations a ON a.id = at.annotation_id JOIN books b ON b.id = a.book_id WHERE b.user_id = ?
		  UNION ALL
		  SELECT dt.tag_id FROM dialogue_tags dt
		    JOIN dialogues d ON d.id = dt.dialogue_id JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?
		) u ON u.tag_id = t.id
		GROUP BY t.id ORDER BY c DESC, t.name LIMIT 5`, uid, uid)
	if err != nil {
		internalError(w, r, "top tags", err)
		return
	}

	// "Collecting since": the earliest saved quote/dialogue (date only, or null).
	var firstSaved *string
	{
		var fs sql.NullString
		err := s.Store.DB.QueryRow(`
			SELECT min(created_at) FROM (
			  SELECT a.created_at FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?
			  UNION ALL
			  SELECT d.created_at FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?)`,
			uid, uid).Scan(&fs)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			internalError(w, r, "first saved", err)
			return
		}
		if fs.Valid && len(fs.String) >= 10 {
			d := fs.String[:10] // YYYY-MM-DD
			firstSaved = &d
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"books":            books,
		"annotations":      annotations,
		"movies":           movies,
		"dialogues":        dialogues,
		"tags":             tags,
		"favorites":        favorites,
		"authors":          authors,
		"genres":           genres,
		"most_annotated":   mostAnnotated,
		"most_quoted":      mostQuoted,
		"busiest_month":    busiest,
		"monthly_activity": monthly,
		"colors":           colors,
		"top_authors":      topAuthors,
		"top_tags":         topTags,
		"first_saved":      firstSaved,
	})
}
