package httpapi

import (
	"net/http"
	"testing"
)

// Merging tags moves the standalone quotes' tags too. The merge listed the annotation and dialogue join tables
// and not the standalone quotes' (added later), so the loser's rows went with it by cascade and a standalone
// quote that wore only the loser came out untagged, with nothing saying so.
func TestMergingTagsKeepsTheStandaloneQuotesThatWoreTheLoser(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	// one quote wears both (the row that makes a naive UPDATE collide), one wears only the loser
	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "Well begun is half done.", "tags": []string{"proverb", "proverbs"},
	}, http.StatusCreated)
	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "A stitch in time.", "tags": []string{"proverbs"},
	}, http.StatusCreated)

	tg := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, http.StatusOK))
	var keep, drop int64
	for _, row := range tg.Tags {
		switch row.Name {
		case "proverb":
			keep = row.ID
		case "proverbs":
			drop = row.ID
		}
	}
	if keep == 0 || drop == 0 {
		t.Fatalf("tags: %+v", tg.Tags)
	}
	c.mustDo("POST", "/tags/merge", map[string]any{"keep_id": keep, "drop_ids": []int64{drop}}, http.StatusOK)

	after := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, http.StatusOK))
	if len(after.Tags) != 1 || after.Tags[0].Name != "proverb" {
		t.Fatalf("tags after the merge: %+v", after.Tags)
	}
	if got := after.Tags[0].Utterances; got != 2 {
		t.Fatalf("the kept tag is worn by %d standalone quotes, want 2 (one wore both, one wore only the loser)", got)
	}
}
