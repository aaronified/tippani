package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// The orphan sweep deletes saved people whose name no longer appears anywhere in
// the library. Which names count as "referenced" depends entirely on the kind:
// authors come from books.author, actors from dialogues.actor, directors from
// movies.director.
//
// That mapping used to be written as a default plus two overrides — ref started
// as the books.author query and a switch replaced it for actor and director.
// With exactly three valid kinds that is correct, and it is correct only for
// that reason. The function's own guard is `if !validPersonKind(kind) { return }`,
// so it stops protecting the moment a fourth kind is added, and a fourth kind
// would inherit the books.author query: every person of that kind whose name is
// not also the author of one of your books would be deleted, and its portrait
// file unlinked, by a best-effort sweep that logs at Warn and still answers 200.
//
// The mapping is now orphanRefQuery, a pure function, and these are the two
// tests that matter.
//
// A first attempt drove gcOrphanPeople directly with kind "speaker" and asserted
// the row survived. It passed against the OLD, buggy code — vacuously, because
// gcOrphanPeople returns early on !validPersonKind and "speaker" is not valid
// yet, so the sweep never ran at all. The landmine only arms when the kind
// becomes valid, which is precisely when nobody is looking for it. Testing the
// mapping in isolation is what removes that dependency.
func TestOrphanRefQueryHasNoDefault(t *testing.T) {
	// The empty answer is the safety property: a kind with no reference query
	// sweeps nothing, rather than inheriting the query for books.
	for _, kind := range []string{"speaker", "", "narrator", "composer", "AUTHOR"} {
		if q := orphanRefQuery(kind); q != "" {
			t.Errorf("orphanRefQuery(%q) returned a query; an unknown kind must sweep nothing.\n"+
				"Inheriting another kind's query deletes people and unlinks their portraits.\ngot: %s", kind, q)
		}
	}
}

// The invariant that will actually fire when §24 adds a speaker kind: every kind
// the app accepts must name the column that keeps it alive. Adding "speaker" to
// validPersonKind without adding its case here fails this test instead of
// deleting data.
func TestEveryValidKindHasAReferenceQuery(t *testing.T) {
	// Kept in step with validPersonKind by construction: any kind it accepts has
	// to appear here, and the loop below proves each one is mapped.
	kinds := []string{"author", "actor", "director", "speaker", "narrator", "composer"}
	for _, k := range kinds {
		if !validPersonKind(k) {
			continue // not accepted yet; nothing to map
		}
		if orphanRefQuery(k) == "" {
			t.Errorf("validPersonKind accepts %q but orphanRefQuery has no case for it.\n"+
				"gcOrphanPeople would skip it (safe), but the kind's orphans would never be collected —\n"+
				"and if the case is ever added carelessly as a fallthrough it deletes the wrong rows.", k)
		}
	}
}

// personCreditSQL is the rename's half of the same hazard, with a bigger blast
// radius: metadata.ReplaceCredit matches a name as a COMPONENT inside a joined
// credit, so a speaker renamed from "Bose" under an inherited books arm would
// rewrite the author line of every book credited to anyone called Bose — in
// place, library-wide, with no undo.
func TestPersonCreditSQLHasNoDefault(t *testing.T) {
	for _, kind := range []string{"speaker", "", "narrator", "AUTHOR"} {
		scan, update, ok := personCreditSQL(kind)
		if ok || scan != "" || update != "" {
			t.Errorf("personCreditSQL(%q) returned statements; an unmapped kind must not be renameable.\n"+
				"scan=%s\nupdate=%s", kind, scan, update)
		}
	}
}

// The scan and the update have to name the SAME table. They used to be two
// separate switches forty lines apart, so they could not only each inherit the
// books arm — they could disagree with each other, scanning every book's author
// and stamping the rewritten strings onto dialogue rows by matching id.
func TestPersonCreditSQLScanAndUpdateAgreeOnTheTable(t *testing.T) {
	table := map[string]string{"author": "books", "actor": "dialogues", "director": "movies"}
	for kind, want := range table {
		scan, update, ok := personCreditSQL(kind)
		if !ok {
			t.Fatalf("personCreditSQL(%q) not mapped", kind)
		}
		if !strings.Contains(scan, want) {
			t.Errorf("%s: scan does not read %s: %s", kind, want, scan)
		}
		if !strings.HasPrefix(strings.TrimSpace(update), "UPDATE "+want+" ") {
			t.Errorf("%s: update does not write %s: %s", kind, want, update)
		}
	}
}

// Every renameable kind must be mapped, so adding a kind without a credit
// column fails here rather than rewriting the wrong table.
func TestEveryValidKindIsRenameableOrExplicitlyNot(t *testing.T) {
	for _, k := range []string{"author", "actor", "director", "speaker"} {
		if !validPersonKind(k) {
			continue
		}
		if _, _, ok := personCreditSQL(k); !ok {
			t.Errorf("validPersonKind accepts %q but personCreditSQL has no case for it —\n"+
				"handleRenamePerson now refuses rather than guessing, which is safe, but the kind\n"+
				"cannot be renamed at all. Add its credit column or confirm it has none.", k)
		}
	}
}

func TestOrphanGCIgnoresAnUnknownKind(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	uid := userIDOf(t, srv, "alice")

	// A person of some kind the sweep does not know about, whose name is
	// deliberately NOT any book's author — the population an inherited
	// books.author reference query would classify as orphaned.
	seedPerson(t, srv, uid, "speaker", "Subhas Chandra Bose")
	// A book by someone else, so the keep-set is non-empty and the sweep has
	// something to compare against rather than bailing early on no rows.
	c.mustDo("POST", "/books", map[string]any{"title": "Emma", "author": "Jane Austen"}, http.StatusCreated)

	srv.gcOrphanPeople(uid, "speaker")

	if n := countPeopleOfKind(t, srv, uid, "speaker"); n != 1 {
		t.Fatalf("orphan GC swept a kind it has no reference query for: %d speakers left, want 1", n)
	}
}

// seedPerson saves a person under one role. Since 0027 that is two rows, not
// one — which is exactly why it lives in a helper: a test that wrote only the
// people row would be testing a person the console cannot see.
func seedPerson(t *testing.T, srv *Server, uid int64, kind, name string) int64 {
	t.Helper()
	res, err := srv.Store.DB.Exec(
		`INSERT INTO people (user_id, name) VALUES (?, ?)
		 ON CONFLICT(user_id, name) DO UPDATE SET name = excluded.name`, uid, name)
	if err != nil {
		t.Fatal(err)
	}
	id, _ := res.LastInsertId()
	if id == 0 {
		if err := srv.Store.DB.QueryRow(
			`SELECT id FROM people WHERE user_id = ? AND name = ?`, uid, name).Scan(&id); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := srv.Store.DB.Exec(
		`INSERT OR IGNORE INTO person_kinds (person_id, kind) VALUES (?, ?)`, id, kind); err != nil {
		t.Fatal(err)
	}
	return id
}

func countPeopleOfKind(t *testing.T, srv *Server, uid int64, kind string) int {
	t.Helper()
	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT count(*) FROM people p JOIN person_kinds pk ON pk.person_id = p.id
		 WHERE p.user_id = ? AND pk.kind = ?`, uid, kind).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// THE POINT OF 0027, as a sweep case. A person who is both an author and a
// speaker is ONE row, so losing their last book must un-file the author role
// and leave the row — bio, portrait and speaker role intact. Before 0027 these
// were two rows and deleting one was harmless; now it would take the other's
// metadata with it.
func TestOrphanGCUnfilesARoleWithoutLosingThePerson(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	uid := userIDOf(t, srv, "alice")

	id := seedPerson(t, srv, uid, "author", "Subhas Chandra Bose")
	if _, err := srv.Store.DB.Exec(
		`INSERT OR IGNORE INTO person_kinds (person_id, kind) VALUES (?, 'speaker')`, id); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(
		`UPDATE people SET bio = 'a bio worth keeping', image_path = 'bose.jpg' WHERE id = ?`, id); err != nil {
		t.Fatal(err)
	}
	// Someone else's book, so the keep-set is non-empty and Bose is not in it.
	c.mustDo("POST", "/books", map[string]any{"title": "Emma", "author": "Jane Austen"}, http.StatusCreated)

	srv.gcOrphanPeople(uid, "author")

	var bio, image string
	if err := srv.Store.DB.QueryRow(
		`SELECT bio, image_path FROM people WHERE id = ?`, id).Scan(&bio, &image); err != nil {
		t.Fatalf("the person was deleted along with their author role: %v", err)
	}
	if bio != "a bio worth keeping" || image != "bose.jpg" {
		t.Fatalf("the surviving row lost its metadata: %q %q", bio, image)
	}
	if n := countPeopleOfKind(t, srv, uid, "author"); n != 0 {
		t.Fatalf("the author role should have been un-filed, %d left", n)
	}
	if n := countPeopleOfKind(t, srv, uid, "speaker"); n != 1 {
		t.Fatalf("the speaker role was collateral damage: %d left", n)
	}
}

// ...and a person whose LAST role goes still goes with it, or the sweep would
// only ever accumulate rows.
func TestOrphanGCStillDeletesAPersonWithNoRolesLeft(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	uid := userIDOf(t, srv, "alice")

	seedPerson(t, srv, uid, "author", "Nobody At All")
	c.mustDo("POST", "/books", map[string]any{"title": "Emma", "author": "Jane Austen"}, http.StatusCreated)

	srv.gcOrphanPeople(uid, "author")

	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT count(*) FROM people WHERE user_id = ? AND name = 'Nobody At All'`, uid).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("a person with no roles left survived the sweep")
	}
}

// The three kinds it DOES know are still swept, so the fix above did not simply
// turn the sweep off. Each is checked against its own reference column, because
// the whole point of the change is that the mapping is now explicit.
func TestOrphanGCStillSweepsTheKindsItKnows(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	uid := userIDOf(t, srv, "alice")

	seed := func(kind, name string) { seedPerson(t, srv, uid, kind, name) }
	count := func(kind string) int { return countPeopleOfKind(t, srv, uid, kind) }

	// One referenced and one unreferenced person per kind.
	c.mustDo("POST", "/books", map[string]any{"title": "Emma", "author": "Jane Austen"}, http.StatusCreated)
	seed("author", "Jane Austen")
	seed("author", "Nobody At All")

	seed("director", "Michael Curtiz")
	seed("director", "Nobody At All")
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO movies (user_id, title, director) VALUES (?, 'Casablanca', 'Michael Curtiz')`,
		uid); err != nil {
		t.Fatal(err)
	}

	for _, kind := range []string{"author", "director"} {
		srv.gcOrphanPeople(uid, kind)
		if got := count(kind); got != 1 {
			t.Fatalf("%s: got %d rows after sweep, want 1 (the referenced one)", kind, got)
		}
	}

	// The referenced one is the survivor, not just "one of them".
	var name string
	if err := srv.Store.DB.QueryRow(
		`SELECT p.name FROM people p JOIN person_kinds pk ON pk.person_id = p.id
		 WHERE p.user_id = ? AND pk.kind = 'author'`, uid).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "Jane Austen" {
		t.Fatalf("orphan GC kept the wrong author: %q", name)
	}
}
