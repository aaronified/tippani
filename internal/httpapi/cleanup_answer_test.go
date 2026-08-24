package httpapi

import (
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

// The match-hash argument, end to end: ignoring one finding must not bury the other
// on the same field, and accepting that other one must not revive the ignored one.
func TestCleanupIgnoreSurvivesAcceptingADifferentRule(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := answerFixture(t, c)
	_, field, hash, _ := findingOf(t, cleanupList(t, c, ""), "reference-mark")

	c.mustDo("POST", "/cleanup/ignore", map[string]any{"items": []map[string]any{
		{"kind": "book", "id": id, "field": field, "rule": "reference-mark", "match_hash": hash},
	}}, http.StatusOK)
	c.mustDo("POST", "/cleanup/accept", map[string]any{"items": []map[string]any{
		{"kind": "book", "id": id, "field": "quote", "rule": "double-space"},
	}}, http.StatusOK)

	// The doubled space is fixed, so nothing is open; the reference mark is still
	// ignored even though the text around it changed.
	open := cleanupList(t, c, "open")
	for _, it := range open.Items {
		if it.ID == id {
			t.Errorf("expected nothing open on that quote, got %+v", it.Findings)
		}
	}
	ign := cleanupList(t, c, "ignored")
	if len(ign.Items) != 1 || len(ign.Items[0].Findings) != 1 || ign.Items[0].Findings[0].Rule != "reference-mark" {
		t.Fatalf("the ignore did not survive the accept: %+v", ign.Items)
	}
	// And it is about the text as it now stands — the doubled space was accepted, so
	// the snippet shows the repaired words with the reference mark still marked.
	if snip := ign.Items[0].Findings[0].Snippet; snip != "call me Ishmael»[12]«" {
		t.Errorf("the ignored finding's snippet is %q", snip)
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

func TestCleanupAnsweringRefusesNonsense(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := answerFixture(t, c)

	c.mustDo("GET", "/cleanup?bucket=sideways", nil, http.StatusBadRequest)
	c.mustDo("POST", "/cleanup/accept", map[string]any{"items": []map[string]any{}}, http.StatusBadRequest)
	// A rule this build does not know: refused, not counted as applied.
	c.mustDo("POST", "/cleanup/accept", map[string]any{"items": []map[string]any{
		{"kind": "book", "id": id, "field": "quote", "rule": "delete-everything"},
	}}, http.StatusBadRequest)
	// A field this feature may not write. The scan reads three; `character` is not
	// one of them, deliberately (cleanup_handlers.go says why).
	c.mustDo("POST", "/cleanup/accept", map[string]any{"items": []map[string]any{
		{"kind": "book", "id": id, "field": "character", "rule": "double-space"},
	}}, http.StatusBadRequest)
	// An unknown kind.
	c.mustDo("POST", "/cleanup/ignore", map[string]any{"items": []map[string]any{
		{"kind": "shelf", "id": id, "field": "quote", "rule": "double-space", "match_hash": "x"},
	}}, http.StatusBadRequest)
	// An ignore with no hash: it would match every future finding of that rule on
	// that field, which is precisely what the hash exists to prevent.
	c.mustDo("POST", "/cleanup/ignore", map[string]any{"items": []map[string]any{
		{"kind": "book", "id": id, "field": "quote", "rule": "double-space"},
	}}, http.StatusBadRequest)
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
