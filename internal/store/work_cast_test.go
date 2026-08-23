package store

import (
	"path/filepath"
	"testing"
)

// 0048 turns `movies.cast_json` — a blob a metadata fetch wrote whole, that no
// screen could edit and that is empty for nearly every game — into a table the
// reader owns. Two things have to hold on an upgrade and neither is visible from
// a from-scratch migration test: every cast already on disk comes across in the
// order the provider billed it, and the blob it came from is still there
// afterwards, because dropping a column is the one step nobody can walk back.

// openAt47 returns a store at the pre-0048 schema with one user, one book and
// three `movies` rows: a film with a cast, a show with a repeated character and
// a blank one, and a game with the empty cast a failed Wikidata lookup leaves.
func openAt47(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 47)

	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed %q: %v", q, err)
		}
	}
	exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'alice', 'x', 1)`)
	exec(`INSERT INTO books (id, user_id, title, author) VALUES (1, 1, 'Moby-Dick', 'Herman Melville')`)
	exec(`INSERT INTO movies (id, user_id, title, media_type, tmdb_id, cast_json)
	      VALUES (1, 1, 'The Matrix', 'movie', 603, ?)`,
		`[{"character":"Neo","actor":"Keanu Reeves","person_id":"6384","image_url":"https://img/x.jpg"},`+
			`{"character":"Trinity","actor":"Carrie-Anne Moss"}]`)
	// A provider genuinely returns both hazards: an entry with no character at
	// all (TMDB does this when a person's Roles array is empty), and the same
	// character billed twice with two actors (a recast between seasons).
	exec(`INSERT INTO movies (id, user_id, title, media_type, tvdb_id, cast_json)
	      VALUES (2, 1, 'Doctor Who', 'show', 76107, ?)`,
		`[{"character":"The Doctor","actor":"Jodie Whittaker"},`+
			`{"character":"","actor":"Uncredited Extra"},`+
			`{"character":"The Doctor","actor":"Peter Capaldi"},`+
			`{"character":"The Doctor","actor":"Jodie Whittaker"}]`)
	exec(`INSERT INTO movies (id, user_id, title, media_type, igdb_id, cast_json)
	      VALUES (3, 1, 'Disco Elysium', 'game', 1234, '[]')`)
	return s
}

func TestTheCastBackfillCarriesEveryBilledRowAndItsOrder(t *testing.T) {
	s := openAt47(t)
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}

	type row struct {
		character, actor, personID, imageURL, origin, source, providerKey string
		billing                                                           int
	}
	var got []row
	rows, err := s.DB.Query(
		`SELECT character, actor, person_id, image_url, origin, source, provider_key, billing
		   FROM work_cast WHERE kind = 'movie' AND work_id = 1 ORDER BY billing`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.character, &r.actor, &r.personID, &r.imageURL,
			&r.origin, &r.source, &r.providerKey, &r.billing); err != nil {
			t.Fatal(err)
		}
		got = append(got, r)
	}
	rows.Close()

	want := []row{
		{character: "Neo", actor: "Keanu Reeves", personID: "6384", imageURL: "https://img/x.jpg",
			origin: "provider", source: "tmdb", providerKey: "Neo\x1fKeanu Reeves", billing: 0},
		{character: "Trinity", actor: "Carrie-Anne Moss",
			origin: "provider", source: "tmdb", providerKey: "Trinity\x1fCarrie-Anne Moss", billing: 1},
	}
	if len(got) != len(want) {
		t.Fatalf("backfilled %d rows, want %d: %+v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("row %d:\n got %+v\nwant %+v", i, got[i], want[i])
		}
	}

	// The billing IS the array index, which is the whole reason json_each's key
	// is used rather than a counter: the provider's order survives an upgrade
	// even though nothing ever recorded it.
	var lead string
	if err := s.DB.QueryRow(
		`SELECT character FROM work_cast WHERE kind = 'movie' AND work_id = 1
		  ORDER BY billing LIMIT 1`).Scan(&lead); err != nil {
		t.Fatal(err)
	}
	if lead != "Neo" {
		t.Fatalf("the lead billing went to %q", lead)
	}

	// AND THE BLOB IS STILL THERE, BYTE FOR BYTE. 0036 kept a superseded column
	// for exactly one release and 0037's backfill is what it was kept for; this
	// follows that precedent, and if this assertion ever goes red the walk-back
	// is gone with it.
	var blob string
	if err := s.DB.QueryRow(`SELECT cast_json FROM movies WHERE id = 1`).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if blob != `[{"character":"Neo","actor":"Keanu Reeves","person_id":"6384","image_url":"https://img/x.jpg"},`+
		`{"character":"Trinity","actor":"Carrie-Anne Moss"}]` {
		t.Fatalf("cast_json was modified by the migration: %s", blob)
	}

	// A game whose Wikidata lookup found nothing starts empty, and a book starts
	// empty because no book has ever had a cast column. Both are the correct
	// outcome rather than a loss — and both are exactly the rows the reader can
	// now type for themselves.
	for _, tc := range []struct {
		kind string
		id   int64
		what string
	}{{"movie", 3, "a game with no voice credits"}, {"book", 1, "a book"}} {
		var n int
		if err := s.DB.QueryRow(
			`SELECT COUNT(*) FROM work_cast WHERE kind = ? AND work_id = ?`, tc.kind, tc.id).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 0 {
			t.Fatalf("%s was seeded %d cast rows", tc.what, n)
		}
	}
}

// The two shapes a real provider list contains that "one row per character"
// does not survive: an entry with no character, and one character billed twice.
// A migration that assumed either away would fail the UNIQUE inside its own
// transaction, which is an application that will not boot.
func TestABlankCharacterAndARepeatedCharacterBothSurviveTheBackfill(t *testing.T) {
	s := openAt47(t)
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}

	var pairs []string
	rows, err := s.DB.Query(
		`SELECT character || '/' || actor FROM work_cast
		  WHERE kind = 'movie' AND work_id = 2 ORDER BY billing`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			t.Fatal(err)
		}
		pairs = append(pairs, p)
	}
	rows.Close()

	// The blank character is STORED (the provider may seed one; the API refuses
	// to let a reader type one), the recast is a second row of its own, and the
	// exact duplicate is dropped by INSERT OR IGNORE rather than raising a
	// UNIQUE violation inside the migration.
	want := []string{"The Doctor/Jodie Whittaker", "/Uncredited Extra", "The Doctor/Peter Capaldi"}
	if len(pairs) != len(want) {
		t.Fatalf("got %d rows %v, want %d %v", len(pairs), pairs, len(want), want)
	}
	for i := range want {
		if pairs[i] != want[i] {
			t.Fatalf("row %d: got %q want %q", i, pairs[i], want[i])
		}
	}
}

// The two triggers stand in for the ON DELETE CASCADE SQLite cannot express
// across a polymorphic (kind, work_id) pointer — 0024's arrangement, copied. A
// cast left behind by a deleted work would be adopted by whatever row SQLite
// next gave that id to.
func TestDeletingAWorkTakesItsCastWithIt(t *testing.T) {
	s := openAt47(t)
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}
	if _, err := s.DB.Exec(
		`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, origin)
		 VALUES (1, 'book', 1, 'Ishmael', 'ishmael', 'reader')`); err != nil {
		t.Fatal(err)
	}
	// A tombstone goes too: it is a fact about one work's cast and means nothing
	// once the work is gone.
	if _, err := s.DB.Exec(
		`UPDATE work_cast SET origin = 'removed' WHERE kind = 'movie' AND work_id = 1 AND character = 'Trinity'`,
	); err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct{ table, kind string }{{"books", "book"}, {"movies", "movie"}} {
		if _, err := s.DB.Exec(`DELETE FROM `+tc.table+` WHERE id = 1`); err != nil {
			t.Fatal(err)
		}
		var n int
		if err := s.DB.QueryRow(
			`SELECT COUNT(*) FROM work_cast WHERE kind = ? AND work_id = 1`, tc.kind).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 0 {
			t.Fatalf("deleting the %s left %d cast rows behind", tc.kind, n)
		}
	}
}

// The migration can only fold with SQLite's lower(), which knows ASCII and
// nothing else, so BackfillCastKeys re-folds from Migrate's tail — the same
// arrangement BackfillDialogueHashes has lived under for want of a SQL sha256.
// Without the Go pass a reader who types "Éowyn" on a quote gets no actor,
// because the stored key still reads "Éowyn" and the computed one reads "éowyn".
func TestTheCastKeysAreFoldedWithUnicodeAndNotAscii(t *testing.T) {
	s := openAt47(t)
	// Seeded through the BACKFILL rather than by hand, so what is under test is
	// the key the migration itself is able to write.
	if _, err := s.DB.Exec(`UPDATE movies SET cast_json = ? WHERE id = 1`,
		`[{"character":"Éowyn","actor":"Miranda OTTO"}]`); err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}

	var charKey, actorKey, providerKey string
	if err := s.DB.QueryRow(
		`SELECT character_key, actor_key, provider_key FROM work_cast
		  WHERE kind = 'movie' AND work_id = 1`).Scan(&charKey, &actorKey, &providerKey); err != nil {
		t.Fatal(err)
	}
	if charKey != "éowyn" {
		t.Fatalf("character_key is %q — SQLite's lower() left the É alone and nothing re-folded it", charKey)
	}
	if actorKey != "miranda otto" {
		t.Fatalf("actor_key is %q", actorKey)
	}
	// provider_key is NOT folded, and that is the point of it: it matches one
	// entry in a provider's list to the row that entry seeded, and it has to be
	// computable identically in SQL and in Go.
	if providerKey != "Éowyn\x1fMiranda OTTO" {
		t.Fatalf("provider_key was folded: %q", providerKey)
	}
	if got := CastKey("  Éowyn "); got != charKey {
		t.Fatalf("CastKey(%q) = %q, which is not the stored key %q", "  Éowyn ", got, charKey)
	}
	if got := ProviderKey(" Éowyn ", "Miranda OTTO "); got != providerKey {
		t.Fatalf("ProviderKey = %q, stored %q", got, providerKey)
	}

	// Re-running is a no-op rather than an error: it is unguarded and runs on
	// every boot, which is what makes it self-healing.
	if err := s.Migrate(); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
}

// Two names that differ only outside ASCII collide the moment they are folded,
// and this repair runs from Migrate — so a returned error would mean the
// application does not start. The row keeps the key it had and the boot survives.
func TestACollidingRefoldIsSkippedRatherThanRefusingToBoot(t *testing.T) {
	s := openAt47(t)
	if _, err := s.DB.Exec(`UPDATE movies SET cast_json = ? WHERE id = 1`,
		`[{"character":"Éowyn","actor":"Miranda Otto"},{"character":"éowyn","actor":"Miranda Otto"}]`); err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(); err != nil {
		t.Fatalf("a pair of near-identical cast rows must not stop the app starting: %v", err)
	}
	var n int
	if err := s.DB.QueryRow(
		`SELECT COUNT(*) FROM work_cast WHERE kind = 'movie' AND work_id = 1`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("both rows should still be there, got %d", n)
	}
}

// The pair unique is PARTIAL — `WHERE origin <> 'removed'` — and the predicate is
// what lets a tombstone keep the character and the actor a refetch has to
// recognise. Without it, deleting a provider's row and typing it back by hand
// would be refused by a row the reader cannot see.
func TestTheCastUniquesHold(t *testing.T) {
	s := openAt47(t)
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}
	add := func(character, actor, providerKey, origin string) error {
		_, err := s.DB.Exec(
			`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key,
			                        provider_key, origin)
			 VALUES (1, 'movie', 1, ?, ?, ?, ?, ?, ?)`,
			character, CastKey(character), actor, CastKey(actor), providerKey, origin)
		return err
	}
	// The same live pair twice is refused.
	if err := add("Neo", "Keanu Reeves", "", "reader"); err == nil {
		t.Fatal("a second live row for Neo/Keanu Reeves was accepted")
	}
	// The same provider entry twice is refused even under a different spelling,
	// because provider_key is what a refetch matches on.
	if err := add("Neo", "Somebody Else", "Neo\x1fKeanu Reeves", "provider"); err == nil {
		t.Fatal("a second row claiming the same provider entry was accepted")
	}
	// Any number of reader rows may carry no provider key at all.
	if err := add("The Oracle", "Gloria Foster", "", "reader"); err != nil {
		t.Fatalf("a second reader-authored row was refused: %v", err)
	}
	// And a tombstone does not stand in the way of the pair being typed back.
	if _, err := s.DB.Exec(
		`UPDATE work_cast SET origin = 'removed' WHERE character = 'Trinity'`); err != nil {
		t.Fatal(err)
	}
	if err := add("Trinity", "Carrie-Anne Moss", "", "reader"); err != nil {
		t.Fatalf("a tombstone blocked the reader typing the pair back: %v", err)
	}
}

// A REPAIR'S COPIED ROWS ARE RE-FOLDED ONE BOOT LATE, NOT DURING THE REPAIR.
//
// BackfillCastKeys is unguarded and re-runs on every Migrate, and that was read as
// meaning it "survives the repair paths that copy base tables into a fresh
// database". It does not run over the copied rows at all: Recover() calls
// Migrate() on the EMPTY temp database and only then runs
// `INSERT INTO main SELECT * FROM old`, so the pass sees nothing and every key
// lands exactly as the old file held it.
//
// Eventually true, immediately not — and the window is real, because a row whose
// key disagrees with CastKey is invisible to its own lookups, so the quote form's
// autofill misses it until the app is next started. This test is here so the
// corrected comment cannot quietly become the old claim again.
func TestARepairLeavesAStaleCastKeyForTheNextBootToFold(t *testing.T) {
	s := openAt47(t)
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}
	// A key as an upgraded file can genuinely hold one: written by SQLite's
	// lower(), which has no Unicode tables, so it disagrees with CastKey.
	if _, err := s.DB.Exec(
		`UPDATE work_cast SET character = 'Éowyn', character_key = 'Éowyn'
		 WHERE kind = 'movie' AND work_id = 1 AND character = 'Neo'`); err != nil {
		t.Fatal(err)
	}
	keyNow := func() string {
		t.Helper()
		var k string
		if err := s.DB.QueryRow(
			`SELECT character_key FROM work_cast WHERE kind = 'movie' AND work_id = 1 AND character = 'Éowyn'`).
			Scan(&k); err != nil {
			t.Fatal(err)
		}
		return k
	}
	if keyNow() != "Éowyn" {
		t.Fatalf("fixture: the stale key did not stick: %q", keyNow())
	}

	if err := s.Recover(); err != nil {
		t.Fatalf("recover: %v", err)
	}
	if got := keyNow(); got != "Éowyn" {
		t.Fatalf("character_key = %q after a repair — if the copy IS re-folded in place "+
			"then BackfillCastKeys' comment can go back to claiming it, and this test "+
			"should be deleted rather than loosened", got)
	}

	// The next boot is what heals it, which is the half of the claim that is true.
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate after recover: %v", err)
	}
	if got := keyNow(); got != CastKey("Éowyn") {
		t.Fatalf("character_key = %q after the next boot's Migrate, want %q — the re-fold "+
			"is unguarded precisely so this happens", got, CastKey("Éowyn"))
	}
}
