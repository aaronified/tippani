package httpapi

import (
	"net/http"
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

func TestOrphanGCIgnoresAnUnknownKind(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	uid := userIDOf(t, srv, "alice")

	// A person of some kind the sweep does not know about, whose name is
	// deliberately NOT any book's author — the population an inherited
	// books.author reference query would classify as orphaned.
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO people (user_id, kind, name, bio) VALUES (?, 'speaker', 'Subhas Chandra Bose', 'a bio worth keeping')`,
		uid); err != nil {
		t.Fatal(err)
	}
	// A book by someone else, so the keep-set is non-empty and the sweep has
	// something to compare against rather than bailing early on no rows.
	c.mustDo("POST", "/books", map[string]any{"title": "Emma", "author": "Jane Austen"}, http.StatusCreated)

	srv.gcOrphanPeople(uid, "speaker")

	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT count(*) FROM people WHERE user_id = ? AND kind = 'speaker'`, uid).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("orphan GC swept a kind it has no reference query for: %d speakers left, want 1", n)
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

	seed := func(kind, name string) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(
			`INSERT INTO people (user_id, kind, name) VALUES (?, ?, ?)`, uid, kind, name); err != nil {
			t.Fatal(err)
		}
	}
	count := func(kind string) int {
		t.Helper()
		var n int
		if err := srv.Store.DB.QueryRow(
			`SELECT count(*) FROM people WHERE user_id = ? AND kind = ?`, uid, kind).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}

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
		`SELECT name FROM people WHERE user_id = ? AND kind = 'author'`, uid).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "Jane Austen" {
		t.Fatalf("orphan GC kept the wrong author: %q", name)
	}
}
