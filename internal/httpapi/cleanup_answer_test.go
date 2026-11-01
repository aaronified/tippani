package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"
)

// Answering the cleanup list: accept, ignore, restore — over a real server and a
// real database.
//
// cleanup_endpoint_test.go owns the scan. These cases own what the reader can DO
// with it, and each one is a promise the page makes to somebody about to change
// their own words: accepting rewrites one field by one rule and nothing else, an
// ignore is remembered and hidden from the open list, an ignore is per FINDING
// rather than per field, and neither can be aimed at somebody else's quote.

type answerReply struct {
	Rules []string `json:"rules"`
	Items []struct {
		Kind      string `json:"kind"`
		ID        int64  `json:"id"`
		WorkTitle string `json:"work_title"`
		Findings  []struct {
			Rule         string `json:"rule"`
			Field        string `json:"field"`
			Snippet      string `json:"snippet"`
			Count        int    `json:"count"`
			AfterSnippet string `json:"after_snippet"`
			Hash         string `json:"match_hash"`
			Ignored      bool   `json:"ignored"`
		} `json:"findings"`
	} `json:"items"`
	Counts    map[string]int `json:"counts"`
	Scanned   int            `json:"scanned"`
	Truncated bool           `json:"truncated"`
}

func cleanupList(t *testing.T, c *testClient, bucket string) answerReply {
	t.Helper()
	path := "/cleanup"
	if bucket != "" {
		path += "?bucket=" + bucket
	}
	return decode[answerReply](t, c.mustDo("GET", path, nil, http.StatusOK))
}

// one finding, by rule, out of the whole list.
func findingOf(t *testing.T, list answerReply, rule string) (int64, string, string, string) {
	t.Helper()
	for _, it := range list.Items {
		for _, f := range it.Findings {
			if f.Rule == rule {
				return it.ID, f.Field, f.Hash, f.AfterSnippet
			}
		}
	}
	t.Fatalf("no %s finding in %+v", rule, list.Items)
	return 0, "", "", ""
}

// A highlight with two different findings in one field: a doubled space and a
// bracketed reference index.
func answerFixture(t *testing.T, c *testClient) int64 {
	t.Helper()
	book := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Moby-Dick"}, http.StatusCreated))
	ann := decode[struct{ ID int64 }](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID,
		"quote":   "call  me Ishmael[12]",
	}, http.StatusCreated))
	return ann.ID
}

func TestCleanupOffersTheRewriteItWouldMake(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := answerFixture(t, c)

	list := cleanupList(t, c, "")
	seen := map[string]string{}
	for _, it := range list.Items {
		if it.ID != id {
			continue
		}
		for _, f := range it.Findings {
			// The find, in its context, with the match marked in guillemets — the
			// server's own snippet, which is the evidence half of the row.
			if f.Snippet == "" || !strings.Contains(f.Snippet, "»") {
				t.Errorf("%s reports snippet=%q", f.Rule, f.Snippet)
			}
			if f.Hash == "" {
				t.Errorf("%s has no hash, so it cannot be answered", f.Rule)
			}
			seen[f.Rule] = f.AfterSnippet
		}
	}
	// The rewrite, MARKED THE SAME WAY the find is, so the two lines on the page
	// differ in exactly one visible place. The single space between the guillemets is
	// what the two spaces became.
	if got := seen["double-space"]; got != "call» «me Ishmael[12]" {
		t.Errorf("double-space would produce %q", got)
	}
	// AND reference-mark OFFERS NOTHING, because there is no rewrite for it that is
	// right more often than wrong — `Apollo11` is a name and `conscience12` is a
	// footnote index, and the detector cannot tell them apart (cleanupUnfixable). The
	// finding is still listed, and can still be ignored; `after` is empty, which is
	// what makes the page draw no accept button.
	if got, ok := seen["reference-mark"]; !ok {
		t.Error("reference-mark is no longer reported at all")
	} else if got != "" {
		t.Errorf("reference-mark offered a rewrite: %q", got)
	}
	if list.Counts["open"] < 2 || list.Counts["ignored"] != 0 {
		t.Errorf("counts %v, want at least two open and none ignored", list.Counts)
	}
}

func TestCleanupAcceptRewritesOnlyTheFieldAndRuleNamed(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := answerFixture(t, c)
	// A note with its own finding, which must survive an accept aimed at the quote.
	c.mustDo("PUT", "/annotations/"+strconv.FormatInt(id, 10), map[string]any{
		"quote": "call  me Ishmael[12]", "note": "a  note", "color": "yellow",
	}, http.StatusOK)

	r := decode[struct {
		Applied    int `json:"applied"`
		Stale      int `json:"stale"`
		Duplicates int `json:"duplicates"`
	}](t, c.mustDo("POST", "/cleanup/accept", map[string]any{"items": []map[string]any{
		{"kind": "book", "id": id, "field": "quote", "rule": "double-space"},
	}}, http.StatusOK))
	if r.Applied != 1 || r.Stale != 0 || r.Duplicates != 0 {
		t.Fatalf("accept reported %+v, want one applied", r)
	}

	got := decode[struct {
		Annotations []struct {
			Quote string `json:"quote"`
			Note  string `json:"note"`
		} `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?id="+strconv.FormatInt(id, 10), nil, http.StatusOK))
	if len(got.Annotations) != 1 {
		t.Fatalf("expected the one highlight, got %d", len(got.Annotations))
	}
	// The doubled space is gone. THE REFERENCE MARK IS NOT — a different rule was
	// not accepted — and the NOTE is untouched, because accept writes the field it
	// was given.
	if q := got.Annotations[0].Quote; q != "call me Ishmael[12]" {
		t.Errorf("quote is %q", q)
	}
	if n := got.Annotations[0].Note; n != "a  note" {
		t.Errorf("note is %q — accept touched a field it was not given", n)
	}
}

func TestCleanupIgnoreHidesItFromTheOpenListAndKeepsIt(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := answerFixture(t, c)
	_, field, hash, _ := findingOf(t, cleanupList(t, c, ""), "reference-mark")

	item := map[string]any{"kind": "book", "id": id, "field": field, "rule": "reference-mark", "match_hash": hash}
	if got := decode[struct{ Changed int }](t, c.mustDo("POST", "/cleanup/ignore",
		map[string]any{"items": []map[string]any{item}}, http.StatusOK)); got.Changed != 1 {
		t.Fatalf("ignore changed %d rows, want 1", got.Changed)
	}

	open := cleanupList(t, c, "open")
	for _, it := range open.Items {
		for _, f := range it.Findings {
			if f.Rule == "reference-mark" && it.ID == id {
				t.Error("an ignored finding is still on the open list")
			}
		}
	}
	if open.Counts["ignored"] != 1 {
		t.Errorf("counts %v, want one ignored", open.Counts)
	}
	ign := cleanupList(t, c, "ignored")
	if len(ign.Items) != 1 || len(ign.Items[0].Findings) != 1 || ign.Items[0].Findings[0].Rule != "reference-mark" {
		t.Fatalf("ignored bucket holds %+v", ign.Items)
	}
	if !ign.Items[0].Findings[0].Ignored {
		t.Error("a finding in the ignored bucket does not say it is ignored")
	}

	// Idempotent, because the page can be open in two tabs.
	if got := decode[struct{ Changed int }](t, c.mustDo("POST", "/cleanup/ignore",
		map[string]any{"items": []map[string]any{item}}, http.StatusOK)); got.Changed != 0 {
		t.Errorf("a second ignore changed %d rows", got.Changed)
	}
	// And it comes back.
	if got := decode[struct{ Changed int }](t, c.mustDo("POST", "/cleanup/unignore",
		map[string]any{"items": []map[string]any{item}}, http.StatusOK)); got.Changed != 1 {
		t.Error("unignore changed nothing")
	}
	if cleanupList(t, c, "open").Counts["ignored"] != 0 {
		t.Error("the restored finding is still counted as ignored")
	}
}

func TestCleanupAcceptOfAStaleFindingChangesNothing(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Moby-Dick"}, http.StatusCreated))
	ann := decode[struct{ ID int64 }](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book.ID, "quote": "call me Ishmael"}, http.StatusCreated))

	r := decode[struct {
		Applied int `json:"applied"`
		Stale   int `json:"stale"`
	}](t, c.mustDo("POST", "/cleanup/accept", map[string]any{"items": []map[string]any{
		{"kind": "book", "id": ann.ID, "field": "quote", "rule": "double-space"},
	}}, http.StatusOK))
	if r.Applied != 0 || r.Stale != 1 {
		t.Errorf("reported %+v, want nothing applied and one stale", r)
	}
}

func TestCleanupAnsweringIsScopedToItsOwner(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	id := answerFixture(t, alice)
	_, field, hash, _ := findingOf(t, cleanupList(t, alice, ""), "double-space")
	bob := addUser(t, h, alice, "bob")

	// Bob's own list is empty — the ownership is in the scan's SQL, not a filter
	// applied afterwards.
	if got := cleanupList(t, bob, ""); len(got.Items) != 0 || got.Counts["open"] != 0 {
		t.Fatalf("bob can see alice's quotes: %+v", got)
	}
	// And both writes are a 404 rather than a 403, which would confirm the row.
	bob.mustDo("POST", "/cleanup/accept", map[string]any{"items": []map[string]any{
		{"kind": "book", "id": id, "field": field, "rule": "double-space"},
	}}, http.StatusNotFound)
	bob.mustDo("POST", "/cleanup/ignore", map[string]any{"items": []map[string]any{
		{"kind": "book", "id": id, "field": field, "rule": "double-space", "match_hash": hash},
	}}, http.StatusNotFound)

	// Alice's quote is untouched by any of it.
	if got := cleanupList(t, alice, "open"); got.Counts["open"] < 2 {
		t.Errorf("alice's list changed: %v", got.Counts)
	}
}

// A deleted quote takes its ignores with it (0052's three triggers).
func TestCleanupIgnoresGoWhenTheQuoteGoes(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := answerFixture(t, c)
	_, field, hash, _ := findingOf(t, cleanupList(t, c, ""), "double-space")
	c.mustDo("POST", "/cleanup/ignore", map[string]any{"items": []map[string]any{
		{"kind": "book", "id": id, "field": field, "rule": "double-space", "match_hash": hash},
	}}, http.StatusOK)

	c.mustDo("DELETE", "/annotations/"+strconv.FormatInt(id, 10), nil, http.StatusOK)

	var left int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM cleanup_ignores`).Scan(&left); err != nil {
		t.Fatal(err)
	}
	if left != 0 {
		t.Errorf("%d ignore(s) outlived the quote they were about", left)
	}
}

// The three kinds, since the scan reads three tables and the writes have to reach
// all of them. A finding on a film line and on a standalone quote is answered the
// same way as one on a highlight.
func TestCleanupAnswersEveryKind(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	movie := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Casablanca"}, http.StatusCreated))
	line := decode[struct{ ID int64 }](t, c.mustDo("POST", "/dialogues",
		map[string]any{"movie_id": movie.ID, "quote": "here's  looking at you"}, http.StatusCreated))
	utt := decode[struct{ ID int64 }](t, c.mustDo("POST", "/quotes",
		map[string]any{"quote": "the  only thing we have to fear"}, http.StatusCreated))

	for _, tc := range []struct {
		kind string
		id   int64
		want string
	}{
		{"screen", line.ID, "here's looking at you"},
		{"quote", utt.ID, "the only thing we have to fear"},
	} {
		r := decode[struct{ Applied int }](t, c.mustDo("POST", "/cleanup/accept",
			map[string]any{"items": []map[string]any{
				{"kind": tc.kind, "id": tc.id, "field": "quote", "rule": "double-space"},
			}}, http.StatusOK))
		if r.Applied != 1 {
			t.Errorf("%s: applied %d, want 1", tc.kind, r.Applied)
		}
	}
	// Read back through the scan: nothing left open on either.
	if got := cleanupList(t, c, "open"); got.Counts["open"] != 0 {
		t.Errorf("still open: %v (%+v)", got.Counts, got.Items)
	}
}

// The cleanup rules, and mostly the text they must LEAVE ALONE.
//
// Every rule here has a false positive that is somebody's real writing, which is
// why the feature reports instead of fixing — and why the negative cases below
// outnumber the positive ones. A rule that fires on correct Bengali, on an
// ellipsis, or on a hyphenated word is worse than no rule: the reader stops
// reading the list, and the one real finding in it goes with them.

func fired(t *testing.T, field, text string) map[string]int {
	t.Helper()
	out := map[string]int{}
	for _, f := range scanCleanup(field, text) {
		out[f.Rule] = f.Count
	}
	return out
}

func TestCleanupFindsWhatAPageLeavesBehind(t *testing.T) {
	cases := []struct {
		name string
		text string
		rule string
	}{
		{"a footnote index welded to the last word", "the end of conscience12", "reference-mark"},
		{"a superscript reference", "a matter of conscience¹", "reference-mark"},
		{"a bracketed reference", "a matter of conscience [12] and no more", "reference-mark"},
		{"a justified line's double space", "two  spaces here", "double-space"},
		{"a space before a full stop", "the end .", "space-before-punctuation"},
		{"a non-breaking space from HTML", "one two", "invisible"},
		{"a zero-width space from a PDF", "one​two", "invisible"},
		{"a soft hyphen inside a word", "con­science", "invisible"},
		{"a hyphen left from a line break", "con- science", "hyphen-break"},
		{"an IPA pronunciation gloss", "conscience /ˈkɒnʃəns/ is the word", "pronunciation"},
		{"a printed pronunciation note", "conscience (pronounced KON-shuns)", "pronunciation"},
		{"doubled commas", "one,, two", "repeated-punctuation"},
		{"padding at the ends", "  the words  ", "edge-space"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := fired(t, "quote", c.text); got[c.rule] == 0 {
				t.Errorf("%q did not fire %s; fired %v", c.text, c.rule, got)
			}
		})
	}
}

// THE HALF THAT MATTERS MORE. Each of these is text somebody wrote on purpose.
func TestCleanupLeavesRealWritingAlone(t *testing.T) {
	cases := []struct {
		name string
		text string
	}{
		{"an ellipsis", "and then… nothing"},
		{"an ellipsis as three dots", "and then... nothing"},
		{"a year", "it was 1984 and cold"},
		{"a numbered chapter", "see chapter 12 for more"},
		{"a hyphenated word", "a well-known fact"},
		{"an em-dash aside", "the fact — a known one — stood"},
		{"a single sentence space", "One. Two. Three."},
		{"a question", "Who goes there?"},
		{"an exclamation", "Stop!"},
		// THE ONE THAT SETTLES THE INVISIBLE RULE. ক্ষ is built with a zero-width
		// joiner, so a rule that flagged every format character would flag correct
		// Bengali on every line it appears in.
		{"a Bengali conjunct built with a joiner", "রক্ষা করো"},
		{"a Bengali proverb", "যেমন কর্ম তেমন ফল"},
		{"a Bengali sentence ending in a dāṛi", "সে চলে গেল।"},
		{"a Devanagari conjunct", "क्षमा करें"},
		{"a quoted aside in brackets", "the fact [as he put it] stood"},
		{"a date", "on 2026-08-24 it rained"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := fired(t, "quote", c.text); len(got) != 0 {
				t.Errorf("%q fired %v; real writing must be left alone", c.text, got)
			}
		})
	}
}

// ONE FINDING PER RULE, WITH A COUNT. Forty double spaces in a long quote is one
// decision to make, and listing forty would bury the other seven rules.
func TestCleanupCollapsesRepeatsIntoACount(t *testing.T) {
	got := scanCleanup("quote", "a  b  c  d")
	if len(got) != 1 {
		t.Fatalf("want one finding, got %+v", got)
	}
	if got[0].Rule != "double-space" || got[0].Count != 3 {
		t.Fatalf("finding = %+v, want double-space × 3", got[0])
	}
	if got[0].Field != "quote" {
		t.Errorf("field = %q, want the field it was asked about", got[0].Field)
	}
}

// A stray mark's row names its work's cover, so Checks can draw the poster on the group's header.
func TestCleanupRowCarriesTheWorksCover(t *testing.T) {
	srv := newTestServer(t)
	srv.fetchUserImage = func(_ context.Context, _, _ string) (string, error) { return "cafef00dcafef00d.jpg", nil }
	c := signupAdmin(t, srv.Handler())
	book := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Moby-Dick"}, http.StatusCreated))
	c.mustDo("PUT", fmt.Sprintf("/books/%d", book.ID),
		map[string]any{"title": "Moby-Dick", "cover_url": "https://example.com/c.jpg"}, http.StatusOK)
	c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID, "quote": "call  me Ishmael"}, http.StatusCreated)
	c.mustDo("POST", "/quotes", map[string]any{"quote": "a  loose quote"}, http.StatusCreated)

	var withCover, standalone int
	for _, it := range decode[struct {
		Items []struct {
			Kind  string `json:"kind"`
			Cover string `json:"work_cover"`
		} `json:"items"`
	}](t, c.mustDo("GET", "/cleanup", nil, http.StatusOK)).Items {
		switch {
		case it.Kind == "book" && it.Cover == "cafef00dcafef00d.jpg":
			withCover++
		case it.Kind == "quote" && it.Cover == "":
			standalone++
		}
	}
	if withCover != 1 || standalone != 1 {
		t.Errorf("a book's finding named its cover %d times and a standalone quote had none %d times, want 1 and 1", withCover, standalone)
	}
}
