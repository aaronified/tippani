package httpapi

// The tile chooser, the counts, and the four fields 0063 put on the wire.

import (
	"net/http"
	"testing"
)

// whosChar is the wire shape of one cast row in the chooser. Named rather than
// written out per literal: the response type and the by-name index below both
// need it, and three copies of an anonymous struct are three places for the
// field set to drift apart.
type whosChar struct {
	CastID     int64  `json:"cast_id"`
	Name       string `json:"name"`
	Quotes     int    `json:"quotes"`
	Favourites int    `json:"favourites"`
}

type whosResp struct {
	Work struct {
		Kind      string `json:"kind"`
		ID        int64  `json:"id"`
		Title     string `json:"title"`
		MediaType string `json:"media_type"`
	} `json:"work"`
	Characters []whosChar `json:"characters"`
	People     []struct {
		ID    int64  `json:"id"`
		Name  string `json:"name"`
		Roles string `json:"roles"`
	} `json:"people"`
}

func charsByName(r whosResp) map[string]whosChar {
	out := map[string]whosChar{}
	for _, c := range r.Characters {
		out[c.Name] = c
	}
	return out
}

// A TILE OPENS EVERY CHARACTER IN THE WORK, not the one whose screen you came
// from — the owner's ruling. The prototype lists only the character on the path,
// which makes one cover behave differently depending on where it was pressed.
func TestATileListsEveryCharacterAndEveryoneCredited(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie", "director": "David Yates"},
		http.StatusCreated))
	for _, pair := range [][2]string{{"Harry", "Daniel Radcliffe"}, {"Ron", "Rupert Grint"}} {
		c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
			map[string]any{"character": pair[0], "actor": pair[1]}, http.StatusCreated)
	}

	got := decode[whosResp](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/whos-in-it", nil, http.StatusOK))
	if got.Work.Title != "Part 2" || got.Work.Kind != "movie" {
		t.Fatalf("work: %+v", got.Work)
	}
	if len(got.Characters) != 2 {
		t.Fatalf("characters: %+v", got.Characters)
	}
	names := map[string]bool{}
	for _, ch := range got.Characters {
		names[ch.Name] = true
		if ch.CastID == 0 {
			// The row and not the record: a work may bill one character twice, so
			// the cast id is what names a local screen.
			t.Fatalf("a character came back with no cast row: %+v", ch)
		}
	}
	if !names["Harry"] || !names["Ron"] {
		t.Fatalf("characters are %v", names)
	}
	// AND EVERYBODY CREDITED, in any role — the two performers and the director,
	// which is the half `work_person` holds rather than `work_cast`.
	people := map[string]string{}
	for _, p := range got.People {
		people[p.Name] = p.Roles
	}
	for _, want := range []string{"Daniel Radcliffe", "Rupert Grint", "David Yates"} {
		if _, ok := people[want]; !ok {
			t.Fatalf("%q is not among the credited: %+v", want, people)
		}
	}
}

// THE SECOND COUNT IS HOW MANY OF THOSE LINES THE READER FAVOURITED — the
// owner's ruling, replacing a count of distinct locators that could only ever
// read one on a library where nobody fills timestamps. So the fixture gives one
// character four lines and favourites two of them, and the pair is 4 and 2: a
// figure derived from the reader's own marks moves when they mark something,
// which is the whole property the number it replaced did not have.
func TestTheCountsAreThisCharactersQuotesAndTheirFavourites(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))
	cast := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
		map[string]any{"character": "Harry", "actor": "Daniel Radcliffe"}, http.StatusCreated))

	// Four lines, the first two favourited. Each quote text is distinct because a
	// dialogue's dedupe hash is over the WORDS — two identical lines in one film
	// are one line, which is right and is not what this fixture is testing.
	for i, fav := range []bool{true, true, false, false} {
		c.mustDo("POST", "/dialogues", map[string]any{
			"movie_id": m.ID, "quote": "line " + itoa(int64(i)),
			"character": "Harry", "speaker_cast_id": cast.ID, "favorite": fav,
		}, http.StatusCreated)
	}

	got := decode[whosResp](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/whos-in-it", nil, http.StatusOK))
	harry := charsByName(got)["Harry"]
	if harry.Quotes != 4 {
		t.Fatalf("quotes = %d, want 4: %+v", harry.Quotes, harry)
	}
	if harry.Favourites != 2 {
		t.Fatalf("favourites = %d, want 2 of the 4: %+v", harry.Favourites, harry)
	}
	// AND THE TWO ARE NOT THE SAME NUMBER, which is what the box exists to show.
	// A second figure that tracked the first would be decoration.
	if harry.Favourites == harry.Quotes {
		t.Fatalf("both counts read %d — the pair says nothing", harry.Quotes)
	}
}

// A BOOK COUNTS ITS OWN HIGHLIGHTS. The two mediums are two queries against two
// tables (`annotations` and `dialogues`), so a favourite count proved on one
// says nothing about the other — which is how the second figure could be right
// for films and wrong for books for a release.
func TestABooksCharacterCountsFavouritedHighlights(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Moby-Dick"}, http.StatusCreated))
	c.mustDo("POST", "/books/"+itoa(b.ID)+"/cast",
		map[string]any{"character": "Ahab"}, http.StatusCreated)

	// The speaker link is written from the line's own `character` text on every
	// quote write (store.SyncQuoteCast), so naming the billing is what points a
	// highlight at the cast row — a book's POST takes no cast id.
	for i, fav := range []bool{true, false, false} {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": b.ID, "quote": "line " + itoa(int64(i)),
			"character": "Ahab", "favorite": fav,
		}, http.StatusCreated)
	}

	got := decode[whosResp](t, c.mustDo("GET", "/books/"+itoa(b.ID)+"/whos-in-it", nil, http.StatusOK))
	ahab := charsByName(got)["Ahab"]
	if ahab.Quotes != 3 || ahab.Favourites != 1 {
		t.Fatalf("a book's character reports %d quotes / %d favourited, want 3 / 1: %+v",
			ahab.Quotes, ahab.Favourites, ahab)
	}
}

// A CHARACTER WITH NOTHING KEPT COUNTS NOTHING, and the LEFT JOIN's own null
// row is why that is worth a test: it yields one row for a cast member with no
// quotes, and any aggregate that treats null as a value counts it. The count
// this pair replaced needed a fixup written back by hand for exactly this row.
func TestACharacterWithNoQuotesCountsNothing(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
		map[string]any{"character": "Neville", "actor": "Matthew Lewis"}, http.StatusCreated)

	got := decode[whosResp](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/whos-in-it", nil, http.StatusOK))
	n := charsByName(got)["Neville"]
	if n.Quotes != 0 || n.Favourites != 0 {
		t.Fatalf("an empty cast row reports %d quotes and %d favourited: %+v", n.Quotes, n.Favourites, n)
	}
}

// ANOTHER READER'S WORK IS NOT FOUND, never forbidden — a 403 would confirm the
// row exists.
func TestWhosInItRefusesAnotherReadersWork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))
	bob := addUser(t, h, c, "bob")
	bob.mustDo("GET", "/movies/"+itoa(m.ID)+"/whos-in-it", nil, http.StatusNotFound)
}
