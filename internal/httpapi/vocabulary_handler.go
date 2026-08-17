package httpapi

import (
	"net/http"
	"sort"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// GET /search/vocabulary — the words this reader's own library actually uses.
//
// One call, fetched when the search box is first focused and held for the session,
// so the facet dropdown ("tag:", "author:", "colour:") is instant and narrows
// locally as you type. A personal library's vocabulary is small: a few hundred
// names, not a paged resource.
//
// ONE REQUEST, NOT ONE PER KEYSTROKE. The alternative — asking the server to
// narrow — puts a round trip behind every character in a box that is already a
// typeahead over the whole library, on a NAS that is running a hundred other
// things. Filtering a few hundred strings in the browser costs nothing and never
// flickers behind the typing.
//
// EVERYTHING IS PER USER, without exception. A name that is not yours is never
// offered, which is not only an isolation rule but the point of the feature: the
// list is meant to be YOUR vocabulary, and a shared one would be both a leak and
// useless.
//
// COLOURS COME BACK AS KEY AND NAME. 1.7.1 made the six categories user-named, so
// the chip has to read `colour:doubt` while the query sends `blue`. A facet that
// showed the storage token would be showing the reader a word they deliberately
// renamed.

type vocabColour struct {
	Key  string `json:"key"`
	Name string `json:"name"`
}

func (s *Server) handleSearchVocabulary(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[search] handleSearchVocabulary uid=%v", uid)

	out := map[string]any{}
	// Each of these is one column of one user's rows, deduplicated and sorted. The
	// credit columns hold JOINED strings ("Gaiman & Pratchett"), so they are split
	// the same way the rest of the app splits them — otherwise `author:` would offer
	// a pair of names as one option and match nothing.
	seps := s.creditSeps(uid)
	for _, spec := range []struct {
		key   string
		query string
		split bool
	}{
		{"tags", `SELECT name FROM tags WHERE user_id = ? ORDER BY name`, false},
		{"genres", `SELECT name FROM genres WHERE user_id = ? ORDER BY name`, false},
		{"series", `SELECT DISTINCT series FROM books WHERE user_id = ? AND series IS NOT NULL AND series <> ''
		            UNION SELECT DISTINCT series FROM movies WHERE user_id = ? AND series IS NOT NULL AND series <> ''`, false},
		{"authors", `SELECT DISTINCT author FROM books WHERE user_id = ? AND author IS NOT NULL AND author <> ''`, true},
		{"directors", `SELECT DISTINCT director FROM movies WHERE user_id = ? AND director IS NOT NULL AND director <> ''`, true},
		{"actors", `SELECT DISTINCT d.actor FROM dialogues d JOIN movies m ON m.id = d.movie_id
		            WHERE m.user_id = ? AND d.actor IS NOT NULL AND d.actor <> ''`, true},
		// Characters come off the same table as actors and are split the same way,
		// which is the point rather than a convenience: a line credited
		// "Rosencrantz & Guildenstern" has to be offered as two options or
		// `character:` matches neither of them. The join covers films, shows AND
		// games in one query — a game is a movies row (0040), so there is nothing
		// media-specific to add here and nothing to forget.
		{"characters", `SELECT DISTINCT d.character FROM dialogues d JOIN movies m ON m.id = d.movie_id
		                WHERE m.user_id = ? AND d.character IS NOT NULL AND d.character <> ''`, true},
		{"speakers", `SELECT DISTINCT speaker FROM utterances WHERE user_id = ? AND speaker <> ''`, true},
		{"shelves", `SELECT DISTINCT status FROM books WHERE user_id = ? AND status <> ''
		             UNION SELECT DISTINCT status FROM movies WHERE user_id = ? AND status <> ''`, false},
	} {
		vals, err := s.vocabList(spec.query, uid, strings.Count(spec.query, "user_id = ?"))
		if err != nil {
			// Best-effort per list: a vocabulary that is missing its series names is
			// still a working dropdown, and 500-ing the whole search box because one
			// column would not read is the wrong trade.
			olog.Warnf(olog.CodeSearchVocab, "[search] vocabulary %s: %v", spec.key, err)
			out[spec.key] = []string{}
			continue
		}
		if spec.split {
			vals = splitAll(vals, seps)
		}
		out[spec.key] = vals
	}

	// Books and films/shows/games, as id + title.
	//
	// THESE ARE THE TWO FIELDS THAT SEND AN ID, and that is why they are a
	// separate shape from everything above. `author:` matches a name against a
	// column; `book:` narrows to ONE work, and a title is not unique — two
	// editions, a translation and the film of the book can all be called the same
	// thing. So the chip reads the title and the wire carries the id, exactly the
	// split the colour slots already use.
	//
	// They were left out of the grammar entirely until 1.16.0, on the reasoning
	// that "there is no vocabulary of titles to offer". That was wrong twice
	// over: a personal library HAS a list of its own titles, it is the same size
	// as the author list already being sent, and typing `book:` is the most
	// obvious thing in the box to want. The cost is one query each.
	for _, spec := range []struct{ key, query string }{
		{"books", `SELECT id, title FROM books WHERE user_id = ? AND title <> '' ORDER BY title`},
		{"movies", `SELECT id, title FROM movies WHERE user_id = ? AND title <> '' ORDER BY title`},
	} {
		pairs, err := s.vocabPairs(spec.query, uid)
		if err != nil {
			olog.Warnf(olog.CodeSearchVocab, "[search] vocabulary %s: %v", spec.key, err)
			pairs = []vocabColour{}
		}
		out[spec.key] = pairs
	}

	// The six colour slots, in slot order, with whatever this reader called them.
	// Unnamed slots are offered under their built-in word so the facet always has
	// something to show; slot 1 is the unset default and cannot be named at all.
	prefs, err := s.loadPrefs(uid)
	if err != nil {
		olog.Warnf(olog.CodeSearchVocab, "[search] vocabulary colours: %v", err)
	}
	names := []string{prefs.CatName1, prefs.CatName2, prefs.CatName3, prefs.CatName4, prefs.CatName5, prefs.CatName6}
	colours := make([]vocabColour, 0, len(colourSlots))
	for i, key := range colourSlots {
		name := strings.TrimSpace(names[i])
		if name == "" {
			name = key
		}
		colours = append(colours, vocabColour{Key: key, Name: name})
	}
	out["colours"] = colours

	writeJSON(w, http.StatusOK, out)
}

// colourSlots is the stored colour word per category slot, in slot order — the same
// order the CHECK constraint lists and the client's palette follows.
var colourSlots = []string{"yellow", "blue", "pink", "orange", "green", "purple"}

// vocabPairs runs a two-column (id, label) query for the fields whose chip shows
// one thing and whose wire carries another. It reuses vocabColour rather than
// declaring a second identical struct: the shape IS {key, name}, and the name of
// the type is the only thing about it that mentions colour.
//
// Untitled rows are already excluded by the queries. A duplicate TITLE is not —
// two editions of one book are two rows, two options and two distinct ids, which
// is the honest answer to "which of them did you mean".
func (s *Server) vocabPairs(query string, uid int64) ([]vocabColour, error) {
	rows, err := s.Store.DB.Query(query, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []vocabColour{}
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			olog.Warnf(olog.CodeSearchVocab, "[search] vocabulary pair scan: %v", err)
			continue
		}
		if name = strings.TrimSpace(name); name == "" {
			continue
		}
		out = append(out, vocabColour{Key: strconv.FormatInt(id, 10), Name: name})
	}
	return out, rows.Err()
}

// vocabList runs one single-column query with `uid` repeated `n` times (some are
// UNIONs over two tables), and returns non-empty values, sorted and deduplicated.
func (s *Server) vocabList(query string, uid int64, n int) ([]string, error) {
	if n < 1 {
		n = 1
	}
	args := make([]any, n)
	for i := range args {
		args[i] = uid
	}
	rows, err := s.Store.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	seen := map[string]bool{}
	var out []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			olog.Warnf(olog.CodeSearchVocab, "[search] vocabulary row scan: %v", err)
			continue
		}
		v = strings.TrimSpace(v)
		if v == "" || seen[v] {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i]) < strings.ToLower(out[j]) })
	if out == nil {
		out = []string{}
	}
	return out, nil
}

// splitAll expands joined credit strings into individual names, so `author:Gaiman`
// is offered — and matches — for a book credited "Gaiman & Pratchett".
func splitAll(vals []string, seps metadata.CreditSeps) []string {
	seen := map[string]bool{}
	var out []string
	for _, v := range vals {
		for _, name := range metadata.SplitCredits(v, seps) {
			name = strings.TrimSpace(name)
			if name == "" || seen[name] {
				continue
			}
			seen[name] = true
			out = append(out, name)
		}
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i]) < strings.ToLower(out[j]) })
	if out == nil {
		out = []string{}
	}
	return out
}
