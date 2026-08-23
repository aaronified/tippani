package httpapi

import (
	"testing"

	"tippani/internal/store"
)

// provider_key IS FROZEN AT SEED (0048), and these two tests are the whole of
// its enforcement.
//
// The key's one job is to match an entry in a provider's list to the row that
// entry seeded last time, which makes it the merge's identity anchor: the
// retraction pass and carryWorkCast both read a row's provenance through it. An
// anchor that moves is not one, and adoptCastRow used to move it — it rewrote the
// key onto whatever the fetched entry had computed, whenever the provider changed
// its own casing.
//
// Both tests below drive the SAME pair through the SAME provider twice, which is
// the only way to see a key that flips: one refetch looks like a correction, two
// show it swapping back.

// castProviderKeys reads a work's provider keys in billing order — the column
// nothing on the wire reports, because no client has any business knowing it.
func castProviderKeys(t *testing.T, srv *Server, movieID int64) []string {
	t.Helper()
	rows, err := srv.Store.DB.Query(
		`SELECT provider_key FROM work_cast WHERE kind = 'movie' AND work_id = ?
		 ORDER BY billing, id`, movieID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			t.Fatal(err)
		}
		out = append(out, k)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}

// A PROVIDER THAT BILLS ONE PERSON TWICE, in two casings, is exactly the double
// billing 0048's backfill has an INSERT OR IGNORE for — and the merge has to
// reach the same answer the backfill does: the first entry gets the row and the
// second is dropped.
//
// It could not, because one row is reachable by TWO fetched entries: entry one by
// its provider key, entry two by its folded pair through adoptCastRow. So entry
// two arrived at a row the loop had already written, re-keyed it, and — because a
// freshly INSERTED row was never marked as seen — rewrote its names and its
// billing too. The row ended up recording whichever spelling the provider
// happened to list second, and then swapped back and forth on every refetch as
// the two entries took turns matching by key.
func TestADoubleBilledProviderEntryDoesNotFlipTheRowsKey(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"Neo","name":"Keanu Reeves"},
	                          {"id":6384,"character":"neo","name":"keanu reeves"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	want := store.ProviderKey("Neo", "Keanu Reeves")

	// Three passes: the seed and two refetches. Nothing about the row may move on
	// any of them, and a key that flips needs the second refetch to be visible.
	for pass, label := range []string{"the seed", "the first refetch", "the second refetch"} {
		if pass > 0 {
			resyncFromTMDB(t, c, m.ID)
		}
		list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
		if len(list.Cast) != 1 {
			t.Fatalf("%s: the pair unique allows one row, got %+v", label, list.Cast)
		}
		if list.Cast[0].Character != "Neo" || list.Cast[0].Actor != "Keanu Reeves" {
			t.Fatalf("%s: the entry that seeded the row must keep it, got %q / %q",
				label, list.Cast[0].Character, list.Cast[0].Actor)
		}
		if list.Cast[0].Billing != 0 {
			t.Fatalf("%s: billing = %d — the second entry took the row over",
				label, list.Cast[0].Billing)
		}
		if keys := castProviderKeys(t, srv, m.ID); len(keys) != 1 || keys[0] != want {
			t.Fatalf("%s: provider keys = %q, want [%q] — the merge's identity anchor moved",
				label, keys, want)
		}
	}
}

// A SUPPLIER RE-CASING ITS OWN NAME is the case the re-key was written for, and
// the case that proves it wrong. The folded pair does not move, so the row is
// found either way; only the key the fetched entry computes has changed.
//
// The row takes the new spelling, because it is an untouched provider row and the
// provider is its only author. Its KEY does not, because the key records which
// entry seeded it, and the next fetch finds it by folded pair regardless — one
// extra indexed lookup, in exchange for a column that means the same thing on
// every boot.
func TestAProviderRecasingANameDoesNotRekeyTheRowItSeeded(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"Neo","name":"Keanu Reeves"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	seeded := store.ProviderKey("Neo", "Keanu Reeves")
	if keys := castProviderKeys(t, srv, m.ID); len(keys) != 1 || keys[0] != seeded {
		t.Fatalf("the seed should key the row by the entry that made it: %q", keys)
	}

	// Same person, same folded pair, a different key.
	stub.cast = `[{"id":6384,"character":"NEO","name":"KEANU REEVES","profile_path":"/k.jpg"}]`
	for _, label := range []string{"the first refetch", "the second refetch"} {
		resyncFromTMDB(t, c, m.ID)
		row := castRowFor(t, c, m.ID, "NEO")
		if row.Actor != "KEANU REEVES" {
			t.Fatalf("%s: an untouched provider row takes the provider's spelling: %+v", label, row)
		}
		if row.ImageURL == "" {
			t.Fatalf("%s: and its facts: %+v", label, row)
		}
		if keys := castProviderKeys(t, srv, m.ID); len(keys) != 1 || keys[0] != seeded {
			t.Fatalf("%s: provider keys = %q, want [%q] — the key is frozen at seed",
				label, keys, seeded)
		}
	}
}
