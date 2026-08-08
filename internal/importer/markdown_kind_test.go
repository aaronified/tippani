package importer

import "testing"

// MarkdownKind routes an upload to one of three parsers, and getting it wrong is
// silent: a quotes file read as a book comes back as a book with no title, and a
// book read as a quotes file loses every chapter. The `type:` line is written
// unconditionally by all three exporters for exactly this reason, and the
// heuristics below it only matter for hand-written files.
func TestMarkdownKindRouting(t *testing.T) {
	cases := []struct {
		name, body, want string
	}{
		{"explicit quotes", "---\ntype: quotes\n---\n\n> a line\n", KindQuotes},
		{"explicit quote singular", "---\ntype: quote\n---\n\n> a line\n", KindQuotes},
		{"explicit book", "---\ntype: book\ntitle: Dune\n---\n", KindBook},
		{"explicit movie", "---\ntype: movie\ntitle: Casablanca\n---\n", KindMovie},
		{"explicit show", "---\ntype: show\ntitle: The Wire\n---\n", KindMovie},
		{"case insensitive", "---\nType: Quotes\n---\n", KindQuotes},

		// Hand-written files with no type line fall back to the locator that only
		// one kind has.
		{"speaker binding", "---\n---\n\n> a line\n- speaker: Bose\n", KindQuotes},
		{"occasion binding", "---\n---\n\n> a line\n- occasion: a rally\n", KindQuotes},
		{"author frontmatter", "---\nauthor: Herbert\n---\n", KindBook},
		{"director frontmatter", "---\ndirector: Curtiz\n---\n", KindMovie},
		{"character binding", "---\n---\n\n> a line\n- character: Rick\n", KindMovie},

		// The historical default. A file with nothing decisive is a book, which is
		// the safer guess — a book import asks for a title and fails loudly.
		{"nothing decisive", "---\ntitle: Something\n---\n\n> a line\n- note: hm\n", KindBook},

		// An unrecognised type says nothing and scanning continues, so a later
		// signal still decides.
		{"unknown type then speaker", "---\ntype: weird\n---\n\n> a line\n- speaker: Bose\n", KindQuotes},
	}
	for _, tc := range cases {
		if got := MarkdownKind([]byte(tc.body)); got != tc.want {
			t.Errorf("%s: MarkdownKind = %q, want %q", tc.name, got, tc.want)
		}
	}
}

// The old two-way question still answers the same way, since the import handler
// and its tests are written in terms of it.
func TestLooksLikeMovieMarkdownStillAgrees(t *testing.T) {
	if LooksLikeMovieMarkdown([]byte("---\ntype: show\n---\n")) != true {
		t.Error("a show is still a catalogue export")
	}
	if LooksLikeMovieMarkdown([]byte("---\ntype: quotes\n---\n")) != false {
		t.Error("a quotes file is not a catalogue export")
	}
}
