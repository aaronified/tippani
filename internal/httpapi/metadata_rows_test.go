package httpapi

import (
	"net/http"
	"sort"
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
			Kind  string   `json:"kind"`
			Title string   `json:"title"`
			Roles []string `json:"roles"`
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

// A CHARACTER'S ROW CARRIES EVERY PERFORMER, NOT THE ONE WITH THE HIGHER ID.
//
// THE DEFECT THIS PINS, because it shipped and looked complete. The first cut read
// `COALESCE(MAX(wc.actor_id), 0)` under a GROUP BY that did not name the actor,
// which answers "one of them" and has no way to say so. `idx_work_cast_pair` is
// UNIQUE on (kind, work_id, character_key, actor_key) — the actor is IN the key —
// so two performers of one character on one work are legal and ordinary: a role
// and its voice, or a part recast. The owner asked the row to carry the "full list
// of chip", and one silently-chosen name is the half of that which looks right.
//
// THE ID IS ASSERTED AND NOT ONLY THE NAME, because the id is what makes the pill
// a door. A list of two names with one usable id would draw two chips, one of them
// pressing nothing.
func TestACharacterRowNamesEveryPerformerOnOneWork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Godfather Part II"}, http.StatusCreated))
	// ONE CHARACTER, ONE FILM, TWO PERFORMERS — the young Vito and the old Vito,
	// which is the pair migration 0063's own note names as the reason the actor is
	// part of the uniqueness key.
	c.mustDo("POST", "/movies/"+itoa(film.ID)+"/cast",
		map[string]any{"character": "Vito Corleone", "actor": "Robert De Niro"}, http.StatusCreated)
	c.mustDo("POST", "/movies/"+itoa(film.ID)+"/cast",
		map[string]any{"character": "Vito Corleone", "actor": "Marlon Brando"}, http.StatusCreated)

	list := decode[struct {
		Characters []struct {
			Name    string `json:"name"`
			WorksIn []struct {
				Title  string `json:"title"`
				Actors []struct {
					ID   int64  `json:"id"`
					Name string `json:"name"`
				} `json:"actors"`
			} `json:"works_in"`
		} `json:"characters"`
	}](t, c.mustDo("GET", "/characters", nil, http.StatusOK))

	var appearances int
	var names []string
	for _, ch := range list.Characters {
		if ch.Name != "Vito Corleone" {
			continue
		}
		for _, w := range ch.WorksIn {
			appearances++
			for _, a := range w.Actors {
				if a.ID == 0 {
					t.Fatalf("a performer pill has no id to open: %+v", a)
				}
				names = append(names, a.Name)
			}
		}
	}
	// ONE APPEARANCE. Splitting the query by actor must not split the ROW — the
	// console counts works from this list, and two rows for one film would say the
	// character is in two.
	if appearances != 1 {
		t.Fatalf("one character on one film is %d appearances, want 1", appearances)
	}
	sort.Strings(names)
	if len(names) != 2 || names[0] != "Marlon Brando" || names[1] != "Robert De Niro" {
		t.Fatalf("the row names %v, want both performers", names)
	}
}

// A NOVEL AND ITS ADAPTATION ARE TWO APPEARANCES, THOUGH THEIR IDS ARE THE SAME.
//
// THE REGRESSION THIS PINS, and it was introduced by the fix for the one above.
// Merging the actor-split rows back into one appearance per work needs a key, and
// the first key was (character, work_id) — which is not a work. `books` and
// `movies` number themselves independently, so book 1 and movie 1 both exist in
// any library holding one of each, and the map folded them into a single row: the
// film's title, its clapper glyph and the whole appearance vanished, and its
// performer was hung on the novel.
//
// IT IS THE CASE THE FEATURE EXISTS FOR, which is what makes it worth its own
// test rather than a line in another. The medium glyphs are on the row precisely
// so "a character in a novel and its adaptation draws two glyphs" — the commit
// that broke this said so in its own body while breaking it.
//
// THE IDS ARE ASSERTED EQUAL rather than assumed: two fresh tables in a fresh
// database both start at 1, but a test that silently stopped exercising the
// collision would go on passing over the bug it was written for.
func TestACharacterInANovelAndItsFilmIsTwoAppearances(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune", "author": "Frank Herbert"}, http.StatusCreated))
	film := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Dune (2021)", "media_type": "movie"}, http.StatusCreated))
	if book.ID != film.ID {
		t.Fatalf("book %d and film %d do not share an id, so this is not testing the collision",
			book.ID, film.ID)
	}
	c.mustDo("POST", "/books/"+itoa(book.ID)+"/cast",
		map[string]any{"character": "Paul Atreides"}, http.StatusCreated)
	c.mustDo("POST", "/movies/"+itoa(film.ID)+"/cast",
		map[string]any{"character": "Paul Atreides", "actor": "Timothee Chalamet"}, http.StatusCreated)

	// MERGED INTO ONE RECORD, WHICH IS THE WHOLE FIXTURE. Billing a character on
	// two works files two records — one per work — and two records never share a
	// merge key, so a test that stopped here would pass over the bug whichever way
	// the key was written. The reader merges them, as the console's own merge verb
	// does, and THEN one character stands on a book and a film whose ids are equal.
	ids := characterIDs(t, c, "Paul Atreides")
	if len(ids) != 2 {
		t.Fatalf("billing one character on two works filed %d records, want 2", len(ids))
	}
	c.mustDo("POST", "/characters/merge",
		map[string]any{"keep_id": ids[0], "drop_id": ids[1]}, http.StatusOK)

	list := decode[struct {
		Characters []struct {
			Name    string `json:"name"`
			WorksIn []struct {
				Kind  string `json:"kind"`
				Title string `json:"title"`
			} `json:"works_in"`
		} `json:"characters"`
	}](t, c.mustDo("GET", "/characters", nil, http.StatusOK))

	// ONE ROW, because the merge made one record — a second row here would mean the
	// merge did not take and the collision is not being exercised.
	var rows int
	var seen []string
	for _, ch := range list.Characters {
		if ch.Name != "Paul Atreides" {
			continue
		}
		rows++
		for _, w := range ch.WorksIn {
			seen = append(seen, w.Kind+":"+w.Title)
		}
	}
	if rows != 1 {
		t.Fatalf("the merged character is %d rows, so the two ids never met in one record", rows)
	}
	sort.Strings(seen)
	if len(seen) != 2 || seen[0] != "book:Dune" || seen[1] != "movie:Dune (2021)" {
		t.Fatalf("the character is in %v, want the novel and the film as two appearances", seen)
	}
}

// characterIDs — every record filed under a name, newest last. The console's merge
// sheet asks the same question of the same endpoint.
func characterIDs(t *testing.T, c *testClient, name string) []int64 {
	t.Helper()
	list := decode[struct {
		Characters []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"characters"`
	}](t, c.mustDo("GET", "/characters", nil, http.StatusOK))
	var out []int64
	for _, ch := range list.Characters {
		if ch.Name == name {
			out = append(out, ch.ID)
		}
	}
	return out
}

// AND EACH WORK SAYS WHAT THE PERSON DID ON IT.
//
// The people console draws a role and its work as one chip — the owner: they "shall
// be in the same chip, as they are interdependent". A person-wide list of roles
// cannot say which work was written and which directed, so the role travels on the
// work. One person, credited two ways on two works, is the case that tells.
func TestAPersonRowSaysTheirRoleOnEachWork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Sculpting in Time")
	c.mustDo("PUT", "/books/"+itoa(book),
		map[string]any{"title": "Sculpting in Time", "author": "Andrei Tarkovsky"}, http.StatusOK)
	c.mustDo("POST", "/movies", map[string]any{"title": "Stalker", "director": "Andrei Tarkovsky"}, http.StatusCreated)

	got := decode[peopleRecordsResp](t, c.mustDo("GET", "/people/records", nil, http.StatusOK))
	roles := map[string][]string{}
	for _, p := range got.People {
		if p.Name != "Andrei Tarkovsky" {
			continue
		}
		for _, w := range p.WorksIn {
			roles[w.Title] = w.Roles
		}
	}
	if len(roles["Sculpting in Time"]) != 1 || roles["Sculpting in Time"][0] != "author" {
		t.Errorf("the book should say author, got %v", roles["Sculpting in Time"])
	}
	if len(roles["Stalker"]) != 1 || roles["Stalker"][0] != "director" {
		t.Errorf("the film should say director, got %v", roles["Stalker"])
	}
}
