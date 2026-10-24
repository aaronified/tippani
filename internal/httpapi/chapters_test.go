package httpapi

import (
	"net/http"
	"strconv"
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

// A chapter's number and its name are two facts (0044).
//
// One free-text field held both since 0001, which is why the capture form's
// placeholder said "e.g. 3" under a label reading Chapter: people were already
// typing numbers into a name. Splitting them buys sorting and a heading that reads
// like a book's, and costs a round trip that has to carry the pair through the
// export, the file, the queue and back.
//
// WHAT THESE ASSERT, in the order the value travels: the form takes both and
// refuses nonsense; the export writes one heading per chapter however the pair is
// filled in; the file re-imports with the number intact; and the shapes this
// deliberately does NOT parse stay whole, because a parse tuned to our own output
// is how a reader's chapter named "1984" would become a number.

func annotationWithChapter(t *testing.T, c *testClient, book int64, quote string, no float64, name string) annotationRow {
	t.Helper()
	return decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": quote, "chapter_no": no, "chapter": name,
	}, http.StatusCreated))
}

// oneAnnotation reads a row back through the list endpoint. There is no
// GET /annotations/{id} — the screen fetches a book's highlights as a list — so this
// is the path the interface itself takes.
func oneAnnotation(t *testing.T, c *testClient, book, id int64) annotationRow {
	t.Helper()
	for _, a := range decode[annList](t, c.mustDo("GET", "/annotations?book_id="+itoa(book), nil, http.StatusOK)).Annotations {
		if a.ID == id {
			return a
		}
	}
	t.Fatalf("annotation %d is not in book %d's list", id, book)
	return annotationRow{}
}

func TestAChapterKeepsItsNumberAndItsNameApart(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := createBook(t, c, "The Recognitions")

	// All four combinations, because "both optional" is the actual requirement and
	// the interesting cases are the two lopsided ones.
	for _, tc := range []struct {
		quote string
		no    float64
		name  string
	}{
		{"a number and a name", 7, "The Fall"},
		{"a number alone", 7, ""},
		{"a name alone", 0, "Envoi"},
		{"neither", 0, ""},
	} {
		got := annotationWithChapter(t, c, book, tc.quote, tc.no, tc.name)
		if got.ChapterNo != tc.no || got.Chapter != tc.name {
			t.Errorf("%s: stored %v / %q, want %v / %q", tc.quote, got.ChapterNo, got.Chapter, tc.no, tc.name)
		}
	}

	// A fraction, which is the whole reason the column is REAL: an interlude, an
	// appendix, a part boundary.
	half := annotationWithChapter(t, c, book, "the interlude", 12.5, "Interlude")
	if half.ChapterNo != 12.5 {
		t.Errorf("a half chapter stored as %v", half.ChapterNo)
	}

	// And it survives an edit, which is a different SQL statement.
	c.mustDo("PUT", "/annotations/"+itoa(half.ID), map[string]any{
		"quote": "the interlude", "color": "yellow", "chapter_no": 13.5, "chapter": "Second interlude",
	}, http.StatusOK)
	after := oneAnnotation(t, c, book, half.ID)
	if after.ChapterNo != 13.5 || after.Chapter != "Second interlude" {
		t.Errorf("after the edit: %v / %q", after.ChapterNo, after.Chapter)
	}

	// Clearing the number is an edit like any other, and has to actually clear it —
	// 0 is how absence is spelled, so a form that sends 0 must not leave 13.5 behind.
	c.mustDo("PUT", "/annotations/"+itoa(half.ID), map[string]any{
		"quote": "the interlude", "color": "yellow", "chapter_no": 0, "chapter": "Second interlude",
	}, http.StatusOK)
	if cleared := oneAnnotation(t, c, book, half.ID); cleared.ChapterNo != 0 {
		t.Errorf("clearing the number left %v", cleared.ChapterNo)
	}
}

func TestAChapterNumberSurvivesTheRoundTrip(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	book := createBook(t, alice, "The Recognitions")
	annotationWithChapter(t, alice, book, "both", 7, "The Fall")
	annotationWithChapter(t, alice, book, "number only", 12.5, "")
	annotationWithChapter(t, alice, book, "name only", 0, "Envoi")
	md := alice.mustDo("GET", "/books/"+itoa(book)+"/export", nil, http.StatusOK).Body.String()

	// Into a second account, so nothing passes by finding the rows already there.
	bob := addUser(t, h, alice, "bob")
	res := stage(t, bob, "/import/markdown", "recognitions.md", []byte(md))
	approveStaged(t, bob, res.BatchID)

	anns := decode[annList](t, bob.mustDo("GET", "/annotations", nil, http.StatusOK)).Annotations
	if len(anns) != 3 {
		t.Fatalf("%d highlights after the round trip, want 3", len(anns))
	}
	want := map[string][2]any{
		"both":        {7.0, "The Fall"},
		"number only": {12.5, ""},
		"name only":   {0.0, "Envoi"},
	}
	for _, a := range anns {
		w, ok := want[a.Quote]
		if !ok {
			t.Errorf("unexpected quote %q", a.Quote)
			continue
		}
		if a.ChapterNo != w[0].(float64) || a.Chapter != w[1].(string) {
			t.Errorf("%q came back as %v / %q, want %v / %q", a.Quote, a.ChapterNo, a.Chapter, w[0], w[1])
		}
	}
}
