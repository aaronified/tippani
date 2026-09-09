package httpapi

// THE PAIR OF NUMBERS THE IDENTITY SHEETS PRINT: how many lines are this
// record's, and how many of those the reader marked a favourite.
//
// THE OWNER'S SCOPE was four screens — "for all. people, character, details, all
// pages those two boxes are" — and the server had the numbers for none of them
// except a character inside one work. What is testable here without knowing how
// any of it is written:
//
//   THE FIRST NUMBER IS THE LINES THE SHEET LISTS. Not a looser count and not a
//   stricter one: a figure over a different set of rows than the list beneath it
//   is a figure the reader can disprove by counting.
//
//   THE SECOND IS A SUBSET OF THE FIRST, and it moves when the reader marks
//   something. That is the property the count it replaced did not have.
//
//   AND THE TOTAL SURVIVES THE CAP on what is listed. A record with more lines
//   than a panel draws still reports how many there are.

import (
	"net/http"
	"testing"
)

type identityCounts struct {
	Lines []struct {
		ID       int64 `json:"id"`
		Favorite bool  `json:"favorite"`
	} `json:"lines"`
	Quotes     int `json:"quotes"`
	Favourites int `json:"favourites"`
}

// A CHARACTER'S PAIR IS OVER EVERY WORK THE RECORD IS IN, which is the difference
// between this sheet and the local one: the same record billed in two films
// reports one total, not two.
//
// AND TWO WORKS DO NOT SHARE A RECORD BY THEMSELVES — the fixture has to say so,
// because an earlier version of this case assumed they did and read the resulting
// 2 as a bug in the counts. CharacterForCast keys on (kind, work, folded name) on
// purpose: "'Narrator', 'Mother' and 'The Doctor' recur across unrelated works and
// are not one character, so automatic name matching would silently weld forty
// books together." A record spans two works when a reader says it does, which is
// what POST /characters/{id}/works is.
func TestACharactersCountsSpanEveryWorkTheRecordIsIn(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Two films. The first bills Harry and so creates the record; the second is
	// then LINKED to that same record rather than billing a twin.
	film := func(title string) int64 {
		m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
			map[string]any{"title": title, "media_type": "movie"}, http.StatusCreated))
		return m.ID
	}
	one, two := film("Part 1"), film("Part 2")
	first := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies/"+itoa(one)+"/cast",
		map[string]any{"character": "Harry", "actor": "Daniel Radcliffe"}, http.StatusCreated))

	who := decode[whosResp](t, c.mustDo("GET", "/movies/"+itoa(one)+"/whos-in-it", nil, http.StatusOK))
	id := charsByName(who)["Harry"].CharacterID
	if id == 0 {
		t.Fatalf("the cast row was never linked to a character record: %+v", who)
	}
	c.mustDo("POST", "/characters/"+itoa(id)+"/works",
		map[string]any{"kind": "movie", "work_id": two, "actor": "Daniel Radcliffe"}, http.StatusOK)
	second := decode[whosResp](t, c.mustDo("GET", "/movies/"+itoa(two)+"/whos-in-it", nil, http.StatusOK))
	secondCast := charsByName(second)["Harry"].CastID
	if secondCast == 0 || charsByName(second)["Harry"].CharacterID != id {
		t.Fatalf("the second work did not join the record: %+v", second)
	}

	// Two lines on each film, one of them favourited.
	for _, w := range []struct {
		work int64
		cast int64
	}{{one, first.ID}, {two, secondCast}} {
		for i, fav := range []bool{true, false} {
			c.mustDo("POST", "/dialogues", map[string]any{
				"movie_id": w.work, "quote": "line " + itoa(w.work*10+int64(i)),
				"character": "Harry", "speaker_cast_id": w.cast, "favorite": fav,
			}, http.StatusCreated)
		}
	}

	got := decode[identityCounts](t, c.mustDo("GET", "/characters/"+itoa(id), nil, http.StatusOK))
	if got.Quotes != 4 {
		t.Fatalf("quotes = %d, want 4 (two lines in each of two films): %+v", got.Quotes, got)
	}
	if got.Favourites != 2 {
		t.Fatalf("favourites = %d, want 2: %+v", got.Favourites, got)
	}
	// AND THE PAIR AGREES WITH THE LIST. The sheet prints the numbers over the
	// lines, so a count taken from a different set of rows is one the reader can
	// disprove by counting what is on the screen.
	if len(got.Lines) != got.Quotes {
		t.Fatalf("the sheet lists %d lines and claims %d", len(got.Lines), got.Quotes)
	}
	marked := 0
	for _, l := range got.Lines {
		if l.Favorite {
			marked++
		}
	}
	if marked != got.Favourites {
		t.Fatalf("%d of the listed lines are favourites and the count says %d", marked, got.Favourites)
	}
}

// A PERSON'S PAIR IS OVER WHAT THEY SAID, through the link a person's lines
// actually use — the performer on a screen line, the speaker on a standalone
// quote. A character's link is a different one, so proving it for a character
// says nothing about this.
func TestAPersonsCountsCoverTheirLinesAndTheirFavourites(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
		map[string]any{"character": "Harry", "actor": "Daniel Radcliffe"}, http.StatusCreated)
	for i, fav := range []bool{true, true, false} {
		c.mustDo("POST", "/dialogues", map[string]any{
			"movie_id": m.ID, "quote": "line " + itoa(int64(i)),
			"character": "Harry", "actor": "Daniel Radcliffe", "favorite": fav,
		}, http.StatusCreated)
	}

	// THE WORK'S OWN CREDIT LIST IS WHERE THE RECORD ID IS, and it is the same
	// list the chooser draws — no separate lookup to get out of step with.
	who := decode[whosResp](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/whos-in-it", nil, http.StatusOK))
	var id int64
	for _, p := range who.People {
		if p.Name == "Daniel Radcliffe" {
			id = p.ID
		}
	}
	if id == 0 {
		t.Fatalf("the performer got no record: %+v", who.People)
	}

	got := decode[identityCounts](t, c.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK))
	if got.Quotes != 3 || got.Favourites != 2 {
		t.Fatalf("a person reports %d quotes / %d favourited, want 3 / 2: %+v",
			got.Quotes, got.Favourites, got)
	}
	if len(got.Lines) != got.Quotes {
		t.Fatalf("the sheet lists %d lines and claims %d", len(got.Lines), got.Quotes)
	}
}

// A RECORD WITH NOTHING KEPT COUNTS NOTHING, both ways. Worth a case of its own
// because the pair is derived rather than stored: an aggregate that treats an
// absent row as a value reports lines a record does not have.
func TestARecordWithNoLinesCountsNothing(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
		map[string]any{"character": "Neville", "actor": "Matthew Lewis"}, http.StatusCreated)

	who := decode[whosResp](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/whos-in-it", nil, http.StatusOK))
	id := charsByName(who)["Neville"].CharacterID
	got := decode[identityCounts](t, c.mustDo("GET", "/characters/"+itoa(id), nil, http.StatusOK))
	if got.Quotes != 0 || got.Favourites != 0 {
		t.Fatalf("a character with no lines reports %d / %d", got.Quotes, got.Favourites)
	}
}

// AND A WORK'S OWN PAIR RIDES WITH THE COUNT ITS CARD ALREADY DRAWS, on both
// shelves — two tables, two queries, so one proven says nothing about the other.
func TestAWorkReportsHowManyOfItsQuotesAreFavourites(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Moby-Dick"}, http.StatusCreated))
	for i, fav := range []bool{true, false, false} {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": b.ID, "quote": "line " + itoa(int64(i)), "favorite": fav,
		}, http.StatusCreated)
	}
	books := decode[struct {
		Books []struct {
			AnnotationCount int `json:"annotation_count"`
			FavouriteCount  int `json:"favourite_count"`
		} `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	if len(books.Books) != 1 {
		t.Fatalf("books: %+v", books)
	}
	if books.Books[0].AnnotationCount != 3 || books.Books[0].FavouriteCount != 1 {
		t.Fatalf("a book reports %d quotes / %d favourited, want 3 / 1",
			books.Books[0].AnnotationCount, books.Books[0].FavouriteCount)
	}

	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))
	for i, fav := range []bool{true, true, false, false} {
		c.mustDo("POST", "/dialogues", map[string]any{
			"movie_id": m.ID, "quote": "line " + itoa(int64(i)), "favorite": fav,
		}, http.StatusCreated)
	}
	movies := decode[struct {
		Movies []struct {
			DialogueCount  int `json:"dialogue_count"`
			FavouriteCount int `json:"favourite_count"`
		} `json:"movies"`
	}](t, c.mustDo("GET", "/movies", nil, http.StatusOK))
	if len(movies.Movies) != 1 {
		t.Fatalf("movies: %+v", movies)
	}
	if movies.Movies[0].DialogueCount != 4 || movies.Movies[0].FavouriteCount != 2 {
		t.Fatalf("a film reports %d quotes / %d favourited, want 4 / 2",
			movies.Movies[0].DialogueCount, movies.Movies[0].FavouriteCount)
	}
}
