package httpapi

import (
	"net/http"
	"testing"
)

// THE FOUR COUNTS THE NAV ASKS FOR, and why they are on /stats rather than on
// four endpoints of their own.
//
// The rail names each destination with the container and what is inside it —
// boards and their quotes, anthologies and their entries, tags and their
// stickers. Every one of those is a count(*) over an indexed user_id, and the
// shell already calls /stats on load, so they ride the statement it was going to
// run anyway. The alternative was four round trips on every page load and four
// more places for the rail and the screen to disagree.
//
// `anthologies` IS THE ONE WITH A HISTORY. navBadge has read `stats.anthologies`
// since the drawer was written and this endpoint has never sent it, so the row
// has worn no count for its whole life — silently, because the client's null
// guard reads absent as "draw nothing". A test over the payload is what would
// have caught it, and this is that test.
func TestStatsCountsWhatTheNavNames(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// Two boards, and quotes inside one of them. The board count is the Quotes
	// row's left-hand number — the "works" of that screen.
	newBoard(t, c, "Speeches")
	newBoard(t, c, "Proverbs")

	// An anthology with entries across kinds, because anthology_entries carries
	// no user_id of its own and is scoped through its anthology — a join this
	// test exists partly to keep honest.
	ann, dia, utt := threeKinds(t, c)
	a := newAnthology(t, c, "Best of the year")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": ann},
		{"kind": "screen", "item_id": dia},
		{"kind": "utterance", "item_id": utt},
	})

	uploadSticker(t, c, "seal.png", "Gold Seal", pngMagic)

	st := getStats(t, c)
	if st.Boards != 2 {
		t.Errorf("boards=%d, want 2", st.Boards)
	}
	if st.Anthologies != 1 {
		t.Errorf("anthologies=%d, want 1", st.Anthologies)
	}
	if st.AnthologyQuotes != 3 {
		t.Errorf("anthology_quotes=%d, want 3", st.AnthologyQuotes)
	}
	if st.Stickers != 1 {
		t.Errorf("stickers=%d, want 1", st.Stickers)
	}
}

// PER-USER ISOLATION, over the four new counts specifically. Three of them are
// plain user_id filters and one is a join, and the join is the one where a
// missing WHERE would badge one reader's rail with another reader's library.
func TestStatsNavCountsAreScopedToTheOwner(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	newBoard(t, alice, "Hers")
	ann, _, _ := threeKinds(t, alice)
	a := newAnthology(t, alice, "Hers too")
	addEntries(t, alice, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	uploadSticker(t, alice, "seal.png", "Hers", pngMagic)

	st := getStats(t, bob)
	if st.Boards != 0 || st.Anthologies != 0 || st.AnthologyQuotes != 0 || st.Stickers != 0 {
		t.Fatalf("bob sees alice's library: boards=%d anthologies=%d anthology_quotes=%d stickers=%d",
			st.Boards, st.Anthologies, st.AnthologyQuotes, st.Stickers)
	}
	// And the request itself is a plain 200, not a 403 — another reader's rows
	// are absent, never refused.
	alice.mustDo("GET", "/stats", nil, http.StatusOK)
}
