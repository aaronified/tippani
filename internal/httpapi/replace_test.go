package httpapi

import (
	"net/http"
	"testing"
)

// Find and replace across a selection.
//
// THE PREVIEW IS THE FEATURE, not a courtesy. This is the most destructive bulk
// operation in the app and the only one whose damage is invisible afterwards: a
// wrong bulk tag is a tag you can see and remove, and a wrong replace has
// rewritten the words — which are the thing this app exists to keep.

type replacePreviewResp struct {
	Rows  int          `json:"rows"`
	Shown int          `json:"shown"`
	Hits  []replaceHit `json:"hits"`
}

func replaceSeed(t *testing.T, c *testClient) (int64, []int64) {
	t.Helper()
	b := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "A Book"}, 201).Body.Bytes())
	var ids []int64
	for _, q := range []string{
		"teh quick brown fox",
		"another teh here",
		"nothing to change",
		"THE loud one",
	} {
		ids = append(ids, idOf(t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": b, "quote": q}, 201).Body.Bytes()))
	}
	return b, ids
}

func TestReplacePreviewWritesNothing(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	b, ids := replaceSeed(t, c)

	got := decode[replacePreviewResp](t, c.mustDo("POST", "/replace/preview", map[string]any{
		"kind": "annotation", "ids": ids, "field": "quote", "find": "teh", "replace": "the",
	}, 200))
	// Two rows contain "teh". "THE loud one" does NOT — case-insensitivity makes
	// "teh" match "TEH", not "THE", which is the whole reason the typo is worth
	// fixing and the reason a replace has to be previewed rather than trusted.
	if got.Rows != 2 {
		t.Fatalf("preview rows = %d, want the two containing the typo: %+v", got.Rows, got.Hits)
	}
	for _, h := range got.Hits {
		if h.Before == h.After {
			t.Errorf("a row with no change is not a hit: %+v", h)
		}
	}
	// AND NOTHING MOVED. This is the assertion the whole two-endpoint split
	// exists for.
	list := decode[struct {
		Annotations []map[string]any `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(b), nil, 200))
	for _, a := range list.Annotations {
		if a["quote"] == "the quick brown fox" {
			t.Fatal("the preview wrote to the database")
		}
	}
}

func TestReplaceApplyRewritesOnlyWhatMatched(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	b, ids := replaceSeed(t, c)

	c.mustDo("POST", "/replace/apply", map[string]any{
		"kind": "annotation", "ids": ids, "field": "quote",
		"find": "teh", "replace": "the", "match_case": true,
	}, 200)

	list := decode[struct {
		Annotations []map[string]any `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(b), nil, 200))
	seen := map[string]bool{}
	for _, a := range list.Annotations {
		seen[a["quote"].(string)] = true
	}
	if !seen["the quick brown fox"] || !seen["another the here"] {
		t.Fatalf("the matches were not rewritten: %v", seen)
	}
	// Untouched rows keep their words EXACTLY — including the one that differs
	// only in case, because match_case was on.
	if !seen["nothing to change"] || !seen["THE loud one"] {
		t.Fatalf("a row that did not match was rewritten: %v", seen)
	}
}

// AN EMPTY `find` MATCHES AT EVERY POSITION, so a replace with it would
// interleave the replacement through every character of every quote in the
// selection — the most destructive thing this endpoint could be asked to do, and
// the easiest to ask for by accident by leaving a box blank.
func TestReplaceRefusesAnEmptyFind(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, ids := replaceSeed(t, c)
	for _, find := range []string{"", "   "} {
		for _, path := range []string{"/replace/preview", "/replace/apply"} {
			c.mustDo("POST", path, map[string]any{
				"kind": "annotation", "ids": ids, "field": "quote", "find": find, "replace": "x",
			}, http.StatusBadRequest)
		}
	}
}

func TestReplaceRefusesAFieldTheKindLacks(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, ids := replaceSeed(t, c)
	// `character` is a dialogue column; an annotation has none.
	c.mustDo("POST", "/replace/preview", map[string]any{
		"kind": "annotation", "ids": ids, "field": "character", "find": "a", "replace": "b",
	}, http.StatusBadRequest)
	// And a work is not a kind this endpoint takes at all.
	c.mustDo("POST", "/replace/preview", map[string]any{
		"kind": "book", "ids": ids, "field": "title", "find": "a", "replace": "b",
	}, http.StatusBadRequest)
}

func TestReplaceNeverLeavesTheAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	b, ids := replaceSeed(t, admin)

	// Bob owns none of these ids, so there is nothing to preview and nothing to
	// rewrite — a 404 rather than a silent success over an empty set.
	bob.mustDo("POST", "/replace/apply", map[string]any{
		"kind": "annotation", "ids": ids, "field": "quote", "find": "teh", "replace": "RUINED",
	}, http.StatusNotFound)

	list := decode[struct {
		Annotations []map[string]any `json:"annotations"`
	}](t, admin.mustDo("GET", "/annotations?book_id="+itoa(b), nil, 200))
	for _, a := range list.Annotations {
		if a["quote"] == "RUINED" {
			t.Fatal("another account rewrote these quotes")
		}
	}
}

// The matcher itself, where the interesting cases are.
func TestReplaceAllHandlesTheAwkwardCases(t *testing.T) {
	for _, tc := range []struct {
		name                 string
		in, find, repl       string
		matchCase, wholeWord bool
		want                 string
		wantN                int
	}{
		{"case-insensitive by default", "The THE the", "the", "a", false, false, "a a a", 3},
		{"case-sensitive when asked", "The THE the", "the", "a", true, false, "The THE a", 1},
		// The reason whole-word exists: "the" inside "there" is not the word.
		{"whole word leaves a substring alone", "there is the end", "the", "a", false, true, "there is a end", 1},
		{"whole word at the very start and end", "the end the", "the", "a", false, true, "a end a", 2},
		{"no match changes nothing", "abc", "z", "y", false, false, "abc", 0},
		// A replacement CONTAINING the needle must not be re-scanned, or this
		// loops forever rewriting its own output.
		{"replacement containing the needle terminates", "a", "a", "aa", false, false, "aa", 1},
		{"empty find is refused by the caller, and is a no-op here", "abc", "", "x", false, false, "abc", 0},
	} {
		got, n := replaceAll(tc.in, tc.find, tc.repl, tc.matchCase, tc.wholeWord)
		if got != tc.want || n != tc.wantN {
			t.Errorf("%s: replaceAll(%q, %q) = %q/%d, want %q/%d",
				tc.name, tc.in, tc.find, got, n, tc.want, tc.wantN)
		}
	}
}
