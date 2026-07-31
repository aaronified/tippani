package importer

import (
	"os"
	"strings"
	"testing"
)

func parseClips(t *testing.T, s string) ([]*Result, ClippingStats) {
	t.Helper()
	res, stats, err := KindleClippings(strings.NewReader(s))
	if err != nil {
		t.Fatalf("KindleClippings: %v", err)
	}
	return res, stats
}

// The user's own file: no "Added on" date at all, "Page N" where most files say
// "location", and a section name where most say a date. Parsing this is the
// whole reason the parser reads structure instead of English.
func TestKindleClippingsUserSample(t *testing.T) {
	const in = "We Are Here (Michael Marshall)\n" +
		"- Your Highlight on Page 11 | Chapter 2\n" +
		"\n" +
		"That meant a change was coming.\n" +
		"==========\n" +
		"We Are Here (Michael Marshall)\n" +
		"- Your Highlight on Page 8 | Chapter 10\n" +
		"\n" +
		"Love is a fire that burns in the soul.\n" +
		"==========\n" +
		"Grimm's Fairy Tales (Margaret Hunt, Wilhelm Grimm, Frances Jenkins Olcott, Jacob Grimm)\n" +
		"- Your Highlight on Page 8 | THE ROBBER BRIDEGROOM\n" +
		"\n" +
		"‘Alas, poor child, thou hast got into a murderer’s den.’\n" +
		"==========\n"

	res, stats := parseClips(t, in)
	if len(res) != 2 {
		t.Fatalf("want 2 books, got %d", len(res))
	}
	if res[0].Book.Title != "We Are Here" || res[0].Book.Author != "Michael Marshall" {
		t.Fatalf("book 1: %+v", res[0].Book)
	}
	if len(res[0].Annotations) != 2 {
		t.Fatalf("book 1 annotations: %d", len(res[0].Annotations))
	}
	a := res[0].Annotations[0]
	if a.Quote != "That meant a change was coming." {
		t.Fatalf("quote: %q", a.Quote)
	}
	if a.Location != "p.11" {
		t.Fatalf("location: %q", a.Location)
	}
	if a.Chapter != "Chapter 2" {
		t.Fatalf("chapter: %q", a.Chapter)
	}
	if a.NotedAt != "" {
		t.Fatalf("no date in this file, got %q", a.NotedAt)
	}
	// A four-name author list is kept verbatim: re-ordering it would be a guess,
	// and the same guess would mangle "(Marshall, Michael)".
	if got := res[1].Book.Author; got != "Margaret Hunt, Wilhelm Grimm, Frances Jenkins Olcott, Jacob Grimm" {
		t.Fatalf("multi-author: %q", got)
	}
	if res[1].Annotations[0].Chapter != "THE ROBBER BRIDEGROOM" {
		t.Fatalf("section name as chapter: %q", res[1].Annotations[0].Chapter)
	}
	if stats.Bookmarks != 0 || stats.Malformed != 0 {
		t.Fatalf("nothing should be skipped: %+v", stats)
	}
}

// A chapter title made of words that look like keywords must not steal the
// classification. "NOTES" must not make it a note, "CLOCK" must not read as
// "Loc", "PAGEANT" must not read as "page".
func TestKindleClippingsAdversarialChapter(t *testing.T) {
	const in = "Some Book (An Author)\n" +
		"- Your Highlight on Page 9 | NOTES ON THE CLOCK TOWER PAGEANT\n" +
		"\n" +
		"The body text.\n" +
		"==========\n"
	res, _ := parseClips(t, in)
	a := res[0].Annotations[0]
	if a.Quote != "The body text." {
		t.Fatalf("must stay a highlight, not become a note: %+v", a)
	}
	if a.Note != "" {
		t.Fatalf("note must be empty: %q", a.Note)
	}
	if a.Chapter != "NOTES ON THE CLOCK TOWER PAGEANT" {
		t.Fatalf("chapter swallowed: %q", a.Chapter)
	}
	if a.Location != "p.9" {
		t.Fatalf("location: %q", a.Location)
	}
}

// The canonical English shape: location range plus an "Added on" date.
func TestKindleClippingsCanonicalEnglish(t *testing.T) {
	const in = "Dune (Frank Herbert)\n" +
		"- Your Highlight on page 42 | Location 610-612 | Added on Sunday, 5 January 2020 21:41:19\n" +
		"\n" +
		"Fear is the mind-killer.\n" +
		"==========\n"
	res, _ := parseClips(t, in)
	a := res[0].Annotations[0]
	if a.Quote != "Fear is the mind-killer." {
		t.Fatalf("quote: %q", a.Quote)
	}
	if a.Location != "p.42" {
		t.Fatalf("first position wins: %q", a.Location)
	}
	if !strings.Contains(a.NotedAt, "2020") {
		t.Fatalf("date field: %q", a.NotedAt)
	}
	if a.Chapter != "" {
		t.Fatalf("a date is not a chapter: %q", a.Chapter)
	}
}

// A German file must land as a highlight and a note, with the note merged onto
// the highlight it annotates.
func TestKindleClippingsGermanNoteMerge(t *testing.T) {
	const in = "Der Prozess (Franz Kafka)\n" +
		"- Ihre Markierung bei Position 610-612 | Hinzugefügt am Montag, 5. Januar 2015 21:41:19\n" +
		"\n" +
		"Jemand musste Josef K. verleumdet haben.\n" +
		"==========\n" +
		"Der Prozess (Franz Kafka)\n" +
		"- Ihre Notiz bei Position 610-612 | Hinzugefügt am Montag, 5. Januar 2015 21:42:03\n" +
		"\n" +
		"der beste erste Satz\n" +
		"==========\n"
	res, stats := parseClips(t, in)
	if len(res) != 1 || len(res[0].Annotations) != 1 {
		t.Fatalf("note should merge onto its highlight: %d books, %d annotations", len(res), len(res[0].Annotations))
	}
	a := res[0].Annotations[0]
	if a.Quote == "" || a.Note != "der beste erste Satz" {
		t.Fatalf("merged annotation: %+v", a)
	}
	if a.Location != "610-612" {
		t.Fatalf("location: %q", a.Location)
	}
	if stats.NotesMerged != 1 {
		t.Fatalf("NotesMerged: %+v", stats)
	}
}

// With no position to key on, a note must NOT be attached to whatever happened
// to precede it — it stands alone.
func TestKindleClippingsNoteWithoutPositionStandsAlone(t *testing.T) {
	const in = "A Book (An Author)\n" +
		"- Your Highlight\n" +
		"\n" +
		"the highlight\n" +
		"==========\n" +
		"A Book (An Author)\n" +
		"- Your Note\n" +
		"\n" +
		"the note\n" +
		"==========\n"
	res, stats := parseClips(t, in)
	if len(res[0].Annotations) != 2 {
		t.Fatalf("want 2 separate annotations, got %d", len(res[0].Annotations))
	}
	if res[0].Annotations[1].Note != "the note" || res[0].Annotations[1].Quote != "" {
		t.Fatalf("orphan note: %+v", res[0].Annotations[1])
	}
	if stats.NotesMerged != 0 {
		t.Fatalf("nothing should have merged: %+v", stats)
	}
}

// Bookmarks carry no text. They are skipped and counted — and a book made
// ENTIRELY of them must not be created as an empty phantom row.
func TestKindleClippingsBookmarksSkipped(t *testing.T) {
	const in = "Kept Book (An Author)\n" +
		"- Your Bookmark on page 5 | Added on Monday, 6 January 2020 10:00:00\n" +
		"\n" +
		"==========\n" +
		"Kept Book (An Author)\n" +
		"- Your Highlight on page 6\n" +
		"\n" +
		"real text\n" +
		"==========\n" +
		"Phantom Book (Nobody)\n" +
		"- Your Bookmark on page 1 | Added on Monday, 6 January 2020 10:00:00\n" +
		"\n" +
		"==========\n"
	res, stats := parseClips(t, in)
	if len(res) != 1 || res[0].Book.Title != "Kept Book" {
		t.Fatalf("a bookmark-only book must not be created: %d books", len(res))
	}
	if len(res[0].Annotations) != 1 {
		t.Fatalf("annotations: %d", len(res[0].Annotations))
	}
	if stats.Bookmarks != 2 {
		t.Fatalf("Bookmarks: %+v", stats)
	}
}

// Editing a highlight makes Kindle append the whole record again. Keep the
// longer text, once.
func TestKindleClippingsDeduplicatesExtendedHighlight(t *testing.T) {
	const in = "A Book (An Author)\n" +
		"- Your Highlight on page 12 | Location 100-101\n" +
		"\n" +
		"Fear is the\n" +
		"==========\n" +
		"A Book (An Author)\n" +
		"- Your Highlight on page 12 | Location 100-103\n" +
		"\n" +
		"Fear is the mind-killer.\n" +
		"==========\n" +
		"A Book (An Author)\n" +
		"- Your Highlight on page 12 | Location 100-103\n" +
		"\n" +
		"Fear is the mind-killer.\n" +
		"==========\n"
	res, stats := parseClips(t, in)
	if len(res[0].Annotations) != 1 {
		t.Fatalf("want 1 deduped annotation, got %d", len(res[0].Annotations))
	}
	if got := res[0].Annotations[0].Quote; got != "Fear is the mind-killer." {
		t.Fatalf("longer text should win: %q", got)
	}
	if stats.Duplicates != 2 {
		t.Fatalf("Duplicates: %+v", stats)
	}
}

// BOM, CRLF, a missing trailing separator, and a garbage block.
func TestKindleClippingsBOMCRLFAndGarbage(t *testing.T) {
	in := "\ufeffFirst Book (An Author)\r\n" +
		"- Your Highlight on page 1\r\n" +
		"\r\n" +
		"one\r\n" +
		"==========\r\n" +
		"a stray line with no metadata line at all\r\n" +
		"==========\r\n" +
		"First Book (An Author)\r\n" +
		"- Your Highlight on page 2\r\n" +
		"\r\n" +
		"two" // no trailing separator
	res, stats := parseClips(t, in)
	if len(res) != 1 {
		t.Fatalf("books: %d", len(res))
	}
	if res[0].Book.Title != "First Book" {
		t.Fatalf("BOM not stripped from the title: %q", res[0].Book.Title)
	}
	if len(res[0].Annotations) != 2 {
		t.Fatalf("the last record has no separator and must still land: %d", len(res[0].Annotations))
	}
	if res[0].Annotations[1].Quote != "two" {
		t.Fatalf("trailing record: %q", res[0].Annotations[1].Quote)
	}
	if stats.Malformed != 1 {
		t.Fatalf("the stray block should be counted: %+v", stats)
	}
}

func TestKindleClippingsTitleAuthorSplit(t *testing.T) {
	cases := []struct{ in, title, author string }{
		{"We Are Here (Michael Marshall)", "We Are Here", "Michael Marshall"},
		// The author is the LAST group, so a bracketed title keeps its brackets.
		{"Dracula (Penguin Classics) (Bram Stoker)", "Dracula (Penguin Classics)", "Bram Stoker"},
		// Printing details are not people.
		{"Some Book (Unabridged)", "Some Book (Unabridged)", ""},
		{"Some Book (2019)", "Some Book (2019)", ""},
		{"Some Book (Book 3)", "Some Book (Book 3)", ""},
		// No parentheses at all.
		{"Just A Title", "Just A Title", ""},
		// Kept verbatim rather than re-ordered — inverting this would mangle a
		// genuine multi-author list, which is indistinguishable from it.
		{"Book (Marshall, Michael)", "Book", "Marshall, Michael"},
	}
	for _, c := range cases {
		title, author := splitClipTitle(c.in)
		if title != c.title || author != c.author {
			t.Errorf("splitClipTitle(%q) = %q / %q, want %q / %q", c.in, title, author, c.title, c.author)
		}
	}
}

func TestKindleClippingsRejectsNonClippings(t *testing.T) {
	if _, _, err := KindleClippings(strings.NewReader("")); err == nil {
		t.Fatal("empty file should error")
	}
	if _, _, err := KindleClippings(strings.NewReader("# Some Markdown\n\nnot a clippings file at all\n")); err == nil {
		t.Fatal("a non-clippings file should error")
	}
}

// hasClipWord is what keeps the short locale tokens safe.
func TestKindleClippingsWordBoundaries(t *testing.T) {
	for _, s := range []string{"the clock tower", "sherlock", "a notary public", "the pageant", "annotated"} {
		if hasClipWord(s, clipNoteWords) {
			t.Errorf("%q must not read as a note keyword", s)
		}
		if hasClipWord(s, clipPosWords) {
			t.Errorf("%q must not read as a position keyword", s)
		}
	}
	for _, s := range []string{"your note", "ihre notiz", "on page 42", "loc. 610", "bei position 610"} {
		if !hasClipWord(s, clipNoteWords) && !hasClipWord(s, clipPosWords) {
			t.Errorf("%q should match a keyword", s)
		}
	}
}

// The owner's real My Clippings.txt, gitignored for privacy like the other
// _real fixtures. The synthetic cases above cover the same shapes in CI.
func TestKindleClippingsRealFile(t *testing.T) {
	f, err := os.Open("testdata/kindle_clippings_real.txt")
	if err != nil {
		t.Skip("real My Clippings.txt fixture not present (gitignored - owner privacy)")
	}
	defer f.Close()
	res, stats, err := KindleClippings(f)
	if err != nil {
		t.Fatal(err)
	}
	if len(res) == 0 {
		t.Fatal("no books parsed")
	}
	for _, b := range res {
		if b.Book.Title == "" {
			t.Fatalf("book with no title: %+v", b.Book)
		}
		if len(b.Annotations) == 0 {
			t.Fatalf("empty book %q must not be created", b.Book.Title)
		}
		for _, a := range b.Annotations {
			if a.Quote == "" && a.Note == "" {
				t.Fatalf("%q: annotation with neither quote nor note: %+v", b.Book.Title, a)
			}
			// The title line must never leak into the body.
			if strings.Contains(a.Quote, b.Book.Title+" (") {
				t.Fatalf("%q: title leaked into the quote: %q", b.Book.Title, a.Quote)
			}
		}
	}
	if stats.Malformed > 0 {
		t.Fatalf("real file should parse cleanly, got %+v", stats)
	}
	t.Logf("parsed %d books, stats %+v", len(res), stats)
}
