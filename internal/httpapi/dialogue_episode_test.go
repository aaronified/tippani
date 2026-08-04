package httpapi

// Season + episode on a show's dialogues (§3b / migration 0025). The interesting
// cases are all about the two states a plain integer cannot tell apart — "season
// 0" (where a series keeps its specials) and "no season recorded" — plus the
// shows-only rule and the order a mixed set of lines comes back in.

import (
	"net/http"
	"strings"
	"testing"
)

// newShow and newFilm create the two parents these tests need. A show is a movies
// row with media_type "show", as everywhere else in the catalogue.
func newShow(c *testClient, title string) int64 {
	c.t.Helper()
	m := decode[movieDetail](c.t, c.mustDo("POST", "/movies",
		map[string]any{"title": title, "media_type": "show"}, http.StatusCreated))
	return m.ID
}

func newFilm(c *testClient, title string) int64 {
	c.t.Helper()
	m := decode[movieDetail](c.t, c.mustDo("POST", "/movies",
		map[string]any{"title": title}, http.StatusCreated))
	return m.ID
}

// listDialogues returns one work's lines in served order.
func listDialogues(c *testClient, movieID int64) []dialogueRow {
	c.t.Helper()
	got := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](c.t, c.mustDo("GET", "/dialogues?movie_id="+itoa(movieID), nil, http.StatusOK))
	return got.Dialogues
}

// epLabel renders a row's locator for a failure message ("S2E6" / "S0E1" / "—").
func epLabel(d dialogueRow) string {
	if d.Season == nil {
		return "—"
	}
	if d.Episode == nil {
		return "S" + itoa(int64(*d.Season))
	}
	return "S" + itoa(int64(*d.Season)) + "E" + itoa(int64(*d.Episode))
}

func TestShowDialogueCarriesItsEpisode(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	show := newShow(c, "Reel Seven")

	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": show, "quote": "You cut the part where I was happy.",
		"season": 2, "episode": 6, "timestamp": "00:34:02",
	}, http.StatusCreated))
	if d.Season == nil || *d.Season != 2 || d.Episode == nil || *d.Episode != 6 {
		t.Fatalf("season/episode should round-trip, got %s", epLabel(d))
	}

	// Season 0 is a REAL season — the specials strand. It must come back as 0 and
	// not collapse into "unset", which is the whole reason the column is nullable.
	special := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": show, "quote": "The pilot never aired. Ask me why.",
		"season": 0, "episode": 1,
	}, http.StatusCreated))
	if special.Season == nil || *special.Season != 0 {
		t.Fatalf("season 0 must survive as 0, got %s", epLabel(special))
	}

	// A season with no episode is legal: sometimes the season is all anyone recalls.
	seasonOnly := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": show, "quote": "Somewhere in the second year, she stopped asking.",
		"season": 2,
	}, http.StatusCreated))
	if seasonOnly.Season == nil || *seasonOnly.Season != 2 || seasonOnly.Episode != nil {
		t.Fatalf("a season alone should store alone, got %s", epLabel(seasonOnly))
	}

	// A line with no locator at all stays null on both halves.
	bare := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": show, "quote": "Seven reels, seven ways to lie about a summer.",
	}, http.StatusCreated))
	if bare.Season != nil || bare.Episode != nil {
		t.Fatalf("an unlocated line should be null/null, got %s", epLabel(bare))
	}

	// Served order: through the run, then through each episode, with the
	// un-episoded line last. Season 0 sorts FIRST — specials come before series 1,
	// which is the only reading consistent with the numbers.
	want := []string{"S0E1", "S2E6", "S2", "—"}
	rows := listDialogues(c, show)
	if len(rows) != len(want) {
		t.Fatalf("expected %d lines, got %d", len(want), len(rows))
	}
	for i, w := range want {
		if got := epLabel(rows[i]); got != w {
			t.Fatalf("order at %d: got %s, want %s (full: %v)", i, got, w, labels(rows))
		}
	}
}

func labels(rows []dialogueRow) []string {
	out := make([]string, 0, len(rows))
	for _, d := range rows {
		out = append(out, epLabel(d))
	}
	return out
}

// A full-state PUT carries the locator like every other field, so clearing it is
// sending null — and editing an episoded line must not silently lose it.
func TestShowDialogueEpisodeUpdate(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	show := newShow(c, "Reel Seven")

	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": show, "quote": "Roll it back.", "season": 3, "episode": 4,
	}, http.StatusCreated))
	path := "/dialogues/" + itoa(d.ID)

	moved := decode[dialogueRow](t, c.mustDo("PUT", path, map[string]any{
		"quote": "Roll it back.", "season": 3, "episode": 5,
	}, http.StatusOK))
	if moved.Episode == nil || *moved.Episode != 5 {
		t.Fatalf("episode should move, got %s", epLabel(moved))
	}

	cleared := decode[dialogueRow](t, c.mustDo("PUT", path, map[string]any{
		"quote": "Roll it back.", "season": nil, "episode": nil,
	}, http.StatusOK))
	if cleared.Season != nil || cleared.Episode != nil {
		t.Fatalf("sending null should clear the locator, got %s", epLabel(cleared))
	}
}

func TestEpisodeValidation(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	show := newShow(c, "Reel Seven")

	cases := []struct {
		name string
		body map[string]any
	}{
		{"episode without a season", map[string]any{"episode": 6}},
		{"negative season", map[string]any{"season": -1}},
		{"negative episode", map[string]any{"season": 1, "episode": -2}},
		{"absurd season", map[string]any{"season": 20260804}},
		{"absurd episode", map[string]any{"season": 1, "episode": 100000}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body := map[string]any{"movie_id": show, "quote": "A line: " + tc.name}
			for k, v := range tc.body {
				body[k] = v
			}
			c.mustDo("POST", "/dialogues", body, http.StatusBadRequest)
		})
	}
}

// A film has one runtime, so it has no episodes to name. The locator is DROPPED
// rather than refused: flipping a show to a film leaves its lines holding numbers
// that no longer mean anything, and refusing them would make every later edit of
// those lines fail from a form that (correctly) does not offer the fields.
func TestFilmDialogueHasNoEpisode(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film := newFilm(c, "The Long Take")

	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "Every alibi is a little story we tell the clock.",
		"season": 2, "episode": 6, "timestamp": "00:22:10",
	}, http.StatusCreated))
	if d.Season != nil || d.Episode != nil {
		t.Fatalf("a film's line must not carry an episode, got %s", epLabel(d))
	}
	if d.Timestamp != "00:22:10" {
		t.Fatalf("the rest of the locator must survive: %+v", d)
	}

	// And the export stays clean — no season/episode lines to re-import.
	md := c.mustDo("GET", "/movies/"+itoa(film)+"/export", nil, http.StatusOK).Body.String()
	for _, key := range []string{"- season:", "- episode:"} {
		if strings.Contains(md, key) {
			t.Fatalf("a film's export should not mention %q:\n%s", key, md)
		}
	}
}

// The whole locator has to survive a trip out through Markdown and back, season 0
// included — a file that dropped it would re-import as "no season recorded".
func TestDialogueEpisodeExportImportRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	show := newShow(c, "Reel Seven")

	for _, d := range []map[string]any{
		{"quote": "The pilot never aired. Ask me why.", "season": 0, "episode": 1},
		{"quote": "Seven reels, seven ways to lie about a summer.", "season": 1, "episode": 1, "timestamp": "00:08:31"},
		{"quote": "You cut the part where I was happy.", "season": 2, "episode": 6},
		{"quote": "Somewhere in the second year, she stopped asking.", "season": 2},
	} {
		body := map[string]any{"movie_id": show}
		for k, v := range d {
			body[k] = v
		}
		c.mustDo("POST", "/dialogues", body, http.StatusCreated)
	}

	md := c.mustDo("GET", "/movies/"+itoa(show)+"/export", nil, http.StatusOK).Body.String()
	// "season: 0" is the line that matters: a zero-as-unset export would omit it.
	for _, want := range []string{"- season: 0\n", "- episode: 1\n", "- season: 2\n", "- episode: 6\n"} {
		if !strings.Contains(md, want) {
			t.Fatalf("export missing %q:\n%s", want, md)
		}
	}

	bob := addUser(t, h, c, "carol")
	if rec := bob.importApprove("/import/markdown", "reel-seven.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	list := decode[struct {
		Movies []struct {
			ID        int64  `json:"id"`
			MediaType string `json:"media_type"`
		} `json:"movies"`
	}](t, bob.mustDo("GET", "/movies", nil, http.StatusOK))
	if len(list.Movies) != 1 || list.Movies[0].MediaType != "show" {
		t.Fatalf("imported catalogue: %+v", list.Movies)
	}
	want := []string{"S0E1", "S1E1", "S2E6", "S2"}
	rows := listDialogues(bob, list.Movies[0].ID)
	if got := labels(rows); len(got) != len(want) {
		t.Fatalf("expected %v, got %v", want, got)
	}
	for i, w := range want {
		if got := epLabel(rows[i]); got != w {
			t.Fatalf("re-imported order at %d: got %s, want %s (full: %v)", i, got, w, labels(rows))
		}
	}
}

// Staging is where an import waits, so the locator has to survive the queue as
// well as the file — and the queue's own editor has to be able to fix it.
func TestStagedDialogueEpisodeSurvivesTheQueue(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	md := "---\ntitle: Reel Seven\ntype: show\n---\n\n> A line from the specials.\n- season: 0\n- episode: 2\n\n" +
		"> A line people write by hand.\n- episode: S3E9\n"
	// importFile, not importApprove: the assertion here is about what sits in the
	// queue, before anything lands in the library.
	if rec := c.importFile("/import/markdown", "reel-seven.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("stage: %d %s", rec.Code, rec.Body)
	}
	queue := decode[struct {
		Quotes []stagedQuoteRow `json:"quotes"`
	}](t, c.mustDo("GET", "/import/staged", nil, http.StatusOK))
	if len(queue.Quotes) != 2 {
		t.Fatalf("expected two staged lines, got %d", len(queue.Quotes))
	}
	byQuote := map[string]stagedQuoteRow{}
	for _, q := range queue.Quotes {
		byQuote[q.Quote] = q
	}
	specials := byQuote["A line from the specials."]
	if specials.Season == nil || *specials.Season != 0 || specials.Episode == nil || *specials.Episode != 2 {
		t.Fatalf("staged season 0 should survive: %+v", specials)
	}
	// "S3E9" on the episode key sets both — that is how people write it by hand.
	combined := byQuote["A line people write by hand."]
	if combined.Season == nil || *combined.Season != 3 || combined.Episode == nil || *combined.Episode != 9 {
		t.Fatalf("combined SxxEyy should fill both: %+v", combined)
	}

	// The queue editor fixes one field at a time, counts included.
	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"ids": []int64{combined.ID}, "season": "4", "episode": "1",
	}, http.StatusOK)
	// A blank clears rather than zeroes — the distinction the endpoint takes
	// strings for in the first place.
	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"ids": []int64{specials.ID}, "episode": "",
	}, http.StatusOK)
	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"ids": []int64{specials.ID}, "season": "twelve",
	}, http.StatusBadRequest)

	queue = decode[struct {
		Quotes []stagedQuoteRow `json:"quotes"`
	}](t, c.mustDo("GET", "/import/staged", nil, http.StatusOK))
	for _, q := range queue.Quotes {
		switch q.ID {
		case combined.ID:
			if q.Season == nil || *q.Season != 4 || q.Episode == nil || *q.Episode != 1 {
				t.Fatalf("bulk edit should set both: %+v", q)
			}
		case specials.ID:
			if q.Season == nil || *q.Season != 0 || q.Episode != nil {
				t.Fatalf("a blank should clear the episode and leave season 0: %+v", q)
			}
		}
	}
}
