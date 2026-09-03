package httpapi

import (
	"net/http"
	"testing"
)

// The prune, and the four ways it could be wrong.
//
// A sweep that deletes in bulk is the one endpoint in this file where a rule that
// is slightly too loose is unrecoverable in the reader's eyes — they pressed one
// button, and forty rows went. So the tests here are mostly about what it must
// NOT take: a record on a work, a record with a line pointing at it, and anything
// at all belonging to another account.

type orphansResp struct {
	People []struct {
		ID    int64  `json:"id"`
		Name  string `json:"name"`
		Image string `json:"image_path"`
	} `json:"people"`
	Characters []struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
	} `json:"characters"`
}

type pruneResp struct {
	People     int `json:"people"`
	Characters int `json:"characters"`
}

// A SAVED RECORD NOTHING CREDITS is the case the button exists for: a person kept
// for their portrait and bio, whose works have since gone.
func TestPruneTakesTheRecordsNothingPointsAt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// One credited author, and one saved record on no work at all.
	c.mustDo("POST", "/books", map[string]any{"title": "Petersburg", "author": "Andrei Bely"}, http.StatusCreated)
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Nobody At All", "bio": "kept for the portrait"}, http.StatusOK)

	before := decode[orphansResp](t, c.mustDo("GET", "/people/orphans", nil, http.StatusOK))
	if len(before.People) != 1 || before.People[0].Name != "Nobody At All" {
		t.Fatalf("orphans are %+v, want just Nobody At All", before.People)
	}

	got := decode[pruneResp](t, c.mustDo("POST", "/people/prune", nil, http.StatusOK))
	if got.People != 1 {
		t.Fatalf("pruned %d people, want 1", got.People)
	}

	// The credited author is still there, and the orphan is not.
	after := decode[orphansResp](t, c.mustDo("GET", "/people/orphans", nil, http.StatusOK))
	if len(after.People) != 0 {
		t.Fatalf("orphans left after the prune: %+v", after.People)
	}
	if personIDFor(t, srv, 1, "Andrei Bely") == 0 {
		t.Fatal("the credited author went with the sweep")
	}
}

// IT GOES TO THE BIN, ONE ENTRY PER NAME, and comes back whole. A bulk delete
// with no undo is the reason this is not just a DELETE loop on the client.
func TestAPrunedRecordCanBePutBack(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Anna Bunina", "bio": "1774-1829"}, http.StatusOK)
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Zinaida Gippius"}, http.StatusOK)
	c.mustDo("POST", "/people/prune", nil, http.StatusOK)

	// Two entries, not one: each name is its own row, so putting one back does
	// not drag the other with it.
	bin := decode[struct {
		Trash []struct {
			ID    int64  `json:"id"`
			Kind  string `json:"kind"`
			Label string `json:"label"`
		} `json:"trash"`
	}](t, c.mustDo("GET", "/trash", nil, http.StatusOK))
	if len(bin.Trash) != 2 {
		t.Fatalf("bin holds %d entries, want 2: %+v", len(bin.Trash), bin.Trash)
	}
	var buninaEntry int64
	for _, e := range bin.Trash {
		if e.Kind != "person-delete" {
			t.Fatalf("entry kind %q, want person-delete", e.Kind)
		}
		if e.Label == "Anna Bunina" {
			buninaEntry = e.ID
		}
	}
	if buninaEntry == 0 {
		t.Fatalf("no entry labelled Anna Bunina: %+v", bin.Trash)
	}

	c.mustDo("POST", "/trash/"+itoa(buninaEntry)+"/restore", nil, http.StatusOK)
	// Back, with the bio it was saved with — the row, not just the name.
	got := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(personIDFor(t, srv, 1, "Anna Bunina")), nil, http.StatusOK))
	if got.Born != "" && got.Name != "Anna Bunina" {
		t.Fatalf("restored as %+v", got)
	}
	// And Gippius is still in the bin, untouched by the other restore.
	stillBinned := decode[struct {
		Trash []struct {
			Label string `json:"label"`
		} `json:"trash"`
	}](t, c.mustDo("GET", "/trash", nil, http.StatusOK))
	if len(stillBinned.Trash) != 1 || stillBinned.Trash[0].Label != "Zinaida Gippius" {
		t.Fatalf("bin is %+v, want Gippius alone", stillBinned.Trash)
	}
}

// A LINE POINTING AT A RECORD IS A CONNECTION, even with no work behind it. A
// standalone quote has no work, so its speaker has no credits — and is emphatically
// not an orphan. This is the case store.DeletePersonRecord's own refusal would let
// through, which is why the queries do not reuse it.
func TestPruneLeavesASpeakerWithQuotesAlone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/quotes", map[string]any{
		"quote":   "The house was quiet and the world was calm.",
		"speaker": "Wallace Stevens",
	}, http.StatusCreated)

	got := decode[orphansResp](t, c.mustDo("GET", "/people/orphans", nil, http.StatusOK))
	for _, p := range got.People {
		if p.Name == "Wallace Stevens" {
			t.Fatal("a speaker with a quote was called an orphan")
		}
	}
	c.mustDo("POST", "/people/prune", nil, http.StatusOK)
	if personIDFor(t, srv, 1, "Wallace Stevens") == 0 {
		t.Fatal("the speaker went with the sweep")
	}
}

// A CHARACTER ON NO WORK is the other half of the button. Characters have no
// children, so there is nothing partial about putting one back.
func TestPruneTakesACharacterOnNoWork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/characters", map[string]any{"name": "Woland", "description": "the professor"}, http.StatusCreated)

	before := decode[orphansResp](t, c.mustDo("GET", "/people/orphans", nil, http.StatusOK))
	if len(before.Characters) != 1 {
		t.Fatalf("orphan characters are %+v, want one", before.Characters)
	}
	got := decode[pruneResp](t, c.mustDo("POST", "/people/prune", nil, http.StatusOK))
	if got.Characters != 1 {
		t.Fatalf("pruned %d characters, want 1", got.Characters)
	}
	after := decode[orphansResp](t, c.mustDo("GET", "/people/orphans", nil, http.StatusOK))
	if len(after.Characters) != 0 {
		t.Fatalf("characters left: %+v", after.Characters)
	}
}

// ANOTHER ACCOUNT'S ORPHANS ARE NOT YOURS TO SWEEP, and a bulk endpoint that
// leaks scope deletes a stranger's library rather than showing it.
func TestPruneIsScopedToTheAccountThatAsked(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Alice's Orphan"}, http.StatusOK)

	// Bob sees none of it, and his prune takes none of it.
	got := decode[orphansResp](t, bob.mustDo("GET", "/people/orphans", nil, http.StatusOK))
	if len(got.People) != 0 {
		t.Fatalf("bob can see %+v", got.People)
	}
	swept := decode[pruneResp](t, bob.mustDo("POST", "/people/prune", nil, http.StatusOK))
	if swept.People != 0 {
		t.Fatalf("bob pruned %d of alice's records", swept.People)
	}
	if personIDFor(t, srv, 1, "Alice's Orphan") == 0 {
		t.Fatal("alice's record went")
	}
}
