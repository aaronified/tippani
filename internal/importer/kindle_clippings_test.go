package importer

import (
	"os"
	"reflect"
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

// Each case feeds one My Clippings.txt to the parser and pins the WHOLE result:
// every book, every annotation field, and all four counters of ClippingStats.
// Each row names the specific parser failure it guards against.
func TestKindleClippingsParses(t *testing.T) {
	cases := []struct {
		name      string
		in        string
		want      []Result
		wantStats ClippingStats
	}{
		{
			// The user's own file: no "Added on" date at all, "Page N" where most files say
			// "location", and a section name where most say a date. Parsing this is the
			// whole reason the parser reads structure instead of English.
			name: "the user's own sample: page numbers, section names, no date at all",
			in: "We Are Here (Michael Marshall)\n" +
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
				"==========\n",
			want: []Result{
				{
					Book: Book{Title: "We Are Here", Author: "Michael Marshall"},
					Annotations: []Annotation{
						{Quote: "That meant a change was coming.", Chapter: "Chapter 2", Location: "p.11"},
						{Quote: "Love is a fire that burns in the soul.", Chapter: "Chapter 10", Location: "p.8"},
					},
				},
				{
					// A four-name author list is kept verbatim: re-ordering it would be a guess,
					// and the same guess would mangle "(Marshall, Michael)".
					Book: Book{Title: "Grimm's Fairy Tales", Author: "Margaret Hunt, Wilhelm Grimm, Frances Jenkins Olcott, Jacob Grimm"},
					Annotations: []Annotation{
						// The section name lands as the chapter.
						{Quote: "‘Alas, poor child, thou hast got into a murderer’s den.’", Chapter: "THE ROBBER BRIDEGROOM", Location: "p.8"},
					},
				},
			},
			// Nothing should be skipped.
			wantStats: ClippingStats{},
		},
		{
			// A chapter title made of words that look like keywords must not steal the
			// classification. "NOTES" must not make it a note, "CLOCK" must not read as
			// "Loc", "PAGEANT" must not read as "page".
			name: "an adversarial chapter title must not steal the classification",
			in: "Some Book (An Author)\n" +
				"- Your Highlight on Page 9 | NOTES ON THE CLOCK TOWER PAGEANT\n" +
				"\n" +
				"The body text.\n" +
				"==========\n",
			want: []Result{{
				Book: Book{Title: "Some Book", Author: "An Author"},
				// Must stay a highlight, not become a note: Quote set, Note empty, and the
				// chapter not swallowed.
				Annotations: []Annotation{
					{Quote: "The body text.", Chapter: "NOTES ON THE CLOCK TOWER PAGEANT", Location: "p.9"},
				},
			}},
			wantStats: ClippingStats{},
		},
		{
			// The canonical English shape: location range plus an "Added on" date.
			name: "the canonical English shape, a location range plus an Added on date",
			in: "Dune (Frank Herbert)\n" +
				"- Your Highlight on page 42 | Location 610-612 | Added on Sunday, 5 January 2020 21:41:19\n" +
				"\n" +
				"Fear is the mind-killer.\n" +
				"==========\n",
			want: []Result{{
				Book: Book{Title: "Dune", Author: "Frank Herbert"},
				Annotations: []Annotation{
					// The first position wins ("p.42", not the location range), and a date is
					// not a chapter — Chapter stays empty.
					{Quote: "Fear is the mind-killer.", Location: "p.42", NotedAt: "Added on Sunday, 5 January 2020 21:41:19"},
				},
			}},
			wantStats: ClippingStats{},
		},
		{
			// A German file must land as a highlight and a note, with the note merged onto
			// the highlight it annotates.
			name: "a German note merges onto the highlight it annotates",
			in: "Der Prozess (Franz Kafka)\n" +
				"- Ihre Markierung bei Position 610-612 | Hinzugefügt am Montag, 5. Januar 2015 21:41:19\n" +
				"\n" +
				"Jemand musste Josef K. verleumdet haben.\n" +
				"==========\n" +
				"Der Prozess (Franz Kafka)\n" +
				"- Ihre Notiz bei Position 610-612 | Hinzugefügt am Montag, 5. Januar 2015 21:42:03\n" +
				"\n" +
				"der beste erste Satz\n" +
				"==========\n",
			want: []Result{{
				Book: Book{Title: "Der Prozess", Author: "Franz Kafka"},
				Annotations: []Annotation{{
					Quote:    "Jemand musste Josef K. verleumdet haben.",
					Note:     "der beste erste Satz",
					Location: "610-612",
					NotedAt:  "Hinzugefügt am Montag, 5. Januar 2015 21:41:19",
				}},
			}},
			wantStats: ClippingStats{NotesMerged: 1},
		},
		{
			// With no position to key on, a note must NOT be attached to whatever happened
			// to precede it — it stands alone.
			name: "a note without a position stands alone",
			in: "A Book (An Author)\n" +
				"- Your Highlight\n" +
				"\n" +
				"the highlight\n" +
				"==========\n" +
				"A Book (An Author)\n" +
				"- Your Note\n" +
				"\n" +
				"the note\n" +
				"==========\n",
			want: []Result{{
				Book: Book{Title: "A Book", Author: "An Author"},
				Annotations: []Annotation{
					{Quote: "the highlight"},
					{Note: "the note"},
				},
			}},
			// Nothing should have merged.
			wantStats: ClippingStats{},
		},
		{
			// Bookmarks carry no text. They are skipped and counted — and a book made
			// ENTIRELY of them must not be created as an empty phantom row.
			name: "bookmarks are skipped and a bookmark-only book is not created",
			in: "Kept Book (An Author)\n" +
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
				"==========\n",
			want: []Result{{
				Book:        Book{Title: "Kept Book", Author: "An Author"},
				Annotations: []Annotation{{Quote: "real text", Location: "p.6"}},
			}},
			wantStats: ClippingStats{Bookmarks: 2},
		},
		{
			// Editing a highlight makes Kindle append the whole record again. Keep the
			// longer text, once.
			name: "an extended highlight deduplicates and the longer text wins",
			in: "A Book (An Author)\n" +
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
				"==========\n",
			want: []Result{{
				Book:        Book{Title: "A Book", Author: "An Author"},
				Annotations: []Annotation{{Quote: "Fear is the mind-killer.", Location: "p.12"}},
			}},
			wantStats: ClippingStats{Duplicates: 2},
		},
		{
			// BOM, CRLF, a missing trailing separator, and a garbage block.
			name: "a BOM, CRLF endings, a garbage block and no trailing separator",
			in: "\ufeffFirst Book (An Author)\r\n" +
				"- Your Highlight on page 1\r\n" +
				"\r\n" +
				"one\r\n" +
				"==========\r\n" +
				"a stray line with no metadata line at all\r\n" +
				"==========\r\n" +
				"First Book (An Author)\r\n" +
				"- Your Highlight on page 2\r\n" +
				"\r\n" +
				"two", // no trailing separator
			want: []Result{{
				// The BOM must not survive into the title.
				Book: Book{Title: "First Book", Author: "An Author"},
				Annotations: []Annotation{
					{Quote: "one", Location: "p.1"},
					// The last record has no separator and must still land.
					{Quote: "two", Location: "p.2"},
				},
			}},
			// The stray block should be counted.
			wantStats: ClippingStats{Malformed: 1},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res, stats := parseClips(t, tc.in)
			got := make([]Result, len(res))
			for i, r := range res {
				got[i] = *r
			}
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("books = %+v, want %+v", got, tc.want)
			}
			if stats != tc.wantStats {
				t.Fatalf("stats = %+v, want %+v", stats, tc.wantStats)
			}
		})
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

// The real file's duplicate pair, pinned. Kindle re-appended a highlight the
// owner had extended in place, so page 368 of The Idiot carries the same
// sentence twice — once cut off at "very rarely", once whole. The two records
// disagree on their Location range (6361-6361 vs 6361-6362) and agree only on
// the page, which is why dropClipDuplicate compares the normalised position
// rather than the raw location line: matching on location alone would have let
// both through. Skips with the fixture, like the test above.
func TestKindleClippingsRealDuplicates(t *testing.T) {
	f, err := os.Open("testdata/kindle_clippings_real.txt")
	if err != nil {
		t.Skip("real My Clippings.txt fixture not present (gitignored - owner privacy)")
	}
	defer f.Close()
	res, stats, err := KindleClippings(f)
	if err != nil {
		t.Fatal(err)
	}
	if stats.Duplicates == 0 {
		t.Error("the real file contains an edited-highlight duplicate; none was collapsed")
	}
	if stats.NotesMerged == 0 {
		t.Error("the real file contains a standalone note to merge; none was")
	}

	const truncated = "and that we can very rarely"
	const whole = "and that we can very rarely accurately describe the motives of another."
	var found int
	for _, b := range res {
		for _, a := range b.Annotations {
			if !strings.Contains(a.Quote, truncated) {
				continue
			}
			found++
			// The longer record wins: the cut-off variant must not survive.
			if !strings.Contains(a.Quote, whole) {
				t.Errorf("%q: kept the truncated variant: %q", b.Book.Title, a.Quote)
			}
		}
	}
	if found != 1 {
		t.Errorf("the duplicated highlight survives %d times, want 1", found)
	}

	// The invariant dropClipDuplicate promises, checked over the whole file so
	// it keeps holding as the owner's clippings grow: within one book, no two
	// quotes at the same position may be prefixes of one another.
	for _, b := range res {
		for i := range b.Annotations {
			for j := i + 1; j < len(b.Annotations); j++ {
				x, y := b.Annotations[i], b.Annotations[j]
				if x.Quote == "" || y.Quote == "" || x.Location != y.Location {
					continue
				}
				nx, ny := clipNorm(x.Quote), clipNorm(y.Quote)
				if strings.HasPrefix(nx, ny) || strings.HasPrefix(ny, nx) {
					t.Errorf("%q: residual duplicate at %s:\n  %q\n  %q",
						b.Book.Title, x.Location, x.Quote, y.Quote)
				}
			}
		}
	}
}

// A BOM before every record's title line, not just at the head of the file —
// what a real device actually writes, and what the synthetic BOM case above
// missed by having only one. A surviving BOM is invisible in test output, so
// this asserts on the title bytes rather than on how the title looks.
func TestKindleClippingsBOMBeforeEveryRecord(t *testing.T) {
	const bom = "\ufeff"
	in := bom + "Title A (Author, One)" + "\n" +
		"- Your Highlight on page 1 | Location 1-2 | Added on Monday, 1 January 2026 00:00:00" + "\n" + "\n" +
		"first" + "\n" +
		"==========" + "\n" +
		bom + "Title A (Author, One)" + "\n" +
		"- Your Highlight on page 2 | Location 3-4 | Added on Monday, 1 January 2026 00:00:01" + "\n" + "\n" +
		"second" + "\n" +
		"==========" + "\n"
	res, stats, err := KindleClippings(strings.NewReader(in))
	if err != nil {
		t.Fatal(err)
	}
	if stats.Malformed > 0 {
		t.Fatalf("stats = %+v", stats)
	}
	// One book, not two: a BOM stuck to the second title must not fork it off.
	if len(res) != 1 {
		var titles []string
		for _, b := range res {
			titles = append(titles, b.Book.Title)
		}
		t.Fatalf("got %d books %q, want 1", len(res), titles)
	}
	if got := res[0].Book.Title; got != "Title A" {
		t.Errorf("title = %q (% x), want %q", got, got, "Title A")
	}
	if strings.ContainsRune(res[0].Book.Title, '\ufeff') {
		t.Error("BOM survived in the title")
	}
	if len(res[0].Annotations) != 2 {
		t.Fatalf("got %d annotations, want 2", len(res[0].Annotations))
	}
}
