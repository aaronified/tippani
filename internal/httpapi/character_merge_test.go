package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// The character half of the identity model's destructive acts, end to end.
//
// 0056 gave characters their own table with aliases, a sort name and a merge, and
// the 3.1.0 backfill creates one character record PER WORK on the promise that
// eight Harry Potters are visible AND MERGEABLE — deliberately, so that forty
// Narrators do not silently weld into one. The visible half shipped in 3.1.0; the
// merge half is this. Every test here was a 404 before it.

type charHit struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Works int    `json:"works"`
}

type charDetailResp struct {
	ID          int64    `json:"id"`
	Name        string   `json:"name"`
	Aliases     []string `json:"aliases"`
	Appearances []struct {
		CastID    int64  `json:"cast_id"`
		WorkTitle string `json:"work_title"`
		Character string `json:"character"`
	} `json:"appearances"`
}

// twoWolands seeds one character name on two books, which is exactly what the
// backfill leaves behind: two records, one per work, waiting to be welded.
func twoWolands(t *testing.T, srv *Server, c *testClient) (a, b int64, bookA, bookB int64) {
	t.Helper()
	bookA = createTestBook(t, c, "The Master and Margarita", "Mikhail Bulgakov")
	bookB = createTestBook(t, c, "Master i Margarita", "M. Bulgakov")
	c.mustDo("POST", "/books/"+itoa(bookA)+"/cast", map[string]any{"character": "Woland"}, http.StatusCreated)
	c.mustDo("POST", "/books/"+itoa(bookB)+"/cast", map[string]any{"character": "Woland"}, http.StatusCreated)
	list := decode[struct {
		Characters []charHit `json:"characters"`
	}](t, c.mustDo("GET", "/characters", nil, 200))
	var ids []int64
	for _, ch := range list.Characters {
		if ch.Name == "Woland" {
			ids = append(ids, ch.ID)
		}
	}
	if len(ids) != 2 {
		t.Fatalf("seed: want two Woland records, one per work; got %d (%+v)", len(ids), list.Characters)
	}
	return ids[0], ids[1], bookA, bookB
}

func TestCharacterMergeFoldsAppearancesAndTheBinHoldsTheWayBack(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	keep, drop, _, _ := twoWolands(t, srv, c)

	// Rename the survivor first, so the alias the merge records is a DIFFERENT
	// spelling from its own name — which is what makes the alias observable, and
	// what a real merge of "Woland" into "the professor" looks like.
	c.mustDo("PUT", "/characters/"+itoa(keep), map[string]any{"name": "The Professor"}, 200)

	merged := decode[struct {
		TrashID int64 `json:"trash_id"`
		Works   int   `json:"works"`
	}](t, c.mustDo("POST", "/characters/merge", map[string]any{"keep_id": keep, "drop_id": drop}, 200))
	if merged.Works != 1 {
		t.Fatalf("merge moved %d appearances, want the one the dropped record had", merged.Works)
	}

	// The dropped record is gone and the survivor holds BOTH appearances.
	c.mustDo("GET", "/characters/"+itoa(drop), nil, http.StatusNotFound)
	after := decode[charDetailResp](t, c.mustDo("GET", "/characters/"+itoa(keep), nil, 200))
	if len(after.Appearances) != 2 {
		t.Fatalf("after merge the survivor is in %d works, want 2: %+v", len(after.Appearances), after.Appearances)
	}
	// THE DROPPED NAME IS NOW A SPELLING THAT FINDS THE SURVIVOR. Without this the
	// next cast import types "Woland" and manufactures the record again.
	if !hasString(after.Aliases, "Woland") {
		t.Fatalf("aliases = %v, want the dropped name among them", after.Aliases)
	}
	// AND THE WORK GOES ON PRINTING WHAT IT PRINTED. A merge says two records are
	// one character; it does not rename anybody's cast list.
	for _, ap := range after.Appearances {
		if ap.Character != "Woland" {
			t.Fatalf("a merge rewrote what a work bills: %q", ap.Character)
		}
	}

	// ---- the bin holds the way back -----------------------------------------
	bin := decode[struct {
		Trash []struct {
			ID         int64  `json:"id"`
			Kind       string `json:"kind"`
			Label      string `json:"label"`
			ChildCount int    `json:"child_count"`
		} `json:"trash"`
	}](t, c.mustDo("GET", "/trash", nil, 200))
	var entry int64
	var label string
	for _, it := range bin.Trash {
		if it.Kind == "character-merge" {
			entry, label = it.ID, it.Label
		}
	}
	if entry == 0 {
		t.Fatalf("no character-merge entry in the bin: %+v", bin.Trash)
	}
	// The label is read BEFORE the merge, because one of the two rows is about to
	// stop existing and this line is what a reader reads to decide whether to undo.
	if label != "Woland → The Professor" {
		t.Fatalf("bin label = %q, want both names as they stood at the merge", label)
	}
	if entry != merged.TrashID {
		t.Fatalf("bin entry %d is not the one the merge reported (%d)", entry, merged.TrashID)
	}

	c.mustDo("POST", "/trash/"+itoa(entry)+"/restore", nil, 200)

	// Both records exist again, one appearance each, and the alias the merge made
	// is gone — not left behind pointing at the survivor.
	back := decode[charDetailResp](t, c.mustDo("GET", "/characters/"+itoa(drop), nil, 200))
	if len(back.Appearances) != 1 {
		t.Fatalf("undo gave the dropped record %d appearances, want 1", len(back.Appearances))
	}
	survivor := decode[charDetailResp](t, c.mustDo("GET", "/characters/"+itoa(keep), nil, 200))
	if len(survivor.Appearances) != 1 {
		t.Fatalf("undo left the survivor with %d appearances, want 1", len(survivor.Appearances))
	}
	if hasString(survivor.Aliases, "Woland") {
		t.Fatalf("undo left the alias the merge created: %v", survivor.Aliases)
	}
}

// A merge must not borrow a value the survivor already has, and must borrow one it
// does not — the mergeFillable rule, which is the only way a merge changes a field.
func TestCharacterMergeFillsOnlyTheSurvivorsBlanks(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	keep, drop, _, _ := twoWolands(t, srv, c)

	c.mustDo("PUT", "/characters/"+itoa(keep), map[string]any{
		"name": "Woland", "description": "The survivor's own words.",
	}, 200)
	c.mustDo("PUT", "/characters/"+itoa(drop), map[string]any{
		"name": "Woland", "description": "The dropped one's words.", "sort_name": "Woland",
	}, 200)

	c.mustDo("POST", "/characters/merge", map[string]any{"keep_id": keep, "drop_id": drop}, 200)

	got := decode[struct {
		Description string `json:"description"`
		SortName    string `json:"sort_name"`
	}](t, c.mustDo("GET", "/characters/"+itoa(keep), nil, 200))
	// The reader picked which record survives, and that pick includes its values.
	if got.Description != "The survivor's own words." {
		t.Fatalf("a merge overwrote a value the survivor had: %q", got.Description)
	}
	// The blank IS filled — otherwise the rule would just be "never borrow".
	if got.SortName != "Woland" {
		t.Fatalf("sort_name = %q, want the dropped record's, since the survivor had none", got.SortName)
	}
}

func TestCharacterMergeRefusesItselfAndAStrangersRecord(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	keep, drop, _, _ := twoWolands(t, srv, c)

	// A refusal the reader caused is a 409 they can read, not a 500.
	c.mustDo("POST", "/characters/merge", map[string]any{"keep_id": keep, "drop_id": keep}, http.StatusConflict)

	// Another account's record does not exist as far as this one is concerned —
	// the package's standing rule, and a 404 rather than a 403.
	other := addUser(t, srv.Handler(), c, "bob")
	other.mustDo("POST", "/characters/merge", map[string]any{"keep_id": keep, "drop_id": drop}, http.StatusNotFound)
}

// Split-out gives one spelling a record of its own, and says nothing untrue about
// where the works went — they stay, because nothing remembers which came from where.
func TestCharacterSplitHandsBackARecordAndLeavesTheAppearances(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	keep, drop, _, _ := twoWolands(t, srv, c)
	c.mustDo("PUT", "/characters/"+itoa(keep), map[string]any{"name": "The Professor"}, 200)
	c.mustDo("POST", "/characters/merge", map[string]any{"keep_id": keep, "drop_id": drop}, 200)

	made := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/characters/"+itoa(keep)+"/split", map[string]any{"alias": "Woland"}, http.StatusCreated))
	if made.ID == 0 {
		t.Fatal("split returned no record")
	}
	split := decode[charDetailResp](t, c.mustDo("GET", "/characters/"+itoa(made.ID), nil, 200))
	if split.Name != "Woland" {
		t.Fatalf("the split record is called %q", split.Name)
	}
	if len(split.Appearances) != 0 {
		t.Fatalf("split moved %d appearances; the schema does not remember which to move", len(split.Appearances))
	}
	survivor := decode[charDetailResp](t, c.mustDo("GET", "/characters/"+itoa(keep), nil, 200))
	if len(survivor.Appearances) != 2 {
		t.Fatalf("the works left the record they were on: %d", len(survivor.Appearances))
	}
	if hasString(survivor.Aliases, "Woland") {
		t.Fatalf("the spelling is still filed here as well as being its own record: %v", survivor.Aliases)
	}
}

// The picker the merge control is built on. It finds by a FOLDED substring, which
// is why it is done in Go: SQLite's lower() is ASCII-only.
func TestCharacterSearchFindsFoldedAndCarriesItsWeight(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	keep, _, _, _ := twoWolands(t, srv, c)
	c.mustDo("PUT", "/characters/"+itoa(keep), map[string]any{"name": "ВОЛАНД"}, 200)

	hits := decode[struct {
		Characters []charHit `json:"characters"`
	}](t, c.mustDo("GET", "/characters/search?q=%D0%B2%D0%BE%D0%BB%D0%B0%D0%BD%D0%B4", nil, 200))
	if len(hits.Characters) != 1 || hits.Characters[0].ID != keep {
		t.Fatalf("a lower-case Cyrillic query did not find the upper-case record: %+v", hits.Characters)
	}
	// The weight is what makes a destructive pick safe: two records of one name are
	// told apart by how much hangs off each.
	if hits.Characters[0].Works != 1 {
		t.Fatalf("hit reports %d works, want the one appearance it has", hits.Characters[0].Works)
	}

	// The literal route wins over /characters/{id} — "search" never arrives as an id.
	c.mustDo("GET", "/characters/search", nil, 200)
}

func hasString(xs []string, want string) bool {
	for _, x := range xs {
		if x == want {
			return true
		}
	}
	return false
}

// THE ORDERING INSIDE A MERGE'S ALIAS HANDLING, pinned for both tables.
//
// A merge upserts the dropped record's name as an alias of the survivor, and the
// reversal has to carry WHAT THAT KEY HELD BEFORE so undo can put it back instead
// of deleting an alias the merge never made. The subtle case is when the dropped
// record ITSELF already held that spelling as an alias — reachable by renaming a
// record onto one of its own spellings. The alias-moving loop runs first, so a read
// taken after it would record the SURVIVOR as the previous owner, and undo would
// re-park the spelling on the survivor it had just taken it off: a restored record
// that its own name no longer finds.
//
// Found by a review of the character half and present in the person half too, which
// is what writing the two out in parallel is for. Both are asserted here.
func TestUndoingAMergeGivesBackASpellingTheDroppedRecordHeldAsItsOwn(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	keep, drop, _, _ := twoWolands(t, srv, c)

	// Give the dropped record an alias, then rename it ONTO that alias — so it now
	// holds a spelling equal to its own name.
	c.mustDo("POST", "/characters/"+itoa(drop)+"/aliases", map[string]any{"alias": "Messire"}, http.StatusNoContent)
	c.mustDo("PUT", "/characters/"+itoa(drop), map[string]any{"name": "Messire"}, 200)
	c.mustDo("PUT", "/characters/"+itoa(keep), map[string]any{"name": "The Professor"}, 200)

	c.mustDo("POST", "/characters/merge", map[string]any{"keep_id": keep, "drop_id": drop}, 200)
	bin := decode[struct {
		Trash []struct {
			ID   int64  `json:"id"`
			Kind string `json:"kind"`
		} `json:"trash"`
	}](t, c.mustDo("GET", "/trash", nil, 200))
	var entry int64
	for _, it := range bin.Trash {
		if it.Kind == "character-merge" {
			entry = it.ID
		}
	}
	c.mustDo("POST", "/trash/"+itoa(entry)+"/restore", nil, 200)

	// The restored record answers to its own spelling again.
	back := decode[charDetailResp](t, c.mustDo("GET", "/characters/"+itoa(drop), nil, 200))
	if !hasString(back.Aliases, "Messire") {
		t.Fatalf("the restored record's aliases are %v — the spelling it owned did not come back", back.Aliases)
	}
	survivor := decode[charDetailResp](t, c.mustDo("GET", "/characters/"+itoa(keep), nil, 200))
	if hasString(survivor.Aliases, "Messire") {
		t.Fatalf("undo left the spelling on the survivor: %v", survivor.Aliases)
	}
}

// The person half of the same ordering.
func TestUndoingAPersonMergeGivesBackASpellingTheDroppedRecordHeldAsItsOwn(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	createTestBook(t, c, "The Master and Margarita", "Mikhail Bulgakov")
	createTestBook(t, c, "Master i Margarita", "M. Bulgakov")

	keep := personID(t, srv, 1, "Mikhail Bulgakov")
	drop := personID(t, srv, 1, "M. Bulgakov")
	c.mustDo("POST", "/people/id/"+itoa(drop)+"/aliases", map[string]any{"alias": "Bulgakov"}, http.StatusNoContent)
	c.mustDo("PUT", "/people/id/"+itoa(drop), map[string]any{"name": "Bulgakov"}, 200)

	c.mustDo("POST", "/people/merge", map[string]any{"keep_id": keep, "drop_id": drop}, 200)
	bin := decode[struct {
		Trash []struct {
			ID   int64  `json:"id"`
			Kind string `json:"kind"`
		} `json:"trash"`
	}](t, c.mustDo("GET", "/trash", nil, 200))
	var entry int64
	for _, it := range bin.Trash {
		if it.Kind == "person-merge" {
			entry = it.ID
		}
	}
	if entry == 0 {
		t.Fatalf("no person-merge entry: %+v", bin.Trash)
	}
	c.mustDo("POST", "/trash/"+itoa(entry)+"/restore", nil, 200)

	back := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(drop), nil, 200))
	if !hasString(back.Aliases, "Bulgakov") {
		t.Fatalf("the restored record's aliases are %v — the spelling it owned did not come back", back.Aliases)
	}
	survivor := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(keep), nil, 200))
	if hasString(survivor.Aliases, "Bulgakov") {
		t.Fatalf("undo left the spelling on the survivor: %v", survivor.Aliases)
	}
}

// Per-user isolation on the two reads that gained it last — 404, never 403, so
// another account's record does not confirm that it exists.
func TestTheRecordListsAreScopedToTheirAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	twoWolands(t, srv, c)
	createTestBook(t, c, "Dune", "Frank Herbert")

	bob := addUser(t, h, c, "bob")
	mine := decode[struct {
		People []personRecordResp `json:"people"`
	}](t, bob.mustDo("GET", "/people/records", nil, 200))
	if len(mine.People) != 0 {
		t.Fatalf("a new account can see %d of somebody else's people records", len(mine.People))
	}
	hits := decode[struct {
		Characters []charHit `json:"characters"`
	}](t, bob.mustDo("GET", "/characters/search?q=woland", nil, 200))
	if len(hits.Characters) != 0 {
		t.Fatalf("a new account's character search returned %d of somebody else's records", len(hits.Characters))
	}
}

// ---- a record delete goes to the bin ----------------------------------------
//
// A GLOBAL RECORD IS NOT ATTRIBUTION. A work_cast row says how one work bills
// somebody and deleting it is a correction to that work, so it stays permanent. A
// people or characters row is authored — a sort name that was a judgement, a
// description, a portrait, every alias filed and every merge those aliases record.
// Before this, both deleted outright.

// binEntry returns the newest bin entry of a kind, or fails.
func binEntry(t *testing.T, c *testClient, kind string) (int64, string, int) {
	t.Helper()
	bin := decode[struct {
		Trash []struct {
			ID         int64  `json:"id"`
			Kind       string `json:"kind"`
			Label      string `json:"label"`
			ChildCount int    `json:"child_count"`
		} `json:"trash"`
	}](t, c.mustDo("GET", "/trash", nil, 200))
	for _, it := range bin.Trash {
		if it.Kind == kind {
			return it.ID, it.Label, it.ChildCount
		}
	}
	t.Fatalf("no %s entry in the bin: %+v", kind, bin.Trash)
	return 0, "", 0
}

func TestDeletingACharacterIsUndoableAndBringsItsCastRowsBack(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	keep, _, bookA, _ := twoWolands(t, srv, c)
	c.mustDo("POST", "/characters/"+itoa(keep)+"/aliases", map[string]any{"alias": "Messire"}, http.StatusNoContent)

	c.mustDo("DELETE", "/characters/"+itoa(keep), nil, http.StatusOK)
	c.mustDo("GET", "/characters/"+itoa(keep), nil, http.StatusNotFound)

	// The cast row survives its character — work_cast.character_id is SET NULL, and
	// the work goes on billing the name in its own column.
	cast := decode[castListResp](t, c.mustDo("GET", "/books/"+itoa(bookA)+"/cast", nil, 200))
	if len(cast.Cast) != 1 || cast.Cast[0].Character != "Woland" {
		t.Fatalf("the cast row went with the record: %+v", cast.Cast)
	}
	if cast.Cast[0].CharacterID != 0 {
		t.Fatalf("the cast row still points at a deleted record: %+v", cast.Cast[0])
	}

	entry, label, children := binEntry(t, c, "character-delete")
	if label != "Woland" {
		t.Fatalf("bin label = %q, want the record's name", label)
	}
	// The alias and the cast row both came off with it, and the row says so.
	if children != 2 {
		t.Fatalf("child_count = %d, want the alias and the appearance", children)
	}

	c.mustDo("POST", "/trash/"+itoa(entry)+"/restore", nil, 200)

	back := decode[charDetailResp](t, c.mustDo("GET", "/characters/"+itoa(keep), nil, 200))
	if !hasString(back.Aliases, "Messire") {
		t.Fatalf("the restored record lost its aliases: %v", back.Aliases)
	}
	// AND THE CAST ROW POINTS AT IT AGAIN, which the bin's generic restore could
	// never do: it re-inserts rows, and this one was never deleted — it was nulled.
	if len(back.Appearances) != 1 {
		t.Fatalf("the restored record is in %d works, want the one it was on", len(back.Appearances))
	}
}

// A PERSON WHO IS STILL CREDITED CANNOT BE DELETED, and the refusal protects an
// invariant rather than the reader's feelings: work_person.person_id is ON DELETE
// CASCADE, so deleting a credited person takes their link rows with them while
// books.author goes on printing the name — exactly the state CreditsAgree calls
// drift, for as long as the entry sits in the bin.
func TestDeletingACreditedPersonIsRefusedAndSaysWhatItWouldCost(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	createTestBook(t, c, "Dune", "Frank Herbert")
	id := personID(t, srv, 1, "Frank Herbert")

	rec := c.mustDo("DELETE", "/people/"+itoa(id), nil, http.StatusConflict)
	if !strings.Contains(rec.Body.String(), "credited") {
		t.Fatalf("the refusal does not say why: %s", rec.Body.String())
	}
	// And the record is still there, with its credit intact.
	got := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(id), nil, 200))
	if len(got.Credits) != 1 {
		t.Fatalf("the refused delete changed the record: %+v", got)
	}
	// The invariant the refusal exists for is still true.
	creditsMustAgree(t, srv, 1)
}

// A performer with lines but no credits IS deletable, because those links are SET
// NULL rather than cascaded — nothing is recomposed, and every id comes back.
func TestDeletingAnUncreditedPerformerIsUndoableAndBringsTheirLinesBack(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Jurassic Park"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Clever girl", "character": "Muldoon", "actor": "Bob Peck",
	}, http.StatusCreated)
	id := personID(t, srv, 1, "Bob Peck")

	c.mustDo("DELETE", "/people/"+itoa(id), nil, http.StatusOK)
	entry, label, _ := binEntry(t, c, "person-delete")
	if label != "Bob Peck" {
		t.Fatalf("bin label = %q", label)
	}
	c.mustDo("POST", "/trash/"+itoa(entry)+"/restore", nil, 200)

	back := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(id), nil, 200))
	if len(back.Lines) != 1 || back.Lines[0].Text != "Clever girl" {
		t.Fatalf("the restored performer holds %d lines: %+v", len(back.Lines), back.Lines)
	}
	creditsMustAgree(t, srv, 1)
}
