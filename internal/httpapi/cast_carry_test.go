package httpapi

import (
	"net/http"
	"testing"
)

// A MERGE MUST NOT DESTROY THE READER'S CAST (0048).
//
// Both merges re-point the quotes and then hard-delete the source rows, and
// 0048's AFTER DELETE triggers reap the cast of anything deleted. So before
// carryWorkCast, merging a duplicate took every voice actor the reader had typed
// on it, every name they had corrected and every deletion they had recorded — no
// carry-over to the survivor, and no bin snapshot to recover from, because a
// merge takes none. It is the feature's one rule broken by a different verb.
//
// Every test in this file failed with an empty or wrong survivor list before that
// function existed.

// castRowsOnWork counts the rows of one work's mapping by origin, tombstones
// included — which is the half `GET /cast` cannot show and the half a merge was
// quietly emptying.
func castRowsOnWork(t *testing.T, srv *Server, kind string, workID int64) map[string]int {
	t.Helper()
	rows, err := srv.Store.DB.Query(
		`SELECT origin, COUNT(*) FROM work_cast WHERE kind = ? AND work_id = ? GROUP BY origin`,
		kind, workID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var origin string
		var n int
		if err := rows.Scan(&origin, &n); err != nil {
			t.Fatal(err)
		}
		out[origin] = n
	}
	return out
}

// allCastRows counts every work_cast row in the database, which is how "the
// trigger ate them" is told apart from "they went to the wrong work".
func allCastRows(t *testing.T, srv *Server) int {
	t.Helper()
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM work_cast`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// THE SKEPTIC'S PROBE, as a test. Two games, a voice actor typed on the one that
// is about to be merged away, and the survivor left holding nothing at all: no
// cast, no rows anywhere in the database, no tombstone, and a fresh quote naming
// that character autofilling an empty actor.
func TestMergingGamesCarriesTheTypedVoiceCast(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	keep := createGame(t, c, "Portal 2", "Valve")
	dupe := createGame(t, c, "Portal II", "Valve")

	// The case the whole feature exists for: a game whose Wikidata lookup found
	// nothing, so this row exists nowhere else in the schema.
	c.mustDo("POST", "/movies/"+itoa(dupe)+"/cast", map[string]any{
		"character": "GLaDOS", "actor": "Ellen McLain",
	}, http.StatusCreated)
	// And a deletion the reader made on purpose, which has to travel too.
	tomb := seedProviderCast(t, srv, 1, "movie", dupe, [2]string{"Cave Johnson", "J.K. Simmons"})
	c.mustDo("DELETE", "/cast/"+itoa(tomb[0]), nil, http.StatusNoContent)

	c.mustDo("POST", "/movies/merge", map[string]any{"into": keep, "from": []int64{dupe}}, http.StatusOK)

	list := castOf(t, c, "/movies/"+itoa(keep)+"/cast")
	if len(list.Cast) != 1 {
		t.Fatalf("the survivor should hold the typed credit: %+v", list.Cast)
	}
	if list.Cast[0].Character != "GLaDOS" || list.Cast[0].Actor != "Ellen McLain" {
		t.Fatalf("wrong row carried across: %+v", list.Cast[0])
	}
	if list.Cast[0].Origin != "reader" {
		t.Fatalf("origin = %q — a carried row keeps the provenance it was given, or a "+
			"refetch may overwrite a name nobody else wrote", list.Cast[0].Origin)
	}
	if got := castRowsOnWork(t, srv, "movie", keep); got["removed"] != 1 {
		t.Fatalf("the tombstone did not travel: %v — the survivor's next refetch would "+
			"hand back a credit the reader deleted on purpose", got)
	}
	if n := allCastRows(t, srv); n != 2 {
		t.Fatalf("%d cast rows in the whole database, want 2 — a merge must move them, not reap them", n)
	}

	// The end of the chain, and the reason any of this matters on a game: a new
	// line naming that character has to find its voice actor.
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": keep, "quote": "The cake is a lie.", "character": "GLaDOS",
	}, http.StatusCreated))
	if d.Actor != "Ellen McLain" {
		t.Fatalf("actor = %q — the autofill reads the mapping, and the merge had emptied it", d.Actor)
	}
}

// WHEN BOTH WORKS NAME THE SAME CHARACTER the survivor's row stays — the pair
// unique allows exactly one — but the PROVENANCE is merged into it, because a
// row the reader corrected on the copy they merged away is still a row they
// corrected. Leaving the survivor's row at 'provider' would let the next refetch
// rewrite a name they had already fixed.
func TestMergingCarriesTheProtectionOntoTheSurvivorsOwnRow(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	keep := createFilm(t, c, "Alien", "Ridley Scott")
	dupe := createFilm(t, c, "Alien (1979)", "Ridley Scott")

	// The same credit on both, untouched on the survivor and corrected on the
	// duplicate — which is what happens when somebody fixes a name on the copy
	// they later decide is the duplicate.
	seedProviderCast(t, srv, 1, "movie", keep, [2]string{"Ripley", "Sigourney Weaver"})
	dupeRows := seedProviderCast(t, srv, 1, "movie", dupe, [2]string{"ripley", "sigourney weaver"})
	c.mustDo("PUT", "/cast/"+itoa(dupeRows[0]), map[string]any{
		"character": "Ripley", "actor": "Sigourney Weaver",
	}, http.StatusOK)

	c.mustDo("POST", "/movies/merge", map[string]any{"into": keep, "from": []int64{dupe}}, http.StatusOK)

	list := castOf(t, c, "/movies/"+itoa(keep)+"/cast")
	if len(list.Cast) != 1 {
		t.Fatalf("one credit, one row — the pair unique allows no more: %+v", list.Cast)
	}
	if list.Cast[0].Origin != "corrected" {
		t.Fatalf("origin = %q, want \"corrected\" — the survivor's row absorbed a "+
			"reader-authored one and must not be a refetch's to rewrite", list.Cast[0].Origin)
	}
	if n := allCastRows(t, srv); n != 1 {
		t.Fatalf("%d rows, want 1 — the source's copy is dropped, not stacked beside it", n)
	}
}

// A LIVE ROW BEATS A TOMBSTONE, whichever side holds it. The reader kept this
// credit on the duplicate and had removed it from the survivor; a merge is
// additive everywhere else, so the row they can see wins and the tombstone goes.
func TestMergingLetsALiveRowBeatTheSurvivorsTombstone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	keep := createFilm(t, c, "Heat", "Michael Mann")
	dupe := createFilm(t, c, "Heat (1995)", "Michael Mann")

	gone := seedProviderCast(t, srv, 1, "movie", keep, [2]string{"Neil McCauley", "Robert De Niro"})
	c.mustDo("DELETE", "/cast/"+itoa(gone[0]), nil, http.StatusNoContent)
	c.mustDo("POST", "/movies/"+itoa(dupe)+"/cast", map[string]any{
		"character": "Neil McCauley", "actor": "Robert De Niro",
	}, http.StatusCreated)

	c.mustDo("POST", "/movies/merge", map[string]any{"into": keep, "from": []int64{dupe}}, http.StatusOK)

	list := castOf(t, c, "/movies/"+itoa(keep)+"/cast")
	if len(list.Cast) != 1 || list.Cast[0].Character != "Neil McCauley" {
		t.Fatalf("the live row should have come across: %+v", list.Cast)
	}
	if got := castRowsOnWork(t, srv, "movie", keep); got["removed"] != 0 {
		t.Fatalf("the survivor's tombstone should be gone: %v — a tombstone exists to stop a "+
			"refetch resurrecting a row, and the row is here now", got)
	}
}

// A BOOK'S LIST HAS THE IDENTICAL HOLE, and it is worse there: nothing seeds a
// book's characters, so every row a merge dropped was one somebody typed.
func TestMergingBooksCarriesTheCharacters(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	keep := createTestBook(t, c, "Moby-Dick", "Herman Melville")
	dupe := createTestBook(t, c, "Moby Dick; or, The Whale", "Herman Melville")
	c.mustDo("POST", "/books/"+itoa(dupe)+"/cast", map[string]any{"character": "Queequeg"},
		http.StatusCreated)

	c.mustDo("POST", "/books/merge", map[string]any{"into": keep, "from": []int64{dupe}}, http.StatusOK)

	list := castOf(t, c, "/books/"+itoa(keep)+"/cast")
	if len(list.Cast) != 1 || list.Cast[0].Character != "Queequeg" {
		t.Fatalf("the survivor should hold the typed character: %+v", list.Cast)
	}
	if n := allCastRows(t, srv); n != 1 {
		t.Fatalf("%d rows, want 1 — the book trigger reaped it", n)
	}
}

// THE CANONICAL DUPLICATE, END TO END: two copies of one film seeded from the
// SAME provider entry — so the same provider_key — and the reader has deleted the
// credit on the copy they keep.
//
// That tombstone is the only record of the deletion, and it lands in carryWorkCast's
// `tombs` map and never in its `live` map. So the source's live row misses on the
// pair lookup, falls through to the provider-key branch, and is dropped there
// because the survivor already claims that key. Delete the tombstone before
// reaching that branch and the pair is left holding NOTHING: not the live row one
// documented branch promises, not the tombstone the other does. The credit then
// comes back on the next refetch, which is strictly worse than having no carry at
// all — the merge used not to touch the survivor's cast, so its tombstone survived.
//
// The refetch at the end is the point. A tombstone that is merely still in the
// table proves nothing; what the rule promises is that a refetch cannot resurrect
// what the reader deleted, and only a second fetch can say whether it holds.
func TestMergingKeepsTheSurvivorsTombstoneForADuplicatesProviderEntry(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	keep := addFromTMDB(t, c)
	dupe := createFilm(t, c, "Portal 2 (2011)", "Erik Wolpaw")
	// The duplicate carries the same credit from the same provider entry, which is
	// what a second copy of one film IS — seedProviderCast computes the identical
	// provider_key the seed above wrote.
	seedProviderCast(t, srv, 1, "movie", dupe, [2]string{"GLaDOS", "Ellen McLain"})

	// And the reader deletes it on the copy they are keeping. A deletion is a
	// tombstone precisely so a refetch cannot undo it.
	gone := castRowFor(t, c, keep.ID, "GLaDOS")
	c.mustDo("DELETE", "/cast/"+itoa(gone.ID), nil, http.StatusNoContent)

	c.mustDo("POST", "/movies/merge", map[string]any{"into": keep.ID, "from": []int64{dupe}}, http.StatusOK)

	if list := castOf(t, c, "/movies/"+itoa(keep.ID)+"/cast"); len(list.Cast) != 0 {
		t.Fatalf("the merge handed back a credit the reader deleted: %+v", list.Cast)
	}
	if got := castRowsOnWork(t, srv, "movie", keep.ID); got["removed"] != 1 {
		t.Fatalf("origins on the survivor = %v, want one tombstone — the deletion is the "+
			"only thing standing between the reader and a refetch that resurrects it", got)
	}
	if n := allCastRows(t, srv); n != 1 {
		t.Fatalf("%d cast rows in the whole database, want 1 (the tombstone) — the survivor's "+
			"own row must not be deleted for a source row that is then dropped", n)
	}

	// THE REFETCH. The provider still lists the credit, and the tombstone's
	// provider_key is what makes mergeProviderCast decline to bring it back.
	resyncFromTMDB(t, c, keep.ID)

	if list := castOf(t, c, "/movies/"+itoa(keep.ID)+"/cast"); len(list.Cast) != 0 {
		t.Fatalf("a refetch after the merge resurrected the deleted credit: %+v — the merge "+
			"had spent the tombstone that exists to stop exactly this", list.Cast)
	}
	if got := castRowsOnWork(t, srv, "movie", keep.ID); got["removed"] != 1 || got["provider"] != 0 {
		t.Fatalf("origins on the survivor after the refetch = %v, want one tombstone and nothing live", got)
	}
}
