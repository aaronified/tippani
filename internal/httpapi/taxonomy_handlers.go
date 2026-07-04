package httpapi

import (
	"database/sql"
	"net/http"
	"strings"
)

func (s *Server) handleListGenres(w http.ResponseWriter, r *http.Request) {
	s.listNames(w, r, "genres")
}

func (s *Server) handleListTags(w http.ResponseWriter, r *http.Request) {
	s.listNames(w, r, "tags")
}

// listNames returns the user's genre or tag vocabulary, sorted.
func (s *Server) listNames(w http.ResponseWriter, r *http.Request, table string) {
	rows, err := s.Store.DB.Query(
		`SELECT name FROM `+table+` WHERE user_id = ? ORDER BY name`, userID(r))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()
	names := []string{}
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil {
			names = append(names, n)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{table: names})
}

// cleanNames normalizes a genre/tag name list: trim, drop empties, cap 64
// runes, dedupe case-insensitively keeping the first spelling.
func cleanNames(names []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, n := range names {
		n = strings.TrimSpace(n)
		if r := []rune(n); len(r) > 64 {
			n = strings.TrimSpace(string(r[:64]))
		}
		if n == "" || seen[strings.ToLower(n)] {
			continue
		}
		seen[strings.ToLower(n)] = true
		out = append(out, n)
	}
	return out
}

// setGenres replaces the genre set of one book or movie (kind: "book" or
// "movie"; the caller has already verified ownership): upsert names, replace
// join rows, recompute the denormalized genre_text — which feeds FTS via the
// UPDATE trigger (PLAN §3) — then GC genres nothing references. The genres
// table is shared between books and movies (PLAN §3b).
func setGenres(tx *sql.Tx, kind string, userID, ownerID int64, names []string) error {
	names = cleanNames(names)
	if _, err := tx.Exec(`DELETE FROM `+kind+`_genres WHERE `+kind+`_id = ?`, ownerID); err != nil {
		return err
	}
	for _, n := range names {
		if _, err := tx.Exec(
			`INSERT INTO genres (user_id, name) VALUES (?, ?) ON CONFLICT DO NOTHING`,
			userID, n); err != nil {
			return err
		}
		if _, err := tx.Exec(
			`INSERT INTO `+kind+`_genres (`+kind+`_id, genre_id)
			 SELECT ?, id FROM genres WHERE user_id = ? AND name = ?`,
			ownerID, userID, n); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(
		`UPDATE `+kind+`s SET genre_text = ? WHERE id = ?`,
		strings.Join(names, " "), ownerID); err != nil {
		return err
	}
	return gcGenres(tx, userID)
}

func gcGenres(tx *sql.Tx, userID int64) error {
	_, err := tx.Exec(
		`DELETE FROM genres WHERE user_id = ? AND id NOT IN
		 (SELECT genre_id FROM book_genres UNION SELECT genre_id FROM movie_genres)`, userID)
	return err
}

// setTags mirrors setGenres for the tag set of one annotation or dialogue
// (kind: "annotation" or "dialogue"; the caller has already verified
// ownership through the book/movie). Both kinds share the per-user tags
// table — one vocabulary spans books and movies (PLAN §3).
func setTags(tx *sql.Tx, kind string, userID, ownerID int64, names []string) error {
	names = cleanNames(names)
	if _, err := tx.Exec(`DELETE FROM `+kind+`_tags WHERE `+kind+`_id = ?`, ownerID); err != nil {
		return err
	}
	for _, n := range names {
		if _, err := tx.Exec(
			`INSERT INTO tags (user_id, name) VALUES (?, ?) ON CONFLICT DO NOTHING`,
			userID, n); err != nil {
			return err
		}
		if _, err := tx.Exec(
			`INSERT INTO `+kind+`_tags (`+kind+`_id, tag_id)
			 SELECT ?, id FROM tags WHERE user_id = ? AND name = ?`,
			ownerID, userID, n); err != nil {
			return err
		}
	}
	return gcTags(tx, userID)
}

func gcTags(tx *sql.Tx, userID int64) error {
	_, err := tx.Exec(
		`DELETE FROM tags WHERE user_id = ? AND id NOT IN
		 (SELECT tag_id FROM annotation_tags UNION SELECT tag_id FROM dialogue_tags)`, userID)
	return err
}
