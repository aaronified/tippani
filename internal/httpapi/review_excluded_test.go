package httpapi

import (
	"net/http"
	"testing"

	"tippani/internal/metadata"
)

// WHAT THE LIST HAS TO GET RIGHT, and it is not "returns rows".
//
// The screen it feeds exists so a reader can find decisions they have forgotten
// making. A list that quietly omits a kind of quote is worse than no list: it
// answers "what have I excluded?" with a number that is wrong, and the reader
// stops looking.
func TestExcludedQuotesAreListedUnderTheirWork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "A Reference Manual")
	keep := decode[idResp](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "a line worth being asked about"}, http.StatusCreated))
	skip := decode[idResp](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "page 41, see appendix"}, http.StatusCreated))

	// Nothing excluded yet: the list is empty rather than absent, so a screen can
	// draw "nothing here" without telling a loading state from an empty one.
	got := decode[excludedResp](t, c.mustDo("GET", "/review/excluded", nil, http.StatusOK))
	if got.Total != 0 || len(got.Groups) != 0 {
		t.Fatalf("a library with nothing excluded: %+v", got)
	}

	// THE PATH THE APP ITSELF USES. review.jsx excludes a card with
	// POST /<kind>s/bulk {ids, review:false} — one endpoint for one quote and for
	// forty — so a test that wrote the column another way would be proving
	// something no reader can reach.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{skip.ID}, "review": false}, http.StatusOK)

	got = decode[excludedResp](t, c.mustDo("GET", "/review/excluded", nil, http.StatusOK))
	if got.Total != 1 {
		t.Fatalf("one quote excluded, total says %d", got.Total)
	}
	if len(got.Groups) != 1 {
		t.Fatalf("want one group, got %d", len(got.Groups))
	}
	g := got.Groups[0]
	if g.Title != "A Reference Manual" {
		t.Errorf("the group should be named for the work: %q", g.Title)
	}
	if g.WorkID != book {
		t.Errorf("the group should carry the work's id so the screen can unskip the lot: %d", g.WorkID)
	}
	if len(g.Quotes) != 1 || g.Quotes[0].ID != skip.ID {
		t.Fatalf("want only the excluded quote: %+v", g.Quotes)
	}
	// THE ONE THAT IS STILL ASKED ABOUT MUST NOT BE HERE. A list that showed every
	// quote of a work with one excluded would read as the whole book being skipped.
	for _, q := range g.Quotes {
		if q.ID == keep.ID {
			t.Error("a quote still in the deck is listed as never asked about")
		}
	}
	if g.Quotes[0].Text == "" {
		t.Error("a quote with no words cannot be recognised by the reader who excluded it")
	}

	// AND PUTTING IT BACK EMPTIES THE LIST, which is the whole point of the screen
	// and the half a read-only test would miss.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{skip.ID}, "review": true}, http.StatusOK)
	got = decode[excludedResp](t, c.mustDo("GET", "/review/excluded", nil, http.StatusOK))
	if got.Total != 0 {
		t.Fatalf("after putting it back, total says %d", got.Total)
	}
}

// ANOTHER ACCOUNT'S EXCLUSIONS ARE NOT YOURS, which is the repo's standing
// invariant and is worth one case on every new listing endpoint: this one joins
// to a parent table, and per-user scoping on a join is exactly where it gets
// dropped.
func TestExcludedQuotesAreScopedToTheirOwner(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	mine := signupAdmin(t, h)
	book := createBook(t, mine, "Mine")
	q := decode[idResp](t, mine.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "a line of my own"}, http.StatusCreated))
	mine.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{q.ID}, "review": false}, http.StatusOK)

	other := addUser(t, h, mine, "someone")
	got := decode[excludedResp](t, other.mustDo("GET", "/review/excluded", nil, http.StatusOK))
	if got.Total != 0 || len(got.Groups) != 0 {
		t.Fatalf("another account can see what I excluded: %+v", got)
	}
}

type idResp struct {
	ID int64 `json:"id"`
}

type excludedResp struct {
	Groups []excludedGroup `json:"groups"`
	Total  int             `json:"total"`
}

// THE LIST HAS TO BE RECOGNISABLE, and a title on its own is not.
//
// The screen this feeds asks a reader to find decisions they have forgotten
// making, months after making them — and what a person recognises their own
// library by is the cover and the name on it. A film's row must carry its poster
// and its director; a book's, its cover and its author. Reaching for the wrong
// column is the failure with no symptom: it matches nothing, which looks exactly
// like a work that has no artwork, which is an ordinary state. So both sources
// are asserted here, and the film is the one that fails if the columns are
// crossed.
func TestExcludedWorksCarryTheirArtworkAndTheirCredit(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Astronomical Algorithms")
	c.mustDo("PUT", "/books/"+itoa(book),
		map[string]any{"title": "Astronomical Algorithms", "author": "Jean Meeus"}, http.StatusOK)
	// THE ARTWORK IS WRITTEN DIRECTLY. The path that fills it fetches a file from
	// a provider, and what is under test is which column this list reads.
	if _, err := srv.Store.DB.Exec(`UPDATE books SET cover_path = 'meeus.jpg' WHERE id = ?`, book); err != nil {
		t.Fatal(err)
	}
	ann := decode[idResp](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "see table 27.A"}, http.StatusCreated))
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{ann.ID}, "review": false}, http.StatusOK)

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker", "director": "Andrei Tarkovsky"}, http.StatusCreated))
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET poster_path = 'stalker.jpg' WHERE id = ?`, movie.ID); err != nil {
		t.Fatal(err)
	}
	dia := decode[idResp](t, c.mustDo("POST", "/dialogues",
		map[string]any{"movie_id": movie.ID, "quote": "Let everything come true."}, http.StatusCreated))
	c.mustDo("POST", "/dialogues/bulk", map[string]any{"ids": []int64{dia.ID}, "review": false}, http.StatusOK)

	got := decode[excludedResp](t, c.mustDo("GET", "/review/excluded", nil, http.StatusOK))
	want := map[string][2]string{
		"Astronomical Algorithms": {"meeus.jpg", "Jean Meeus"},
		"Stalker":                 {"stalker.jpg", "Andrei Tarkovsky"},
	}
	if len(got.Groups) != len(want) {
		t.Fatalf("want a group per work, got %d", len(got.Groups))
	}
	for _, g := range got.Groups {
		w, ok := want[g.Title]
		if !ok {
			t.Fatalf("a group for a work nobody skipped: %q", g.Title)
		}
		if g.Art != w[0] {
			t.Errorf("%s: artwork is %q, want %q", g.Title, g.Art, w[0])
		}
		if len(g.People) != 1 || g.People[0].Name != w[1] {
			t.Errorf("%s: credit is %v, want %q", g.Title, g.People, w[1])
		}
	}
}

// THE NAMES UNDER A TITLE ARE PEOPLE, AND EACH ONE IS A DOOR.
//
// This used to split by hand on comma, semicolon and ampersand, and a rating
// measured what that did: "Martin Luther King, Jr." became two chips, the second
// of them "Jr.", and "Gaiman and Pratchett" stayed one. A chip on this screen
// opens a person, so a fragment is a press onto a record that does not exist.
// The rule lives in metadata.SplitCredits and these are the cases that told the
// two apart; the ceiling of two is this screen's own, because the row is a
// phone's width.
func TestTheNamesUnderASkippedWorkAreWholePeople(t *testing.T) {
	for _, tc := range []struct {
		credit string
		want   []string
	}{
		{"", nil},
		{"   ", nil},
		{"Jean Meeus", []string{"Jean Meeus"}},
		// THE SUFFIX RE-ATTACHES. Two chips here, the second reading "Jr.", is the
		// finding this case exists for.
		{"Martin Luther King, Jr.", []string{"Martin Luther King, Jr."}},
		// AND " and " IS A SEPARATOR when both sides are names.
		{"Neil Gaiman and Terry Pratchett", []string{"Neil Gaiman", "Terry Pratchett"}},
		{"Gilbert & Sullivan", []string{"Gilbert", "Sullivan"}},
		{"A. Smith, B. Jones; C. Ray, D. Fox", []string{"A. Smith", "B. Jones"}},
	} {
		got := creditNames(tc.credit, metadata.DefaultCreditSeps)
		if len(got) != len(tc.want) {
			t.Fatalf("%q -> %v, want %v", tc.credit, got, tc.want)
		}
		for i := range got {
			if got[i] != tc.want[i] {
				t.Errorf("%q -> %v, want %v", tc.credit, got, tc.want)
			}
		}
	}

	// AND THE READER'S OWN SETTING IS HONOURED, which is the whole reason this
	// calls the shared splitter rather than keeping its own rule: somebody whose
	// shelf holds "Rowling, J. K." turns the comma off, and this list has to stop
	// splitting on it too.
	noComma := metadata.ParseCreditSeps("semicolon,amp")
	if got := creditNames("Rowling, J. K.", noComma); len(got) != 1 || got[0] != "Rowling, J. K." {
		t.Errorf("with the comma switched off: %v", got)
	}
}

// AND THE ENDPOINT READS THE READER'S SETTING, which the case above cannot say.
//
// THE LESSON THIS REPO KEEPS RELEARNING: a pure test of a splitter proves the
// splitter, not that anything calls it with the right argument. Swapping the
// handler's `s.creditSeps(q, uid)` for the default set leaves every case above
// green — so the preference is set here, through the route that stores it, and
// asked of the route that reads it.
func TestTheSkippedListSplitsCreditsTheWayTheReaderAsked(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// A shelf whose names carry commas — the case creditSeparators exists for.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"creditSeparators": "semicolon,amp"}, http.StatusOK)

	book := createBook(t, c, "Fantastic Beasts")
	c.mustDo("PUT", "/books/"+itoa(book),
		map[string]any{"title": "Fantastic Beasts", "author": "Rowling, J. K."}, http.StatusOK)
	ann := decode[idResp](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "a line to skip"}, http.StatusCreated))
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{ann.ID}, "review": false}, http.StatusOK)

	got := decode[excludedResp](t, c.mustDo("GET", "/review/excluded", nil, http.StatusOK))
	if len(got.Groups) != 1 {
		t.Fatalf("want one group, got %d", len(got.Groups))
	}
	if p := got.Groups[0].People; len(p) != 1 || p[0].Name != "Rowling, J. K." {
		t.Errorf("the comma was split on although the reader switched it off: %v", p)
	}
}

// THE TWO FACTS THE ROW PRINTS THAT ARE NOT THE QUOTES THEMSELVES.
//
// The screen draws "27 skipped of 28 quotes" and a chip carrying the author's
// photograph. Neither can be computed from the rows this endpoint used to send:
// the total is the WORK's count and the list only holds what is excluded, and the
// credit was a bare string so every chip drew the grey stand-in. Both were
// invisible defects — the fraction simply was not there, and a stand-in looks
// exactly like a person nobody has fetched yet.
func TestTheExcludedListCarriesTheWholeCountAndTheCreditsFace(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[idResp](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The Long Walk", "author": "Slavomir Rawicz"}, http.StatusCreated))
	var ids []int64
	for _, q := range []string{"one", "two", "three", "four"} {
		a := decode[idResp](t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": book.ID, "quote": q}, http.StatusCreated))
		ids = append(ids, a.ID)
	}
	// Three of the four, so the fraction has two different numbers in it: a test
	// where everything is skipped passes against a handler that sends the excluded
	// count twice.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": ids[:3], "review": false}, http.StatusOK)

	// A PHOTOGRAPH ON THE PEOPLE ROW. Written straight into the column rather than
	// fetched: the app's own route for this takes an image URL and goes and gets
	// it, which is an outbound call this container answers with 403 — and what is
	// under test is whether the list CARRIES the path, not how it got there.
	if _, err := srv.Store.DB.Exec(
		`UPDATE people SET image_path = 'rawicz.jpg' WHERE name = 'Slavomir Rawicz'`); err != nil {
		t.Fatalf("could not give the author a photograph: %v", err)
	}

	got := decode[excludedResp](t, c.mustDo("GET", "/review/excluded", nil, http.StatusOK))
	if len(got.Groups) != 1 {
		t.Fatalf("want one group, got %d", len(got.Groups))
	}
	g := got.Groups[0]
	if len(g.Quotes) != 3 {
		t.Fatalf("three skipped, the list holds %d", len(g.Quotes))
	}
	// THE DENOMINATOR IS THE WORK'S, NOT THE LIST'S. Four quotes exist; three are
	// skipped. A handler that counted the rows it just selected would say 3 here,
	// and the screen would read "3 of 3" over a book with one quote still in the
	// deck.
	if g.QuotesTotal != 4 {
		t.Errorf("the work has four quotes; the group says %d", g.QuotesTotal)
	}
	if len(g.People) != 1 || g.People[0].Name != "Slavomir Rawicz" {
		t.Fatalf("want the author as the credit: %+v", g.People)
	}
	if g.People[0].ImagePath != "rawicz.jpg" {
		t.Errorf("the credit should carry the photograph the people row holds, got %q", g.People[0].ImagePath)
	}
}

// A CREDIT NOBODY HAS FETCHED A PERSON FOR IS NOT A FAILURE. It comes back with an
// empty path and the chip draws its own stand-in — which is also what the screen
// showed for EVERY credit before this, and is why the defect was invisible.
func TestACreditWithNoPersonRowStillArrives(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[idResp](t, c.mustDo("POST", "/books",
		map[string]any{"title": "An Unfetched Book", "author": "Nobody In Particular"}, http.StatusCreated))
	a := decode[idResp](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book.ID, "quote": "a line"}, http.StatusCreated))
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{a.ID}, "review": false}, http.StatusOK)

	got := decode[excludedResp](t, c.mustDo("GET", "/review/excluded", nil, http.StatusOK))
	if len(got.Groups) != 1 || len(got.Groups[0].People) != 1 {
		t.Fatalf("want one group with one credit: %+v", got.Groups)
	}
	p := got.Groups[0].People[0]
	if p.Name != "Nobody In Particular" {
		t.Errorf("the name should arrive whether or not a person row exists: %q", p.Name)
	}
	if p.ImagePath != "" {
		t.Errorf("no person row means no photograph, got %q", p.ImagePath)
	}
}
