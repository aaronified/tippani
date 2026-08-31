package store

import (
	"path/filepath"
	"testing"
)

// Migration 0027 rebuilds `people` on (user_id, name) and moves the role into a
// person_kinds set.
//
// A rebuild that merges rows is LOSSY, which makes it a different animal from
// every other migration here: the others either add a column or re-shape a
// constraint, and a mistake shows up as a failure. This one deletes rows on
// purpose, and a mistake shows up as somebody's bio quietly gone. So the tests
// below pin the survivor RULE and the values that survive, not just the counts —
// counting rows would pass just as happily if the wrong duplicate won.

// openAt26 returns a store at the pre-0027 schema. It stops at 26 rather than
// deleting a schema_version row, because Migrate() resumes from MAX(version) and
// the delete trick silently becomes a no-op the moment a newer migration lands.
func openAt26(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 26)
	return s
}

func mustExecT(t *testing.T, s *Store, q string, args ...any) {
	t.Helper()
	if _, err := s.DB.Exec(q, args...); err != nil {
		t.Fatalf("%s: %v", q, err)
	}
}

// seedPeopleAt26 writes the shapes the merge has to get right, then migrates to
// head. Person ids are explicit so the assertions can name a survivor.
func seedPeopleAt26(t *testing.T, s *Store) {
	t.Helper()
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x'), (2, 'bob', 'x')`)

	ins := `INSERT INTO people (id, user_id, kind, name, bio, image_path, born, created_at)
	        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

	// 1+2: one person, two roles. The ACTOR row carries the portrait, so it must
	// win over the older author row — the rule is "most information", not "oldest".
	mustExecT(t, s, ins, 1, 1, "author", "Neil Gaiman", "wrote things", "", "1960", "2020-01-01 00:00:00")
	mustExecT(t, s, ins, 2, 1, "actor", "Neil Gaiman", "", "gaiman.jpg", "", "2021-01-01 00:00:00")

	// 3: one role only — the ordinary case, which must be left exactly alone.
	mustExecT(t, s, ins, 3, 1, "director", "Kurosawa", "made films", "kurosawa.jpg", "1910", "2022-01-01 00:00:00")

	// 4+5: neither row has a portrait, so the tie falls to the one with a bio.
	mustExecT(t, s, ins, 4, 1, "author", "Austen", "", "", "1775", "2020-01-01 00:00:00")
	mustExecT(t, s, ins, 5, 1, "actor", "Austen", "wrote Emma", "", "", "2021-01-01 00:00:00")

	// 6: another account's person of the SAME name. Merging across accounts would
	// be a cross-account data leak, not just a wrong row.
	mustExecT(t, s, ins, 6, 2, "author", "Neil Gaiman", "bob's copy", "bob.jpg", "", "2020-01-01 00:00:00")

	// 7: a kind the API would never write. A CHECK on person_kinds would reject
	// it and turn Migrate() into a startup failure; there is deliberately none.
	mustExecT(t, s, ins, 7, 1, "narrator", "Someone Odd", "", "", "", "2020-01-01 00:00:00")

	migrateThrough(t, s, 9999)
}

func personKinds(t *testing.T, s *Store, uid int64, name string) []string {
	t.Helper()
	rows, err := s.DB.Query(`SELECT pk.kind FROM person_kinds pk JOIN people p ON p.id = pk.person_id
	                         WHERE p.user_id = ? AND p.name = ? ORDER BY pk.kind`, uid, name)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			t.Fatal(err)
		}
		out = append(out, k)
	}
	return out
}

func TestPeopleMergeKeepsTheRichestRow(t *testing.T) {
	s := openAt26(t)
	seedPeopleAt26(t, s)

	var id int64
	var bio, image, born string
	if err := s.DB.QueryRow(
		`SELECT id, bio, image_path, born FROM people WHERE user_id = 1 AND name = 'Neil Gaiman'`,
	).Scan(&id, &bio, &image, &born); err != nil {
		t.Fatal(err)
	}
	// The portrait decides it, so the newer actor row wins outright — including
	// its empty bio. That is the cost of the rule, and it is the rule on purpose:
	// a merge cannot splice two rows into a third without inventing a person who
	// never existed in the table.
	if id != 2 {
		t.Fatalf("survivor is id %d; the row with the portrait should have won", id)
	}
	if image != "gaiman.jpg" {
		t.Fatalf("the portrait did not survive: %q", image)
	}

	// A tie on portraits falls through to the bio.
	var austenID int64
	var austenBio string
	if err := s.DB.QueryRow(
		`SELECT id, bio FROM people WHERE user_id = 1 AND name = 'Austen'`,
	).Scan(&austenID, &austenBio); err != nil {
		t.Fatal(err)
	}
	if austenID != 5 || austenBio != "wrote Emma" {
		t.Fatalf("with no portrait the bio should decide, got id %d bio %q", austenID, austenBio)
	}
}

func TestPeopleMergeCollectsEveryKind(t *testing.T) {
	s := openAt26(t)
	seedPeopleAt26(t, s)

	if got := personKinds(t, s, 1, "Neil Gaiman"); len(got) != 2 || got[0] != "actor" || got[1] != "author" {
		t.Fatalf("both roles should survive the merge, got %v", got)
	}
	if got := personKinds(t, s, 1, "Kurosawa"); len(got) != 1 || got[0] != "director" {
		t.Fatalf("a single-role person should be left alone, got %v", got)
	}
	// The whole point: a role is no longer part of identity, so one row answers
	// for every role its person plays.
	var n int
	if err := s.DB.QueryRow(`SELECT count(*) FROM people WHERE user_id = 1 AND name = 'Neil Gaiman'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("expected one row per person, got %d", n)
	}
}

// Two accounts each keep their own person of the same name. Merging across the
// user boundary would not be a wrong row, it would be a cross-account leak.
func TestPeopleMergeNeverCrossesAccounts(t *testing.T) {
	s := openAt26(t)
	seedPeopleAt26(t, s)

	var n int
	if err := s.DB.QueryRow(`SELECT count(*) FROM people WHERE name = 'Neil Gaiman'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("expected one Gaiman per account, got %d", n)
	}
	var bio string
	if err := s.DB.QueryRow(
		`SELECT bio FROM people WHERE user_id = 2 AND name = 'Neil Gaiman'`).Scan(&bio); err != nil {
		t.Fatal(err)
	}
	if bio != "bob's copy" {
		t.Fatalf("the other account's row was overwritten: %q", bio)
	}
}

// A kind the API would never write must not stop the app booting. There is no
// CHECK on person_kinds for exactly this reason, and this is the test that
// fails if someone adds one.
func TestPeopleMergeSurvivesAnUnknownKind(t *testing.T) {
	s := openAt26(t)
	seedPeopleAt26(t, s) // migrates to head; a CHECK would have failed it here

	if got := personKinds(t, s, 1, "Someone Odd"); len(got) != 1 || got[0] != "narrator" {
		t.Fatalf("an unrecognised kind should be carried across untouched, got %v", got)
	}
}

// Nothing referenced people(id) before this migration, but person_kinds does
// now — so a deleted person must not leave its roles behind, and a deleted user
// must take both with them.
func TestPersonKindsCascade(t *testing.T) {
	s := openAt26(t)
	seedPeopleAt26(t, s)

	count := func(q string, args ...any) int {
		t.Helper()
		var n int
		if err := s.DB.QueryRow(q, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	if count(`SELECT count(*) FROM person_kinds`) == 0 {
		t.Fatal("nothing to test — the seed produced no kinds")
	}

	mustExecT(t, s, `DELETE FROM people WHERE user_id = 1 AND name = 'Kurosawa'`)
	if n := count(`SELECT count(*) FROM person_kinds pk
	               LEFT JOIN people p ON p.id = pk.person_id WHERE p.id IS NULL`); n != 0 {
		t.Fatalf("%d role rows outlived their person", n)
	}

	mustExecT(t, s, `DELETE FROM users WHERE id = 1`)
	if n := count(`SELECT count(*) FROM people WHERE user_id = 1`); n != 0 {
		t.Fatalf("deleting the account left %d people", n)
	}
	if n := count(`SELECT count(*) FROM person_kinds pk
	               LEFT JOIN people p ON p.id = pk.person_id WHERE p.id IS NULL`); n != 0 {
		t.Fatalf("deleting the account left %d orphaned role rows", n)
	}
	// Bob is untouched.
	if n := count(`SELECT count(*) FROM people WHERE user_id = 2`); n != 1 {
		t.Fatalf("the other account lost people: %d", n)
	}
}

// 0027 made the NAME the identity and refused a second row under it. 0056 undid
// that on purpose, and this asserts the undoing rather than deleting the case:
// identity is the id now, the name is a label on it, and two people who
// genuinely share a name are a library fact rather than a corruption.
//
// The 0027 behaviour is still asserted, one migration earlier, by the merge
// tests above — which is where it belongs, because it was true then.
func TestTwoPeopleMayShareAName(t *testing.T) {
	s := openAt26(t)
	seedPeopleAt26(t, s)
	migrateThrough(t, s, 9999)

	if _, err := s.DB.Exec(
		`INSERT INTO people (user_id, name) VALUES (1, 'Kurosawa')`); err != nil {
		t.Fatalf("a second Kurosawa was refused; 0056 did not drop the unique: %v", err)
	}
	// Two rows, two ids, one spelling — and the credit that prints it points at
	// one of them rather than at the string.
	var n int
	if err := s.DB.QueryRow(
		`SELECT count(*) FROM people WHERE user_id = 1 AND name = 'Kurosawa'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("expected two people named Kurosawa, got %d", n)
	}
	// The other account is untouched, as it was before.
	if _, err := s.DB.Exec(
		`INSERT INTO people (user_id, name) VALUES (2, 'Kurosawa')`); err != nil {
		t.Fatalf("the other account could not keep its own Kurosawa: %v", err)
	}
}

// An empty people table must migrate cleanly — the window function, the join
// and the DISTINCT all have to cope with nothing at all.
func TestPeopleMergeOnAnEmptyTable(t *testing.T) {
	s := openAt26(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	migrateThrough(t, s, 9999)

	var n int
	if err := s.DB.QueryRow(`SELECT count(*) FROM person_kinds`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("an empty people table produced %d role rows", n)
	}
	// And the parked copy is gone, not left behind as debris.
	var name string
	err := s.DB.QueryRow(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_people_backup'`).Scan(&name)
	if err == nil {
		t.Fatal("the migration left its parked backup table behind")
	}
}
