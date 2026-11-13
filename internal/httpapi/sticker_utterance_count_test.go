package httpapi

import (
	"net/http"
	"testing"
)

// The sticker list says how many standalone quotes wear each sticker, so the
// console does not call a sticker used only by standalone quotes unused and offer
// to delete it without a word about them.
func TestAStickerCountsTheStandaloneQuotesThatWearIt(t *testing.T) {
	srv := newTestServer(t)
	srv.SeedNewUsers = true // the default stickers; off by default in tests
	c := signupAdmin(t, srv.Handler())
	worn := listStickers(t, c)[0]
	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "Well begun is half done.", "sticker_id": worn.ID,
	}, http.StatusCreated)

	for _, s := range listStickers(t, c) {
		want := 0
		if s.ID == worn.ID {
			want = 1
		}
		if s.Utterances != want || s.Annotations != 0 || s.Dialogues != 0 {
			t.Fatalf("sticker %q counts utterances=%d annotations=%d dialogues=%d, want %d/0/0",
				s.Name, s.Utterances, s.Annotations, s.Dialogues, want)
		}
	}
}
