package httpapi

import (
	"net/http"
	"testing"
)

// The combined people breakdown.
//
// 0027 already decided this: a person's identity is their NAME, and their roles
// are a set they belong to, written that way precisely because "a speaker is
// very often already an author". The stats never caught up. They asked the
// question four times — authors, directors, actors, speakers — so anyone who
// crosses media was two half-people in two different sections, and no section
// could answer "who do I actually quote most".
//
// The failure mode is quiet. Nothing errors, nothing is empty; the numbers are
// simply each smaller than the truth, in a way you would only catch by adding
// two rows together yourself and wondering why nothing on the page had.

func breakdownRow(t *testing.T, c *testClient, kind, name string) (works, quotes int, found bool) {
	t.Helper()
	for _, r := range getStats(t, c).Breakdown[kind].Top {
		if r.Name == name {
			return r.Works, r.Quotes, true
		}
	}
	return 0, 0, false
}

func TestOnePersonWithABookAndAFilmIsOneRow(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// Stephen Fry writes books and acts in films. Under the old breakdowns he was
	// a row in Authors and a separate row in Actors, each with half his work.
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Liar", "author": "Stephen Fry",
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "A line from the novel",
	}, http.StatusCreated)

	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Wilde", "director": "Brian Gilbert",
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "A line from the film", "actor": "Stephen Fry",
	}, http.StatusCreated)

	// The role breakdowns still each tell their own half — they are not wrong,
	// they are partial, and they remain useful for "who do I read".
	if w, q, ok := breakdownRow(t, c, "authors", "Stephen Fry"); !ok || w != 1 || q != 1 {
		t.Errorf("authors row: works=%d quotes=%d found=%v", w, q, ok)
	}
	if w, q, ok := breakdownRow(t, c, "actors", "Stephen Fry"); !ok || w != 1 || q != 1 {
		t.Errorf("actors row: works=%d quotes=%d found=%v", w, q, ok)
	}

	// The combined one is the whole person: two works, two quotes, one row.
	w, q, ok := breakdownRow(t, c, "people", "Stephen Fry")
	if !ok {
		t.Fatal("Stephen Fry is missing from the people breakdown")
	}
	if w != 2 || q != 2 {
		t.Errorf("people row: works=%d quotes=%d, want 2/2 — the book and the film", w, q)
	}
}

func TestTwoCreditsOnOneWorkDoNotCountTwice(t *testing.T) {
	// The one place merging the roles can double count. A dialogue is the only
	// quote carrying two credits, and Eastwood directs and stars in the same
	// film — so a naive union would give him two quotes for one line and a
	// leaderboard that rewards holding two jobs.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Unforgiven", "director": "Clint Eastwood",
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "Deserve's got nothin' to do with it", "actor": "Clint Eastwood",
	}, http.StatusCreated)

	w, q, ok := breakdownRow(t, c, "people", "Clint Eastwood")
	if !ok {
		t.Fatal("Clint Eastwood is missing from the people breakdown")
	}
	if w != 1 || q != 1 {
		t.Errorf("people row: works=%d quotes=%d, want 1/1 — one film, one line", w, q)
	}
}

func TestCreditSpellingDoesNotSplitAPerson(t *testing.T) {
	// tallyMap folds case, so the set feeding it must too — otherwise "Clint
	// Eastwood" the director and "clint eastwood" the actor arrive as two people
	// and the double count comes straight back through the side door.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Gran Torino", "director": "Clint Eastwood",
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "Get off my lawn", "actor": "clint eastwood",
	}, http.StatusCreated)

	if _, q, ok := breakdownRow(t, c, "people", "Clint Eastwood"); !ok || q != 1 {
		t.Errorf("people row: quotes=%d found=%v, want one line counted once", q, ok)
	}
}

func TestAMultiAuthorCreditStillSplitsIntoPeople(t *testing.T) {
	// The combined map must not become a place where "Gaiman & Pratchett" is one
	// person. It reuses the same credit splitter as every other tally.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Good Omens", "author": "Neil Gaiman & Terry Pratchett",
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "A line",
	}, http.StatusCreated)

	for _, name := range []string{"Neil Gaiman", "Terry Pratchett"} {
		if _, q, ok := breakdownRow(t, c, "people", name); !ok || q != 1 {
			t.Errorf("%s: quotes=%d found=%v", name, q, ok)
		}
	}
	if _, _, ok := breakdownRow(t, c, "people", "Neil Gaiman & Terry Pratchett"); ok {
		t.Error("the joined credit was kept as one person")
	}
}
