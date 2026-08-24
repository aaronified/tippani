package httpapi

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
)

// GET /books/{id}/chapters — what the locator fields offer while you type.
//
// The value of this endpoint is entirely in what it EXCLUDES: another book's
// chapters, another reader's book, and the highlights that carry no chapter at
// all. So that is what these cases are about, and every one asserts values rather
// than counts — "got 3, wanted 3" passes happily while the three are the wrong
// three, which is the whole failure mode of a suggestion list.

type chaptersReply struct {
	Chapters []struct {
		No    float64 `json:"no"`
		Name  string  `json:"name"`
		Count int     `json:"count"`
	} `json:"chapters"`
}

func chaptersOf(t *testing.T, c *testClient, bookID int64) chaptersReply {
	t.Helper()
	return decode[chaptersReply](t, c.mustDo("GET",
		"/books/"+strconv.FormatInt(bookID, 10)+"/chapters", nil, http.StatusOK))
}

func TestBookChaptersOffersThisBooksOwnChaptersCommonestFirst(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Moby-Dick"}, http.StatusCreated))
	other := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Bartleby"}, http.StatusCreated))

	add := func(id int64, quote, chapter string, no float64) {
		t.Helper()
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": id, "quote": quote, "chapter": chapter, "chapter_no": no,
		}, http.StatusCreated)
	}
	add(book.ID, "one", "The Whale", 42)
	add(book.ID, "two", "The Whale", 42)
	add(book.ID, "three", "Loomings", 1)
	// No chapter at all: not a chapter, so not an option.
	add(book.ID, "four", "", 0)
	// Another book's chapter must not leak into this book's list — the whole reason
	// this is per book rather than part of the search vocabulary.
	add(other.ID, "five", "The Wall", 3)

	got := chaptersOf(t, c, book.ID)
	if len(got.Chapters) != 2 {
		t.Fatalf("offered %+v, want exactly the two chapters this book uses", got.Chapters)
	}
	// Commonest first, so the chapter you are working through is at the top and a
	// one-off typo sinks instead of sitting beside the real name.
	if got.Chapters[0].Name != "The Whale" || got.Chapters[0].No != 42 || got.Chapters[0].Count != 2 {
		t.Errorf("first option is %+v, want The Whale / 42 / 2", got.Chapters[0])
	}
	if got.Chapters[1].Name != "Loomings" || got.Chapters[1].No != 1 {
		t.Errorf("second option is %+v, want Loomings / 1", got.Chapters[1])
	}
	for _, ch := range got.Chapters {
		if ch.Name == "The Wall" {
			t.Error("another book's chapter leaked into this book's list")
		}
	}
}

// The pair travels together, which is the reason the reply is objects rather than
// two lists of strings: a name the reader typed once beside a number can fill the
// number in next time.
func TestBookChaptersKeepsTheNumberWithTheName(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Essays"}, http.StatusCreated))
	// A named chapter with no number (an essay collection) and a numbered one with
	// no name (a plain novel) are both legitimate, and 0044 split the field so both
	// could be stored. Both have to survive this endpoint.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "a", "chapter": "On Style",
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "b", "chapter_no": 7,
	}, http.StatusCreated)

	got := chaptersOf(t, c, book.ID)
	pairs := map[string]float64{}
	for _, ch := range got.Chapters {
		pairs[ch.Name] = ch.No
	}
	if no, ok := pairs["On Style"]; !ok || no != 0 {
		t.Errorf("named chapter came back as %v (present=%v), want number 0", no, ok)
	}
	if no, ok := pairs[""]; !ok || no != 7 {
		t.Errorf("numbered chapter came back as %v (present=%v), want 7", no, ok)
	}
}

// A decimal chapter is where an interlude goes (0044), so the number must not be
// rounded on the way out.
func TestBookChaptersKeepsADecimalNumber(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Cloud Atlas"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "a", "chapter": "Interlude", "chapter_no": 12.5,
	}, http.StatusCreated)
	got := chaptersOf(t, c, book.ID)
	if len(got.Chapters) != 1 || got.Chapters[0].No != 12.5 {
		t.Fatalf("got %+v, want one option numbered 12.5", got.Chapters)
	}
}

func TestBookChaptersIsScopedToItsOwner(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	book := decode[struct{ ID int64 }](t, alice.mustDo("POST", "/books",
		map[string]any{"title": "Moby-Dick"}, http.StatusCreated))
	alice.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "a", "chapter": "The Whale",
	}, http.StatusCreated)

	bob := addUser(t, h, alice, "bob")
	// 404 AND NOT AN EMPTY LIST: an empty list is a working answer, and it would
	// tell Bob the book exists and has no chapters. It is also a 404 rather than a
	// 403 for the reason every read in this package is.
	bob.mustDo("GET", "/books/"+strconv.FormatInt(book.ID, 10)+"/chapters", nil, http.StatusNotFound)
}

func TestBookChaptersAnswersEmptyForABookWithNone(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Unread"}, http.StatusCreated))
	// `[]` and not `null` — a caller reading `.length` on the reply must not throw,
	// which is the rule every list endpoint here follows.
	rec := c.mustDo("GET", "/books/"+strconv.FormatInt(book.ID, 10)+"/chapters", nil, http.StatusOK)
	if body := rec.Body.String(); !strings.Contains(body, `"chapters":[]`) {
		t.Errorf("empty reply is %s, want an empty array", body)
	}
}
