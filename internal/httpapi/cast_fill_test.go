package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// THE UNATTENDED FILL AND THE FROZEN BLOB (0048).
//
// /metadata/fill is the one provider path with no human in it: fifteen titles a
// call, no diff on screen, chunked over a whole selection by the client. Both
// tests here are about what that licenses and what it does not.
//
// Neither could have existed before 0048, because missingStored returned false
// for a []metadata.CastMember — a cast was the one gap the gap-filler could not
// see, so it never sent the field and never reached either of these paths.

// fillOnce runs the endpoint over one film and hands back the field names it
// claims to have written.
func fillOnce(t *testing.T, c *testClient, movieID int64) []string {
	t.Helper()
	res := decode[struct {
		Results []struct {
			Status string   `json:"status"`
			Filled []string `json:"filled"`
			Error  string   `json:"error"`
		} `json:"results"`
	}](t, c.mustDo("POST", "/metadata/fill", map[string]any{"movie_ids": []int64{movieID}}, http.StatusOK))
	if len(res.Results) != 1 || res.Results[0].Status != "ok" {
		t.Fatalf("fill: %+v", res.Results)
	}
	return res.Results[0].Filled
}

// A CAST THE READER EMPTIED IS NOT A GAP, and an empty list is not proof that
// nobody has curated it.
//
// Deleting a provider row leaves a TOMBSTONE, and a tombstone is filtered out of
// every read but the merge's — deliberately, because it is not part of the cast
// any more. So the re-verify diff's stored side is honestly empty, missingStored
// honestly says "missing", and the unattended fill then offered back the very
// list somebody had just finished deleting.
//
// The merge refused it, exactly as designed — which made the visible symptom the
// worse one: the endpoint reported `filled: ["cast"]` over a write that landed
// nothing at all. A bulk button that says it wrote something it did not is how a
// reader learns to distrust every count it prints.
func TestAnUnattendedFillDoesNotReseedACastTheReaderEmptied(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	                          {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	seeded := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast").Cast
	if len(seeded) != 2 {
		t.Fatalf("fixture: %+v", seeded)
	}
	// Every credit deleted on purpose — two tombstones and an empty list, which is
	// the state the whole feature exists to make possible.
	for _, row := range seeded {
		c.mustDo("DELETE", "/cast/"+itoa(row.ID), nil, http.StatusNoContent)
	}
	var tombstones int
	if err := srv.Store.DB.QueryRow(
		`SELECT COUNT(*) FROM work_cast WHERE kind = 'movie' AND work_id = ? AND origin = 'removed'`,
		m.ID).Scan(&tombstones); err != nil {
		t.Fatal(err)
	}
	if tombstones != 2 {
		t.Fatalf("fixture: %d tombstones, want 2", tombstones)
	}

	for _, field := range fillOnce(t, c, m.ID) {
		if field == "cast" {
			t.Fatal(`fill claimed to have filled "cast" — the reader deleted every ` +
				`credit, the merge wrote nothing, and the count said otherwise`)
		}
	}
	if list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast").Cast; len(list) != 0 {
		t.Fatalf("a fill must not hand back a deleted cast: %+v", list)
	}
}

// THE FROZEN BLOB SURVIVES AN APPROVED CAST.
//
// movies.cast_json is kept for one release for one reason: if 0048's backfill is
// wrong about somebody's library, that blob is the only copy in existence of what
// the provider said before the mapping took over. applyReverifyMovie is the path
// that must not spend it, because it is ALSO what /metadata/fill applies through
// — so a bulk button with no diff on screen was rewriting the one copy there is,
// per title, across a whole selection.
//
// It is filled where it is empty and never overwritten, which keeps the pre-0048
// copy on every title that has one. Freezing it is also what starved the column's
// last reader — the quiz's speaker distractors, which have since moved to
// work_cast (cast_speaker_test.go), because a frozen column with a reader on it is
// a pool that goes stale the first time a diff is approved.
func TestApprovingACastDoesNotOverwriteTheFrozenBlob(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"Glados","name":"Ellen McLain"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	blobOf := func() string {
		t.Helper()
		var blob string
		if err := srv.Store.DB.QueryRow(`SELECT COALESCE(cast_json,'') FROM movies WHERE id = ?`,
			m.ID).Scan(&blob); err != nil {
			t.Fatal(err)
		}
		return blob
	}
	seedBlob := blobOf()
	if !strings.Contains(seedBlob, "Ellen McLain") {
		t.Fatalf("fixture: the create path writes the blob whole: %q", seedBlob)
	}

	// The provider now bills a second person, and the reader approves the lot.
	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{"type": "movie", "id": m.ID, "set": map[string]any{
			"cast": []map[string]any{
				{"character": "Glados", "actor": "Ellen McLain", "person_id": "6384"},
				{"character": "Cave Johnson", "actor": "J.K. Simmons", "person_id": "9"},
			},
		}}},
	}, http.StatusOK)

	if list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast").Cast; len(list) != 2 {
		t.Fatalf("the approved cast should have landed in the mapping: %+v", list)
	}
	if got := blobOf(); got != seedBlob {
		t.Fatalf("the frozen blob was rewritten:\n before %q\n after  %q", seedBlob, got)
	}
}

// The other half of the same statement: a title whose blob is '[]' has no
// pre-0048 copy to protect, so it is filled rather than refused. This is the shape
// /metadata/fill meets most often, an IMDb import's leftovers with a pinned id and
// nothing else.
//
// What the fill is FOR has narrowed since the distractors moved off the column —
// the CASE is what keeps `cast_json` in the UPDATE's column list, which is what a
// cast-only approval proves ownership with — and the behaviour is pinned either
// way, because the last assertion below is that half of it.
func TestAnEmptyBlobIsStillFilledByAnApprovedCast(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Matrix"}, http.StatusCreated))

	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{"type": "movie", "id": m.ID, "set": map[string]any{
			"cast": []map[string]any{{"character": "Neo", "actor": "Keanu Reeves", "person_id": "6384"}},
		}}},
	}, http.StatusOK)

	var blob string
	if err := srv.Store.DB.QueryRow(`SELECT COALESCE(cast_json,'') FROM movies WHERE id = ?`,
		m.ID).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(blob, "Keanu Reeves") {
		t.Fatalf("an empty blob is a gap, not a copy worth keeping: %q", blob)
	}
	// And a cast-only approval still lands: with no other approved field, the
	// conditional cast_json statement is the ONLY column in the UPDATE, and it is
	// what proves the row is the caller's.
	if list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast").Cast; len(list) != 1 {
		t.Fatalf("a cast-only approval must still write the mapping: %+v", list)
	}
}
