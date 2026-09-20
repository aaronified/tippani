package httpapi

import (
	"net/http"
	"testing"
)

// WHAT A ROW ON THE METADATA CONSOLES HAS TO CARRY, and it is not the name.
//
// The owner, on the character list: "The characters show work, but not quotes."
// A record's row exists so a reader can tell, without opening it, whether it is
// worth anything — and the two numbers that answer that are how many works it is
// in and how many quotes point at it. The screen's issue filters read the same
// fields, so a missing one is not a cosmetic gap: it is a filter that silently
// matches everybody.

type charListResp struct {
	Characters []struct {
		ID      int64  `json:"id"`
		Name    string `json:"name"`
		Works   int    `json:"works"`
		Quotes  int    `json:"quotes"`
		WorksIn []struct {
			Kind  string `json:"kind"`
			Title string `json:"title"`
		} `json:"works_in"`
	} `json:"characters"`
}

type peopleRecordsResp struct {
	People []struct {
		ID      int64  `json:"id"`
		Name    string `json:"name"`
		Works   int    `json:"works"`
		Quotes  int    `json:"quotes"`
		WorksIn []struct {
			Kind  string `json:"kind"`
			Title string `json:"title"`
		} `json:"works_in"`
	} `json:"people"`
}

// A CHARACTER'S ROW COUNTS THE QUOTES THAT POINT AT THEM.
//
// Through `speaker_cast_id`, which is the app's own definition of whose line a
// line is — maintained on every save, and backfilled for everything older. The
// alternative, folding the `character` text column, is a second and looser answer
// to a question the link already answers exactly, and the two would disagree the
// first time a name was spelled two ways.
func TestACharacterRowSaysHowManyQuotesPointAtThem(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker", "director": "Andrei Tarkovsky"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Let everything come true.", "character": "Stalker",
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Weakness is a great thing.", "character": "Stalker",
	}, http.StatusCreated)
	// A second character on the same film, with nothing said — the row that the
	// "no quotes" filter exists to surface.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "And strength is nothing.", "character": "Writer",
	}, http.StatusCreated)

	// THE CAST IS BUILT WHEN THE WORK'S CAST IS READ, which is the press a reader
	// makes by opening the film — every character its own quotes name becomes one
	// of its people there, and that is what gives each a record to count against.
	c.mustDo("GET", "/movies/"+itoa(movie.ID)+"/cast", nil, http.StatusOK)

	got := decode[charListResp](t, c.mustDo("GET", "/characters", nil, http.StatusOK))
	if len(got.Characters) < 2 {
		t.Fatalf("want a record per character, got %+v", got.Characters)
	}
	for _, ch := range got.Characters {
		switch ch.Name {
		case "Stalker":
			if ch.Quotes != 2 {
				t.Errorf("Stalker said two lines and the row counts %d", ch.Quotes)
			}
			if ch.Works != 1 {
				t.Errorf("Stalker is in one work and the row counts %d", ch.Works)
			}
		case "Writer":
			if ch.Quotes != 1 {
				t.Errorf("Writer said one line and the row counts %d", ch.Quotes)
			}
		}
	}
}

// A PERSON'S ROW NAMES THE WORKS, not only how many.
//
// "12" tells a reader the record is used and not what it is FOR — which is the
// question somebody scanning a list of people is actually asking. BOTH ways a
// person reaches a work are included: the credit (`work_person`) and the
// performance (`work_cast`), because a list showing only the first leaves every
// actor's row empty under a count that says twelve.
func TestAPersonRowNamesTheWorksTheyAreOn(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "The Master and Margarita")
	c.mustDo("PUT", "/books/"+itoa(book),
		map[string]any{"title": "The Master and Margarita", "author": "Mikhail Bulgakov"}, http.StatusOK)
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Ivan Vasilievich", "director": "Leonid Gaidai"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "I demand the continuation of the banquet!",
		"character": "Bunsha", "actor": "Yuri Yakovlev",
	}, http.StatusCreated)

	c.mustDo("GET", "/movies/"+itoa(movie.ID)+"/cast", nil, http.StatusOK)

	got := decode[peopleRecordsResp](t, c.mustDo("GET", "/people/records", nil, http.StatusOK))
	seen := map[string][]string{}
	for _, p := range got.People {
		for _, w := range p.WorksIn {
			seen[p.Name] = append(seen[p.Name], w.Title)
		}
	}
	if len(seen["Mikhail Bulgakov"]) != 1 || seen["Mikhail Bulgakov"][0] != "The Master and Margarita" {
		t.Errorf("the author's row names %v", seen["Mikhail Bulgakov"])
	}
	// THE PERFORMER IS THE HALF A CREDIT-ONLY QUERY LOSES.
	if len(seen["Yuri Yakovlev"]) != 1 || seen["Yuri Yakovlev"][0] != "Ivan Vasilievich" {
		t.Errorf("the actor's row names %v", seen["Yuri Yakovlev"])
	}
}
