package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"tippani/internal/metadata"
)

func TestPeopleMetadataCRUD(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Not saved yet → an exists:false shell so the UI can offer fetch / manual.
	shell := decode[struct {
		Exists bool   `json:"exists"`
		Name   string `json:"name"`
	}](t, c.mustDo("GET", "/people?kind=author&name=Frank+Herbert", nil, 200))
	if shell.Exists || shell.Name != "Frank Herbert" {
		t.Fatalf("unsaved shell: %+v", shell)
	}

	// Upsert manual metadata.
	p := decode[personRow](t, c.mustDo("PUT", "/people", map[string]any{
		"kind": "author", "name": "Frank Herbert", "bio": "Author of Dune.", "born": "1920", "source": "manual",
	}, 200))
	if p.ID == 0 || p.Kind != "author" || p.Name != "Frank Herbert" || p.Bio != "Author of Dune." || p.Born != "1920" {
		t.Fatalf("upsert: %+v", p)
	}

	// GET single now resolves.
	got := decode[struct {
		Exists bool      `json:"exists"`
		Person personRow `json:"person"`
	}](t, c.mustDo("GET", "/people?kind=author&name=Frank+Herbert", nil, 200))
	if !got.Exists || got.Person.Bio != "Author of Dune." {
		t.Fatalf("get single: %+v", got)
	}

	// Update = upsert on the same (kind, name); id is stable.
	p2 := decode[personRow](t, c.mustDo("PUT", "/people", map[string]any{
		"kind": "author", "name": "Frank Herbert", "bio": "Sci-fi author.", "born": "1920-10-08",
	}, 200))
	if p2.ID != p.ID || p2.Bio != "Sci-fi author." || p2.Born != "1920-10-08" {
		t.Fatalf("update: %+v", p2)
	}

	// List by kind; actors are a separate namespace.
	list := decode[struct {
		People []personRow `json:"people"`
	}](t, c.mustDo("GET", "/people?kind=author", nil, 200))
	if len(list.People) != 1 || list.People[0].Name != "Frank Herbert" {
		t.Fatalf("list: %+v", list)
	}
	actors := decode[struct {
		People []personRow `json:"people"`
	}](t, c.mustDo("GET", "/people?kind=actor", nil, 200))
	if len(actors.People) != 0 {
		t.Fatalf("actor list should be empty: %+v", actors)
	}

	// Validation.
	c.mustDo("GET", "/people?kind=nope", nil, http.StatusBadRequest)
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": ""}, http.StatusBadRequest)

	// Delete clears the metadata.
	c.mustDo("DELETE", "/people/"+itoa(p.ID), nil, 200)
	after := decode[struct {
		Exists bool `json:"exists"`
	}](t, c.mustDo("GET", "/people?kind=author&name=Frank+Herbert", nil, 200))
	if after.Exists {
		t.Fatalf("should be deleted")
	}
}

// Cross-user isolation: one user's people rows are invisible to another.
// Renaming a book's author cleans up the old author's saved metadata (it's no
// longer referenced) while a still-referenced author survives.
func TestPeopleOrphanGC(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The Idiot", "author": "F. Dostoevsky"}, http.StatusCreated))
	decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Emma", "author": "J. Austen"}, http.StatusCreated))
	// Save metadata for both authors.
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "F. Dostoevsky", "bio": "x"}, 200)
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "J. Austen", "bio": "y"}, 200)

	type peopleResp struct {
		People []struct {
			Name string `json:"name"`
		} `json:"people"`
	}
	before := decode[peopleResp](t, c.mustDo("GET", "/people?kind=author", nil, 200))
	if len(before.People) != 2 {
		t.Fatalf("expected 2 saved authors, got %+v", before.People)
	}

	// Fix the author's name on the book — the old "F. Dostoevsky" is now orphaned.
	c.mustDo("PUT", "/books/"+itoa(b.ID),
		map[string]any{"title": "The Idiot", "author": "Fyodor Dostoevsky"}, 200)

	after := decode[peopleResp](t, c.mustDo("GET", "/people?kind=author", nil, 200))
	names := map[string]bool{}
	for _, p := range after.People {
		names[p.Name] = true
	}
	if names["F. Dostoevsky"] {
		t.Fatalf("orphaned author metadata was not cleaned: %+v", after.People)
	}
	if !names["J. Austen"] {
		t.Fatalf("still-referenced author was wrongly removed: %+v", after.People)
	}
}

func TestPeopleUserIsolation(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Ursula K. Le Guin", "bio": "x"}, 200)

	other := addUser(t, h, admin, "bob")
	list := decode[struct {
		People []personRow `json:"people"`
	}](t, other.mustDo("GET", "/people?kind=author", nil, 200))
	if len(list.People) != 0 {
		t.Fatalf("bob should not see admin's people: %+v", list)
	}
}

// /people/names merges referenced names (books.author / dialogues.actor via
// the caller's movies) with saved rows, user-scoped, sorted by name.
func TestPeopleNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	admin.mustDo("POST", "/books", map[string]any{"title": "Dune", "author": "Frank Herbert"}, 201)
	// Counts: a second solo book and a co-authored credit — each split
	// component gets the credit's count, so Herbert tallies 3 and Le Guin 2.
	admin.mustDo("POST", "/books", map[string]any{"title": "Children of Dune", "author": "Frank Herbert"}, 201)
	admin.mustDo("POST", "/books", map[string]any{"title": "Collected Letters", "author": "Frank Herbert & Ursula K. Le Guin"}, 201)
	m := decode[struct {
		ID int64 `json:"id"`
	}](t, admin.mustDo("POST", "/movies", map[string]any{"title": "Casablanca"}, 201))
	admin.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Here's looking at you, kid.",
		"character": "Rick", "actor": "Humphrey Bogart",
	}, 201)
	// A second dialogue on the SAME title must not double-count the actor —
	// actors tally distinct titles, not dialogue rows.
	admin.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "We'll always have Paris.",
		"character": "Rick", "actor": "Humphrey Bogart",
	}, 201)
	// A referenced author with saved metadata shows the saved flag + links.
	// (Unreferenced saved rows are swept on this endpoint now — see
	// TestRenamePersonAndSweep — so keep this author backed by a real book.)
	admin.mustDo("POST", "/books", map[string]any{"title": "The Dispossessed", "author": "Ursula K. Le Guin"}, 201)
	admin.mustDo("PUT", "/people", map[string]any{
		"kind": "author", "name": "Ursula K. Le Guin",
		"links": "https://en.wikipedia.org/wiki/Ursula_K._Le_Guin",
	}, 200)

	type nameRow struct {
		Name  string `json:"name"`
		Saved bool   `json:"saved"`
		Links string `json:"links"`
		Count int64  `json:"count"`
	}
	authors := decode[struct {
		People []nameRow `json:"people"`
	}](t, admin.mustDo("GET", "/people/names?kind=author", nil, 200))
	if len(authors.People) != 2 || authors.People[0].Name != "Frank Herbert" || authors.People[1].Name != "Ursula K. Le Guin" {
		t.Fatalf("authors = %+v", authors.People)
	}
	if authors.People[0].Saved || !authors.People[1].Saved || authors.People[1].Links == "" {
		t.Fatalf("saved flags/links wrong: %+v", authors.People)
	}
	if authors.People[0].Count != 3 || authors.People[1].Count != 2 {
		t.Fatalf("author counts wrong (want Herbert 3, Le Guin 2): %+v", authors.People)
	}
	actors := decode[struct {
		People []nameRow `json:"people"`
	}](t, admin.mustDo("GET", "/people/names?kind=actor", nil, 200))
	if len(actors.People) != 1 || actors.People[0].Name != "Humphrey Bogart" {
		t.Fatalf("actors = %+v", actors.People)
	}
	if actors.People[0].Count != 1 {
		t.Fatalf("actor count should be distinct titles, got %+v", actors.People)
	}

	// Isolation: bob sees none of admin's names; bad kind is a 400.
	empty := decode[struct {
		People []nameRow `json:"people"`
	}](t, bob.mustDo("GET", "/people/names?kind=author", nil, 200))
	if len(empty.People) != 0 {
		t.Fatalf("bob should see nothing: %+v", empty.People)
	}
	// "publisher" USED TO BE THE EXAMPLE HERE and became a real kind, which is
	// the third time this has happened to this line (speaker, then translator)
	// and the reason it is worth a sentence: the invalid-kind example must be a
	// credit nobody has added yet, or the test stops checking anything the day
	// the vocabulary grows. "narrator" is the next plausible one, and
	// people_gc_test.go names it too.
	admin.mustDo("GET", "/people/names?kind=narrator", nil, 400)
}

// Multi-author separation (ROADMAP §11): a joined credit lists as split
// components in /people/names, the orphan GC keeps rows saved under either a
// component or the verbatim joined string, and a component rename rewrites the
// stored credit without clobbering co-authors. The stored books.author string
// itself stays verbatim.
func TestPeopleMultiAuthorSplit(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Good Omens", "author": "X Alpha & Y Beta"}, http.StatusCreated))
	// A guard case that must NOT split.
	c.mustDo("POST", "/books", map[string]any{"title": "Ledgers", "author": "Daniels and Sons"}, http.StatusCreated)

	type nameRow struct {
		Name  string `json:"name"`
		Saved bool   `json:"saved"`
	}
	names := func() map[string]bool {
		res := decode[struct {
			People []nameRow `json:"people"`
		}](t, c.mustDo("GET", "/people/names?kind=author", nil, 200))
		out := map[string]bool{}
		for _, p := range res.People {
			out[p.Name] = true
		}
		return out
	}

	got := names()
	if !got["X Alpha"] || !got["Y Beta"] || got["X Alpha & Y Beta"] {
		t.Fatalf("joined credit should list as components: %v", got)
	}
	if !got["Daniels and Sons"] || got["Daniels"] || got["Sons"] {
		t.Fatalf("single name containing 'and' was shattered: %v", got)
	}

	// The orphan GC keeps a row saved under a component name AND one saved
	// under the verbatim joined credit (both are "referenced").
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "X Alpha", "bio": "component"}, 200)
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "X Alpha & Y Beta", "bio": "joined"}, 200)
	got = names()
	if !got["X Alpha"] || !got["X Alpha & Y Beta"] {
		t.Fatalf("GC dropped a referenced saved row: %v", got)
	}

	// Component rename: rewrites the joined credit, never touches the co-author.
	res := decode[struct {
		Updated int `json:"updated"`
	}](t, c.mustDo("POST", "/people/rename",
		map[string]any{"kind": "author", "from": "X Alpha", "to": "X. Alpha"}, 200))
	if res.Updated != 1 {
		t.Fatalf("component rename updated %d books", res.Updated)
	}
	book := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(b.ID), nil, 200))
	if book.Author != "X. Alpha & Y Beta" {
		t.Fatalf("rewritten credit = %q", book.Author)
	}
	got = names()
	if !got["X. Alpha"] || !got["Y Beta"] || got["X Alpha"] {
		t.Fatalf("names after component rename: %v", got)
	}

	// Splitting honours the per-user separator config: with comma disabled, a
	// "Last, First" author stays one person.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"creditSeparators": "amp,and"}, 200)
	c.mustDo("POST", "/books", map[string]any{"title": "LOTR", "author": "Tolkien, J.R.R."}, http.StatusCreated)
	got = names()
	if !got["Tolkien, J.R.R."] || got["Tolkien"] {
		t.Fatalf("comma-off config still split: %v", got)
	}
	// (The earlier comma-joined rewrite now reads as one name under this
	// config — expected: the split view follows the active separators.)
}

// /people/lookup validates input and returns provider links via the seams;
// actor lookups without a TMDB key are a clear 503.
func TestPersonLookup(t *testing.T) {
	srv := newTestServer(t)
	srv.authorLinks = func(_ context.Context, name string) (map[string]string, error) {
		if name != "Frank Herbert" {
			t.Errorf("name = %q", name)
		}
		return map[string]string{"openlibrary": "https://openlibrary.org/authors/OL79034A", "wikipedia": "https://en.wikipedia.org/wiki/Frank_Herbert"}, nil
	}
	h := srv.Handler()
	admin := signupAdmin(t, h)

	res := decode[struct {
		Links map[string]string `json:"links"`
	}](t, admin.mustDo("POST", "/people/lookup", map[string]any{"kind": "author", "name": "Frank Herbert"}, 200))
	if res.Links["wikipedia"] != "https://en.wikipedia.org/wiki/Frank_Herbert" {
		t.Fatalf("links = %v", res.Links)
	}

	admin.mustDo("POST", "/people/lookup", map[string]any{"kind": "author", "name": ""}, 400)
	admin.mustDo("POST", "/people/lookup", map[string]any{"kind": "narrator", "name": "X"}, 400)
	// No TMDB key resolvable in tests -> actor lookup is a labelled 503.
	admin.mustDo("POST", "/people/lookup", map[string]any{"kind": "actor", "name": "Humphrey Bogart"}, 503)
}

// Rename an author across the library folds two spellings into one — books
// rewritten, saved metadata migrated to the new name, old row gone. And the
// orphan sweep on /people/names removes a saved row no book references.
func TestRenamePersonAndSweep(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/books", map[string]any{"title": "Crime and Punishment", "author": "Fyodor Dostoevsky"}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{"title": "The Idiot", "author": "Fyodor Dostoyevsky"}, http.StatusCreated)
	// Saved metadata on the variant spelling (the one we'll rename away).
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Fyodor Dostoevsky", "bio": "Russian novelist", "born": "1821"}, 200)

	res := decode[struct {
		OK      bool `json:"ok"`
		Updated int  `json:"updated"`
	}](t, c.mustDo("POST", "/people/rename",
		map[string]any{"kind": "author", "from": "Fyodor Dostoevsky", "to": "Fyodor Dostoyevsky"}, 200))
	if !res.OK || res.Updated != 1 {
		t.Fatalf("rename response: %+v", res)
	}

	var oldBooks, newBooks int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM books WHERE author = 'Fyodor Dostoevsky'`).Scan(&oldBooks); err != nil {
		t.Fatal(err)
	}
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM books WHERE author = 'Fyodor Dostoyevsky'`).Scan(&newBooks); err != nil {
		t.Fatal(err)
	}
	if oldBooks != 0 || newBooks != 2 {
		t.Fatalf("book authors after rename: old=%d new=%d, want 0/2", oldBooks, newBooks)
	}

	got := decode[struct {
		Exists bool      `json:"exists"`
		Person personRow `json:"person"`
	}](t, c.mustDo("GET", "/people?kind=author&name=Fyodor+Dostoyevsky", nil, 200))
	if !got.Exists || got.Person.Bio != "Russian novelist" || got.Person.Born != "1821" {
		t.Fatalf("metadata not folded onto the new name: %+v", got)
	}
	old := decode[struct {
		Exists bool `json:"exists"`
	}](t, c.mustDo("GET", "/people?kind=author&name=Fyodor+Dostoevsky", nil, 200))
	if old.Exists {
		t.Fatal("old-spelling metadata row still exists after rename")
	}

	// Auto-sweep: a saved row for a name no book references is gone after a
	// /people/names load.
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Ghost Author", "bio": "unreferenced"}, 200)
	names := decode[struct {
		People []struct {
			Name string `json:"name"`
		} `json:"people"`
	}](t, c.mustDo("GET", "/people/names?kind=author", nil, 200))
	for _, n := range names.People {
		if n.Name == "Ghost Author" {
			t.Fatal("unreferenced 'Ghost Author' was not swept on /people/names load")
		}
	}
	var ghost int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM people WHERE name = 'Ghost Author'`).Scan(&ghost); err != nil {
		t.Fatal(err)
	}
	if ghost != 0 {
		t.Fatalf("orphan sweep left %d 'Ghost Author' rows", ghost)
	}
}

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

func TestACreditWithNoRecordGetsOneAndKeepsIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	// A SPEAKER TYPED ONTO A QUOTE, which is how the reader in the report entered
	// theirs: no cast fetched, nothing looked up.
	newUtterance(t, c, map[string]any{
		"quote":   "I have no special talents. I am only passionately curious.",
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

// THE PEOPLE CONSOLE'S FETCH MISSING, AS A JOB: started as the console starts it
// (POST /jobs {kind: "people", ids}), watched as Settings › Jobs watches it, and
// each record read back as its panel reads it.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the queue
// is given to the server as serve() gives it (queueing, jobs_api_test.go); the
// suppliers are the server's seams — Open Library's author resolution
// (srv.resolveAuthor) and the portrait download (srv.fetchImage, through
// downloads) — because a test may not reach the real ones, and one test holds
// the resolution until its request is cancelled, so that Stop is pressed with a
// record in hand; and
// the job's wire fields and its counts' names, which the People screen's flash
// reads (jobs.js's jobOutcome: ok, failed, first_error).
//
// What each one guards, in a sentence a person would say: a people fetch fetches
// each record, says in its log what it found or why it failed, and counts the
// fetched and the failed with the reason the first one failed, in the words the
// row's own Fetch would have said, under the names the screen reads; another
// reader's record is not fetched; and Stop ends it at once, leaving the record in
// hand untouched.

// recordID is a person's record id as the People console lists it.
func recordID(t *testing.T, c *testClient, name string) int64 {
	t.Helper()
	for _, p := range decode[struct {
		People []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"people"`
	}](t, c.mustDo("GET", "/people/records", nil, http.StatusOK)).People {
		if p.Name == name {
			return p.ID
		}
	}
	t.Fatalf("no record named %q in the People console", name)
	return 0
}

// leGuinResolves makes Open Library know one author and fail on everybody else.
func leGuinResolves(srv *Server) {
	srv.resolveAuthor = func(_ context.Context, name string, _ []string) (metadata.AuthorResolution, error) {
		if name != "Ursula K. Le Guin" {
			return metadata.AuthorResolution{}, errors.New("open library: status 503")
		}
		return metadata.AuthorResolution{
			Key: "OL2A", Name: name, Bio: "An American author.",
			ImageURL: "https://covers.openlibrary.org/a/id/2-L.jpg",
			Links:    map[string]string{"openlibrary": "https://openlibrary.org/authors/OL2A"},
		}, nil
	}
}

func TestAPeopleJobFetchesEachRecordAndSaysWhyTheFirstOneFailed(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	leGuinResolves(srv)
	downloads(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	for _, name := range []string{"Ursula K. Le Guin", "Nobody Known"} {
		alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": name}, http.StatusOK)
	}
	bob.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Bob's author"}, http.StatusOK)
	leGuin, nobody, bobs := recordID(t, alice, "Ursula K. Le Guin"), recordID(t, alice, "Nobody Known"), recordID(t, bob, "Bob's author")

	job := alice.waitJob(alice.mustStart("people", map[string]any{"ids": []int64{leGuin, nobody, bobs}}).ID, "succeeded")
	if job.Done != 3 || job.Total != 3 {
		t.Fatalf("the fetch's progress: %d of %d", job.Done, job.Total)
	}
	// The reason is the one the row's Fetch shows for a lookup that failed, and
	// it is the first failure's: bob's record, which is not alice's, came after.
	countsAre(t, job, map[string]any{"ok": float64(1), "failed": float64(2), "first_error": errPortraitLookup})

	log := strings.Join(logOf(t, alice, job.ID), "\n")
	for _, want := range []string{
		"info «Ursula K. Le Guin» — found portrait, identity (openlibrary), bio, links",
		"warn «Nobody Known» — failed: " + errPortraitLookup,
		fmt.Sprintf("warn person #%d — failed: not found", bobs),
	} {
		if !strings.Contains(log, want) {
			t.Errorf("the fetch's log has no %q:\n%s", want, log)
		}
	}
	if strings.Contains(log, "Bob's author") {
		t.Errorf("alice's fetch names bob's record:\n%s", log)
	}

	got := decode[struct {
		Bio       string `json:"bio"`
		ImagePath string `json:"image_path"`
		Links     string `json:"links"`
	}](t, alice.mustDo("GET", "/people/id/"+itoa(leGuin), nil, http.StatusOK))
	if got.Bio != "An American author." || got.ImagePath == "" || got.Links != "https://openlibrary.org/authors/OL2A" {
		t.Fatalf("Le Guin after the fetch: %+v", got)
	}
	if b := decode[struct {
		Source string `json:"source"`
	}](t, bob.mustDo("GET", "/people/id/"+itoa(bobs), nil, http.StatusOK)); b.Source != "" {
		t.Fatalf("bob's record was fetched by alice's job: %+v", b)
	}
}

// A Stop pressed while the second record is being resolved ends the fetch there:
// the first record keeps what was fetched for it, and the second is left as it
// was, counted neither fetched nor failed.
func TestAPeopleJobStoppedWithARecordInHandLeavesThatRecordUntouched(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	leGuinResolves(srv)
	resolve := srv.resolveAuthor
	asked := make(chan struct{}, 1)
	srv.resolveAuthor = func(ctx context.Context, name string, titles []string) (metadata.AuthorResolution, error) {
		if name == "Second" {
			asked <- struct{}{}
			<-ctx.Done() // the second record's resolution never answers
			return metadata.AuthorResolution{}, ctx.Err()
		}
		return resolve(ctx, "Ursula K. Le Guin", titles)
	}
	downloads(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	for _, name := range []string{"First", "Second"} {
		alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": name}, http.StatusOK)
	}
	first, second := recordID(t, alice, "First"), recordID(t, alice, "Second")

	job := alice.mustStart("people", map[string]any{"ids": []int64{first, second}})
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the fetch never asked Open Library about the second record")
	}
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	stopped := alice.waitJob(job.ID, "stopped")
	if stopped.Done != 1 {
		t.Fatalf("stopped after %d of %d records, want the one fetched before the Stop", stopped.Done, stopped.Total)
	}
	countsAre(t, stopped, map[string]any{"ok": float64(1), "failed": float64(0), "first_error": ""})
	bio := func(id int64) string {
		return decode[struct {
			Bio string `json:"bio"`
		}](t, alice.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK)).Bio
	}
	if bio(first) == "" || bio(second) != "" {
		t.Fatalf("after the stop: the first record's bio %q, the second's %q; want the first fetched and the second untouched",
			bio(first), bio(second))
	}
}

// THE PEOPLE ROW'S FETCH, ONE PRESS: POST /people/id/{id}/fetch.
//
// Driven through the API as the People console drives it: the row's Fetch sends
// the record's id and nothing else, and the record is read back as its panel
// reads it (GET /people/id/{id}), its picture as the page loads it
// (GET /covers/{file}).
//
// WHAT IT KNOWS, declared because a test here may not know the code: the
// suppliers are the server's own seams — Open Library's author resolution
// (srv.resolveAuthor), the portrait download (srv.fetchImage, which writes the
// file it names into the covers dir, as the real one does) and the IGDB client
// (srv.IGDB, pointed at a stub of its /companies answer) — because a test may not
// reach the real ones. Two records sharing a name are made by twoNamesakes
// (person_portrait_record_test.go), which writes the second into the table: the
// API resolves by name, so no request makes a second.
//
// What each one guards, in a sentence a person would say: a Fetch lands on the
// record I pressed and not on the one that shares its name, whose picture stays
// where it was; it keeps the names I gave my links and adds the page it found;
// another reader's record is not there for me to fetch; and a game studio is
// fetched from the games catalogue, not looked for among film people or authors.

type fetchedPerson struct {
	Person struct {
		ID        int64  `json:"id"`
		Name      string `json:"name"`
		ImagePath string `json:"image_path"`
		Bio       string `json:"bio"`
		Links     string `json:"links"`
		Source    string `json:"source"`
		SourceID  string `json:"source_id"`
	} `json:"person"`
	Links map[string]string `json:"links"`
}

// downloads stands in for the portrait download: each address it is asked for
// becomes a new file in the covers dir, named as the real downloader names one.
func downloads(t *testing.T, srv *Server) *[]string {
	t.Helper()
	var asked []string
	var n atomic.Int64
	srv.fetchImage = func(_ context.Context, rawURL, dir string) (string, error) {
		asked = append(asked, rawURL)
		name := fmt.Sprintf("%016x.jpg", n.Add(1))
		return name, os.WriteFile(filepath.Join(dir, name), []byte("jpeg"), 0o600)
	}
	return &asked
}

func TestAFetchLandsOnTheRecordPressedAndKeepsTheNamesOnItsLinks(t *testing.T) {
	srv := newTestServer(t)
	srv.resolveAuthor = func(_ context.Context, name string, _ []string) (metadata.AuthorResolution, error) {
		if name != "David Reich" {
			t.Errorf("resolved %q", name)
		}
		return metadata.AuthorResolution{
			Key: "OL1A", Name: "David Reich", Bio: "A geneticist.",
			ImageURL: "https://covers.openlibrary.org/a/id/1-L.jpg",
			Links:    map[string]string{"openlibrary": "https://openlibrary.org/authors/OL1A"},
		}, nil
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	first, second := twoNamesakes(t, srv, alice)

	// The first already has a picture of their own, chosen by the reader.
	srv.fetchUserImage = func(_ context.Context, _, dir string) (string, error) {
		name := "00000000000000f1.jpg"
		return name, os.WriteFile(filepath.Join(dir, name), []byte("jpeg"), 0o600)
	}
	alice.mustDo("PUT", "/people/id/"+itoa(first), map[string]any{"image_url": "https://example.test/first.jpg"}, http.StatusOK)
	// The second has a link the reader named.
	alice.mustDo("PUT", "/people/id/"+itoa(second), map[string]any{"links": "https://example.org/essays | Their essays"}, http.StatusOK)
	asked := downloads(t, srv)

	got := decode[fetchedPerson](t, alice.mustDo("POST", "/people/id/"+itoa(second)+"/fetch", nil, http.StatusOK))
	p := got.Person
	if p.ID != second || p.Source != "openlibrary" || p.SourceID != "OL1A" || p.Bio != "A geneticist." || p.ImagePath == "" {
		t.Fatalf("the record fetched: %+v", p)
	}
	if len(*asked) != 1 || (*asked)[0] != "https://covers.openlibrary.org/a/id/1-L.jpg" {
		t.Fatalf("downloaded %v", *asked)
	}
	wantLinks := "https://openlibrary.org/authors/OL1A\nhttps://example.org/essays | Their essays"
	if p.Links != wantLinks {
		t.Fatalf("the fetch answered links\n%s\nwant\n%s", p.Links, wantLinks)
	}
	if got.Links["openlibrary"] != "https://openlibrary.org/authors/OL1A" {
		t.Fatalf("the links it found: %v", got.Links)
	}

	// Read back as the panel reads it: kept, names and all.
	type record struct {
		ImagePath string `json:"image_path"`
		Bio       string `json:"bio"`
		Links     string `json:"links"`
		Source    string `json:"source"`
	}
	if r := decode[record](t, alice.mustDo("GET", "/people/id/"+itoa(second), nil, http.StatusOK)); r.Links != wantLinks || r.ImagePath != p.ImagePath {
		t.Fatalf("the record after its fetch: %+v", r)
	}
	alice.mustDo("GET", "/covers/"+p.ImagePath, nil, http.StatusOK)

	// THE NAMESAKE IS UNTOUCHED: no identity, no facts, no links, and its own
	// picture still on the record and on the disk.
	if r := decode[record](t, alice.mustDo("GET", "/people/id/"+itoa(first), nil, http.StatusOK)); r.Source != "" || r.Bio != "" || r.Links != "" || r.ImagePath != "00000000000000f1.jpg" {
		t.Fatalf("the namesake after the other's fetch: %+v", r)
	}
	alice.mustDo("GET", "/covers/00000000000000f1.jpg", nil, http.StatusOK)

	// Another reader has no such record, and nothing is looked up for them.
	bob := addUser(t, h, alice, "bob")
	*asked = nil
	bob.mustDo("POST", "/people/id/"+itoa(second)+"/fetch", nil, http.StatusNotFound)
	bob.mustDo("POST", "/people/id/999999/fetch", nil, http.StatusNotFound)
	bob.mustDo("POST", "/people/id/nobody/fetch", nil, http.StatusBadRequest)
	if len(*asked) != 0 {
		t.Fatalf("another reader's fetch downloaded %v", *asked)
	}
}

// igdbCompanies answers IGDB's token and /companies calls with one company.
func igdbCompanies(t *testing.T, company string) *metadata.IGDB {
	t.Helper()
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "token"):
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "t", "expires_in": 3600})
		case strings.Contains(r.URL.Path, "/companies"):
			_, _ = w.Write([]byte(company))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(stub.Close)
	return &metadata.IGDB{ClientID: "id", ClientSecret: "secret", BaseURL: stub.URL, TokenURL: stub.URL + "/token"}
}

func TestAStudiosFetchAsksTheGamesCatalogue(t *testing.T) {
	srv := newTestServer(t)
	srv.IGDB = igdbCompanies(t, `[{
		"id": 1, "name": "Electronic Arts", "url": "https://www.igdb.com/companies/electronic-arts",
		"logo": {"image_id": "cl1x"},
		"websites": [{"category": 1, "url": "https://www.ea.com"}, {"category": 4, "url": "https://en.wikipedia.org/wiki/Electronic_Arts"}]
	}]`)
	srv.resolveAuthor = func(context.Context, string, []string) (metadata.AuthorResolution, error) {
		t.Error("a studio was looked up as a book author")
		return metadata.AuthorResolution{}, nil
	}
	asked := downloads(t, srv)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/movies", map[string]any{"title": "Mass Effect", "media_type": "game", "director": "Electronic Arts"}, http.StatusCreated)
	var studio int64
	for _, p := range decode[struct {
		People []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"people"`
	}](t, c.mustDo("GET", "/people/records", nil, http.StatusOK)).People {
		if p.Name == "Electronic Arts" {
			studio = p.ID
		}
	}
	if studio == 0 {
		t.Fatal("the studio has no record in the People console")
	}

	p := decode[fetchedPerson](t, c.mustDo("POST", "/people/id/"+itoa(studio)+"/fetch", nil, http.StatusOK)).Person
	if p.Source != "igdb" || p.SourceID != "1" || p.ImagePath == "" {
		t.Fatalf("the studio after its fetch: %+v", p)
	}
	if len(*asked) != 1 || !strings.Contains((*asked)[0], "cl1x") {
		t.Fatalf("downloaded %v, want the company's logo", *asked)
	}
	// Its catalogue page and its encyclopaedia page, in the order links are
	// written; the studio's own site is not a provider page and is not kept.
	if want := "https://www.igdb.com/companies/electronic-arts\nhttps://en.wikipedia.org/wiki/Electronic_Arts"; p.Links != want {
		t.Fatalf("the studio's links:\n%s\nwant\n%s", p.Links, want)
	}
}
