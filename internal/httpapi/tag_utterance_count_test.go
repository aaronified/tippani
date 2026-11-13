package httpapi

import (
	"net/http"
	"testing"
)

// The tag list says how many standalone quotes wear each tag. Before it did, the
// Android app summed `annotations` and `dialogues` and showed a tag worn only by
// standalone quotes as used by none.
func TestATagCountsTheStandaloneQuotesThatWearIt(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "Well begun is half done.", "tags": []string{"proverbs"},
	}, http.StatusCreated)
	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "A stitch in time.", "tags": []string{"proverbs"},
	}, http.StatusCreated)

	tg := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, http.StatusOK))
	if len(tg.Tags) != 1 {
		t.Fatalf("tags: %+v", tg.Tags)
	}
	if got := tg.Tags[0]; got.Utterances != 2 || got.Annotations != 0 || got.Dialogues != 0 {
		t.Fatalf("counts utterances=%d annotations=%d dialogues=%d, want 2/0/0", got.Utterances, got.Annotations, got.Dialogues)
	}
}
