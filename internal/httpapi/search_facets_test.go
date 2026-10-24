package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"testing"
	"time"
)

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

// ---- the colour facet ------------------------------------------------------

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

// ---- the language facet ------------------------------------------------------

// THE FIELD THE LANGUAGE WORK WAS ABOUT, AND THE LAST ONE IT WAS MISSING. Every
// quote kind has carried a language for a while — utterances since 0035,
// annotations and dialogues since 0071 — and `/search/vocabulary` has shipped the
// distinct list since Settings needed a table of them. Nothing consumed it for
// search, so a reader with a Bengali shelf and a Sanskrit one could narrow by tag,
// colour, shelf and fourteen other things, and not by that.
func TestTheLanguageFacetReachesAllThreeQuoteKinds(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Gitanjali", "author": "Rabindranath Tagore",
	}, http.StatusCreated))
	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Pather Panchali", "director": "Satyajit Ray",
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "here the highlight", "language": "Bengali",
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "here the other highlight", "language": "English",
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "here the line", "language": "Bengali",
	}, http.StatusCreated)
	newUtterance(t, c, map[string]any{"quote": "here the proverb", "language": "Bengali"})
	newUtterance(t, c, map[string]any{"quote": "here the saying", "language": "Sanskrit"})

	// All three kinds, one facet — the row set `tag` and `colour` already use.
	res := searchWith(t, c, "q=here&language=Bengali")
	wantTitles(t, "language:Bengali annotations", quoteTexts(res.Annotations), []string{"here the highlight"})
	wantTitles(t, "language:Bengali dialogues", dialogueTexts(res.Dialogues), []string{"here the line"})
	wantTitles(t, "language:Bengali quotes", utteranceTexts(res.Quotes), []string{"here the proverb"})

	// Two languages UNION, for the reason two colours do: a line is in ONE
	// language, so ANDing them asks for something nothing is.
	both := searchWith(t, c, "q=here&scope=quotes&language=Bengali&language=Sanskrit")
	wantTitles(t, "language:Bengali language:Sanskrit", utteranceTexts(both.Quotes),
		[]string{"here the proverb", "here the saying"})
}

func TestTheLanguageFacetFoldsCaseAndMatchesWhole(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// A language is FREE TEXT on the row, so one language can be stored two ways
	// by a reader who typed it twice. /search/vocabulary folds the list it offers
	// for exactly that reason; a facet that did not fold would hand back a chip
	// drawn from that list and find half the rows behind it.
	newUtterance(t, c, map[string]any{"quote": "here the first", "language": "Bengali"})
	newUtterance(t, c, map[string]any{"quote": "here the second", "language": "bengali"})
	res := searchWith(t, c, "q=here&scope=quotes&language=BENGALI")
	wantTitles(t, "language:BENGALI", utteranceTexts(res.Quotes), []string{"here the first", "here the second"})

	// AND IT IS A WHOLE-VALUE MATCH, NOT A CONTAINS. The credit facets tokenise
	// and ask whether the column contains each word, which is right for a line
	// holding several names and wrong here: a language is one value, and
	// `language:English` must not drag in every row written in Old English.
	newUtterance(t, c, map[string]any{"quote": "here the third", "language": "Old English"})
	res = searchWith(t, c, "q=here&scope=quotes&language=English")
	wantTitles(t, "language:English", utteranceTexts(res.Quotes), []string{})
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

// ---- the request contract --------------------------------------------------

// Every way a search request is refused before a single row is read: an
// unknown facet key, a facet value outside its vocabulary, a request carrying
// nothing to search for, and a work facet that is not an id. All of them are
// the same call — one GET that must answer 400 — so the rows share one server:
// none of them seeds anything, so no row can see another row's state.
func TestSearchRejectsAMalformedRequest(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	for _, tc := range []struct {
		name string
		path string
	}{
		// A typo'd facet that is quietly dropped returns a WIDER result set that
		// looks exactly like a correct answer. Rejecting it is the only way the
		// reader ever finds out the narrowing did not happen.
		{"unknown facet key: tags", "/search?q=x&tags=stoicism"},
		{"unknown facet key: colours", "/search?q=x&colours=blue"},
		{"unknown facet key: nonsense", "/search?q=x&nonsense=1"},

		// The colour vocabulary is closed by a CHECK constraint, so a seventh colour
		// can never match and saying so beats an empty result.
		{"malformed facet value: a colour outside the vocabulary", "/search?q=x&colour=turquoise"},
		{"malformed facet value: a year that is not a number", "/search?q=x&year=nineteen"},
		{"malformed facet value: a favourite that is neither yes nor no", "/search?q=x&favourite=maybe"},

		// Neither free text nor a facet is not a search, it is a request for the
		// whole library.
		{"nothing to go on: no query and no facet", "/search"},
		{"nothing to go on: a scope and nothing else", "/search?scope=books"},

		// The chip shows a title and sends an id. A title arriving here means the
		// two halves have come apart, which is worth a 400 rather than no results.
		{"a work facet that is not an id: a book title", "/search?q=x&book=The+Dispossessed"},
		{"a work facet that is not an id: book zero", "/search?q=x&book=0"},
		{"a work facet that is not an id: a negative movie id", "/search?q=x&movie=-3"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// Rebound to this subtest's t so a row that answers anything but 400
			// fails as that row, rather than as a Goexit out of the parent.
			sub := &testClient{t: t, h: h, cookie: c.cookie}
			sub.mustDo("GET", tc.path, nil, http.StatusBadRequest)
		})
	}
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

// ---- one work --------------------------------------------------------------

func TestAWorkIDIsNotAWayIntoAnotherAccount(t *testing.T) {
	// The one facet whose value is guessable. Ids are sequential, so `book=1`
	// is a thing a stranger can type — and the user scope has to be what stops
	// it, not the id being secret.
	h := newTestServer(t).Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	book := decode[bookDetail](t, admin.mustDo("POST", "/books", map[string]any{"title": "Kestrel Private"}, http.StatusCreated))
	admin.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID, "quote": "kestrel secret"}, http.StatusCreated)

	res := searchWith(t, bob, "q=kestrel&book="+itoa(book.ID))
	if len(res.Books) != 0 || len(res.Annotations) != 0 {
		t.Errorf("bob read account 1's book %d: %v / %v", book.ID, bookTitles(res.Books), quoteTexts(res.Annotations))
	}
}

// The malformed-work-facet cases (a title where an id belongs, a zero id, a
// negative id) live in TestSearchRejectsAMalformedRequest with the rest of the
// 400s.

// ---- what a facet cannot describe ------------------------------------------

// ---- two silent wrong answers the review found ------------------------------

func TestACreditFacetMatchesANameThatIsNotEnglish(t *testing.T) {
	// THE FAILURE WAS TOTAL AND SILENT, over a value the app itself had just
	// offered. The credit facets lowered the value with Go's strings.ToLower — a
	// full Unicode fold — and compared it against SQLite's lower(), which folds
	// ASCII and nothing else. For "Marcus Aurelius" the two agree by accident;
	// for "Лев Толстой" they cannot, so the facet returned no rows at all for a
	// name GET /search/vocabulary lists as a dropdown option.
	//
	// The ASCII case is in here as the control, because a fix that broke it
	// would look exactly like a fix that worked.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/books", map[string]any{"title": "War and Peace", "author": "Лев Толстой"}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{"title": "Nana", "author": "Émile Zola"}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{"title": "Meditations", "author": "Marcus Aurelius"}, http.StatusCreated)
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Solaris", "director": "Андрей Тарковский",
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "a line", "actor": "Донатас Банионис",
	}, http.StatusCreated)
	newUtterance(t, c, map[string]any{"quote": "a saying", "speaker": "Ῥαβινδρανάθ"})

	for _, tc := range []struct {
		query string
		want  []string
	}{
		{"scope=books&author=Marcus", []string{"Meditations"}},
		{"scope=books&author=" + urlQueryEscape("Лев Толстой"), []string{"War and Peace"}},
		{"scope=books&author=" + urlQueryEscape("Толстой"), []string{"War and Peace"}},
		{"scope=books&author=" + urlQueryEscape("Émile"), []string{"Nana"}},
	} {
		res := searchWith(t, c, tc.query)
		wantTitles(t, tc.query, bookTitles(res.Books), tc.want)
	}

	// The other three credit columns go through the same builder, so they would
	// have had the same hole.
	res := searchWith(t, c, "scope=movies&director="+urlQueryEscape("Тарковский"))
	wantTitles(t, "director", movieTitles(res.Movies), []string{"Solaris"})
	res = searchWith(t, c, "q=line&scope=dialogues&actor="+urlQueryEscape("Банионис"))
	wantTitles(t, "actor", dialogueTexts(res.Dialogues), []string{"a line"})
	res = searchWith(t, c, "q=saying&scope=quotes&speaker="+urlQueryEscape("Ῥαβινδρανάθ"))
	wantTitles(t, "speaker", utteranceTexts(res.Quotes), []string{"a saying"})
}

func TestATagWithNothingUnderItIsNotAResult(t *testing.T) {
	// The genre and decade facets already drop an empty group — "an orphaned
	// genre name is noise, not a result". The tag facet was the one of the three
	// that did not, and facets made the empty case routine: a tag matches the
	// query by NAME while a colour facet excludes everything wearing it.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Meditations"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "the obstacle is the way",
		"color": "green", "tags": []string{"stoicism"},
	}, http.StatusCreated)

	res := searchWith(t, c, "q=stoicism&colour=blue")
	if len(res.Tags) != 0 {
		t.Errorf("a tag heading over an empty box: %+v", res.Tags)
	}
}

func TestAnEmptyTagGroupDoesNotSwallowARealHit(t *testing.T) {
	// THE EXPENSIVE HALF, and the reason the one above is not merely cosmetic.
	// `total` counts GROUPS, so an empty tag group makes a search that found
	// nothing look like a search that found something — which skips the
	// cross-column fallback and the zero-hit typo pass.
	//
	// annotations_fts indexes quote and note as separate columns and the faceted
	// pass matches them one at a time, so a query spanning BOTH only ever lands
	// through the fallback. The A/B below changes exactly one thing: the NAME of
	// a tag on an unrelated row. Under the bug that alone lost the row the
	// reader was looking for.
	find := func(t *testing.T, tag string) searchResults {
		t.Helper()
		h := newTestServer(t).Handler()
		c := signupAdmin(t, h)
		book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Meditations"}, http.StatusCreated))
		// The row wanted: blue, "obstacle" in the quote and "wisdom" in the note.
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": book.ID, "quote": "the obstacle is the way",
			"note": "wisdom from Rome", "color": "blue",
		}, http.StatusCreated)
		// An unrelated green row, carrying a tag the facets exclude.
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": book.ID, "quote": "unrelated", "color": "green", "tags": []string{tag},
		}, http.StatusCreated)
		return searchWith(t, c, "q=obstacle+wisdom&colour=blue")
	}

	// A tag whose name has nothing to do with the query: the row is found.
	wantTitles(t, "control", quoteTexts(find(t, "gardening").Annotations), []string{"the obstacle is the way"})
	// A tag whose NAME matches both query tokens. Nothing else differs.
	wantTitles(t, "with a name-matched tag", quoteTexts(find(t, "obstacle wisdom").Annotations),
		[]string{"the obstacle is the way"})
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

// SEARCH HITS CARRY THEIR CHARACTERS' PICTURES, IN EVERY SECTION THAT HOLDS ONE
// (0050).
//
// The sections are assembled independently, so the risk this guards is a section
// nobody remembered — and the symptom would be a chip silently falling back to the
// actor on one part of the page and not another. It walks the three sections a
// dialogue hit reaches from one query: the quote match, the ACTOR match and the
// CHARACTER match.
//
// The actor section is included on purpose. The client decides which face to draw
// from the section it is rendering — the actor under Actors, the character
// elsewhere — so the data is present either way, and withholding it here would
// make the client's choice depend on what the server guessed the reader meant.
func TestSearchHitsCarryCharacterPictures(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film, withArt, _ := seedTVDBCast(t, srv, c)

	srv.fetchImage = func(context.Context, string, string) (string, error) {
		return "waller-stored.jpg", nil
	}
	c.mustDo("POST", "/cast/"+itoa(withArt)+"/image", nil, http.StatusOK)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "Squadron is a go.",
		"character": "Amanda Waller", "actor": "Viola Davis",
	}, http.StatusCreated)

	type hit struct {
		Quote           string `json:"quote"`
		CharacterImages []struct {
			Name string `json:"name"`
			Path string `json:"path"`
		} `json:"character_images"`
	}
	type resp struct {
		Dialogues []hit `json:"dialogues"`
		Actors    []struct {
			Name      string `json:"name"`
			Dialogues []hit  `json:"dialogues"`
		} `json:"actors"`
		Characters []struct {
			Name      string `json:"name"`
			Dialogues []hit  `json:"dialogues"`
		} `json:"characters"`
	}
	search := func(q string) resp {
		t.Helper()
		res := c.mustDo("GET", "/search?q="+q+"&scope=all", nil, http.StatusOK)
		var out resp
		if err := json.Unmarshal(res.Body.Bytes(), &out); err != nil {
			t.Fatalf("decode search: %v", err)
		}
		return out
	}

	// 1. THE QUOTE MATCHED — the words. The chip is the character's.
	byQuote := search("squadron")
	if len(byQuote.Dialogues) == 0 {
		t.Fatal("no dialogue hits for a quote match")
	}
	if n := len(byQuote.Dialogues[0].CharacterImages); n != 1 {
		t.Errorf("quote-match hit carries %d picture(s), want 1", n)
	}

	// 2. THE CHARACTER MATCHED — the section the chip is drawn from.
	byChar := search("waller")
	if len(byChar.Characters) == 0 {
		t.Fatal("no characters section for a character match")
	}
	if n := len(byChar.Characters[0].Dialogues); n == 0 {
		t.Fatal("the characters section holds no lines")
	}
	if n := len(byChar.Characters[0].Dialogues[0].CharacterImages); n != 1 {
		t.Errorf("character-section hit carries %d picture(s), want 1", n)
	}

	// 3. THE ACTOR MATCHED. The data is still attached, even though this section's
	// chips draw the actor.
	byActor := search("viola")
	if len(byActor.Actors) == 0 {
		t.Fatal("no actors section for an actor match")
	}
	if n := len(byActor.Actors[0].Dialogues); n == 0 {
		t.Fatal("the actors section holds no lines")
	}
	if n := len(byActor.Actors[0].Dialogues[0].CharacterImages); n != 1 {
		t.Errorf("actor-section hit carries %d picture(s), want 1 — the client picks "+
			"the face, so the server must not withhold it", n)
	}
}

// A quote keeps its colour when you search for it.
//
// Colour is not decoration here. Since 1.7.1 the six slots are CATEGORIES the
// reader names — doubt, joy, to-check — so a quote's colour is a field of the
// record in the same way its tags are. Every other surface carried it: the
// Library, a work's page, Home's favourites, the export, the share card.
//
// Search did not, and only for the two kinds that have a parent. `utteranceHit`
// selected `u.color` and had a Color field; `annotationHit` and `dialogueHit`
// had neither the column nor the field, so every book annotation and every film
// line came back with an empty colour. A library sorted into six named
// categories looked uncategorised the moment it was searched, and the share
// sheet opened from a result silently dropped the category line.
//
// The test asserts VALUES for all three kinds together, because the bug was
// exactly that two of the three disagreed with the other one, and a test for
// one kind would have gone on passing.

func TestSearchCarriesTheQuoteColour(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Dispossessed", "author": "Ursula K. Le Guin",
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "You cannot buy the revolution.", "color": "green",
	}, http.StatusCreated)

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Stalker", "director": "Andrei Tarkovsky", "release_year": 1979,
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Let everything that has been planned come true.",
		"character": "Stalker", "color": "purple",
	}, http.StatusCreated)

	newUtterance(t, c, map[string]any{
		"quote": "The revolution is not a dinner party.", "speaker": "Mao Zedong", "color": "pink",
	})

	// One query that reaches all three kinds at once, so a colour that goes
	// missing on only one of them cannot hide behind the other two.
	res := decode[searchResults](t, c.mustDo("GET", "/search?q=revolution", nil, http.StatusOK))

	if len(res.Annotations) != 1 {
		t.Fatalf("expected one annotation, got %d", len(res.Annotations))
	}
	if got := res.Annotations[0].Color; got != "green" {
		t.Errorf("annotation colour: got %q, want %q", got, "green")
	}
	if len(res.Quotes) != 1 {
		t.Fatalf("expected one quote, got %d", len(res.Quotes))
	}
	if got := res.Quotes[0].Color; got != "pink" {
		t.Errorf("quote colour: got %q, want %q", got, "pink")
	}

	// The dialogue's words do not contain "revolution", so it is fetched by its
	// own query rather than riding along on this one.
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=planned", nil, http.StatusOK))
	if len(res.Dialogues) != 1 {
		t.Fatalf("expected one dialogue, got %d", len(res.Dialogues))
	}
	if got := res.Dialogues[0].Color; got != "purple" {
		t.Errorf("dialogue colour: got %q, want %q", got, "purple")
	}
}

// A DECADE FACET THAT COULD NOT FIND A QUOTE.
//
// searchDecadeFacet took two booleans — books and movies — so the one kind of row
// that carries a date OF ITS OWN was the one kind it never looked at. A standalone
// quote is dated by `occasion_date`; a book highlight and a film line borrow their
// work's year and arrive here inside that work.
//
// THIS IS NOT A HYPOTHETICAL GAP. timelineYears counts those quotes into its bars
// — its UNION has a branch reading `substr(occasion_date, 1, 5)` for exactly them
// — and the timeline's ticks are doors into this facet. So a library holding one
// quote from 399 BCE drew a bar over that decade, and the door under the bar
// opened an empty page.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `occasion_date` is TEXT holding a partial date
// with a four-digit zero-padded year and a leading '-' for BCE. A decade query
// gives a year RANGE, and for a BCE decade the range is negative and runs from the
// higher absolute year — the 380s BCE is [-389, -380].
func TestADecadeFindsAStandaloneQuote(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())

	// One line per decade, so a hit proves the range and not merely the column.
	said := map[string]string{
		"-0399": "The unexamined life is not worth living.",
		"-0380": "The 380s BCE, at the far end of the decade.",
		"-0389": "The 380s BCE, at the near end of it.",
		"0040":  "A line from the first century, written for this test.",
		"1944":  "Give me blood, and I will give you freedom",
		"":      "A line with no date at all.",
	}
	for date, quote := range said {
		body := bose()
		body["quote"] = quote
		body["occasion_date"] = date
		newUtterance(t, c, body)
	}

	for _, tc := range []struct {
		q    string
		want []string
	}{
		{"390s BCE", []string{"-0399"}},
		// Both ends of one decade, and in chronological order rather than the
		// order the padded text would give: 389 BCE is earlier than 380 BCE.
		{"380s BCE", []string{"-0389", "-0380"}},
		// THE PADDED FORM for a year under 1000, because "40s" is the documented
		// shorthand for the 1940s — see TestParseDecade above. It is also the form
		// the stats timeline links with, which is the case that matters here.
		{"0040s", []string{"0040"}},
		{"1940s", []string{"1944"}},
		// THE UNDATED QUOTE MUST NOT ANSWER THIS. CAST('' AS INTEGER) is 0 and
		// "0s" is a legal query whose range is 0-9, so without the emptiness
		// guard this one search returns every undated quote in the library.
		{"0s", nil},
		{"1950s", nil},
	} {
		res := decode[searchResults](t, c.mustDo("GET", "/search?q="+url.QueryEscape(tc.q), nil, http.StatusOK))
		if tc.want == nil {
			if res.Decade != nil && len(res.Decade.Quotes) > 0 {
				t.Errorf("%q returned %d quote(s), want none: %+v", tc.q, len(res.Decade.Quotes), res.Decade.Quotes)
			}
			continue
		}
		if res.Decade == nil {
			t.Fatalf("%q returned no decade facet at all", tc.q)
		}
		if len(res.Decade.Quotes) != len(tc.want) {
			t.Fatalf("%q returned %d quote(s), want %d", tc.q, len(res.Decade.Quotes), len(tc.want))
		}
		for i, date := range tc.want {
			if got := res.Decade.Quotes[i].OccasionDate; got != date {
				t.Errorf("%q quote %d is dated %q, want %q", tc.q, i, got, date)
			}
		}
	}
}

// THE FACET ANSWERS TO THE SCOPE, which is what replacing the two booleans bought
// beyond the new kind: a books-only search must not return a quote, and a
// quotes-only one must not return a book.
func TestADecadeFacetRespectsTheScope(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	body := bose()
	body["occasion_date"] = "1944"
	newUtterance(t, c, body)
	c.mustDo("POST", "/books", map[string]any{"title": "A 1944 Book", "published_year": 1944}, http.StatusCreated)

	for _, tc := range []struct {
		scope  string
		books  int
		quotes int
	}{
		{"all", 1, 1},
		{"books", 1, 0},
		{"quotes", 0, 1},
	} {
		res := decode[searchResults](t, c.mustDo("GET", "/search?q=1940s&scope="+tc.scope, nil, http.StatusOK))
		if res.Decade == nil {
			t.Fatalf("scope %q returned no decade facet", tc.scope)
		}
		if len(res.Decade.Books) != tc.books || len(res.Decade.Quotes) != tc.quotes {
			t.Errorf("scope %q: %d book(s) and %d quote(s), want %d and %d",
				tc.scope, len(res.Decade.Books), len(res.Decade.Quotes), tc.books, tc.quotes)
		}
	}
}
