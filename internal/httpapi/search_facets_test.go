package httpapi

// Facets — narrowing a search by saying which field you meant.
//
// EVERY ASSERTION HERE IS ON VALUES, NEVER ON COUNTS, and that is not fussiness.
// A facet bug does not raise an error; it returns a result set of the wrong
// SHAPE — usually a wider one, because a predicate that failed to apply looks
// exactly like a predicate that matched everything. "Got 3, wanted 3" passes
// happily while the three are the wrong three. So each test names the rows it
// expects to see and the rows it expects to be gone.
//
// The other half of the risk is arithmetic. /search runs about fifteen queries
// and the facet arguments are spliced into each one BETWEEN the user id and the
// limit; get the order wrong and SQLite binds the tag name where the row cap
// should go. That fails loudly if you are lucky and silently if you are not,
// which is why the tests below reach every section rather than only the easy
// flat ones.

import (
	"net/http"
	"net/url"
	"sort"
	"testing"
	"time"
)

// ---- helpers ---------------------------------------------------------------

// searchWith runs a search and returns the whole response.
func searchWith(t *testing.T, c *testClient, query string) searchResults {
	t.Helper()
	return decode[searchResults](t, c.mustDo("GET", "/search?"+query, nil, http.StatusOK))
}

func quoteTexts(hits []annotationHit) []string {
	out := []string{}
	for _, h := range hits {
		out = append(out, h.Quote)
	}
	sort.Strings(out)
	return out
}

func utteranceTexts(hits []utteranceHit) []string {
	out := []string{}
	for _, h := range hits {
		out = append(out, h.Quote)
	}
	sort.Strings(out)
	return out
}

func dialogueTexts(hits []dialogueHit) []string {
	out := []string{}
	for _, h := range hits {
		out = append(out, h.Quote)
	}
	sort.Strings(out)
	return out
}

func bookTitles(hits []bookHit) []string {
	out := []string{}
	for _, h := range hits {
		out = append(out, h.Title)
	}
	sort.Strings(out)
	return out
}

func movieTitles(hits []movieHit) []string {
	out := []string{}
	for _, h := range hits {
		out = append(out, h.Title)
	}
	sort.Strings(out)
	return out
}

// wantTitles compares two sets of names. The extractors above sort what they
// return, so `want` is sorted here too and a test can list its expectations in
// whatever order reads best.
func wantTitles(t *testing.T, what string, got, want []string) {
	t.Helper()
	w := append([]string(nil), want...)
	sort.Strings(w)
	if !sameStrings(got, w) {
		t.Errorf("%s = %v, want %v", what, got, w)
	}
}

// todayISO is the day the server will have stamped a row created during this
// test, in the form the date-added facet parses.
func todayISO() string { return time.Now().UTC().Format("2006-01-02") }

func urlQueryEscape(s string) string { return url.QueryEscape(s) }

// ---- the tag facet ---------------------------------------------------------

func TestTagFacetNarrowsToTheRightQuotes(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Meditations", "author": "Marcus Aurelius",
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "the obstacle is the way", "tags": []string{"stoicism"},
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "the way of the garden", "tags": []string{"gardening"},
	}, http.StatusCreated)

	// Both annotations match the free text; only one wears the tag.
	all := searchWith(t, c, "q=way&scope=annotations")
	wantTitles(t, "unfaceted annotations", quoteTexts(all.Annotations),
		[]string{"the obstacle is the way", "the way of the garden"})

	narrowed := searchWith(t, c, "q=way&scope=annotations&tag=stoicism")
	wantTitles(t, "tag:stoicism annotations", quoteTexts(narrowed.Annotations),
		[]string{"the obstacle is the way"})
}

func TestTwoTagsIntersect(t *testing.T) {
	// The rule the plan argues for: narrowing by a second tag must NARROW.
	// Under an OR rule this test would see all three quotes back.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, map[string]any{"quote": "a line with both", "tags": []string{"stoicism", "death"}})
	newUtterance(t, c, map[string]any{"quote": "a line with one", "tags": []string{"stoicism"}})
	newUtterance(t, c, map[string]any{"quote": "a line with other", "tags": []string{"death"}})

	both := searchWith(t, c, "q=line&scope=quotes&tag=stoicism&tag=death")
	wantTitles(t, "tag:stoicism tag:death", utteranceTexts(both.Quotes), []string{"a line with both"})

	one := searchWith(t, c, "q=line&scope=quotes&tag=stoicism")
	wantTitles(t, "tag:stoicism", utteranceTexts(one.Quotes),
		[]string{"a line with both", "a line with one"})
}

// ---- the colour facet ------------------------------------------------------

func TestTwoColoursUnion(t *testing.T) {
	// The other half of the same rule, and the reason it cannot be one rule. A
	// quote has ONE colour, so ANDing two of them asks for something nothing is
	// and returns nothing forever — a query that looks broken rather than empty.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, map[string]any{"quote": "a blue line", "color": "blue"})
	newUtterance(t, c, map[string]any{"quote": "a pink line", "color": "pink"})
	newUtterance(t, c, map[string]any{"quote": "a green line", "color": "green"})

	two := searchWith(t, c, "q=line&scope=quotes&colour=blue&colour=pink")
	wantTitles(t, "colour:blue colour:pink", utteranceTexts(two.Quotes),
		[]string{"a blue line", "a pink line"})
}

func TestColourFacetEmptiesTheKindsThatHaveNoColour(t *testing.T) {
	// THE DECISION THIS PINS. `colour=blue` asks for blue things. A book is not a
	// blue thing — it has no colour column at all — so the Books section is
	// EMPTY. The alternative, ignoring a facet the section cannot honour, would
	// put every book in the library under a heading claiming the results are
	// blue, which is the exact "wider set that looks like a correct answer"
	// failure the whole design is trying to avoid.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Blue Nights"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "blue nights are a kind of light", "color": "blue",
	}, http.StatusCreated)

	res := searchWith(t, c, "q=blue&colour=blue")
	if len(res.Books) != 0 {
		t.Errorf("books survived a colour facet they cannot answer: %v", bookTitles(res.Books))
	}
	wantTitles(t, "annotations", quoteTexts(res.Annotations), []string{"blue nights are a kind of light"})
}

// ---- credits ---------------------------------------------------------------

func TestAuthorFacetMatchesInsideAJoinedCredit(t *testing.T) {
	// The credit columns hold joined strings. `author:Pratchett` has to find a
	// book credited to two people, or the facet contradicts the dropdown that
	// offered "Pratchett" as an option in the first place.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/books", map[string]any{"title": "Good Omens", "author": "Gaiman & Pratchett"}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{"title": "Small Gods", "author": "Terry Pratchett"}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{"title": "Coraline", "author": "Neil Gaiman"}, http.StatusCreated)

	res := searchWith(t, c, "scope=books&author=Pratchett")
	wantTitles(t, "author:Pratchett", bookTitles(res.Books), []string{"Good Omens", "Small Gods"})

	// Two credits UNION, for the same reason two colours do: one book has one
	// author line, so ANDing them would ask for a book by nobody.
	both := searchWith(t, c, "scope=books&author=Pratchett&author=Gaiman")
	wantTitles(t, "author:Pratchett author:Gaiman", bookTitles(both.Books),
		[]string{"Coraline", "Good Omens", "Small Gods"})
}

func TestDirectorActorAndSpeakerFacets(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	casa := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Casablanca", "director": "Michael Curtiz",
	}, http.StatusCreated))
	stalker := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Stalker", "director": "Andrei Tarkovsky",
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": casa.ID, "quote": "here is looking at you", "actor": "Humphrey Bogart",
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": stalker.ID, "quote": "here is the zone", "actor": "Alexander Kaidanovsky",
	}, http.StatusCreated)
	newUtterance(t, c, map[string]any{"quote": "here is a speech", "speaker": "Subhas Chandra Bose"})
	newUtterance(t, c, map[string]any{"quote": "here is another", "speaker": "Rabindranath Tagore"})

	res := searchWith(t, c, "scope=movies&director=Curtiz")
	wantTitles(t, "director:Curtiz", movieTitles(res.Movies), []string{"Casablanca"})

	res = searchWith(t, c, "q=here&scope=dialogues&actor=Bogart")
	wantTitles(t, "actor:Bogart", dialogueTexts(res.Dialogues), []string{"here is looking at you"})

	res = searchWith(t, c, "q=here&scope=quotes&speaker=Tagore")
	wantTitles(t, "speaker:Tagore", utteranceTexts(res.Quotes), []string{"here is another"})
}

// ---- work facets: genre, series, year, shelf -------------------------------

func TestGenreSeriesAndYearFacets(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/books", map[string]any{
		"title": "The Dispossessed", "series": "Hainish", "published_year": 1974,
		"genres": []string{"science fiction", "politics"},
	}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{
		"title": "The Left Hand of Darkness", "series": "Hainish", "published_year": 1969,
		"genres": []string{"science fiction"},
	}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{
		"title": "A Wizard of Earthsea", "series": "Earthsea", "published_year": 1968,
		"genres": []string{"fantasy"},
	}, http.StatusCreated)

	res := searchWith(t, c, "scope=books&series=Hainish")
	wantTitles(t, "series:Hainish", bookTitles(res.Books),
		[]string{"The Dispossessed", "The Left Hand of Darkness"})

	res = searchWith(t, c, "scope=books&year=1974")
	wantTitles(t, "year:1974", bookTitles(res.Books), []string{"The Dispossessed"})

	// Two years union.
	res = searchWith(t, c, "scope=books&year=1974&year=1968")
	wantTitles(t, "year:1974 year:1968", bookTitles(res.Books),
		[]string{"A Wizard of Earthsea", "The Dispossessed"})

	// Genres are stored Title-Cased; the facet folds case on both sides so the
	// reader can type what they see or what they typed.
	res = searchWith(t, c, "scope=books&genre=science%20fiction")
	wantTitles(t, "genre:science fiction", bookTitles(res.Books),
		[]string{"The Dispossessed", "The Left Hand of Darkness"})

	// Two genres INTERSECT — a book has many, so a second one narrows.
	res = searchWith(t, c, "scope=books&genre=Science%20Fiction&genre=Politics")
	wantTitles(t, "genre:sf genre:politics", bookTitles(res.Books), []string{"The Dispossessed"})
}

func TestShelfFacet(t *testing.T) {
	// books.status and movies.status share one vocabulary except for the first
	// word — 'reading' against 'watching' — so `shelf:reading` legitimately
	// empties the films side rather than erroring.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	reading := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Underway"}, http.StatusCreated))
	c.mustDo("POST", "/books", map[string]any{"title": "Untouched"}, http.StatusCreated)
	c.mustDo("PUT", "/books/"+itoa(reading.ID)+"/status", map[string]any{"status": "reading"}, http.StatusOK)

	res := searchWith(t, c, "scope=books&shelf=reading")
	wantTitles(t, "shelf:reading", bookTitles(res.Books), []string{"Underway"})
}

// ---- flags -----------------------------------------------------------------

func TestFavouriteNoteAndWishlistFlags(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	starred := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "A Starred Book", "favorite": true,
	}, http.StatusCreated))
	plain := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "A Plain Book"}, http.StatusCreated))

	// Wishlist is DERIVED: a work with no quotes in it is the wishlist. So
	// giving `plain` a highlight is what takes it off, and `starred` stays on
	// because nothing was ever saved out of it.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": plain.ID, "quote": "a passage", "note": "a thought about it",
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": plain.ID, "quote": "another passage",
	}, http.StatusCreated)
	_ = starred

	res := searchWith(t, c, "scope=books&favourite=yes")
	wantTitles(t, "favourite:yes", bookTitles(res.Books), []string{"A Starred Book"})

	res = searchWith(t, c, "scope=books&favourite=no")
	wantTitles(t, "favourite:no", bookTitles(res.Books), []string{"A Plain Book"})

	res = searchWith(t, c, "scope=books&wishlist=yes")
	wantTitles(t, "wishlist:yes", bookTitles(res.Books), []string{"A Starred Book"})

	res = searchWith(t, c, "scope=books&wishlist=no")
	wantTitles(t, "wishlist:no", bookTitles(res.Books), []string{"A Plain Book"})

	// note is a nullable TEXT column, so "has a note" is a non-empty test.
	res = searchWith(t, c, "q=passage&scope=annotations&note=yes")
	wantTitles(t, "note:yes", quoteTexts(res.Annotations), []string{"a passage"})

	res = searchWith(t, c, "q=passage&scope=annotations&note=no")
	wantTitles(t, "note:no", quoteTexts(res.Annotations), []string{"another passage"})
}

func TestNoteFacetTreatsWhitespaceAsNoNote(t *testing.T) {
	// TRIM is part of the predicate: a note of one space is not a note, and the
	// books list has always counted it that way.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Blank"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "a passage here", "note": "   ",
	}, http.StatusCreated)

	res := searchWith(t, c, "q=passage&scope=annotations&note=yes")
	if len(res.Annotations) != 0 {
		t.Errorf("a whitespace note counted as a note: %v", quoteTexts(res.Annotations))
	}
}

// ---- the request contract --------------------------------------------------

func TestUnknownFacetIsRejected(t *testing.T) {
	// A typo'd facet that is quietly dropped returns a WIDER result set that
	// looks exactly like a correct answer. Rejecting it is the only way the
	// reader ever finds out the narrowing did not happen.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	c.mustDo("GET", "/search?q=x&tags=stoicism", nil, http.StatusBadRequest)
	c.mustDo("GET", "/search?q=x&colours=blue", nil, http.StatusBadRequest)
	c.mustDo("GET", "/search?q=x&nonsense=1", nil, http.StatusBadRequest)
}

func TestMalformedFacetValuesAreRejected(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// The colour vocabulary is closed by a CHECK constraint, so a seventh colour
	// can never match and saying so beats an empty result.
	c.mustDo("GET", "/search?q=x&colour=turquoise", nil, http.StatusBadRequest)
	c.mustDo("GET", "/search?q=x&year=nineteen", nil, http.StatusBadRequest)
	c.mustDo("GET", "/search?q=x&favourite=maybe", nil, http.StatusBadRequest)
}

func TestBothSpellingsOfTheBritishFacetsAreAccepted(t *testing.T) {
	// The URL is meant to be hand-editable, and being right about `color=blue`
	// costs one map entry. The chips only ever emit the British spelling.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newUtterance(t, c, map[string]any{"quote": "a blue line", "color": "blue"})

	for _, q := range []string{"q=line&scope=quotes&colour=blue", "q=line&scope=quotes&color=blue"} {
		res := searchWith(t, c, q)
		wantTitles(t, q, utteranceTexts(res.Quotes), []string{"a blue line"})
	}
}

func TestSearchStillNeedsSomethingToGoOn(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	// Neither free text nor a facet is not a search, it is a request for the
	// whole library.
	c.mustDo("GET", "/search", nil, http.StatusBadRequest)
	c.mustDo("GET", "/search?scope=books", nil, http.StatusBadRequest)
}

func TestAFacetAloneIsAWholeSearch(t *testing.T) {
	// The ordinary shape of a chip-built query: picking `tag:stoicism` out of
	// the dropdown lifts the words OUT of the box, so the box is empty and the
	// only thing left is the parameter. Requiring `q` would have made the
	// feature's main path a 400.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, map[string]any{"quote": "an untyped-for line", "tags": []string{"stoicism"}})
	newUtterance(t, c, map[string]any{"quote": "an unrelated line"})

	res := searchWith(t, c, "scope=quotes&tag=stoicism")
	wantTitles(t, "tag:stoicism with no q", utteranceTexts(res.Quotes), []string{"an untyped-for line"})
}

func TestFacetValuesNeverReachTheFTSMatch(t *testing.T) {
	// Facets are ordinary SQL predicates on ordinary columns, always
	// parameter-bound. A value carrying FTS5 query syntax must be matched
	// LITERALLY — not parsed as an operator, and not able to error the query.
	//
	// An unquoted `"` or a bare NEAR/OR reaching a MATCH is a 500 in SQLite, so
	// this test would fail loudly rather than subtly if a value ever got there.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, map[string]any{"quote": "a normal line", "tags": []string{"stoicism"}})

	for _, evil := range []string{
		`stoicism" OR "x`,
		`stoicism OR death`,
		`stoicism NEAR death`,
		`stoicism*`,
		`"`,
		`a AND b`,
	} {
		res := decode[searchResults](t, c.mustDo("GET", "/search?scope=quotes&tag="+urlQueryEscape(evil), nil, http.StatusOK))
		if len(res.Quotes) != 0 {
			t.Errorf("tag=%q matched something; the value was interpreted rather than compared: %v",
				evil, utteranceTexts(res.Quotes))
		}
	}

	// And the plain name still works, so the escaping above did not simply break
	// every tag lookup.
	res := searchWith(t, c, "scope=quotes&tag=stoicism")
	wantTitles(t, "tag:stoicism", utteranceTexts(res.Quotes), []string{"a normal line"})
}

// ---- reaching every section ------------------------------------------------

func TestFacetsReachTheTagSectionAndItsCount(t *testing.T) {
	// The Tags section lists a tag with a COUNT and a page of quotes under it.
	// Both have to be computed under the same facets, or a tag reads "3" over a
	// list of one and the number is describing a search nobody ran.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, map[string]any{"quote": "blue one", "color": "blue", "tags": []string{"weather"}})
	newUtterance(t, c, map[string]any{"quote": "pink one", "color": "pink", "tags": []string{"weather"}})
	newUtterance(t, c, map[string]any{"quote": "green one", "color": "green", "tags": []string{"weather"}})

	all := searchWith(t, c, "q=weather&scope=quotes")
	if len(all.Tags) != 1 || all.Tags[0].Count != 3 {
		t.Fatalf("unfaceted tag section = %+v, want one tag counting 3", all.Tags)
	}

	narrowed := searchWith(t, c, "q=weather&scope=quotes&colour=blue")
	if len(narrowed.Tags) != 1 {
		t.Fatalf("faceted tag section = %+v, want one tag", narrowed.Tags)
	}
	wantTitles(t, "tag section quotes", utteranceTexts(narrowed.Tags[0].Quotes), []string{"blue one"})
	if narrowed.Tags[0].Count != 1 {
		t.Errorf("tag count = %d, want 1 — the count must describe the same search as the list", narrowed.Tags[0].Count)
	}
}

func TestFacetsReachTheGenreSection(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/books", map[string]any{
		"title": "Kept", "genres": []string{"fantasy"}, "series": "Earthsea",
	}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{
		"title": "Dropped", "genres": []string{"fantasy"}, "series": "Elsewhere",
	}, http.StatusCreated)

	res := searchWith(t, c, "q=fantasy&scope=books&series=Earthsea")
	if len(res.Genres) != 1 {
		t.Fatalf("genre section = %+v, want one genre", res.Genres)
	}
	wantTitles(t, "genre section books", bookTitles(res.Genres[0].Books), []string{"Kept"})
}

func TestFacetsReachTheDecadeSection(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/books", map[string]any{
		"title": "Sixties Fantasy", "published_year": 1968, "genres": []string{"fantasy"},
	}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{
		"title": "Sixties History", "published_year": 1969, "genres": []string{"history"},
	}, http.StatusCreated)

	all := searchWith(t, c, "q=1960s&scope=books")
	if all.Decade == nil {
		t.Fatal("no decade section for a decade query")
	}
	wantTitles(t, "decade books", bookTitles(all.Decade.Books), []string{"Sixties Fantasy", "Sixties History"})

	narrowed := searchWith(t, c, "q=1960s&scope=books&genre=Fantasy")
	if narrowed.Decade == nil {
		t.Fatal("the decade section vanished under a facet it can answer")
	}
	wantTitles(t, "faceted decade books", bookTitles(narrowed.Decade.Books), []string{"Sixties Fantasy"})
}

func TestFacetsReachTheNotesSection(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Noted"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "one", "note": "a remark about weather", "color": "blue",
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "two", "note": "another remark about weather", "color": "pink",
	}, http.StatusCreated)

	all := searchWith(t, c, "q=weather&scope=annotations")
	wantTitles(t, "notes", quoteTexts(all.Notes.Annotations), []string{"one", "two"})

	narrowed := searchWith(t, c, "q=weather&scope=annotations&colour=blue")
	wantTitles(t, "faceted notes", quoteTexts(narrowed.Notes.Annotations), []string{"one"})
}

func TestFacetsReachTheCreditSections(t *testing.T) {
	// Authors/Directors/Actors/Speakers are FTS matches on a name column, so
	// they are the sections most likely to be forgotten when a predicate is
	// added — they are built by grouping, not by a plain listing.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/books", map[string]any{
		"title": "Early Le Guin", "author": "Ursula K. Le Guin", "published_year": 1968,
	}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{
		"title": "Later Le Guin", "author": "Ursula K. Le Guin", "published_year": 1974,
	}, http.StatusCreated)

	all := searchWith(t, c, "q=guin&scope=books")
	if len(all.Authors) != 1 {
		t.Fatalf("authors = %+v, want one", all.Authors)
	}
	wantTitles(t, "author books", bookTitles(all.Authors[0].Books), []string{"Early Le Guin", "Later Le Guin"})

	narrowed := searchWith(t, c, "q=guin&scope=books&year=1974")
	if len(narrowed.Authors) != 1 {
		t.Fatalf("faceted authors = %+v, want one", narrowed.Authors)
	}
	wantTitles(t, "faceted author books", bookTitles(narrowed.Authors[0].Books), []string{"Later Le Guin"})
}

func TestFacetsReachTheDateAddedSection(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/books", map[string]any{"title": "Starred Today", "favorite": true}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{"title": "Plain Today"}, http.StatusCreated)

	today := decode[searchResults](t, c.mustDo("GET", "/search?q="+todayISO()+"&scope=books", nil, http.StatusOK))
	if today.DateAdded == nil {
		t.Fatal("no date-added section for today")
	}
	wantTitles(t, "date books", bookTitles(today.DateAdded.Books), []string{"Plain Today", "Starred Today"})

	narrowed := decode[searchResults](t, c.mustDo("GET",
		"/search?q="+todayISO()+"&scope=books&favourite=yes", nil, http.StatusOK))
	if narrowed.DateAdded == nil {
		t.Fatal("the date-added section vanished under a facet it can answer")
	}
	wantTitles(t, "faceted date books", bookTitles(narrowed.DateAdded.Books), []string{"Starred Today"})
}

// ---- what a facet cannot describe ------------------------------------------

// A facet that a kind of row has no column for must EMPTY that kind, not be
// ignored for it. There are a dozen places in the compiler that decide this and
// exactly one way to get them wrong, so the rule is checked once per facet
// rather than once.
//
// The failure this catches is the quiet one: ignoring `speaker:` for books
// leaves every book in the library sitting under a heading that says these
// results are by that speaker. Every row is real, nothing errors, and the answer
// is to a question nobody asked.
func TestAFacetEmptiesTheKindsItCannotDescribe(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "kestrel book", "author": "Jay Kestrel", "series": "Kestrel",
		"published_year": 1968, "genres": []string{"birds"}, "favorite": true,
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "kestrel annotation", "note": "a note",
		"color": "blue", "tags": []string{"birds"},
	}, http.StatusCreated)
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "kestrel movie", "director": "Jay Kestrel", "series": "Kestrel",
		"release_year": 1968, "genres": []string{"birds"}, "favorite": true,
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "kestrel dialogue", "note": "a note",
		"color": "blue", "actor": "Jay Kestrel", "tags": []string{"birds"},
	}, http.StatusCreated)
	newUtterance(t, c, map[string]any{
		"quote": "kestrel quote", "note": "a note", "color": "blue",
		"speaker": "Jay Kestrel", "tags": []string{"birds"},
	})

	// Sanity: with no facet at all, every one of the five sections has its row.
	base := searchWith(t, c, "q=kestrel")
	if len(base.Books) == 0 || len(base.Annotations) == 0 || len(base.Movies) == 0 ||
		len(base.Dialogues) == 0 || len(base.Quotes) == 0 {
		t.Fatalf("the fixture does not reach all five sections: b=%d a=%d m=%d d=%d q=%d",
			len(base.Books), len(base.Annotations), len(base.Movies), len(base.Dialogues), len(base.Quotes))
	}

	for _, tc := range []struct {
		facet string
		// The sections that must come back EMPTY, named as they read in the API.
		empty []string
	}{
		{"tag=birds", []string{"books", "movies"}},
		{"colour=blue", []string{"books", "movies"}},
		{"genre=Birds", []string{"quotes"}},
		{"series=Kestrel", []string{"quotes"}},
		{"year=1968", []string{"quotes"}},
		{"shelf=reading", []string{"quotes"}},
		{"author=Kestrel", []string{"movies", "dialogues", "quotes"}},
		{"director=Kestrel", []string{"books", "annotations", "quotes"}},
		{"actor=Kestrel", []string{"books", "annotations", "movies", "quotes"}},
		{"speaker=Kestrel", []string{"books", "annotations", "movies", "dialogues"}},
		{"note=yes", []string{"books", "movies"}},
		{"wishlist=no", []string{"annotations", "dialogues", "quotes"}},
	} {
		res := searchWith(t, c, "q=kestrel&"+tc.facet)
		got := map[string]int{
			"books": len(res.Books), "annotations": len(res.Annotations),
			"movies": len(res.Movies), "dialogues": len(res.Dialogues), "quotes": len(res.Quotes),
		}
		for _, name := range tc.empty {
			if got[name] != 0 {
				t.Errorf("%s: %s came back with %d rows; a facet that section cannot answer was ignored rather than applied",
					tc.facet, name, got[name])
			}
		}
	}
}

// ---- isolation -------------------------------------------------------------

func TestFacetsCannotReachAnotherAccount(t *testing.T) {
	// Every facet query carries its own user scope, and for annotations and
	// dialogues that scope is a JOIN to the parent rather than a column. A facet
	// that narrowed without it would be a cross-account read dressed up as a
	// search result.
	h := newTestServer(t).Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	book := decode[bookDetail](t, admin.mustDo("POST", "/books", map[string]any{
		"title": "Admin's Book", "author": "Ursula K. Le Guin", "series": "Hainish",
		"published_year": 1974, "genres": []string{"science fiction"}, "favorite": true,
	}, http.StatusCreated))
	admin.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "a private passage", "tags": []string{"secretive"}, "color": "blue",
	}, http.StatusCreated)
	newUtterance(t, admin, map[string]any{"quote": "a private line", "speaker": "Bose", "tags": []string{"secretive"}})

	for _, q := range []string{
		"scope=books&author=Le+Guin",
		"scope=books&series=Hainish",
		"scope=books&year=1974",
		"scope=books&genre=Science+Fiction",
		"scope=books&favourite=yes",
		"scope=books&wishlist=yes",
		"scope=annotations&tag=secretive",
		"scope=annotations&colour=blue",
		"scope=quotes&tag=secretive",
		"scope=quotes&speaker=Bose",
		"q=passage&scope=annotations&note=no",
	} {
		res := searchWith(t, bob, q)
		n := len(res.Books) + len(res.Annotations) + len(res.Movies) + len(res.Dialogues) + len(res.Quotes) +
			len(res.Authors) + len(res.Directors) + len(res.Actors) + len(res.Speakers) +
			len(res.Notes.Annotations) + len(res.Notes.Dialogues) + len(res.Notes.Quotes) +
			len(res.Tags) + len(res.Genres)
		if n != 0 {
			t.Errorf("bob saw %d rows through %q: %+v", n, q, res)
		}
	}
}
