package httpapi

import (
	"net/url"
	"strconv"
	"strings"
)

// Facets — saying which field you meant.
//
// `/search` grew about fifteen separate queries, one per section, because the
// results are sectioned by WHAT matched. A facet is a predicate that has to reach
// every one of them, and every mistake here is SILENT: a wrong result set, not an
// error. So the predicates are compiled in exactly one place — this file — and
// the fifteen queries all reach it through the same builder (facetedHits, in
// search_handler.go). There is no second place to forget.
//
// THE SYNTAX IS NOT ON THE WIRE. The client parses `tag:stoicism` and sends
// `&tag=stoicism`; the server never sees a colon. One parser, on the client,
// because a grammar both halves parse is a grammar that drifts — and the drift
// shows up as a query that renders one way and matches another. It also means
// the URL is the honest record: every chip is a query parameter, so a search is
// bookmarkable and shareable.
//
// NO FACET VALUE EVER REACHES AN FTS `MATCH`. Facets are ordinary SQL predicates
// on ordinary columns, always parameter-bound. Only the free-text `q` reaches
// FTS, and it reaches it exactly the way it did before.

// rowKind is one of the five kinds of row a search can return. Everything in
// this file is a function of the kind, because that is what decides both which
// column a facet lives on and whether it exists at all.
type rowKind int

const (
	rowBook rowKind = iota
	rowAnnotation
	rowMovie
	rowDialogue
	rowUtterance
)

// searchFacets is one request's narrowing, parsed and typed.
//
// THE COMBINING RULE IS A PROPERTY OF THE FACET, not of the query, and this is
// the one decision here worth arguing about.
//
// A quote has ONE colour. `colour=blue&colour=pink` under an all-AND rule means
// "has two colours", which nothing does, so that search returns nothing forever
// and looks broken. Under an OR rule it means "either", which is what you would
// say out loud. Meanwhile `tag=stoicism&tag=death` MUST intersect, because
// narrowing by two tags is a real question in a quote library and OR would widen
// it — the opposite of what pressing a second chip is supposed to do.
//
// One rule cannot serve both. So: a field a row can hold several of (tags,
// genres) intersects; a field a row holds one of (colour, shelf, series, year,
// and every credit) unions.
//
// Credits are in the OR family, which is worth saying because they look like
// tags. A book has one author column. `author=Gaiman&author=Le+Guin` under AND
// would be the colour failure again — nothing is by both — so it means "either",
// and a co-written book still turns up for `author=Gaiman` alone because the
// match is a substring of the joined credit.
type searchFacets struct {
	// Intersecting: every value must be present.
	tags   []string
	genres []string
	// Unioning: any value will do.
	colours   []string
	shelves   []string
	series    []string
	years     []int
	authors    []string
	directors  []string
	actors     []string
	characters []string
	speakers   []string
	// One work, by id. These are what a search started from a work's own page
	// narrows to: `book:The Dispossessed` shows the title and sends the id,
	// because a title is not unique and an id is.
	bookIDs  []int64
	movieIDs []int64
	// Flags. nil means "not asked about", which is not the same as false: a
	// bare *bool is the difference between "show me favourites", "show me
	// things I have not starred", and "I did not mention favourites".
	favourite *bool
	note      *bool
	wishlist  *bool
}

func (f searchFacets) any() bool {
	return len(f.tags) > 0 || len(f.genres) > 0 || len(f.colours) > 0 || len(f.shelves) > 0 ||
		len(f.series) > 0 || len(f.years) > 0 || len(f.authors) > 0 || len(f.directors) > 0 ||
		len(f.actors) > 0 || len(f.characters) > 0 || len(f.speakers) > 0 ||
		len(f.bookIDs) > 0 || len(f.movieIDs) > 0 ||
		f.favourite != nil || f.note != nil || f.wishlist != nil
}

// searchReservedParams are the query parameters that are NOT facets. Anything
// else on the URL has to be a known facet name or the request is rejected — see
// parseSearchFacets.
var searchReservedParams = map[string]bool{"q": true, "scope": true, "limit": true}

// The colour keys, closed by a CHECK constraint on three tables. A value outside
// these six cannot match anything, ever, so it is a 400 rather than a silent
// empty result. (Contrast a shelf name, whose vocabulary is open by design —
// 0024 says so explicitly — and which is therefore matched as given.)
var searchColourKeys = map[string]bool{
	"yellow": true, "blue": true, "pink": true, "orange": true, "green": true, "purple": true,
}

// searchFacetError is a malformed request, reported to the caller verbatim.
type searchFacetError struct{ msg string }

func (e searchFacetError) Error() string { return e.msg }

// parseSearchFacets reads the facet parameters off a query string.
//
// AN UNKNOWN FACET NAME IS A 400, NOT A SILENT IGNORE. This is the whole reason
// the function validates rather than just reading the keys it knows. A dropped
// facet returns a WIDER result set than was asked for, and a wider result set
// looks exactly like a correct answer — you get rows, they are all real, and
// nothing anywhere says the narrowing you typed did not happen.
//
// Both spellings of the two British/American words are accepted, because the URL
// is meant to be hand-editable and being right about `color=blue` is worth one
// map entry. The chips only ever emit the British spelling.
func parseSearchFacets(vals url.Values) (searchFacets, error) {
	var f searchFacets
	for key, vs := range vals {
		if searchReservedParams[key] {
			continue
		}
		switch key {
		case "tag":
			f.tags = append(f.tags, nonEmpty(vs)...)
		case "genre":
			f.genres = append(f.genres, nonEmpty(vs)...)
		case "colour", "color":
			for _, v := range nonEmpty(vs) {
				v = strings.ToLower(v)
				if !searchColourKeys[v] {
					return f, searchFacetError{"unknown colour: " + v}
				}
				f.colours = append(f.colours, v)
			}
		case "shelf":
			f.shelves = append(f.shelves, nonEmpty(vs)...)
		case "series":
			f.series = append(f.series, nonEmpty(vs)...)
		case "year":
			for _, v := range nonEmpty(vs) {
				n, err := strconv.Atoi(strings.TrimSpace(v))
				if err != nil {
					return f, searchFacetError{"year must be a number: " + v}
				}
				f.years = append(f.years, n)
			}
		case "author":
			f.authors = append(f.authors, nonEmpty(vs)...)
		case "director":
			f.directors = append(f.directors, nonEmpty(vs)...)
		case "actor":
			f.actors = append(f.actors, nonEmpty(vs)...)
		case "character":
			f.characters = append(f.characters, nonEmpty(vs)...)
		case "speaker":
			f.speakers = append(f.speakers, nonEmpty(vs)...)
		case "book", "movie":
			for _, v := range nonEmpty(vs) {
				n, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
				if err != nil || n <= 0 {
					return f, searchFacetError{key + " must be an id: " + v}
				}
				if key == "book" {
					f.bookIDs = append(f.bookIDs, n)
				} else {
					f.movieIDs = append(f.movieIDs, n)
				}
			}
		case "favourite", "favorite":
			b, err := parseFacetFlag(key, vs)
			if err != nil {
				return f, err
			}
			f.favourite = b
		case "note":
			b, err := parseFacetFlag(key, vs)
			if err != nil {
				return f, err
			}
			f.note = b
		case "wishlist":
			b, err := parseFacetFlag(key, vs)
			if err != nil {
				return f, err
			}
			f.wishlist = b
		default:
			return f, searchFacetError{"unknown facet: " + key}
		}
	}
	return f, nil
}

// nonEmpty drops blank values. A chip cannot be empty, so `&tag=` is a client
// bug rather than a request to match the empty tag — and matching it would
// silently narrow to nothing.
func nonEmpty(vs []string) []string {
	out := make([]string, 0, len(vs))
	for _, v := range vs {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	return out
}

// parseFacetFlag reads the last value of a boolean facet. Last rather than
// first because a repeated flag is a confused client, and the newest instruction
// is the better guess at what it meant.
func parseFacetFlag(name string, vs []string) (*bool, error) {
	vs = nonEmpty(vs)
	if len(vs) == 0 {
		return nil, nil
	}
	v := strings.ToLower(strings.TrimSpace(vs[len(vs)-1]))
	switch v {
	case "1", "true", "yes", "y", "on":
		t := true
		return &t, nil
	case "0", "false", "no", "n", "off":
		fa := false
		return &fa, nil
	}
	return nil, searchFacetError{name + " must be yes or no: " + v}
}

// ---- compiling the predicates ----------------------------------------------

// where returns the extra SQL for one row kind — already prefixed with " AND " —
// its bound arguments, and whether this facet set can match the kind AT ALL.
//
// THE FALSE RETURN IS THE IMPORTANT ONE, and it is not an error. `colour=blue`
// asks for blue things; a BOOK is not a blue thing, because a book has no
// colour. The choice is between excluding books from that search and ignoring
// the facet for them, and ignoring it would put every book in the library under
// a heading that says the results are blue. So an inapplicable facet removes the
// kind from the search entirely, and the caller skips the query rather than
// running a wider one.
func (f searchFacets) where(k rowKind, uid int64) (string, []any, bool) {
	src := searchSources[k]
	self, work := src.self, src.work

	var conds []string
	var args []any
	add := func(c string, a ...any) {
		conds = append(conds, c)
		args = append(args, a...)
	}

	// tag — a property of a QUOTE. A book is not tagged; the highlights inside
	// it are, and those are their own rows in their own section.
	if len(f.tags) > 0 {
		var join, col string
		switch k {
		case rowAnnotation:
			join, col = "annotation_tags", "annotation_id"
		case rowDialogue:
			join, col = "dialogue_tags", "dialogue_id"
		case rowUtterance:
			join, col = "utterance_tags", "utterance_id"
		default:
			return "", nil, false
		}
		// One EXISTS per value, ANDed by the loop: two tags intersect.
		//
		// tags.user_id is asserted even though the row above it is already
		// user-scoped. The join tables carry no user_id, so this is the only
		// thing standing between a guessable tag id and somebody else's name.
		for _, name := range f.tags {
			add(`EXISTS (SELECT 1 FROM `+join+` ftj JOIN tags ftg ON ftg.id = ftj.tag_id
				WHERE ftj.`+col+` = `+self+`.id AND ftg.user_id = ? AND lower(ftg.name) = lower(?))`, uid, name)
		}
	}

	// genre — a property of a WORK, which an annotation or a line inherits from
	// the book or film it came out of. The hit already carries the parent's
	// genres so the client can group by them, so narrowing by one is answerable.
	if len(f.genres) > 0 {
		var join, col string
		switch k {
		case rowBook, rowAnnotation:
			join, col = "book_genres", "book_id"
		case rowMovie, rowDialogue:
			join, col = "movie_genres", "movie_id"
		default:
			return "", nil, false // a standalone quote came out of no work
		}
		for _, name := range f.genres {
			add(`EXISTS (SELECT 1 FROM `+join+` fgj JOIN genres fgg ON fgg.id = fgj.genre_id
				WHERE fgj.`+col+` = `+work+`.id AND fgg.user_id = ? AND lower(fgg.name) = lower(?))`, uid, name)
		}
	}

	if len(f.colours) > 0 {
		switch k {
		case rowAnnotation, rowDialogue, rowUtterance:
		default:
			return "", nil, false
		}
		add(self+".color IN ("+placeholders(len(f.colours))+")", strsToAny(f.colours)...)
	}

	// shelf, series, year — all three live on the work, so all three reach a
	// quote through its parent and none of them reach a standalone quote, which
	// has no parent to ask.
	if len(f.shelves) > 0 {
		if work == "" {
			return "", nil, false
		}
		add(work+".status IN ("+placeholders(len(f.shelves))+")", strsToAny(f.shelves)...)
	}
	if len(f.series) > 0 {
		if work == "" {
			return "", nil, false
		}
		// COALESCE because series is nullable, and lower() on both sides rather
		// than lowering in Go: SQLite's lower() folds ASCII only, so folding one
		// side in Go and the other in SQL would disagree the moment a series
		// name is not English.
		add(`lower(COALESCE(`+work+`.series, '')) IN (`+lowerPlaceholders(len(f.series))+`)`, strsToAny(f.series)...)
	}
	if len(f.years) > 0 {
		if work == "" {
			return "", nil, false
		}
		col := "published_year"
		if src.movieSide {
			col = "release_year"
		}
		args2 := make([]any, len(f.years))
		for i, y := range f.years {
			args2[i] = y
		}
		add(work+"."+col+" IN ("+placeholders(len(f.years))+")", args2...)
	}

	// Credits. The columns hold JOINED strings ("Gaiman & Pratchett"), so the
	// match is per-token substring — the same nameConds the rest of search uses —
	// rather than equality. That is what makes `author=Gaiman` find a book
	// credited to two people without the facet having to split anything.
	if len(f.authors) > 0 {
		switch k {
		case rowBook, rowAnnotation:
		default:
			return "", nil, false
		}
		c, a := creditAnyOf(work+".author", f.authors)
		add(c, a...)
	}
	if len(f.directors) > 0 {
		switch k {
		case rowMovie, rowDialogue:
		default:
			return "", nil, false
		}
		c, a := creditAnyOf(work+".director", f.directors)
		add(c, a...)
	}
	if len(f.actors) > 0 {
		if k != rowDialogue {
			return "", nil, false
		}
		c, a := creditAnyOf("d.actor", f.actors)
		add(c, a...)
	}
	// character — the OTHER credit on a line of dialogue, and the only one of the
	// five that is not a person. It behaves identically all the same: a line has
	// one speaker, so two characters means EITHER, and it reaches nothing but a
	// dialogue. A book has no characters as a column, so asking for one removes
	// books from the search rather than quietly widening it back to every book in
	// the library.
	if len(f.characters) > 0 {
		if k != rowDialogue {
			return "", nil, false
		}
		c, a := creditAnyOf("d.character", f.characters)
		add(c, a...)
	}
	if len(f.speakers) > 0 {
		if k != rowUtterance {
			return "", nil, false
		}
		c, a := creditAnyOf("u.speaker", f.speakers)
		add(c, a...)
	}

	// One work, by id — what a search started from a work's own page narrows to.
	// It reaches that work's quotes as well as the work itself, because from
	// inside a book "search" nearly always means "search this book".
	if len(f.bookIDs) > 0 {
		switch k {
		case rowBook, rowAnnotation:
		default:
			return "", nil, false
		}
		ids := make([]any, len(f.bookIDs))
		for i, id := range f.bookIDs {
			ids[i] = id
		}
		add("b.id IN ("+placeholders(len(ids))+")", ids...)
	}
	if len(f.movieIDs) > 0 {
		switch k {
		case rowMovie, rowDialogue:
		default:
			return "", nil, false
		}
		ids := make([]any, len(f.movieIDs))
		for i, id := range f.movieIDs {
			ids[i] = id
		}
		add("m.id IN ("+placeholders(len(ids))+")", ids...)
	}

	// favourite is the one facet every kind has.
	if f.favourite != nil {
		n := 0
		if *f.favourite {
			n = 1
		}
		add(self+".favorite = ?", n)
	}

	// note is a nullable TEXT column, not a flag, so "has a note" is a non-empty
	// test — and TRIM is part of it, because a note of one space is not a note.
	if f.note != nil {
		switch k {
		case rowAnnotation, rowDialogue, rowUtterance:
		default:
			return "", nil, false
		}
		if *f.note {
			add("(" + self + ".note IS NOT NULL AND TRIM(" + self + ".note) <> '')")
		} else {
			add("(" + self + ".note IS NULL OR TRIM(" + self + ".note) = '')")
		}
	}

	// wishlist HAS NO COLUMN, deliberately (0024): a work with no quotes in it
	// IS the wishlist, so it needs no storage and can never drift out of step
	// with the count it is derived from. That makes the facet a count-zero
	// predicate rather than an equality, and it applies to works only — a
	// highlight cannot be on the wishlist, because having it is what takes the
	// book off.
	if f.wishlist != nil {
		var sub string
		switch k {
		case rowBook:
			sub = `SELECT 1 FROM annotations fwa WHERE fwa.book_id = b.id`
		case rowMovie:
			sub = `SELECT 1 FROM dialogues fwd WHERE fwd.movie_id = m.id`
		default:
			return "", nil, false
		}
		if *f.wishlist {
			add("NOT EXISTS (" + sub + ")")
		} else {
			add("EXISTS (" + sub + ")")
		}
	}

	if len(conds) == 0 {
		return "", nil, true
	}
	return " AND " + strings.Join(conds, " AND "), args, true
}

// creditAnyOf builds "(name matches value A) OR (name matches value B)", where
// each value matches the way search has always matched a credit column: every
// token of the value must appear somewhere in it.
//
// BOTH SIDES ARE FOLDED BY THE SAME IMPLEMENTATION, which is the whole reason
// this does not simply call nameConds. nameConds takes tokens that queryTokens
// has already lowered with Go's strings.ToLower — a full Unicode fold — and
// compares them against SQLite's lower(), which folds ASCII and nothing else.
// For an ASCII name the two agree by accident. For "Лев Толстой" they cannot:
// Go turns the value into "лев", SQLite leaves the column as "Лев Толстой", and
// instr never hits. The facet returned NOTHING, silently, for a name the
// vocabulary endpoint had just offered as a dropdown option.
//
// So the value is bound RAW and wrapped in SQL lower() here, exactly as the
// series, tag and genre predicates already do. Two names folded by one
// implementation can disagree with a reader's expectations; two names folded by
// two implementations disagree with each other, which is worse and invisible.
func creditAnyOf(col string, values []string) (string, []any) {
	var parts []string
	var args []any
	for _, v := range values {
		// Split only — NOT lowered. The fold happens in SQL, on both sides.
		tokens := strings.Fields(v)
		if len(tokens) == 0 {
			continue
		}
		conds := make([]string, len(tokens))
		a := make([]any, len(tokens))
		for i, t := range tokens {
			conds[i] = "instr(lower(" + col + "), lower(?)) > 0"
			a[i] = t
		}
		parts = append(parts, "("+strings.Join(conds, " AND ")+")")
		args = append(args, a...)
	}
	if len(parts) == 0 {
		// Every value was whitespace. Match nothing rather than everything: the
		// caller asked to narrow, and the honest answer to an unanswerable
		// narrowing is no rows, never all of them.
		return "1 = 0", nil
	}
	return "(" + strings.Join(parts, " OR ") + ")", args
}

func placeholders(n int) string {
	return strings.TrimSuffix(strings.Repeat("?, ", n), ", ")
}

// lowerPlaceholders is placeholders() with each bind wrapped in SQL lower(), so
// both sides of a comparison are folded by the same implementation.
func lowerPlaceholders(n int) string {
	return strings.TrimSuffix(strings.Repeat("lower(?), ", n), ", ")
}

func strsToAny(vs []string) []any {
	out := make([]any, len(vs))
	for i, v := range vs {
		out[i] = v
	}
	return out
}
