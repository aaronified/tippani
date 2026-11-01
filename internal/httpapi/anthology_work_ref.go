package httpapi

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
)

// A WORK'S IDENTITY IN AN ANTHOLOGY FILE, and finding it again on import (0091).
//
// The Markdown export writes, beside each passage that came out of a work, the identifiers that work
// has ("isbn=9780..., tmdb=550") and its year. They are what lets an import tell that "this passage
// is from the book you already have" without trusting a title. THE MATCH IS EXACT OR NOTHING: a
// shared identifier, and a quote of that work whose words are the entry's. Anything less keeps the
// entry a standalone quote, which is what the importer has always done.

// workRef reads the identifiers a work carries, in a fixed order, as the file writes them.
func (s *Server) workRef(uid int64, kind string, id int64) (ref, year string, err error) {
	var parts []string
	add := func(key, val string) {
		if v := strings.TrimSpace(val); v != "" {
			parts = append(parts, key+"="+v)
		}
	}
	switch kind {
	case kindBook:
		var isbn, asin, google, ol string
		var y sql.NullInt64
		if err = s.Store.DB.QueryRow(`SELECT COALESCE(isbn,''), COALESCE(asin,''), COALESCE(google_id,''),
		       COALESCE(openlibrary_id,''), published_year FROM books WHERE id = ? AND user_id = ?`, id, uid).
			Scan(&isbn, &asin, &google, &ol, &y); err != nil {
			return "", "", err
		}
		add("isbn", isbn)
		add("asin", asin)
		add("google", google)
		add("openlibrary", ol)
		if y.Valid && y.Int64 > 0 {
			year = strconv.FormatInt(y.Int64, 10)
		}
	case kindScreen:
		var tmdb, tvdb, y sql.NullInt64
		var imdb string
		if err = s.Store.DB.QueryRow(`SELECT tmdb_id, tvdb_id, COALESCE(imdb_id,''), release_year
		       FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&tmdb, &tvdb, &imdb, &y); err != nil {
			return "", "", err
		}
		if tmdb.Valid && tmdb.Int64 > 0 {
			add("tmdb", strconv.FormatInt(tmdb.Int64, 10))
		}
		if tvdb.Valid && tvdb.Int64 > 0 {
			add("tvdb", strconv.FormatInt(tvdb.Int64, 10))
		}
		add("imdb", imdb)
		if y.Valid && y.Int64 > 0 {
			year = strconv.FormatInt(y.Int64, 10)
		}
	}
	return strings.Join(parts, ", "), year, nil
}

// attachWorkRefs fills each entry's WorkRef and WorkYear, one read per distinct work.
func (s *Server) attachWorkRefs(uid int64, entries []anthologyEntryRow) error {
	type key struct {
		kind string
		id   int64
	}
	seen := map[key][2]string{}
	for i := range entries {
		e := &entries[i]
		if e.WorkID == 0 {
			continue
		}
		k := key{e.Kind, e.WorkID}
		v, ok := seen[k]
		if !ok {
			ref, year, err := s.workRef(uid, e.Kind, e.WorkID)
			if err != nil {
				return err
			}
			v = [2]string{ref, year}
			seen[k] = v
		}
		e.WorkRef, e.WorkYear = v[0], v[1]
	}
	return nil
}

// parseWorkRef is the inverse of workRef's string: "isbn=978, tmdb=550" as a map.
func parseWorkRef(ref string) map[string]string {
	out := map[string]string{}
	for _, part := range strings.Split(ref, ",") {
		k, v, ok := strings.Cut(strings.TrimSpace(part), "=")
		if ok && strings.TrimSpace(v) != "" {
			out[strings.ToLower(strings.TrimSpace(k))] = strings.TrimSpace(v)
		}
	}
	return out
}

// relinkTarget finds the quote an imported entry IS: a highlight or a film line of a work the reader's
// library already has, matched by a shared identifier, whose words are exactly the entry's. ok is false
// for every other case, including a work that matches with no such quote in it.
func relinkTarget(tx *sql.Tx, uid int64, ref, text string) (kind string, id int64, ok bool, err error) {
	m := parseWorkRef(ref)
	text = strings.TrimSpace(text)
	if len(m) == 0 || text == "" {
		return "", 0, false, nil
	}

	var conds []string
	args := []any{uid}
	for _, c := range []struct{ key, col string }{{"isbn", "isbn"}, {"asin", "asin"}, {"google", "google_id"}, {"openlibrary", "openlibrary_id"}} {
		if v := m[c.key]; v != "" {
			conds = append(conds, c.col+" = ?")
			args = append(args, v)
		}
	}
	if len(conds) > 0 {
		var bookID int64
		e := tx.QueryRow(fmt.Sprintf(`SELECT id FROM books WHERE user_id = ? AND (%s) ORDER BY id LIMIT 1`, strings.Join(conds, " OR ")), args...).Scan(&bookID)
		if e != nil && e != sql.ErrNoRows {
			return "", 0, false, e
		}
		if e == nil {
			var ann int64
			e = tx.QueryRow(`SELECT id FROM annotations WHERE book_id = ? AND quote = ? ORDER BY id LIMIT 1`, bookID, text).Scan(&ann)
			if e != nil && e != sql.ErrNoRows {
				return "", 0, false, e
			}
			if e == nil {
				return kindBook, ann, true, nil
			}
		}
	}

	conds, args = nil, []any{uid}
	for _, c := range []struct{ key, col string }{{"tmdb", "tmdb_id"}, {"tvdb", "tvdb_id"}} {
		if v := m[c.key]; v != "" {
			if n, e := strconv.ParseInt(v, 10, 64); e == nil && n > 0 {
				conds = append(conds, c.col+" = ?")
				args = append(args, n)
			}
		}
	}
	if v := m["imdb"]; v != "" {
		conds = append(conds, "imdb_id = ?")
		args = append(args, v)
	}
	if len(conds) > 0 {
		var movieID int64
		e := tx.QueryRow(fmt.Sprintf(`SELECT id FROM movies WHERE user_id = ? AND (%s) ORDER BY id LIMIT 1`, strings.Join(conds, " OR ")), args...).Scan(&movieID)
		if e != nil && e != sql.ErrNoRows {
			return "", 0, false, e
		}
		if e == nil {
			var line int64
			e = tx.QueryRow(`SELECT id FROM dialogues WHERE movie_id = ? AND quote = ? ORDER BY id LIMIT 1`, movieID, text).Scan(&line)
			if e != nil && e != sql.ErrNoRows {
				return "", 0, false, e
			}
			if e == nil {
				return kindScreen, line, true, nil
			}
		}
	}
	return "", 0, false, nil
}
