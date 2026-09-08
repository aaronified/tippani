package httpapi

// THE RECORD A CREDIT NEVER HAD, AND WHY THE RETIRED SCREEN WAS STILL REACHABLE.
//
// A name typed onto a quote is text in `utterances.speaker`. Nothing in the app
// filed a person for it — the three writers that call recordPersonKind are all
// triggered by an explicit person write — so `GET /people?kind=speaker` did not
// know the name, the client had no id for the chip, and usePersonOpener fell to
// the surface that could create the row: the retired one. The first press on
// every hand-entered credit landed there.
//
// SO THE TESTS ARE ABOUT THE TWO HALVES OF "HAD NO KIND": no row at all, and a
// row filed under a different role. Both make the credit invisible to the chip
// that is asking, and both are what this endpoint is for.

import (
	"net/http"
	"testing"
)

func TestACreditWithNoRecordGetsOneAndKeepsIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	// A SPEAKER TYPED ONTO A QUOTE, which is how the reader in the report entered
	// theirs: no cast fetched, nothing looked up.
	newUtterance(t, c, map[string]any{
		"quote": "I have no special talents. I am only passionately curious.",
		"speaker": "Albert Einstein", "occasion": "writing to Carl Seelig"})

	// BEFORE: the speaker list does not know the name, which is exactly why the
	// chip had no id to open the record by.
	var before struct {
		People []personRow `json:"people"`
	}
	before = decode[struct {
		People []personRow `json:"people"`
	}](t, c.mustDo("GET", "/people?kind=speaker", nil, 200))
	for _, p := range before.People {
		if p.Name == "Albert Einstein" {
			t.Fatalf("the fixture already has a speaker record, so this measures nothing")
		}
	}

	got := decode[personRow](t, c.mustDo("POST", "/people/ensure",
		map[string]any{"kind": "speaker", "name": "Albert Einstein"}, 200))
	if got.ID == 0 {
		t.Fatal("no id came back, so the caller still has nothing to open the record by")
	}
	if got.Name != "Albert Einstein" {
		t.Errorf("the row came back as %q", got.Name)
	}

	// AND THE CHIP CAN FIND IT NOW, which is the property: the role is filed, not
	// only the row. GET /people?kind= joins person_kinds since 0027, so a row
	// without the role is invisible to the surface asking under it.
	after := decode[struct {
		People []personRow `json:"people"`
	}](t, c.mustDo("GET", "/people?kind=speaker", nil, 200))
	found := false
	for _, p := range after.People {
		if p.ID == got.ID {
			found = true
		}
	}
	if !found {
		t.Error("the record exists and the speaker list still does not carry it — the row was created " +
			"without its role, which leaves the chip exactly as blind as before")
	}

	// A SECOND PRESS IS THE SAME PERSON. Two rows for one name would give the
	// reader two half-filled records to enrich.
	again := decode[personRow](t, c.mustDo("POST", "/people/ensure",
		map[string]any{"kind": "speaker", "name": "Albert Einstein"}, 200))
	if again.ID != got.ID {
		t.Errorf("pressing twice made two records (%d then %d)", got.ID, again.ID)
	}
}

// AND IT NEVER OVERWRITES A RECORD THE READER HAS FILLED IN.
//
// THIS IS WHY IT IS NOT handleUpsertPerson, which was the obvious thing to call:
// that one UPDATEs bio, portrait, dates, links and source from the request, so a
// scaffold's empty fields would blank the record of every name that already had
// one — on a press, silently, from a chip.
func TestEnsureLeavesAFilledRecordAlone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	saved := decode[personRow](t, c.mustDo("PUT", "/people", map[string]any{
		"kind": "author", "name": "Rabindranath Tagore",
		"bio": "Bengali polymath, 1861-1941", "born": "1861", "links": "https://example.invalid/tagore",
	}, 200))
	if saved.Bio == "" {
		t.Fatal("the fixture saved no bio, so this measures nothing")
	}

	// The same person, reached from a SPEAKER chip: a new role on a filled record.
	got := decode[personRow](t, c.mustDo("POST", "/people/ensure",
		map[string]any{"kind": "speaker", "name": "Rabindranath Tagore"}, 200))
	if got.ID != saved.ID {
		t.Fatalf("a second record was made for a name that had one (%d then %d)", saved.ID, got.ID)
	}
	if got.Bio != saved.Bio {
		t.Errorf("the bio came back %q, was %q — opening a chip has erased what the reader wrote",
			got.Bio, saved.Bio)
	}
	if got.Born != saved.Born || got.Links != saved.Links {
		t.Errorf("born/links came back %q/%q, were %q/%q", got.Born, got.Links, saved.Born, saved.Links)
	}
	// AND BOTH ROLES, because one person who writes and speaks is one record. This
	// is the other half of "the people had no kind": the row existed and the role
	// did not, so the speaker chip could not see it.
	kinds := map[string]bool{}
	for _, k := range got.Kinds {
		kinds[k] = true
	}
	if !kinds["author"] || !kinds["speaker"] {
		t.Errorf("the record is filed under %v, want both author and speaker", got.Kinds)
	}
}

func TestEnsureRefusesWhatItCannotFile(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("POST", "/people/ensure", map[string]any{"kind": "protagonist", "name": "X"}, http.StatusBadRequest)
	c.mustDo("POST", "/people/ensure", map[string]any{"kind": "speaker", "name": "   "}, http.StatusBadRequest)
}
