package store

import (
	"testing"
)

// A PERFORMER PRINTED ON A CAST LIST HAS A PAGE, AND THAT PAGE HAS THE WORK ON IT.
//
// THE SPECIFICATION. `work_cast.actor` is the name a row prints; `actor_id` is
// who it means. The face beside the name is a button onto that person's own
// screen, and the screen lists their work by reading this column back the other
// way (PersonRoles). So a row holding the name and not the id is two failures at
// once with no symptom between them: the button opens nothing, and the person's
// page says they are in no films while a film's cast list prints their name.
//
// WHY THIS CASE EXISTS AT ALL. Every live writer of the table links its row.
// 3.1.0-person-identity linked every row a library HELD when it ran. Neither
// covers the rows written in between, by a build that had learned the schema and
// not yet the link — which is a real window, because the provider merge was the
// last writer to learn it. The owner's library came out of that window with 41
// such rows.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraph above, and that the assertion
// is the READER'S question — "is this film on this performer's page" — rather
// than "is the column non-null". The column is the mechanism; the page is the
// promise.

func TestAPerformerNamedOnACastRowHasTheirWorkOnTheirPage(t *testing.T) {
	s := upgradeFrom48(t, `INSERT INTO movies (id, user_id, title, media_type) VALUES (7, 1, 'Anand', 'movie')`)

	// THE ROW AS THE OLD BUILD WROTE IT: the performer's name, and nobody behind
	// it. Written after the upgrade so that no earlier pass can have seen it,
	// which is the whole of the case.
	if _, err := s.DB.Exec(`
		INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key, billing, origin)
		VALUES (1, 'movie', 7, 'Isabhai Suratwala', 'isabhai suratwala', 'Johnny Walker', 'johnny walker', 0, 'provider')`,
	); err != nil {
		t.Fatal(err)
	}
	// And a row the reader has deliberately taken off the list, which must not
	// gain a record: nobody can open a row nobody can see.
	if _, err := s.DB.Exec(`
		INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key, billing, origin)
		VALUES (1, 'movie', 7, 'As Himself', 'as himself', 'Dara Singh', 'dara singh', 1, 'removed')`,
	); err != nil {
		t.Fatal(err)
	}

	rerunPass(t, s, "3.1.0-cast-performers")

	var personID int64
	if err := s.DB.QueryRow(`SELECT id FROM people WHERE user_id = 1 AND name = 'Johnny Walker'`).
		Scan(&personID); err != nil {
		t.Fatalf("the performer the cast list prints has no record at all: %v", err)
	}
	roles, err := PersonRoles(s.DB, 1, personID)
	if err != nil {
		t.Fatal(err)
	}
	if len(roles) != 1 {
		t.Fatalf("Johnny Walker's page lists %d works, while the film's cast list prints his name", len(roles))
	}
	if roles[0].WorkTitle != "Anand" || roles[0].Character != "Isabhai Suratwala" {
		t.Errorf("his one work reads %q as %q", roles[0].WorkTitle, roles[0].Character)
	}

	var n int
	if err := s.DB.QueryRow(
		`SELECT COUNT(*) FROM people WHERE user_id = 1 AND name = 'Dara Singh'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Error("a row the reader deleted was given a person record — there is nothing on any screen to open it from")
	}
}

// AND A ROW ALREADY POINTING SOMEWHERE IS NOT DRAGGED BACK BY THE NAME ON IT. A
// reader who re-pointed a credit at a different record did so deliberately —
// two performers share a name far more often than a library has rows to spare —
// and a pass that re-resolved from the printed name would undo that silently,
// on a start nobody was watching.
func TestAReassignedPerformerIsLeftWhereTheReaderPutThem(t *testing.T) {
	s := upgradeFrom48(t, `INSERT INTO movies (id, user_id, title, media_type) VALUES (7, 1, 'Anand', 'movie')`)

	res, err := s.DB.Exec(`INSERT INTO people (user_id, name) VALUES (1, 'Johnny Walker the younger')`)
	if err != nil {
		t.Fatal(err)
	}
	theirs, _ := res.LastInsertId()
	if _, err := s.DB.Exec(`
		INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key, billing, origin, actor_id)
		VALUES (1, 'movie', 7, 'Isabhai Suratwala', 'isabhai suratwala', 'Johnny Walker', 'johnny walker', 0, 'provider', ?)`,
		theirs); err != nil {
		t.Fatal(err)
	}

	rerunPass(t, s, "3.1.0-cast-performers")

	var got int64
	if err := s.DB.QueryRow(`SELECT actor_id FROM work_cast WHERE work_id = 7`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != theirs {
		t.Errorf("the credit moved from the record the reader chose (%d) to %d", theirs, got)
	}
}

// rerunPass forgets one pass and migrates again, which is how a test reaches a
// pass that has already run on the database it is holding. Going through
// Migrate rather than calling the function keeps the registry in the test: a
// pass that failed to register would make every case here pass by doing nothing.
func rerunPass(t *testing.T, s *Store, name string) {
	t.Helper()
	if _, err := s.DB.Exec(`DELETE FROM one_time_passes WHERE name = ?`, name); err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	if !passApplied(t, s, name) {
		t.Fatalf("%s did not run — it is not registered, so nothing here proves anything", name)
	}
}
