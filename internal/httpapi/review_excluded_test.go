package httpapi

import (
	"net/http"
	"testing"
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
		if len(g.People) != 1 || g.People[0] != w[1] {
			t.Errorf("%s: credit is %v, want %q", g.Title, g.People, w[1])
		}
	}
}

// TWO NAMES, AND NOT FOUR. The row this feeds is a phone's width, so a work with
// a long credit sends the first two and the work's own page shows the rest. The
// cut is here rather than on the screen because a client that sliced it would be
// the second place that has to know what a credit's separators are.
func TestACrowdedCreditIsCutToTwoChips(t *testing.T) {
	for _, tc := range []struct {
		credit string
		want   []string
	}{
		{"", nil},
		{"   ", nil},
		{"Jean Meeus", []string{"Jean Meeus"}},
		{"Gilbert & Sullivan", []string{"Gilbert", "Sullivan"}},
		{"A. Smith, B. Jones; C. Ray, D. Fox", []string{"A. Smith", "B. Jones"}},
	} {
		got := creditNames(tc.credit)
		if len(got) != len(tc.want) {
			t.Fatalf("%q -> %v, want %v", tc.credit, got, tc.want)
		}
		for i := range got {
			if got[i] != tc.want[i] {
				t.Errorf("%q -> %v, want %v", tc.credit, got, tc.want)
			}
		}
	}
}
