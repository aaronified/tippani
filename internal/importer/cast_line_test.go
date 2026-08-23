package importer

import (
	"strings"
	"testing"
)

// THE CAST LINE'S SHAPE (0048), pinned where it is cheapest to pin.
//
// A work's cast round-trips through one frontmatter line — "cast:" on a title,
// "characters:" on a book — because writeFrontmatter is a flat key/value writer
// with no YAML dependency (PLAN §5b) and parseReads already reads a list of small
// records out of one line the same way. The whole path is exercised at the
// handler level; what belongs here is the parsing this file can get wrong on
// input the exporter would never write and a person easily would.
func TestParseCastReadsTheExportersOwnLine(t *testing.T) {
	got := parseCast("GLaDOS — Ellen McLain; Chell (reader); " +
		"Wheatley — Stephen Merchant (corrected); Cave Johnson — J.K. Simmons (removed)")
	want := []CastEntry{
		{Character: "GLaDOS", Actor: "Ellen McLain"},
		{Character: "Chell", Origin: "reader"},
		{Character: "Wheatley", Actor: "Stephen Merchant", Origin: "corrected"},
		{Character: "Cave Johnson", Actor: "J.K. Simmons", Origin: "removed"},
	}
	if len(got) != len(want) {
		t.Fatalf("parsed %d entries, want %d: %+v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("entry %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestParseCastToleratesWhatAPersonWouldType(t *testing.T) {
	for _, tc := range []struct {
		name, line string
		want       CastEntry
	}{
		// A plain hyphen and an en dash, the same three separators parseReads takes.
		{"hyphen", "Ripley - Sigourney Weaver", CastEntry{Character: "Ripley", Actor: "Sigourney Weaver"}},
		{"en dash", "Ripley – Sigourney Weaver", CastEntry{Character: "Ripley", Actor: "Sigourney Weaver"}},
		// No actor at all: every book row, and every game row whose voice actor is
		// still unknown. Ordinary, not malformed.
		{"no actor", "  Ahab  ", CastEntry{Character: "Ahab"}},
		// A provider can seed a row with no character (TMDB does, whenever a
		// person's Roles array is empty), so the export can write one.
		{"no character", "— Ellen McLain", CastEntry{Actor: "Ellen McLain"}},
		// AND THE CASE THE MARKER SYNTAX HAS TO SURVIVE: a parenthesis that is part
		// of the name. Unrecognised words are not markers, so the brackets stay put
		// rather than being eaten off the end of somebody's character.
		{"parens in a name", "The Narrator (voice) — Edward Norton",
			CastEntry{Character: "The Narrator (voice)", Actor: "Edward Norton"}},
		// THE ALIASES ARE NOT MARKERS, and each of these is a character somebody's
		// library can genuinely hold. A marker is a suffix stripped off the end of a
		// NAME, so every word accepted beyond the three the exporter writes is a name
		// the round trip mangles — and the tombstone one loses the credit outright,
		// because a tombstone is filtered out of every read but the merge's.
		{"deleted is a name", "Chell (deleted)", CastEntry{Character: "Chell (deleted)"}},
		{"added is a name", "Chell (added)", CastEntry{Character: "Chell (added)"}},
		{"mine is a name", "Chell (mine)", CastEntry{Character: "Chell (mine)"}},
		{"fixed is a name", "Chell (fixed)", CastEntry{Character: "Chell (fixed)"}},
		// 'provider' is written as no marker at all, so reading it back as one is the
		// same trap with a quieter outcome.
		{"provider is a name", "Chell (provider)", CastEntry{Character: "Chell (provider)"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := parseCast(tc.line)
			if len(got) != 1 {
				t.Fatalf("parsed %d entries from %q: %+v", len(got), tc.line, got)
			}
			if got[0] != tc.want {
				t.Fatalf("%q parsed as %+v, want %+v", tc.line, got[0], tc.want)
			}
		})
	}
}

// An entry with neither name is dropped, which is parseReads' rule for a read
// with neither date: an empty entry is not a credit.
func TestParseCastDropsEmptyEntries(t *testing.T) {
	if got := parseCast("; ;  — ; (reader)"); len(got) != 0 {
		t.Fatalf("expected nothing parseable, got %+v", got)
	}
}

// The line reaches the parsed header from either key, on either side, so a file
// retargeted from one shelf to the other keeps its list.
func TestBothFrontmatterKeysCarryTheCast(t *testing.T) {
	for _, key := range []string{"cast", "characters"} {
		titles, err := MovieMarkdownAll(strings.NewReader(
			"---\ntitle: Portal 2\ntype: game\n" + key + ": GLaDOS — Ellen McLain\n---\n\n> The cake is a lie.\n"))
		if err != nil {
			t.Fatalf("%s: %v", key, err)
		}
		if len(titles) != 1 || len(titles[0].Movie.Cast) != 1 || titles[0].Movie.Cast[0].Actor != "Ellen McLain" {
			t.Fatalf("%s: the title's cast did not arrive: %+v", key, titles)
		}
		books, err := MarkdownAll(strings.NewReader(
			"---\ntitle: Moby-Dick\ntype: book\n" + key + ": Ahab\n---\n\n> Call me Ishmael.\n"))
		if err != nil {
			t.Fatalf("%s: %v", key, err)
		}
		if len(books) != 1 || len(books[0].Book.Cast) != 1 || books[0].Book.Cast[0].Character != "Ahab" {
			t.Fatalf("%s: the book's characters did not arrive: %+v", key, books)
		}
	}
}
