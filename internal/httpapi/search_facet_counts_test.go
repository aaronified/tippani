package httpapi

import (
	"net/url"
	"testing"
	"time"
)

// Counts beside each facet value.
//
// THE ONE THING A COUNT MUST NEVER DO is describe a different set of rows from
// the list it sits beside. A wrong number is not a cosmetic defect here: it is
// the reader deciding not to press something because it said 0, or pressing it
// and landing on an empty screen. Both are silent.
//
// So most of what follows is the same question asked twice — once of
// /search/facets and once of /search — and compared.

type facetCounts map[string]map[string]int

func countsOf(t *testing.T, c *testClient, qs string) facetCounts {
	t.Helper()
	return decode[facetCounts](t, c.mustDo("GET", "/search/facets?"+qs, nil, 200))
}

// countLibrary builds one small library that exercises every shape the counter
// has: a joined credit, a shared tag across two kinds, a colour, a wishlist
// work, a note, and a series.
func countLibrary(t *testing.T, c *testClient) (int64, int64) {
	t.Helper()
	b1 := idOf(t, c.mustDo("POST", "/books", map[string]any{
		"title": "Good Omens", "author": "Gaiman & Pratchett",
		"series": "None", "genres": []string{"fantasy"}, "status": "reading",
	}, 201).Body.Bytes())
	b2 := idOf(t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Dispossessed", "author": "Ursula K. Le Guin", "genres": []string{"science fiction"},
	}, 201).Body.Bytes())
	// A book with no quotes in it IS the wishlist (0024).
	c.mustDo("POST", "/books", map[string]any{"title": "Unread", "author": "Nobody"}, 201)

	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": b1, "quote": "the ineffable plan", "color": "blue",
		"tags": []string{"faith", "funny"},
	}, 201)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": b1, "quote": "a second line about the plan", "color": "blue", "tags": []string{"faith"},
	}, 201)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": b2, "quote": "a wall on the plan of the world", "color": "pink",
		"note": "worth returning to", "tags": []string{"faith"},
	}, 201)

	m1 := idOf(t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Casablanca", "director": "Michael Curtiz",
	}, 201).Body.Bytes())
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m1, "quote": "a plan for the letters", "actor": "Humphrey Bogart",
		"character": "Rick Blaine", "tags": []string{"faith"},
	}, 201)
	return b1, m1
}

func TestFacetCountsMatchTheHitsTheyDescribe(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	countLibrary(t, c)

	got := countsOf(t, c, "q=plan")

	// `faith` is on three annotations and one dialogue: four hits for "plan".
	if got["tag"]["faith"] != 4 {
		t.Errorf("tag:faith = %d, want 4 across both kinds", got["tag"]["faith"])
	}
	if got["tag"]["funny"] != 1 {
		t.Errorf("tag:funny = %d, want 1", got["tag"]["funny"])
	}
	// And the count is the same number the search itself returns.
	res := decode[searchResults](t, c.mustDo("GET", "/search?q=plan&tag=faith", nil, 200))
	inList := len(res.Annotations) + len(res.Dialogues) + len(res.Characters)
	if inList != got["tag"]["faith"] {
		t.Errorf("tag:faith counted %d and listed %d — a count that disagrees with its own list is worse than none",
			got["tag"]["faith"], inList)
	}
}

// A JOINED credit is one column and two authors. The count has to land on each
// name, because that is the name the vocabulary offers and the facet matches.
func TestFacetCountsSplitAJoinedCredit(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	countLibrary(t, c)

	got := countsOf(t, c, "q=plan")
	if got["author"]["Gaiman"] != got["author"]["Pratchett"] || got["author"]["Gaiman"] == 0 {
		t.Fatalf("authors = %v, want both halves of the pair counted", got["author"])
	}
	if _, ok := got["author"]["Gaiman & Pratchett"]; ok {
		t.Error("the joined string is not a value anything can be narrowed to")
	}
}

// THE COMBINING RULE, which is the only real decision in the whole feature.
func TestFacetCountsFollowTheCombiningRule(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	countLibrary(t, c)

	// AND field: with `tag:faith` up, the number beside `tag:funny` is how many
	// wear BOTH — which is what pressing it will do.
	withTag := countsOf(t, c, "q=plan&tag=faith")
	if withTag["tag"]["funny"] != 1 {
		t.Errorf("tag:funny under tag:faith = %d, want the intersection (1)", withTag["tag"]["funny"])
	}

	// OR field: with `colour:blue` up, the number beside `colour:pink` must be
	// what allowing pink AS WELL would give — not the zero you get by asking for
	// a quote that is both colours at once. Counting an OR field with its own
	// chips applied makes every unpicked value read 0 forever, which makes the
	// panel look broken exactly when it is working.
	withColour := countsOf(t, c, "q=plan&colour=blue")
	if withColour["colour"]["pink"] == 0 {
		t.Errorf("colour:pink under colour:blue = 0 — an OR facet must be counted without its own values")
	}
	if withColour["colour"]["blue"] == 0 {
		t.Error("the picked value still needs its own count")
	}
}

// A count of zero is REPORTED rather than dropped from the map, so the panel can
// grey the value instead of removing it. A value that vanishes when you narrow
// reads as "I mis-remembered my library"; a grey one reads as "not under this
// question", which is the answer and tells you which chip to take off.
func TestFacetCountsOmitOnlyWhatIsNotAValue(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	countLibrary(t, c)

	got := countsOf(t, c, "q=plan")
	// A row with no author is not an author called "".
	if _, ok := got["author"][""]; ok {
		t.Error("the empty string is not a facet value")
	}
	// Nor is an unset year a year.
	if _, ok := got["year"]["0"]; ok {
		t.Error("year 0 is 'no year recorded', not a year")
	}
	// The flags answer in the words the grammar uses, not in 1/0 — a second
	// mapping on the client is a second thing to disagree with.
	if got["favourite"]["no"] == 0 {
		t.Errorf("favourite = %v, want yes/no keys", got["favourite"])
	}
	if got["note"]["yes"] != 1 {
		t.Errorf("note = %v, want the one annotation carrying a note", got["note"])
	}
	// The wishlist book is NOT here, and that is right: it is a book with nothing
	// quoted from it and a title that does not say "plan", so it is not a hit for
	// this query and must not be counted as one. The panel opens before anything
	// is typed, though, so the no-query case is the one that has to answer.
	if _, ok := got["wishlist"]["yes"]; ok {
		t.Errorf("wishlist = %v, want nothing — the unread book is not a hit for 'plan'", got["wishlist"])
	}
	bare := countsOf(t, c, "")
	if bare["wishlist"]["yes"] != 1 {
		t.Errorf("wishlist with no query = %v, want the one book with nothing quoted from it", bare["wishlist"])
	}
	if bare["author"]["Nobody"] != 1 {
		t.Errorf("authors with no query = %v, want the unread book's author counted", bare["author"])
	}
}

// The counter reads its own table of which kinds a field applies to, and
// where() reads another. Two tables for one rule is the drift this repo names
// over and over — so they are walked against each other rather than trusted.
func TestFacetCountKindsMatchTheFacetPredicates(t *testing.T) {
	all := []rowKind{rowBook, rowAnnotation, rowMovie, rowDialogue, rowUtterance}
	// One value per field, so where() has something to compile.
	probe := map[string]searchFacets{
		"tag":       {tags: []string{"x"}},
		"genre":     {genres: []string{"x"}},
		"colour":    {colours: []string{"blue"}},
		"shelf":     {shelves: []string{"reading"}},
		"series":    {series: []string{"x"}},
		"year":      {years: []int{1999}},
		"author":    {authors: []string{"x"}},
		"director":  {directors: []string{"x"}},
		"actor":     {actors: []string{"x"}},
		"character": {characters: []string{"x"}},
		"speaker":   {speakers: []string{"x"}},
		"wishlist":  {wishlist: boolPtr(true)},
		"note":      {note: boolPtr(true)},
		"book":      {bookIDs: []int64{1}},
		"movie":     {movieIDs: []int64{1}},
	}
	for field, f := range probe {
		applies := map[rowKind]bool{}
		for _, k := range all {
			if _, _, ok := f.where(k, 1); ok {
				applies[k] = true
			}
		}
		counted := map[rowKind]bool{}
		for _, k := range facetCountKinds[field] {
			counted[k] = true
		}
		for _, k := range all {
			if applies[k] != counted[k] {
				t.Errorf("%s: where() says applies=%v for kind %v, facetCountKinds says %v",
					field, applies[k], k, counted[k])
			}
		}
	}
}

func boolPtr(b bool) *bool { return &b }

// Isolation, because this endpoint reports on the whole library at once and a
// leak here would be a census of somebody else's shelves.
func TestFacetCountsAreScopedToOneAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	countLibrary(t, admin)

	got := countsOf(t, bob, "q=plan")
	for field, values := range got {
		for v, n := range values {
			t.Errorf("%s offered bob %q = %d from somebody else's library", field, v, n)
		}
	}
}

// A malformed facet is a 400 here exactly as it is on /search — the counts are
// an answer to the same question and must refuse the same requests.
func TestFacetCountsRejectAnUnknownFacet(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("GET", "/search/facets?q=x&"+url.Values{"nonsense": {"1"}}.Encode(), nil, 400)
}

// Date ranges (roadmap §3). The single-day `date_added` facet has existed since
// the Stats calendar linked into it; a RANGE is what "what did I save in the
// first half of last year" needs.
func TestSearchNarrowsToAnAddedOnRange(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	b := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "Ranged"}, 201).Body.Bytes())
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": b, "quote": "a line about time"}, 201).Body.Bytes())

	// Everything is created "now", so a range around today includes it and a
	// range that ends yesterday does not.
	today := time.Now().UTC().Format("2006-01-02")
	yesterday := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	tomorrow := time.Now().UTC().AddDate(0, 0, 1).Format("2006-01-02")

	in := decode[searchResults](t, c.mustDo("GET",
		"/search?q=time&added_from="+yesterday+"&added_to="+tomorrow, nil, 200))
	if len(in.Annotations) != 1 || in.Annotations[0].ID != id {
		t.Fatalf("a range containing today missed it: %+v", in.Annotations)
	}

	// THE UPPER BOUND IS THE ONE THAT BREAKS. created_at is a datetime, so a
	// naive `<= today` compares '2026-08-17' against '2026-08-17 14:32:00' as
	// SMALLER and silently drops everything saved after midnight on the last day
	// of every range anybody asks for.
	sameDay := decode[searchResults](t, c.mustDo("GET",
		"/search?q=time&added_from="+today+"&added_to="+today, nil, 200))
	if len(sameDay.Annotations) != 1 {
		t.Fatalf("a single-day range lost a quote saved during that day: %+v", sameDay.Annotations)
	}

	out := decode[searchResults](t, c.mustDo("GET",
		"/search?q=time&added_to="+yesterday, nil, 200))
	if len(out.Annotations) != 0 {
		t.Fatalf("a range ending yesterday included today: %+v", out.Annotations)
	}

	// A malformed date is a 400, like every other malformed facet — answering
	// with an unnarrowed result set would look exactly like a correct answer.
	c.mustDo("GET", "/search?q=time&added_from=last%20tuesday", nil, 400)

	// And the range alone is a whole search: no free text needed, the same rule
	// a chips-only search follows.
	only := decode[searchResults](t, c.mustDo("GET",
		"/search?added_from="+yesterday+"&added_to="+tomorrow, nil, 200))
	if len(only.Annotations) != 1 {
		t.Fatalf("a range with no query is still a search: %+v", only.Annotations)
	}
}
