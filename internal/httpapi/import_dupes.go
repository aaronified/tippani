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
