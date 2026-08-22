package httpapi

// Episode-qualified dedupe for a show's dialogue.
//
// A book is one work and a passage in it is one passage, so excluding the locator
// from the dedupe hash is right there. A series is one `movies` row while a line is
// located BY episode, so the same rule made a recurring catchphrase unstorable
// past its first occurrence. These tests pin the fix and, just as importantly, pin
// that nothing changed for films, for un-episoded lines, or for books.

import (
	"net/http"
	"strings"
	"testing"

	"tippani/internal/store"
)

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

// The hash itself, at the unit level. The nil/nil case being byte-identical to
// DedupeHash is what lets every film and un-episoded row keep the hash already on
// disk, so it is worth pinning separately from the handlers.
func TestDialogueDedupeHashShape(t *testing.T) {
	const line = "You cut the part where I was happy."
	n := func(i int) *int { return &i }

	if store.DialogueDedupeHash(line, nil, nil, "", "") != store.DedupeHash(line) {
		t.Fatal("with no episode the hash must equal the plain text hash, or existing rows need rewriting")
	}
	if store.DialogueDedupeHash(line, n(1), n(2), "", "") == store.DedupeHash(line) {
		t.Fatal("an episoded line must not hash as the bare text")
	}
	if store.DialogueDedupeHash(line, n(1), n(2), "", "") == store.DialogueDedupeHash(line, n(3), n(7), "", "") {
		t.Fatal("two episodes must hash differently")
	}
	// Season 0 is a real season, so it cannot hash as "no season".
	if store.DialogueDedupeHash(line, n(0), nil, "", "") == store.DialogueDedupeHash(line, nil, nil, "", "") {
		t.Fatal("season 0 must be distinguishable from no season")
	}
	// S1E2 and S12 must not alias through naive concatenation.
	if store.DialogueDedupeHash(line, n(1), n(2), "", "") == store.DialogueDedupeHash(line, n(12), nil, "", "") {
		t.Fatal("S1E2 and S12 must not collide")
	}
	// The text normalization still applies on the qualified path.
	if store.DialogueDedupeHash("It’s  fine", n(1), n(1), "", "") != store.DialogueDedupeHash("it's fine", n(1), n(1), "", "") {
		t.Fatal("typographic folding and whitespace collapse must still apply")
	}
}
