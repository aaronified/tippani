package httpapi

// The tile chooser, the counts, and the four fields 0063 put on the wire.

import (
	"net/http"
	"testing"
)

type whosResp struct {
	Work struct {
		Kind      string `json:"kind"`
		ID        int64  `json:"id"`
		Title     string `json:"title"`
		MediaType string `json:"media_type"`
	} `json:"work"`
	Characters []struct {
		CastID      int64  `json:"cast_id"`
		Name        string `json:"name"`
		Quotes      int    `json:"quotes"`
		Locators    int    `json:"locators"`
		LocatorNoun string `json:"locator_noun"`
	} `json:"characters"`
	People []struct {
		ID    int64  `json:"id"`
		Name  string `json:"name"`
		Roles string `json:"roles"`
	} `json:"people"`
}

func charsByName(r whosResp) map[string]struct {
	CastID      int64  `json:"cast_id"`
	Name        string `json:"name"`
	Quotes      int    `json:"quotes"`
	Locators    int    `json:"locators"`
	LocatorNoun string `json:"locator_noun"`
} {
	out := map[string]struct {
		CastID      int64  `json:"cast_id"`
		Name        string `json:"name"`
		Quotes      int    `json:"quotes"`
		Locators    int    `json:"locators"`
		LocatorNoun string `json:"locator_noun"`
	}{}
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

// THE SECOND COUNT IS A DISTINCT OVER THE CHARACTER'S OWN QUOTES, and the blank
// is one of the values — both the owner's ruling. "In a movie all scenes are
// distinct anyway", so nothing stores a scene total and none is invented.
func TestTheCountsAreThisCharactersQuotesAndTheirDistinctPlaces(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))
	cast := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
		map[string]any{"character": "Harry", "actor": "Daniel Radcliffe"}, http.StatusCreated))

	// Four lines: two share a timestamp, one has its own, one has none at all.
	// Each quote text is distinct because a dialogue's dedupe hash is over the
	// WORDS and not the timestamp — two identical lines in one film are one line,
	// which is right and is not what this fixture is testing.
	for i, ts := range []string{"00:02:14", "00:02:14", "01:40:00", ""} {
		c.mustDo("POST", "/dialogues", map[string]any{
			"movie_id": m.ID, "quote": "line " + itoa(int64(i)),
			"character": "Harry", "timestamp": ts, "speaker_cast_id": cast.ID,
		}, http.StatusCreated)
	}

	got := decode[whosResp](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/whos-in-it", nil, http.StatusOK))
	harry := charsByName(got)["Harry"]
	if harry.Quotes != 4 {
		t.Fatalf("quotes = %d, want 4: %+v", harry.Quotes, harry)
	}
	// Three places: the shared timestamp counts once, the lone one counts, and
	// the blank is its own — a line is somewhere even when nobody has said where.
	if harry.Locators != 3 {
		t.Fatalf("places = %d, want 3 (two share one, one alone, one blank): %+v", harry.Locators, harry)
	}
	// AND THE NOUN IS THE MEDIUM'S. A film has scenes where a book has chapters
	// and a game has quests; the label is not a fixed word.
	if harry.LocatorNoun != "scene" {
		t.Fatalf("locator noun = %q, want scene", harry.LocatorNoun)
	}
}

// A CHARACTER WITH NOTHING KEPT COUNTS NOTHING. The LEFT JOIN yields one null
// row for a cast member with no quotes, and a coalesced DISTINCT would count
// that null as one place the character does not in fact speak from.
func TestACharacterWithNoQuotesReportsNoPlaces(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
		map[string]any{"character": "Neville", "actor": "Matthew Lewis"}, http.StatusCreated)

	got := decode[whosResp](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/whos-in-it", nil, http.StatusOK))
	n := charsByName(got)["Neville"]
	if n.Quotes != 0 || n.Locators != 0 {
		t.Fatalf("an empty cast row reports %d quotes in %d places: %+v", n.Quotes, n.Locators, n)
	}
}

// A GAME COUNTS QUESTS AND A BOOK CHAPTERS, from the column that medium's quotes
// actually carry.
func TestTheLocatorNounFollowsTheMedium(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	g := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Game", "media_type": "game"}, http.StatusCreated))
	c.mustDo("POST", "/movies/"+itoa(g.ID)+"/cast",
		map[string]any{"character": "Harry", "actor": "Adam Sopp"}, http.StatusCreated)
	got := decode[whosResp](t, c.mustDo("GET", "/movies/"+itoa(g.ID)+"/whos-in-it", nil, http.StatusOK))
	if charsByName(got)["Harry"].LocatorNoun != "quest" {
		t.Fatalf("a game counts %q", charsByName(got)["Harry"].LocatorNoun)
	}

	b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Deathly Hallows"}, http.StatusCreated))
	c.mustDo("POST", "/books/"+itoa(b.ID)+"/cast",
		map[string]any{"character": "Harry"}, http.StatusCreated)
	got = decode[whosResp](t, c.mustDo("GET", "/books/"+itoa(b.ID)+"/whos-in-it", nil, http.StatusOK))
	if charsByName(got)["Harry"].LocatorNoun != "chapter" {
		t.Fatalf("a book counts %q", charsByName(got)["Harry"].LocatorNoun)
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
