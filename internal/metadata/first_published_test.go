package metadata

import "testing"

// Preferring the first publication year over an edition's.
//
// The bug this fixes is invisible in a modern library and glaring in an old one.
// Google Books answers with the date of the EDITION it is describing, so a
// Penguin Meditations is 2006 and a Dover Walden is 1995 — both perfectly true,
// and both the wrong answer to "when was this written". Open Library's search
// already returns first_publish_year and this package has always read it; the
// two just never spoke to each other, and which one you got depended on which
// provider's row you happened to click.

func cand(source, title, author string, year int) BookCandidate {
	return BookCandidate{Source: source, Title: title, Author: author, PublishedYear: year}
}

func TestAdoptFirstPublished(t *testing.T) {
	cases := []struct {
		name      string
		cands     []BookCandidate
		wantYears []int
	}{
		{
			name: "an edition year gives way to the first publication",
			cands: []BookCandidate{
				cand("google", "Meditations", "Marcus Aurelius", 2006),
				cand("openlibrary", "Meditations", "Marcus Aurelius Antoninus", 180),
			},
			wantYears: []int{180, 180},
		},
		{
			// The fallback that was actually asked for: if no first-publication year is
			// available, keep the edition date rather than blanking the field.
			// And the one with nothing gains the year its twin had.
			name: "the edition year survives when nothing knows better",
			cands: []BookCandidate{
				cand("google", "Some Novel", "A Writer", 1994),
				cand("openlibrary", "Some Novel", "A Writer", 0),
			},
			wantYears: []int{1994, 1994},
		},
		{
			// Ulysses is Joyce's and Tennyson's. Folding on title alone would date the
			// novel to 1842 — a wrong answer that looks authoritative.
			name: "two different works with one name do not merge",
			cands: []BookCandidate{
				cand("google", "Ulysses", "James Joyce", 1922),
				cand("openlibrary", "Ulysses", "Alfred Tennyson", 1842),
			},
			wantYears: []int{1922, 1842},
		},
		{
			// normalizeWork drops what follows a colon, which is exactly the difference
			// between how the two providers title the same book.
			name: "a subtitle does not stop the match",
			cands: []BookCandidate{
				cand("google", "The Republic: Book One", "Plato", 2007),
				cand("openlibrary", "The Republic", "Plato", -380),
			},
			wantYears: []int{-380, -380},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			adoptFirstPublished(tc.cands, false)
			for i, c := range tc.cands {
				if c.PublishedYear != tc.wantYears[i] {
					t.Errorf("%s: published_year = %d, want %d", c.Source, c.PublishedYear, tc.wantYears[i])
				}
			}
		})
	}
}

// An ISBN identifies one book, so the two providers are not two choices — they
// are two partial accounts of one object. Picking a ROW means inheriting all of
// that row's gaps, which is why the merge is per FIELD.
func TestAnISBNSearchMergesTheProvidersIntoOneBestRecord(t *testing.T) {
	g := cand("google", "Walden; Or, Life in the Woods (Penguin Classics)", "H. D. Thoreau", 1995)
	g.Description = "A long publisher blurb about the pond."
	g.CoverURL = "https://books.google.com/thumb?fife=w1280-h1920&id=vol1"
	g.Genres = []string{"Nature", "Philosophy"}
	g.GoogleID = "vol1"
	g.ISBN13 = "9780306406157"

	o := cand("openlibrary", "Walden", "Henry David Thoreau", 1854)
	o.CoverURL = "https://covers.openlibrary.org/b/id/1-L.jpg"
	o.Genres = []string{"Solitude", "nature"} // "nature" duplicates Google's, in another case
	o.OpenLibraryID = "/works/OL1W"

	got := mergeSameBook([]BookCandidate{g, o})
	if len(got) != 1 {
		t.Fatalf("got %d candidates, want one merged record", len(got))
	}
	m := got[0]

	// The field this whole thing exists for.
	if m.PublishedYear != 1854 {
		t.Errorf("year = %d, want 1854 (first publication, not the Penguin printing)", m.PublishedYear)
	}
	// Google's hi-res fife render beats Open Library's -L.jpg.
	if m.CoverURL != g.CoverURL {
		t.Errorf("cover = %q, want the Google hi-res render", m.CoverURL)
	}
	// Open Library rarely has a blurb; Google almost always does.
	if m.Description != g.Description {
		t.Errorf("description = %q", m.Description)
	}
	// The fuller spelling of the name, which is also what the people table wants.
	if m.Author != "Henry David Thoreau" {
		t.Errorf("author = %q", m.Author)
	}
	// OL titles the work; Google titles the edition in hand, furniture and all.
	if m.Title != "Walden" {
		t.Errorf("title = %q, want the work title", m.Title)
	}
	// Two vocabularies that barely overlap: keep both, and do not double-count a
	// subject that differs only in case.
	if len(m.Genres) != 3 {
		t.Errorf("genres = %v, want the union without a case-duplicate", m.Genres)
	}
	// Both identities survive, so either can be re-verified later.
	if m.GoogleID != "vol1" || m.OpenLibraryID != "/works/OL1W" {
		t.Errorf("ids = %q / %q", m.GoogleID, m.OpenLibraryID)
	}
	if m.ISBN13 != "9780306406157" {
		t.Errorf("isbn13 = %q", m.ISBN13)
	}
}

func TestMergingLeavesASingleCandidateAlone(t *testing.T) {
	// One provider answered. There is nothing to merge and nothing to lose.
	only := []BookCandidate{cand("google", "Alone", "A Writer", 1994)}
	got := mergeSameBook(only)
	if len(got) != 1 || got[0].PublishedYear != 1994 || got[0].Title != "Alone" {
		t.Fatalf("single candidate changed: %+v", got)
	}
}

func TestMergingKeepsAYearWhenTheOtherSourceHasNone(t *testing.T) {
	// The fallback, on the ISBN path: no first-publication year available, so
	// the edition date is the best answer there is and must not be zeroed.
	got := mergeSameBook([]BookCandidate{
		cand("google", "Some Novel", "A Writer", 1994),
		cand("openlibrary", "Some Novel", "A Writer", 0),
	})
	if got[0].PublishedYear != 1994 {
		t.Fatalf("year = %d, want the edition date kept", got[0].PublishedYear)
	}
}

func TestSharesAuthorToken(t *testing.T) {
	for _, tc := range []struct {
		a, b string
		want bool
	}{
		{"Marcus Aurelius", "Marcus Aurelius Antoninus", true},
		{"James Joyce", "Alfred Tennyson", false},
		{"Plato", "Plato", true},
		{"", "Anyone At All", true}, // a missing credit is not a different book
		{"Anyone At All", "", true}, // and it is not directional
		{"J. R. R. Tolkien", "John Ronald Reuel Tolkien", true},
		// Short tokens are skipped so initials and particles cannot carry a
		// match on their own: "de" appearing in both names proves nothing.
		{"Simone de Beauvoir", "Alexandre de Something", false},
	} {
		if got := sharesAuthorToken(tc.a, tc.b); got != tc.want {
			t.Errorf("sharesAuthorToken(%q, %q) = %v, want %v", tc.a, tc.b, got, tc.want)
		}
	}
}
