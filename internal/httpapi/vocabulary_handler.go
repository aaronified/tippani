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
		fold  bool
	}{
		{"tags", `SELECT name FROM tags WHERE user_id = ? ORDER BY name`, false, false},
		{"genres", `SELECT name FROM genres WHERE user_id = ? ORDER BY name`, false, false},
		// AN EXPLICIT ORDER ON THE ONES THAT HAD NONE, and it is not what sorts the
		// dropdown — vocabList has sorted every list it returns since 2f8263c2, which
		// this comment claimed otherwise for a day. What a query's own ORDER BY
		// decides is which rows arrive FIRST, and that only shows when two rows
		// collapse into one: the languages list folds, so the order below picks the
		// spelling the reader sees. For series and shelves it is belt and braces —
		// a UNION emitting rows in whatever order it deduplicated them is a SQLite
		// implementation detail rather than a promise, and a query that says what it
		// wants costs nothing.
		{"series", `SELECT DISTINCT series FROM books WHERE user_id = ? AND series IS NOT NULL AND series <> ''
		            UNION SELECT DISTINCT series FROM movies WHERE user_id = ? AND series IS NOT NULL AND series <> ''
		            ORDER BY 1 COLLATE NOCASE`, false, false},
		{"authors", `SELECT DISTINCT author FROM books WHERE user_id = ? AND author IS NOT NULL AND author <> ''`, true, false},
		{"directors", `SELECT DISTINCT director FROM movies WHERE user_id = ? AND director IS NOT NULL AND director <> ''`, true, false},
		{"actors", `SELECT DISTINCT d.actor FROM dialogues d JOIN movies m ON m.id = d.movie_id
		            WHERE m.user_id = ? AND d.actor IS NOT NULL AND d.actor <> ''`, true, false},
		// Characters come off the same table as actors and are split the same way,
		// which is the point rather than a convenience: a line credited
		// "Rosencrantz & Guildenstern" has to be offered as two options or
		// `character:` matches neither of them. The join covers films, shows AND
		// games in one query — a game is a movies row (0040), so there is nothing
		// media-specific to add here and nothing to forget.
		//
		// 0047 UNIONs THE BOOK SIDE IN. A novel's speakers are the same vocabulary
		// under the same facet name, and offering only the film half would make
		// `character:` autocomplete a word the reader typed on a highlight yesterday
		// and then fail to find it.
		//
		// vocabList derives its argument count from strings.Count(query, "user_id = ?"),
		// so a UNION arm carrying its own scope needs nothing else changed — and one
		// that FORGOT the scope would be a cross-account leak the count would not
		// notice, which is why both arms spell it out.
		{"characters", `SELECT DISTINCT d.character FROM dialogues d JOIN movies m ON m.id = d.movie_id
		                WHERE m.user_id = ? AND d.character IS NOT NULL AND d.character <> ''
		                UNION
		                SELECT DISTINCT a.character FROM annotations a JOIN books b ON b.id = a.book_id
		                WHERE b.user_id = ? AND a.character <> ''`, true, false},
		{"speakers", `SELECT DISTINCT speaker FROM utterances WHERE user_id = ? AND speaker <> ''`, true, false},
		// THE LANGUAGES THE LIBRARY ACTUALLY USES, and the reason it is here rather
		// than derived on a screen is that the screen that needs it holds no quotes.
		// Settings' readable-languages chips were drawn from the ten starters plus
		// whatever the reader had MARKED, so a line typed as "Sanskrit" had no chip
		// to press — it could not be declared readable, so its translation led the
		// card forever and the only way out was to go and give Sanskrit a mark in
		// Metadata. The Quotes screen dodged this by deduplicating the rows it had
		// already loaded, which is not available to a screen that loads none.
		//
		// NOT SPLIT. Every other name-shaped facet here is a joined credit and has
		// to be taken apart; a language is one name, and splitting it would offer
		// "Old" and "English" as two languages nothing is stored under.
		//
		// FOLDED, AND THE ONLY ONE THAT IS. A language is free text on the row, so a
		// reader who typed "bengali" on Tuesday and "Bengali" on Friday has one
		// language stored two ways, and this list sent both. The board form's chip
		// row drew two chips for it (boards.jsx deduped with a bare Set until this
		// commit); the language combobox did not, because Combo already folds every
		// row list it is given — which is the point rather than a reprieve. A server
		// that hands back one language twice is a defect every consumer has to know
		// about, and one of the two did not.
		//
		// It is folded rather than left alone because the rest of the app has already
		// decided the question: normalizeLanguageMarks folds the key it stores
		// ("Bengali" and "bengali" are one language), validateBoard folds before
		// deduping a board's list, and languages.jsx keys its whole mark table by the
		// lowercased name. This list disagreeing with all three was the defect.
		//
		// The credit facets are NOT folded, and that is not an oversight. `author:`
		// and `tag:` match a stored value with no NOCASE anywhere in the schema, so
		// "Poetry" and "poetry" are two tag rows finding two different sets of
		// quotes; offering one of them would hide half a library behind a chip that
		// looks complete. There is no language facet to match against (#153), and
		// when there is, it will be case-insensitive for the same reason this is.
		//
		// GROUP BY, NOT DISTINCT, so an ORDER BY over an aggregate is available: the
		// fold keeps the FIRST spelling written, which is the rule validateBoard
		// already states — "bengali" typed second should not win over "Bengali".
		// DISTINCT with an ORDER BY outside the select list is not, and sorting the
		// folded list by name would leave the surviving spelling to sort.Slice, which
		// is not stable and would pick a different one between two runs over the same
		// library.
		//
		// AND A BOOK'S OWN TWO, which is the same defect one layer up and was found by
		// the same question: `books.language` and `books.orig_language` (0047) are
		// edited through this very combobox now, so a language a reader had only ever
		// set on a WORK was offered back to them nowhere — including on the box they
		// had just typed it into. `orig_language` counts as much as `language`: a
		// novel translated from Russian holds Russian, and a reader who then marks
		// Russian must not have that mark removable while the book still says it.
		// `movies` has neither column, so there is nothing to union from it.
		//
		// ALL THREE QUOTE TABLES, and reading only `utterances` was a defect that
		// emptied this list for a whole kind of library. 0071 put `language` on
		// annotations and dialogues — "it is needed everywhere" is the ask it quotes
		// — so a reader whose Bengali is all book highlights got NO languages back:
		// their combobox opened on English, Spanish and French, their board offered
		// no chips at all, and Settings drew a live red ✕ beside a language their
		// library is full of, under a tooltip promising it refuses while rows still
		// use it.
		//
		// ORDERED BY created_at AND THEN id, because `id` alone cannot span three
		// tables — the sequences are independent, so an annotation's id 2 says
		// nothing about whether it was written before utterance 7. created_at is
		// comparable across all three; inside one second it falls back to the
		// smallest id, which is exact within a table and arbitrary-but-stable across
		// them. Which of two spellings entered in the same second wins is not a
		// question with a right answer, only one that must have the same answer every
		// time.
		{"languages", `SELECT language FROM (
		                 SELECT language, created_at, id FROM utterances
		                  WHERE user_id = ? AND language <> ''
		                 UNION ALL
		                 SELECT a.language, a.created_at, a.id FROM annotations a
		                   JOIN books b ON b.id = a.book_id
		                  WHERE b.user_id = ? AND a.language <> ''
		                 UNION ALL
		                 SELECT d.language, d.created_at, d.id FROM dialogues d
		                   JOIN movies m ON m.id = d.movie_id
		                  WHERE m.user_id = ? AND d.language <> ''
		                 UNION ALL
		                 SELECT language, created_at, id FROM books
		                  WHERE user_id = ? AND language <> ''
		                 UNION ALL
		                 SELECT orig_language, created_at, id FROM books
		                  WHERE user_id = ? AND orig_language <> ''
		               )
		               GROUP BY language ORDER BY MIN(created_at), MIN(id)`, false, true},
		{"shelves", `SELECT DISTINCT status FROM books WHERE user_id = ? AND status <> ''
		             UNION SELECT DISTINCT status FROM movies WHERE user_id = ? AND status <> ''
		             ORDER BY 1 COLLATE NOCASE`, false, false},
	} {
		vals, err := s.vocabList(spec.query, uid, strings.Count(spec.query, "user_id = ?"), spec.fold)
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
//
// `fold` decides what "duplicated" means. Off, two spellings of one word are two
// options, which is right for a tag or an author — they are stored values matched
// with no NOCASE anywhere in the schema, so each finds its own rows. On, the first
// spelling the query emits wins and the rest are dropped, which is why the caller
// that folds orders by first appearance rather than by name.
func (s *Server) vocabList(query string, uid int64, n int, fold bool) ([]string, error) {
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
		key := v
		if fold {
			key = strings.ToLower(v)
		}
		if v == "" || seen[key] {
			continue
		}
		seen[key] = true
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
