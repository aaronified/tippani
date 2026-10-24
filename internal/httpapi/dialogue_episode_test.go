package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// Season + episode on a show's dialogues (§3b / migration 0025). The interesting
// cases are all about the two states a plain integer cannot tell apart — "season
// 0" (where a series keeps its specials) and "no season recorded" — plus the
// shows-only rule and the order a mixed set of lines comes back in.

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

// Episode-qualified dedupe for a show's dialogue.
//
// A book is one work and a passage in it is one passage, so excluding the locator
// from the dedupe hash is right there. A series is one `movies` row while a line is
// located BY episode, so the same rule made a recurring catchphrase unstorable
// past its first occurrence. These tests pin the fix and, just as importantly, pin
// that nothing changed for films, for un-episoded lines, or for books.

// TestDialogueDedupeAcrossLocators runs the handler-level script once per locator
// shape: build a parent, post the same line two or three times with different
// locators, then check what the parent is left holding.
func TestDialogueDedupeAcrossLocators(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	n := func(i int) *int { return &i }

	type post struct {
		season, episode *int
		wantStatus      int
	}
	cases := []struct {
		name        string
		film        bool
		parentTitle string
		line        string
		posts       []post
		wantRows    int
		// wantLabels is asserted only when set: the exact locators, in served order.
		wantLabels             []string
		wantDistinctIDs        bool
		conflictCarriesFirstID bool
	}{
		{
			// TestRecurringLineAcrossEpisodesStaysDistinct is the bug this all exists for: a
			// catchphrase said in two episodes is two quotes, not one.
			name:        "a recurring line across episodes stays distinct",
			parentTitle: "Reel Seven",
			line:        "You cut the part where I was happy.",
			posts: []post{
				{season: n(1), episode: n(2), wantStatus: http.StatusCreated},
				// Same words, a different episode. Before the fix this answered 409 and handed
				// back the S1E2 row, discarding the episode the caller actually typed.
				{season: n(3), episode: n(7), wantStatus: http.StatusCreated},
			},
			wantRows:        2,
			wantLabels:      []string{"S1E2", "S3E7"},
			wantDistinctIDs: true,
		},
		{
			// A season with no episode still discriminates — "somewhere in season 4" and
			// "somewhere in season 6" are different claims about the same words.
			name:        "a recurring line across seasons without episodes",
			parentTitle: "Reel Seven",
			line:        "She stopped asking.",
			posts: []post{
				{season: n(4), wantStatus: http.StatusCreated},
				{season: n(6), wantStatus: http.StatusCreated},
			},
			wantRows: 2,
		},
		{
			// The dedupe that SHOULD still fire: the same line, in the same episode, twice.
			name:        "the same line in the same episode still deduplicates",
			parentTitle: "Reel Seven",
			line:        "Seven reels, seven ways to lie about a summer.",
			posts: []post{
				{season: n(2), episode: n(3), wantStatus: http.StatusCreated},
				{season: n(2), episode: n(3), wantStatus: http.StatusConflict},
			},
			wantRows: 1,
			// 409 carrying the row that already holds the slot, so a retried offline flush
			// stays idempotent — the contract the annotation path also keeps.
			conflictCarriesFirstID: true,
		},
		{
			// Two un-episoded lines on a show dedupe exactly as they did before: the file
			// said nothing about where they came from, so there is nothing to tell them apart.
			name:        "un-episoded show lines still deduplicate",
			parentTitle: "Reel Seven",
			line:        "The pilot never aired.",
			posts: []post{
				{wantStatus: http.StatusCreated},
				{wantStatus: http.StatusConflict},
			},
			wantRows: 1,
		},
		{
			// A film has one runtime and no episodes, so its dedupe is untouched by any of
			// this — including when a caller sends episode numbers a film cannot have (they
			// are cleared by normalize, and must not leak into the hash and defeat dedupe).
			name:        "film dialogue dedupe unchanged",
			film:        true,
			parentTitle: "Casablanca",
			line:        "Round up the usual suspects.",
			posts: []post{
				{wantStatus: http.StatusCreated},
				{wantStatus: http.StatusConflict},
				// Same line again, this time with a season attached. normalize strips it for a
				// film, so it must still read as the duplicate it is.
				{season: n(2), episode: n(4), wantStatus: http.StatusConflict},
			},
			wantRows: 1,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// A fresh parent per row, NOT a shared one. listDialogues filters by movie_id
			// and the dedupe index is UNIQUE (movie_id, dedupe_hash), so a row whose whole
			// assertion is "this work now holds N lines" must not be able to see — or
			// dedupe against — another row's fixtures. Sharing one show here made three
			// rows count every earlier row's lines too (4, 5, 6 instead of 2, 1, 1).
			parent := newShow(c, tc.parentTitle)
			if tc.film {
				parent = newFilm(c, tc.parentTitle)
			}

			var created []int64
			for _, p := range tc.posts {
				body := map[string]any{"movie_id": parent, "quote": tc.line}
				if p.season != nil {
					body["season"] = *p.season
				}
				if p.episode != nil {
					body["episode"] = *p.episode
				}
				rec := c.mustDo("POST", "/dialogues", body, p.wantStatus)
				if p.wantStatus == http.StatusCreated {
					created = append(created, decode[dialogueRow](t, rec).ID)
					continue
				}
				if p.wantStatus == http.StatusConflict && tc.conflictCarriesFirstID {
					if !strings.Contains(rec.Body.String(), itoa(created[0])) {
						t.Fatalf("the 409 should carry the existing row %d, got %s", created[0], rec.Body)
					}
				}
			}

			if tc.wantDistinctIDs {
				seen := map[int64]bool{}
				for _, id := range created {
					if seen[id] {
						t.Fatalf("two episodes' occurrences collapsed into row %d", id)
					}
					seen[id] = true
				}
			}

			rows := listDialogues(c, parent)
			if len(rows) != tc.wantRows {
				t.Fatalf("expected %d occurrence(s), got %d (%v)", tc.wantRows, len(rows), labels(rows))
			}
			if tc.wantLabels != nil {
				if got := labels(rows); !sameStrings(got, tc.wantLabels) {
					t.Fatalf("expected %v, got %v", tc.wantLabels, got)
				}
			}
		})
	}
}

// The importer half: one file naming the same line in two episodes must add two
// rows, not add one and silently relabel it with the second episode.
func TestImportRecurringLineAcrossEpisodes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	md := "---\ntitle: Reel Seven\ntype: show\n---\n\n" +
		"> You cut the part where I was happy.\n- season: 1\n- episode: 2\n\n" +
		"> You cut the part where I was happy.\n- season: 3\n- episode: 7\n"

	if rec := c.importApprove("/import/markdown", "reel-seven.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	list := decode[struct {
		Movies []struct {
			ID int64 `json:"id"`
		} `json:"movies"`
	}](t, c.mustDo("GET", "/movies", nil, http.StatusOK))
	if len(list.Movies) != 1 {
		t.Fatalf("expected one show, got %+v", list.Movies)
	}
	show := list.Movies[0].ID

	// Both occurrences must be there. Before the fix the second hit
	// UNIQUE (movie_id, dedupe_hash) and the importer's COALESCE enrichment
	// relabelled the S1E2 row as S3E7 instead — one row, wrong episode.
	rows := listDialogues(c, show)
	if len(rows) != 2 {
		t.Fatalf("expected both episodes' lines, got %d (%v)", len(rows), labels(rows))
	}
	if got := labels(rows); got[0] != "S1E2" || got[1] != "S3E7" {
		t.Fatalf("expected S1E2 and S3E7, got %v", got)
	}

	// And re-importing the very same file is still a no-op — the property the
	// text-only hash was protecting, which the qualified hash must not break.
	if rec := c.importApprove("/import/markdown", "reel-seven.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("re-import: %d %s", rec.Code, rec.Body)
	}
	if rows := listDialogues(c, show); len(rows) != 2 {
		t.Fatalf("re-import should be idempotent, got %d rows (%v)", len(rows), labels(rows))
	}
}

// autofillActor maps the character(s) a line credits to who plays them in the
// work's CAST MAPPING (work_cast, 0048). A line can name several characters
// (comma-joined tokens), so the resolver splits, matches each on the folded name,
// and joins the unique actors in order — only when no actor was supplied.
//
// THE RULE IS THE SAME ONE AS BEFORE AND THE SOURCE IS NOT. Until 0048 this read
// `movies.cast_json`, which no screen could edit and which is empty for nearly
// every game; every case below used to be fed a JSON literal. They are now fed
// rows, which is the whole point: the last two cases could not be written at all
// against a blob, because there was no way to author or to remove an entry in it.
func TestAutofillActor(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film := createWork(t, c, "Two for the Road", "Stanley Donen", "movie")
	// The third row is a credit with no performer, which TMDB really does return
	// when a person's Roles array is empty — it must contribute nothing rather
	// than an empty string in a comma-joined list.
	seedProviderCast(t, srv, 1, "movie", film,
		[2]string{"Mark Wallace", "Albert Finney"},
		[2]string{"Joanna Wallace", "Audrey Hepburn"},
		[2]string{"Narrator", ""})

	cases := []struct {
		name      string
		character string
		actor     string
		want      string
	}{
		{"single character", "Mark Wallace", "", "Albert Finney"},
		{"case-insensitive", "mark wallace", "", "Albert Finney"},
		{"multiple characters", "Mark Wallace, Joanna Wallace", "", "Albert Finney, Audrey Hepburn"},
		{"order preserved", "Joanna Wallace, Mark Wallace", "", "Audrey Hepburn, Albert Finney"},
		{"dupe actors collapse", "Mark Wallace, Mark Wallace", "", "Albert Finney"},
		{"unmatched character drops", "Mark Wallace, Nobody", "", "Albert Finney"},
		{"cast member without actor", "Narrator", "", ""},
		{"no match at all", "Nobody", "", ""},
		{"explicit actor is preserved", "Mark Wallace", "Someone Else", "Someone Else"},
		{"empty character", "", "", ""},
		{"whitespace character", "  ", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := autofillActor(srv.Store.DB, "movie", film, tc.character, tc.actor); got != tc.want {
				t.Errorf("autofillActor(%q, %q) = %q, want %q", tc.character, tc.actor, got, tc.want)
			}
		})
	}

	// A work with no cast at all resolves nothing and is not an error — which is
	// the state every game was permanently in before this table existed.
	empty := createWork(t, c, "Disco Elysium", "ZA/UM", "game")
	if got := autofillActor(srv.Store.DB, "movie", empty, "Kim Kitsuragi", ""); got != "" {
		t.Errorf("an empty cast resolved %q, want empty", got)
	}

	// A ROW THE READER DELETED ANSWERS NOTHING. The delete leaves a tombstone
	// (origin='removed') so that a refetch cannot hand the row back; the autofill
	// has to agree that it is gone, or deleting a wrong credit would go on
	// stamping its actor onto every line that names the character.
	t.Run("a tombstoned row answers nothing", func(t *testing.T) {
		hand := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(film)+"/cast", map[string]any{
			"character": "Manchester Man", "actor": "Bill Nighy",
		}, http.StatusCreated))
		if got := autofillActor(srv.Store.DB, "movie", film, "Manchester Man", ""); got != "Bill Nighy" {
			t.Fatalf("a hand-typed row should resolve: got %q", got)
		}
		// Tombstoned rather than hard-deleted by making it a provider row first,
		// which is the only kind the delete keeps.
		if _, err := srv.Store.DB.Exec(
			`UPDATE work_cast SET provider_key = 'x', origin = 'provider' WHERE id = ?`, hand.ID); err != nil {
			t.Fatal(err)
		}
		c.mustDo("DELETE", "/cast/"+itoa(hand.ID), nil, http.StatusNoContent)
		var origin string
		if err := srv.Store.DB.QueryRow(`SELECT origin FROM work_cast WHERE id = ?`, hand.ID).Scan(&origin); err != nil {
			t.Fatalf("the row should still be there as a tombstone: %v", err)
		}
		if origin != "removed" {
			t.Fatalf("origin = %q, want \"removed\" — the fixture is not testing what it says", origin)
		}
		if got := autofillActor(srv.Store.DB, "movie", film, "Manchester Man", ""); got != "" {
			t.Errorf("a tombstoned row resolved %q, want empty", got)
		}
	})
}
