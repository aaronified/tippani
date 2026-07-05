package httpapi

import (
	"database/sql"
	"strings"
	"unicode"
)

// dupHint is a possible-duplicate book surfaced to the import review UI so the
// user can decide to keep it separate or merge (PLAN §5).
type dupHint struct {
	ID     int64  `json:"id"`
	Title  string `json:"title"`
	Author string `json:"author"`
}

// normalizeTitle folds a title for fuzzy matching: lowercased, subtitle after a
// colon / em- / en-dash / " - " dropped, punctuation stripped, whitespace
// collapsed. So "Homo Deus: The million-copy bestseller…" and "Homo Deus" both
// reduce to "homo deus".
func normalizeTitle(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	// Cut the subtitle at the first strong separator.
	for _, sep := range []string{":", "—", "–", " - "} {
		if i := strings.Index(s, sep); i > 0 {
			s = s[:i]
		}
	}
	var b strings.Builder
	prevSpace := false
	for _, r := range s {
		switch {
		case unicode.IsLetter(r) || unicode.IsNumber(r):
			b.WriteRune(r)
			prevSpace = false
		case unicode.IsSpace(r):
			if !prevSpace {
				b.WriteByte(' ')
				prevSpace = true
			}
		}
		// other punctuation is dropped
	}
	return strings.TrimSpace(b.String())
}

// titlesSimilar reports whether two titles look like the same book: equal once
// normalized (subtitle dropped, punctuation stripped, case-folded). This makes
// "Homo Deus" and "Homo Deus: The million-copy bestseller…" match while keeping
// distinct titles like "Dune" and "Dune Messiah" apart. It flags for review,
// not auto-merge — so series volumes that share a main title before the colon
// are surfaced for the user to judge.
func titlesSimilar(a, b string) bool {
	na, nb := normalizeTitle(a), normalizeTitle(b)
	return na != "" && na == nb
}

// findSimilarBooks returns the user's existing books whose title looks like the
// given one, excluding excludeID (the just-imported book). Titles are compared
// in Go — personal libraries are small enough that scanning them is fine.
func findSimilarBooks(tx *sql.Tx, uid int64, title string, excludeID int64) ([]dupHint, error) {
	rows, err := tx.Query(
		`SELECT id, title, COALESCE(author, '') FROM books WHERE user_id = ? AND id <> ?`, uid, excludeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []dupHint
	for rows.Next() {
		var h dupHint
		if err := rows.Scan(&h.ID, &h.Title, &h.Author); err != nil {
			return nil, err
		}
		if titlesSimilar(title, h.Title) {
			out = append(out, h)
		}
	}
	return out, rows.Err()
}

// rowQuerier is the read subset shared by *sql.DB and *sql.Tx, so the movie
// look-alike scan works both inside an import transaction and on the bare DB.
type rowQuerier interface {
	Query(query string, args ...any) (*sql.Rows, error)
}

// movieDupHint is a same-title film/show already in the library, surfaced when
// an import or an add-from-source would otherwise create a second copy. It
// carries enough for the UI to describe the row (year, poster, dialogue count)
// and to enrich it in place (its id + which supplier id it already holds).
type movieDupHint struct {
	ID            int64  `json:"id"`
	Title         string `json:"title"`
	ReleaseYear   int    `json:"release_year"`
	MediaType     string `json:"media_type"`
	HasPoster     bool   `json:"has_poster"`
	DialogueCount int    `json:"dialogue_count"`
	TMDBID        int64  `json:"tmdb_id"`
	TVDBID        int64  `json:"tvdb_id"`
}

// findSimilarMovies returns the user's existing films/shows whose title looks
// like the given one and share its media_type (a movie and a show of the same
// name are never the same entry), excluding excludeID. Used to anchor imported
// dialogues onto a pre-existing title, and to warn before a lookup would create
// a duplicate. Same fuzzy title rule as books (subtitle dropped, case-folded).
func findSimilarMovies(q rowQuerier, uid int64, title, mediaType string, excludeID int64) ([]movieDupHint, error) {
	rows, err := q.Query(`
		SELECT m.id, m.title, COALESCE(m.release_year, 0), m.media_type,
		       m.poster_path IS NOT NULL, COALESCE(m.tmdb_id, 0), COALESCE(m.tvdb_id, 0),
		       (SELECT count(*) FROM dialogues d WHERE d.movie_id = m.id)
		FROM movies m
		WHERE m.user_id = ? AND m.id <> ? AND m.media_type = ?
		ORDER BY m.id DESC`, uid, excludeID, mediaType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []movieDupHint
	for rows.Next() {
		var h movieDupHint
		if err := rows.Scan(&h.ID, &h.Title, &h.ReleaseYear, &h.MediaType,
			&h.HasPoster, &h.TMDBID, &h.TVDBID, &h.DialogueCount); err != nil {
			return nil, err
		}
		if titlesSimilar(title, h.Title) {
			out = append(out, h)
		}
	}
	return out, rows.Err()
}
