package httpapi

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/search"
)

// GET /search/facets — how many hits each facet value would give.
//
// `Austen (12)`. The Filters panel shipped without these in 1.16.0 and the note
// in PLAN §7 said why: the count worth having is hits under the CURRENT query,
// not rows in the library, and the cheap version is worse than nothing because
// it prints a number beside a value that yields zero under the chip already up.
// That reasoning still holds. What changed is the shape — this is not fifteen
// more queries per value per field, it is ONE GROUP BY per field per applicable
// kind, about thirty in total, over indexed columns of a personal library.
//
// SEPARATE ENDPOINT, NOT PART OF /search. The counts are wanted when the panel
// is open and never while somebody is typing into the box, so folding them into
// the search response would put thirty queries behind every keystroke of a
// 200 ms-debounced typeahead. One call when the panel opens, one more when the
// narrowing changes.
//
// ---------------------------------------------------------------------------
//
// WHICH NARROWING APPLIES WHEN COUNTING A FIELD'S OWN VALUES is the only real
// decision here, and the rule that answers it is already written down.
//
// `combine` says a second tag INTERSECTS and a second author UNIONS. So:
//
//   - An AND field (tag, genre) counts WITH its own chips applied. `tag:death`
//     is up, and the number beside `tag:grief` is how many wear both — which is
//     exactly what pressing it will do.
//   - An OR field (colour, every credit, shelf, series, year, the works) counts
//     WITHOUT them. `author:Austen` is up; the number beside `author:Le Guin` has
//     to be what you would get by ALSO allowing Le Guin, not the zero you get by
//     asking for books by both.
//
// Count them the same way and one of the two lies. Under an all-with rule every
// unpicked colour reads 0 forever, which makes the panel look broken at exactly
// the moment it is working. Under an all-without rule a second tag advertises a
// number nothing will ever show you.
//
// A ZERO IS REPORTED, NOT OMITTED. The client greys the value rather than
// hiding it: a value that vanishes when you narrow leaves the reader wondering
// whether they mis-remembered their own library, and a value that goes grey
// says "not under this question" — which is the honest answer and the one that
// tells you which chip to take off.

// facetCountKinds is which row kinds a field can be counted over. It mirrors
// the applicability rules in searchFacets.where() — a field that returns false
// there has nothing to count here — and mirroring rather than sharing is a real
// risk, so `TestFacetCountKindsMatchTheFacetPredicates` walks both.
var facetCountKinds = map[string][]rowKind{
	"tag":       {rowAnnotation, rowDialogue, rowUtterance},
	"genre":     {rowBook, rowAnnotation, rowMovie, rowDialogue},
	"colour":    {rowAnnotation, rowDialogue, rowUtterance},
	"shelf":     {rowBook, rowAnnotation, rowMovie, rowDialogue},
	"series":    {rowBook, rowAnnotation, rowMovie, rowDialogue},
	"year":      {rowBook, rowAnnotation, rowMovie, rowDialogue},
	"author":    {rowBook, rowAnnotation},
	"director":  {rowMovie, rowDialogue},
	"actor":     {rowDialogue},
	"character": {rowDialogue},
	"speaker":   {rowUtterance},
	"favourite": {rowBook, rowAnnotation, rowMovie, rowDialogue, rowUtterance},
	"note":      {rowAnnotation, rowDialogue, rowUtterance},
	"wishlist":  {rowBook, rowMovie},
	"book":      {rowBook, rowAnnotation},
	"movie":     {rowMovie, rowDialogue},
}

// facetCountAnd is the fields whose own chips stay applied while counting them —
// the AND family. Everything else is counted with its own values lifted.
var facetCountAnd = map[string]bool{"tag": true, "genre": true}

// splitCountFields hold JOINED credit strings ("Gaiman & Pratchett"), so their
// GROUP BY buckets one pair as one value. They are split in Go afterwards and
// the counts summed, which is the same treatment the vocabulary endpoint gives
// them — and the only way `author:Gaiman` can carry a number at all.
var splitCountFields = map[string]bool{
	"author": true, "director": true, "actor": true, "character": true, "speaker": true,
}

func (s *Server) handleSearchFacetCounts(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	f, ferr := parseSearchFacets(r.URL.Query())
	if ferr != nil {
		writeErr(w, http.StatusBadRequest, ferr.Error())
		return
	}
	q := r.URL.Query().Get("q")
	scope := r.URL.Query().Get("scope")
	if scope == "" {
		scope = "all"
	}
	sc := parseSearchScope(scope)
	olog.Tracef("[search] handleSearchFacetCounts uid=%d scope=%q q=%q", uid, scope, q)

	seps := s.creditSeps(uid)
	out := map[string]map[string]int{}
	for field, kinds := range facetCountKinds {
		counts := map[string]int{}
		// The field's own narrowing is lifted for an OR field — see the header.
		base := f
		if !facetCountAnd[field] {
			base = f.without(field)
		}
		for _, k := range kinds {
			if !kindInScope(k, sc) {
				continue
			}
			got, err := s.countOneFacet(field, k, q, base, uid)
			if err != nil {
				// Best-effort per field, like the vocabulary endpoint: a panel
				// missing one row of numbers still works, and 500-ing the whole
				// thing because one column would not read is the wrong trade.
				olog.Warnf(olog.CodeSearchVocab, "[search] facet counts %s/%v: %v", field, k, err)
				continue
			}
			for v, n := range got {
				counts[v] += n
			}
		}
		if splitCountFields[field] {
			counts = splitCounts(counts, seps)
		}
		out[field] = counts
	}
	writeJSON(w, http.StatusOK, out)
}

func kindInScope(k rowKind, sc searchScope) bool {
	switch k {
	case rowBook:
		return sc.books
	case rowAnnotation:
		return sc.annotations
	case rowMovie:
		return sc.movies
	case rowDialogue:
		return sc.dialogues
	default:
		return sc.utterances
	}
}

// without returns a copy of the facets with one field's values dropped, so an
// OR field can be counted against everything EXCEPT itself.
func (f searchFacets) without(field string) searchFacets {
	switch field {
	case "colour":
		f.colours = nil
	case "shelf":
		f.shelves = nil
	case "series":
		f.series = nil
	case "year":
		f.years = nil
	case "author":
		f.authors = nil
	case "director":
		f.directors = nil
	case "actor":
		f.actors = nil
	case "character":
		f.characters = nil
	case "speaker":
		f.speakers = nil
	case "favourite":
		f.favourite = nil
	case "note":
		f.note = nil
	case "wishlist":
		f.wishlist = nil
	case "book":
		f.bookIDs = nil
	case "movie":
		f.movieIDs = nil
	}
	return f
}

// countOneFacet is one GROUP BY: this field's values, over this kind of row,
// under the free text and the rest of the narrowing.
//
// It is built from the SAME searchSources entry and the SAME where() builder
// the result queries use, so a count can never describe a different set of rows
// from the list it sits beside — which is the failure mode that makes counts
// worth less than nothing.
func (s *Server) countOneFacet(field string, k rowKind, q string, f searchFacets, uid int64) (map[string]int, error) {
	fc, fargs, ok := f.where(k, uid)
	if !ok {
		return nil, nil
	}
	src := searchSources[k]
	self, work := src.self, src.work

	// The grouping expression, and any extra join it needs.
	var expr, join string
	switch field {
	case "tag":
		var tj, col string
		switch k {
		case rowAnnotation:
			tj, col = "annotation_tags", "annotation_id"
		case rowDialogue:
			tj, col = "dialogue_tags", "dialogue_id"
		default:
			tj, col = "utterance_tags", "utterance_id"
		}
		// tags.user_id is asserted here for the same reason where() asserts it:
		// the join tables carry no user_id of their own.
		join = " JOIN " + tj + " ctj ON ctj." + col + " = " + self + ".id" +
			" JOIN tags ctg ON ctg.id = ctj.tag_id AND ctg.user_id = " + strconv.FormatInt(uid, 10)
		expr = "ctg.name"
	case "genre":
		var gj, col string
		if src.movieSide {
			gj, col = "movie_genres", "movie_id"
		} else {
			gj, col = "book_genres", "book_id"
		}
		join = " JOIN " + gj + " cgj ON cgj." + col + " = " + work + ".id" +
			" JOIN genres cgg ON cgg.id = cgj.genre_id AND cgg.user_id = " + strconv.FormatInt(uid, 10)
		expr = "cgg.name"
	case "colour":
		expr = self + ".color"
	case "shelf":
		expr = work + ".status"
	case "series":
		expr = "COALESCE(" + work + ".series, '')"
	case "year":
		if src.movieSide {
			expr = work + ".release_year"
		} else {
			expr = work + ".published_year"
		}
	case "author":
		expr = "COALESCE(" + work + ".author, '')"
	case "director":
		expr = "COALESCE(" + work + ".director, '')"
	case "actor":
		expr = "COALESCE(d.actor, '')"
	case "character":
		expr = "COALESCE(d.character, '')"
	case "speaker":
		expr = "COALESCE(u.speaker, '')"
	case "favourite":
		// The wire values are yes/no, so the SQL answers in those words rather
		// than in 1/0 — otherwise the client would need a second mapping that
		// could disagree with the grammar's.
		expr = "CASE WHEN " + self + ".favorite = 1 THEN 'yes' ELSE 'no' END"
	case "note":
		expr = "CASE WHEN " + self + ".note IS NOT NULL AND TRIM(" + self + ".note) <> '' THEN 'yes' ELSE 'no' END"
	case "wishlist":
		var sub string
		if k == rowBook {
			sub = "SELECT 1 FROM annotations cwa WHERE cwa.book_id = b.id"
		} else {
			sub = "SELECT 1 FROM dialogues cwd WHERE cwd.movie_id = m.id"
		}
		expr = "CASE WHEN EXISTS (" + sub + ") THEN 'no' ELSE 'yes' END"
	case "book":
		expr = "b.id"
	case "movie":
		expr = "m.id"
	default:
		return nil, nil
	}

	args := make([]any, 0, len(fargs)+2)
	var from, where string
	if q == "" {
		from, where = src.plainFrom, src.userCond
		args = append(args, uid)
	} else {
		from = src.ftsFrom
		where = src.ftsTable + " MATCH ? AND " + src.userCond
		// EVERY indexed column, deliberately. The result sections each match a
		// NAMED column — Dialogues on the words, Characters on the speaker — but
		// a count is answering "how many hits", and hits are the union of those
		// sections. Counting one column would report a smaller number than the
		// screen is about to show.
		args = append(args, search.PhraseQuery(q), uid)
	}
	where += fc
	args = append(args, fargs...)

	// DISTINCT on the row id, because the tag and genre joins fan out: a quote
	// wearing three tags is three rows of that join and one hit.
	rows, err := s.Store.DB.Query(
		`SELECT `+expr+`, count(DISTINCT `+self+`.id) FROM `+from+join+` WHERE `+where+
			` GROUP BY 1`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCounts(rows)
}

func scanCounts(rows *sql.Rows) (map[string]int, error) {
	out := map[string]int{}
	for rows.Next() {
		var v sql.NullString
		var n int
		if err := rows.Scan(&v, &n); err != nil {
			return out, err
		}
		key := strings.TrimSpace(v.String)
		// An empty bucket is "this row has no author", which is not a value
		// anything can be narrowed to. A `year` of 0 is the same statement.
		if key == "" || key == "0" || n == 0 {
			continue
		}
		out[key] += n
	}
	return out, rows.Err()
}

// splitCounts expands a joined credit's count onto each of its names.
//
// The sum over the map therefore exceeds the number of rows, and that is
// correct rather than a rounding error: a book credited to two people really is
// one hit under each of two authors, and pressing either finds it.
func splitCounts(in map[string]int, seps metadata.CreditSeps) map[string]int {
	out := map[string]int{}
	for joined, n := range in {
		for _, name := range metadata.SplitCredits(joined, seps) {
			if name = strings.TrimSpace(name); name != "" {
				out[name] += n
			}
		}
	}
	return out
}
