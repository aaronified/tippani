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

// TestRecurringLineAcrossEpisodesStaysDistinct is the bug this all exists for: a
// catchphrase said in two episodes is two quotes, not one.
func TestRecurringLineAcrossEpisodesStaysDistinct(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	show := newShow(c, "Reel Seven")

	const line = "You cut the part where I was happy."

	first := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": show, "quote": line, "season": 1, "episode": 2,
	}, http.StatusCreated))

	// Same words, a different episode. Before the fix this answered 409 and handed
	// back the S1E2 row, discarding the episode the caller actually typed.
	second := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": show, "quote": line, "season": 3, "episode": 7,
	}, http.StatusCreated))

	if first.ID == second.ID {
		t.Fatalf("two episodes' occurrences collapsed into row %d", first.ID)
	}
	rows := listDialogues(c, show)
	if len(rows) != 2 {
		t.Fatalf("expected both occurrences, got %d (%v)", len(rows), labels(rows))
	}
	if got := labels(rows); got[0] != "S1E2" || got[1] != "S3E7" {
		t.Fatalf("expected S1E2 then S3E7, got %v", got)
	}
}

// A season with no episode still discriminates — "somewhere in season 4" and
// "somewhere in season 6" are different claims about the same words.
func TestRecurringLineAcrossSeasonsWithoutEpisodes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	show := newShow(c, "Reel Seven")

	const line = "She stopped asking."
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": show, "quote": line, "season": 4,
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": show, "quote": line, "season": 6,
	}, http.StatusCreated)

	if rows := listDialogues(c, show); len(rows) != 2 {
		t.Fatalf("expected two seasons' occurrences, got %d (%v)", len(rows), labels(rows))
	}
}

// The dedupe that SHOULD still fire: the same line, in the same episode, twice.
func TestSameLineSameEpisodeStillDeduplicates(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	show := newShow(c, "Reel Seven")

	const line = "Seven reels, seven ways to lie about a summer."
	first := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": show, "quote": line, "season": 2, "episode": 3,
	}, http.StatusCreated))

	// 409 carrying the row that already holds the slot, so a retried offline flush
	// stays idempotent — the contract the annotation path also keeps.
	body := c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": show, "quote": line, "season": 2, "episode": 3,
	}, http.StatusConflict).Body.String()
	if !strings.Contains(body, itoa(first.ID)) {
		t.Fatalf("the 409 should carry the existing row %d, got %s", first.ID, body)
	}
	if rows := listDialogues(c, show); len(rows) != 1 {
		t.Fatalf("expected one row, got %d", len(rows))
	}
}

// Two un-episoded lines on a show dedupe exactly as they did before: the file
// said nothing about where they came from, so there is nothing to tell them apart.
func TestUnepisodedShowLinesStillDeduplicate(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	show := newShow(c, "Reel Seven")

	const line = "The pilot never aired."
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": show, "quote": line}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": show, "quote": line}, http.StatusConflict)
}

// A film has one runtime and no episodes, so its dedupe is untouched by any of
// this — including when a caller sends episode numbers a film cannot have (they
// are cleared by normalize, and must not leak into the hash and defeat dedupe).
func TestFilmDialogueDedupeUnchanged(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film := newFilm(c, "Casablanca")

	const line = "Round up the usual suspects."
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": film, "quote": line}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": film, "quote": line}, http.StatusConflict)

	// Same line again, this time with a season attached. normalize strips it for a
	// film, so it must still read as the duplicate it is.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": line, "season": 2, "episode": 4,
	}, http.StatusConflict)

	if rows := listDialogues(c, film); len(rows) != 1 {
		t.Fatalf("a film should still hold one copy, got %d", len(rows))
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

	if store.DialogueDedupeHash(line, nil, nil) != store.DedupeHash(line) {
		t.Fatal("with no episode the hash must equal the plain text hash, or existing rows need rewriting")
	}
	if store.DialogueDedupeHash(line, n(1), n(2)) == store.DedupeHash(line) {
		t.Fatal("an episoded line must not hash as the bare text")
	}
	if store.DialogueDedupeHash(line, n(1), n(2)) == store.DialogueDedupeHash(line, n(3), n(7)) {
		t.Fatal("two episodes must hash differently")
	}
	// Season 0 is a real season, so it cannot hash as "no season".
	if store.DialogueDedupeHash(line, n(0), nil) == store.DialogueDedupeHash(line, nil, nil) {
		t.Fatal("season 0 must be distinguishable from no season")
	}
	// S1E2 and S12 must not alias through naive concatenation.
	if store.DialogueDedupeHash(line, n(1), n(2)) == store.DialogueDedupeHash(line, n(12), nil) {
		t.Fatal("S1E2 and S12 must not collide")
	}
	// The text normalization still applies on the qualified path.
	if store.DialogueDedupeHash("It’s  fine", n(1), n(1)) != store.DialogueDedupeHash("it's fine", n(1), n(1)) {
		t.Fatal("typographic folding and whitespace collapse must still apply")
	}
}
