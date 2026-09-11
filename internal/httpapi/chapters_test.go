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

// THE ORDER IS ENTRY ORDER, MOST RECENT FIRST, and the fixture below separates it
// from BOTH of the rules it replaced — the three orderings put a different chapter
// at the top, so no two of them can pass this test.
//
//	count first       Loomings (3), Envoi (2), The Whale (1)
//	highest number    The Whale (42), Loomings (1), Envoi (0)
//	entry order       Envoi, The Whale, Loomings
//
// THE VERSION THAT SHIPPED WITH `ORDER BY COUNT(*) DESC` COULD NOT DO THIS: its
// commonest chapter was also its highest-numbered one, so two rules produced the
// same rows and the assertion held under either. A fixture that cannot separate a
// rule from its alternative tests nothing about the rule.
func TestBookChaptersPutsTheChapterYouWereLastInFirst(t *testing.T) {
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
	// THE ORDER THESE ARE ADDED IN IS THE FIXTURE. Loomings is the commonest AND the
	// lowest-numbered AND the first entered; Envoi is last entered and unnumbered.
	// So each of the three rules picks a different chapter to lead with.
	add(book.ID, "one", "Loomings", 1)
	add(book.ID, "two", "Loomings", 1)
	add(book.ID, "three", "Loomings", 1)
	add(book.ID, "four", "The Whale", 42)
	// UNNUMBERED, which an essay or a scripture division is — and entered LAST, so
	// it leads. A number-ordered list would put it last (chapter_no 0) and a
	// count-ordered one second.
	add(book.ID, "five", "Envoi", 0)
	add(book.ID, "six", "Envoi", 0)
	// No chapter at all: not a chapter, so not an option.
	add(book.ID, "seven", "", 0)
	// Another book's chapter must not leak into this book's list — the whole reason
	// this is per book rather than part of the search vocabulary.
	add(other.ID, "eight", "The Wall", 3)

	got := chaptersOf(t, c, book.ID)
	if len(got.Chapters) != 3 {
		t.Fatalf("offered %+v, want exactly the three chapters this book uses", got.Chapters)
	}
	// WHAT YOU WERE LAST TYPING, first — which is what makes this survive a reread,
	// the owner's own argument for it. Unnumbered, so a number-ordered list would
	// have put it last.
	if got.Chapters[0].Name != "Envoi" || got.Chapters[0].No != 0 {
		t.Errorf("first option is %+v, want Envoi / 0", got.Chapters[0])
	}
	if got.Chapters[1].Name != "The Whale" || got.Chapters[1].No != 42 {
		t.Errorf("second option is %+v, want The Whale / 42", got.Chapters[1])
	}
	// Last, despite being the commonest — and the count still travels, because it
	// is what tells a real chapter from a one-off typo of one when the two sit next
	// to each other.
	if got.Chapters[2].Name != "Loomings" || got.Chapters[2].No != 1 || got.Chapters[2].Count != 3 {
		t.Errorf("third option is %+v, want Loomings / 1 / 3", got.Chapters[2])
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
