package httpapi

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

import (
	"net/http"
	"strings"
	"testing"
)

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

func TestAChapterNumberIsRefusedWithAReason(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := createBook(t, c, "The Recognitions")

	for _, tc := range []struct {
		no   float64
		want string
	}{
		{-3, "negative"},
		{20250, "too large"},
	} {
		body := c.mustDo("POST", "/annotations", map[string]any{
			"book_id": book, "quote": "x", "chapter_no": tc.no,
		}, http.StatusBadRequest).Body.String()
		if !strings.Contains(body, tc.want) {
			t.Errorf("chapter_no %v answered %s, want it to mention %q", tc.no, strings.TrimSpace(body), tc.want)
		}
	}

	// The bulk bar shares the rule, and refuses rather than clearing forty rows and
	// reporting success — which is what "" would have done through nullableMeasure.
	a := annotationWithChapter(t, c, book, "a passage", 7, "The Fall")
	body := c.mustDo("POST", "/annotations/bulk", map[string]any{
		"ids": []int64{a.ID}, "chapter_no": "seven",
	}, http.StatusBadRequest).Body.String()
	if !strings.Contains(body, "has to be a number") {
		t.Errorf("bulk chapter_no=%q answered %s", "seven", strings.TrimSpace(body))
	}
	if still := oneAnnotation(t, c, book, a.ID); still.ChapterNo != 7 {
		t.Errorf("the refused bulk edit changed the number to %v", still.ChapterNo)
	}

	// And a real bulk edit works, including the blank that clears it.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{a.ID}, "chapter_no": "9.5"}, http.StatusOK)
	if got := oneAnnotation(t, c, book, a.ID); got.ChapterNo != 9.5 {
		t.Errorf("bulk set the number to %v, want 9.5", got.ChapterNo)
	}
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{a.ID}, "chapter_no": ""}, http.StatusOK)
	if got := oneAnnotation(t, c, book, a.ID); got.ChapterNo != 0 {
		t.Errorf("a blank bulk chapter_no left %v", got.ChapterNo)
	}
}

// TestTheExportWritesOneHeadingPerChapter — the pair becomes one heading, and two
// highlights in the same chapter stay under it.
func TestTheExportWritesOneHeadingPerChapter(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := createBook(t, c, "The Recognitions")

	annotationWithChapter(t, c, book, "first of seven", 7, "The Fall")
	annotationWithChapter(t, c, book, "second of seven", 7, "The Fall")
	annotationWithChapter(t, c, book, "a numbered one", 8, "")
	annotationWithChapter(t, c, book, "a named one", 0, "Envoi")

	md := c.mustDo("GET", "/books/"+itoa(book)+"/export", nil, http.StatusOK).Body.String()
	for _, want := range []string{"\n## 7 · The Fall\n", "\n## 8\n", "\n## Envoi\n"} {
		if !strings.Contains(md, want) {
			t.Errorf("the export is missing the heading %q:\n%s", want, md)
		}
	}
	// One heading for chapter 7, not one per highlight — the export groups on the
	// rendered heading, so a number filled in on one row cannot split a chapter.
	if n := strings.Count(md, "## 7 · The Fall"); n != 1 {
		t.Errorf("chapter 7 got %d headings, want 1:\n%s", n, md)
	}
	// A whole number reads as "7", never "7.0", which is what a REAL column gives
	// you if nobody trims it.
	if strings.Contains(md, "7.0") {
		t.Errorf("the export printed a trailing .0:\n%s", md)
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

// TestTheImporterDoesNotGuessAChapterNumber — the restraint, asserted.
//
// Only the exporter's own shape is split. Everything a person is likely to have
// typed stays whole in the name, exactly as it did before the column existed, which
// is what makes this change safe to ship against files nobody will re-export.
func TestTheImporterDoesNotGuessAChapterNumber(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	md := "---\ntitle: Hand Written\n---\n\n" +
		"## 3. The Fall\n\n> a dot is not the separator\n\n" +
		"## Chapter 7\n\n> nor is a word\n\n" +
		"## 1984\n\n> nor is a bare number that is a name\n\n" +
		"## 3:16\n\n> nor is a verse locator\n"
	res := stage(t, c, "/import/markdown", "hand.md", []byte(md))
	approveStaged(t, c, res.BatchID)

	anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, http.StatusOK)).Annotations
	if len(anns) != 4 {
		t.Fatalf("%d highlights, want 4", len(anns))
	}
	byQuote := map[string]annotationRow{}
	for _, a := range anns {
		byQuote[a.Quote] = a
	}
	for quote, wantName := range map[string]string{
		"a dot is not the separator":          "3. The Fall",
		"nor is a word":                       "Chapter 7",
		"nor is a bare number that is a name": "1984",
		"nor is a verse locator":              "3:16",
	} {
		a := byQuote[quote]
		if a.Chapter != wantName || a.ChapterNo != 0 {
			t.Errorf("%q: got %v / %q, want 0 / %q — the importer parsed a heading it should have left alone",
				quote, a.ChapterNo, a.Chapter, wantName)
		}
	}
}
