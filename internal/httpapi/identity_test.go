package httpapi

import (
	"net/http"
	"testing"

	"tippani/internal/store"
)

// The identity endpoints, through real requests.
//
// WHY NOT ONLY THE STORE TESTS. internal/store proves an alias resolves and that
// the cast reads reach both kinds of work. What it cannot prove is that the
// HANDLER hands the reader the record they asked for, scoped to their account,
// with the credits attached — which is the whole of what the person panel draws.
// Every isolation failure in this package looks like a working screen showing
// somebody else's library.

type personDetailResp struct {
	ID       int64    `json:"id"`
	Name     string   `json:"name"`
	SortName string   `json:"sort_name"`
	Born     string   `json:"born"`
	Note     string   `json:"note"`
	Aliases  []string `json:"aliases"`
	Credits  []struct {
		Kind     string `json:"kind"`
		WorkID   int64  `json:"work_id"`
		Title    string `json:"title"`
		Role     string `json:"role"`
		CreditAs string `json:"credit_as"`
	} `json:"credits"`
	Roles []struct {
		CastID    int64  `json:"cast_id"`
		Kind      string `json:"kind"`
		WorkTitle string `json:"work_title"`
		Character string `json:"character"`
	} `json:"roles"`
}

type characterDetailResp struct {
	ID          int64    `json:"id"`
	Name        string   `json:"name"`
	SortName    string   `json:"sort_name"`
	Description string   `json:"description"`
	Aliases     []string `json:"aliases"`
	Appearances []struct {
		CastID    int64  `json:"cast_id"`
		Kind      string `json:"kind"`
		WorkTitle string `json:"work_title"`
		Actor     string `json:"actor"`
	} `json:"appearances"`
}

// personIDFor finds the record a credit string resolved to, which is how every
// test here gets an id without an endpoint that lists them by name.
func personIDFor(t *testing.T, srv *Server, uid int64, name string) int64 {
	t.Helper()
	var id int64
	if err := srv.Store.DB.QueryRow(
		`SELECT id FROM people WHERE user_id = ? AND name = ? ORDER BY id LIMIT 1`, uid, name).Scan(&id); err != nil {
		t.Fatalf("no person %q: %v", name, err)
	}
	return id
}

// A PERSON'S PAGE IS EVERY WORK THEY ARE ON, and the credits are what the panel is
// for — two books by one author is the claim the whole schema change exists to
// make, so this is the test that says the API can express it.
func TestAPersonsPageListsEveryWorkTheyAreCreditedOn(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/books", map[string]any{"title": "The Master and Margarita", "author": "Mikhail Bulgakov"}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{"title": "The White Guard", "author": "Mikhail Bulgakov"}, http.StatusCreated)
	c.mustDo("POST", "/movies", map[string]any{"title": "Ran", "director": "Akira Kurosawa"}, http.StatusCreated)

	id := personIDFor(t, srv, 1, "Mikhail Bulgakov")
	got := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK))
	if len(got.Credits) != 2 {
		t.Fatalf("Bulgakov is on %d works, want 2: %+v", len(got.Credits), got.Credits)
	}
	for _, cr := range got.Credits {
		if cr.Kind != "book" || cr.Role != "author" {
			t.Fatalf("credit is %+v", cr)
		}
	}
	// The film's director is a different record, which is the other half of "one
	// human being is one record": records do not collapse across roles either.
	if got.Name != "Mikhail Bulgakov" {
		t.Fatalf("name %q", got.Name)
	}
}

// ANOTHER ACCOUNT'S RECORD IS A 404, NEVER A 403 — the package's standing rule,
// and the one an id-keyed endpoint is most likely to get wrong, because the id is
// a guessable integer.
func TestAPersonsPageIsInvisibleToAnotherAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	alice.mustDo("POST", "/books", map[string]any{"title": "Solaris", "author": "Stanisław Lem"}, http.StatusCreated)
	id := personIDFor(t, srv, 1, "Stanisław Lem")

	bob.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusNotFound)
	bob.mustDo("PUT", "/people/id/"+itoa(id), map[string]any{"note": "mine now"}, http.StatusNotFound)
	bob.mustDo("POST", "/people/id/"+itoa(id)+"/aliases", map[string]any{"alias": "S. Lem"}, http.StatusNotFound)

	// And nothing bob did reached the row.
	after := decode[personDetailResp](t, alice.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK))
	if after.Note != "" || len(after.Aliases) != 0 {
		t.Fatalf("bob got through: %+v", after)
	}
}

// EDITING ONE FIELD MUST NOT CLEAR THE OTHERS, which is what the pointer fields on
// the request are for. A struct of plain strings passes every test that sends the
// whole record and eats a bio the first time a panel sends one field.
func TestEditingOneIdentityFieldLeavesTheRestAlone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{"title": "Solaris", "author": "Stanisław Lem"}, http.StatusCreated)
	id := personIDFor(t, srv, 1, "Stanisław Lem")

	c.mustDo("PUT", "/people/id/"+itoa(id), map[string]any{"born": "1921", "sort_name": "Lem, Stanisław"}, http.StatusOK)
	got := decode[personDetailResp](t, c.mustDo("PUT", "/people/id/"+itoa(id),
		map[string]any{"note": "the one who wrote the ocean"}, http.StatusOK))

	if got.Born != "1921" || got.SortName != "Lem, Stanisław" {
		t.Fatalf("a note wiped the fields it never mentioned: %+v", got)
	}
	if got.Note != "the one who wrote the ocean" {
		t.Fatalf("note %q", got.Note)
	}
}

// RENAMING THE RECORD RE-DERIVES THE COLUMN THAT CACHES IT. Without this the shelf
// goes on printing the old spelling until something else happens to touch the
// book — which is the exact failure mode a derived column exists to risk.
func TestRenamingARecordRewritesTheCreditItIsPrintedIn(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	b := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Solaris", "author": "Stanislaw Lem"}, http.StatusCreated))
	id := personIDFor(t, srv, 1, "Stanislaw Lem")

	c.mustDo("PUT", "/people/id/"+itoa(id), map[string]any{"name": "Stanisław Lem"}, http.StatusOK)

	after := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(b.ID), nil, http.StatusOK))
	if after.Author != "Stanisław Lem" {
		t.Fatalf("the book still prints %q", after.Author)
	}
	creditsMustAgree(t, srv, 1)
}

// AN ALIAS IS HOW THE NEXT IMPORT FINDS THE RECORD, so the assertion that matters
// is not that the row exists — it is that a book credited with the other spelling
// lands on the person you already have.
func TestAnAliasCatchesTheNextBookCreditedThatWay(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{"title": "The White Guard", "author": "Mikhail Bulgakov"}, http.StatusCreated)
	id := personIDFor(t, srv, 1, "Mikhail Bulgakov")

	c.mustDo("POST", "/people/id/"+itoa(id)+"/aliases", map[string]any{"alias": "M. Bulgakov"}, http.StatusNoContent)
	c.mustDo("POST", "/books", map[string]any{"title": "A Country Doctor's Notebook", "author": "M. Bulgakov"}, http.StatusCreated)

	got := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK))
	if len(got.Credits) != 2 {
		t.Fatalf("the alias did not catch the second book: %+v", got.Credits)
	}
	// The book still PRINTS the spelling on its own cover — credit_as is what makes
	// one record and two spellings possible at once.
	var printed string
	for _, cr := range got.Credits {
		if cr.Title == "A Country Doctor's Notebook" {
			printed = cr.CreditAs
		}
	}
	if printed != "M. Bulgakov" {
		t.Fatalf("the second book credits %q, want the spelling it was typed with", printed)
	}
	if len(got.Aliases) != 1 || got.Aliases[0] != "M. Bulgakov" {
		t.Fatalf("aliases %+v", got.Aliases)
	}
}

// A SPELLING SOMEBODY HOLDS AS A NAME IS A 409 AND A SENTENCE, not a 500. It is a
// fact about the reader's library rather than a fault, and they can act on it.
func TestAnAliasCollisionIsAnAnswerRatherThanAnError(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{"title": "Mrs Dalloway", "author": "Virginia Woolf"}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{"title": "Beginning Again", "author": "Leonard Woolf"}, http.StatusCreated)
	id := personIDFor(t, srv, 1, "Virginia Woolf")

	c.mustDo("POST", "/people/id/"+itoa(id)+"/aliases", map[string]any{"alias": "Leonard Woolf"}, http.StatusConflict)
	// Removing one that was never there is not an error either — a panel deleting a
	// chip twice must not produce a red banner.
	c.mustDo("DELETE", "/people/id/"+itoa(id)+"/aliases?alias=Nobody", nil, http.StatusNoContent)
}

// ---- characters ------------------------------------------------------------

// A CHARACTER IS ITS OWN RECORD, and creating one NEVER resolves by name: two
// works with a "Narrator" get two records, which is 0056's rule and the reason
// this endpoint does not call ResolveCharacter.
func TestCreatingACharacterMakesANewRecordEveryTime(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	a := decode[characterDetailResp](t, c.mustDo("POST", "/characters", map[string]any{"name": "Narrator"}, http.StatusCreated))
	b := decode[characterDetailResp](t, c.mustDo("POST", "/characters", map[string]any{"name": "Narrator"}, http.StatusCreated))
	if a.ID == b.ID {
		t.Fatal("two Narrators became one record")
	}
	list := decode[struct {
		Characters []struct {
			ID    int64  `json:"id"`
			Name  string `json:"name"`
			Works int    `json:"works"`
		} `json:"characters"`
	}](t, c.mustDo("GET", "/characters", nil, http.StatusOK))
	if len(list.Characters) != 2 {
		t.Fatalf("the review list shows %d", len(list.Characters))
	}
	for _, ch := range list.Characters {
		if ch.Works != 0 {
			t.Fatalf("a character in no works reports %d", ch.Works)
		}
	}
}

// THE CHARACTER PAGE IS EVERY WORK IT APPEARS IN, ACROSS KINDS — the same
// character in the novel and in the film, which is what a library-wide record buys
// and what a per-work cast row alone could never say.
func TestACharactersPageSpansTheBookAndTheFilm(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "The Master and Margarita"}, http.StatusCreated))
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "The Master and Margarita (2005)"}, http.StatusCreated))
	ch := decode[characterDetailResp](t, c.mustDo("POST", "/characters", map[string]any{"name": "Woland"}, http.StatusCreated))

	// The cast rows exist before the pairing does — which is the real order of
	// events: a provider or a reader puts a name on a work, and linking it to a
	// record is a later, deliberate act.
	castID := func(kind string, workID int64) int64 {
		t.Helper()
		res, err := srv.Store.DB.Exec(
			`INSERT INTO work_cast (user_id, kind, work_id, character, character_key) VALUES (1, ?, ?, 'Woland', ?)`,
			kind, workID, store.CastKey("Woland"))
		if err != nil {
			t.Fatal(err)
		}
		id, _ := res.LastInsertId()
		return id
	}
	bookCast, filmCast := castID("book", b.ID), castID("movie", m.ID)

	c.mustDo("PUT", "/cast/"+itoa(bookCast)+"/link", map[string]any{"character_id": ch.ID}, http.StatusNoContent)
	c.mustDo("PUT", "/cast/"+itoa(filmCast)+"/link", map[string]any{"character_id": ch.ID}, http.StatusNoContent)

	got := decode[characterDetailResp](t, c.mustDo("GET", "/characters/"+itoa(ch.ID), nil, http.StatusOK))
	if len(got.Appearances) != 2 {
		t.Fatalf("Woland appears in %d works: %+v", len(got.Appearances), got.Appearances)
	}
	kinds := map[string]bool{}
	for _, a := range got.Appearances {
		kinds[a.Kind] = true
	}
	if !kinds["book"] || !kinds["movie"] {
		t.Fatalf("the character page missed a kind: %+v", got.Appearances)
	}
}

// THE PAIRING GOES BOTH WAYS OFF ONE TABLE: an actor's page lists the characters
// they have played, and each one names the work. This is the user's own ruling —
// "the actor page will list all the characters it has been linked to".
func TestAnActorsPageListsTheCharactersTheyHavePlayed(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Ran", "director": "Akira Kurosawa"}, http.StatusCreated))
	ch := decode[characterDetailResp](t, c.mustDo("POST", "/characters", map[string]any{"name": "Hidetora Ichimonji"}, http.StatusCreated))

	res, err := srv.Store.DB.Exec(
		`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key)
		 VALUES (1, 'movie', ?, 'Hidetora', ?, 'Tatsuya Nakadai', ?)`,
		m.ID, store.CastKey("Hidetora"), store.CastKey("Tatsuya Nakadai"))
	if err != nil {
		t.Fatal(err)
	}
	castID, _ := res.LastInsertId()

	// The performer is a person record. Made by crediting them somewhere, because
	// the link endpoint deliberately does not invent one — pairing is a pick from
	// what exists, never a create.
	c.mustDo("POST", "/movies", map[string]any{"title": "Kagemusha", "director": "Tatsuya Nakadai"}, http.StatusCreated)
	actorID := personIDFor(t, srv, 1, "Tatsuya Nakadai")

	c.mustDo("PUT", "/cast/"+itoa(castID)+"/link",
		map[string]any{"person_id": actorID, "character_id": ch.ID}, http.StatusNoContent)

	person := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(actorID), nil, http.StatusOK))
	if len(person.Roles) != 1 || person.Roles[0].Character != "Hidetora" {
		t.Fatalf("the actor's roles: %+v", person.Roles)
	}
	if person.Roles[0].WorkTitle != "Ran" {
		t.Fatalf("the role does not name its work: %+v", person.Roles[0])
	}
	// And from the other side, the same row names the performer off the RECORD.
	char := decode[characterDetailResp](t, c.mustDo("GET", "/characters/"+itoa(ch.ID), nil, http.StatusOK))
	if len(char.Appearances) != 1 || char.Appearances[0].Actor != "Tatsuya Nakadai" {
		t.Fatalf("the character's appearances: %+v", char.Appearances)
	}
}

// PAIRING IS A PICK FROM WHAT EXISTS. A link naming a record from another account,
// or one that is not there at all, is refused — otherwise a stale id in a client
// would silently write a pairing to somebody else's person.
func TestPairingRefusesARecordThatIsNotYours(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	m := decode[movieDetail](t, alice.mustDo("POST", "/movies", map[string]any{"title": "Ran"}, http.StatusCreated))
	res, err := srv.Store.DB.Exec(
		`INSERT INTO work_cast (user_id, kind, work_id, character, character_key) VALUES (1, 'movie', ?, 'Hidetora', ?)`,
		m.ID, store.CastKey("Hidetora"))
	if err != nil {
		t.Fatal(err)
	}
	castID, _ := res.LastInsertId()

	bob.mustDo("POST", "/books", map[string]any{"title": "Something", "author": "Bob's Author"}, http.StatusCreated)
	theirs := personIDFor(t, srv, 2, "Bob's Author")

	alice.mustDo("PUT", "/cast/"+itoa(castID)+"/link", map[string]any{"person_id": theirs}, http.StatusNotFound)
	// And bob cannot reach alice's cast row at all.
	bob.mustDo("PUT", "/cast/"+itoa(castID)+"/link", map[string]any{"person_id": theirs}, http.StatusNotFound)

	var linked int
	if err := srv.Store.DB.QueryRow(
		`SELECT count(*) FROM work_cast WHERE id = ? AND actor_id IS NOT NULL`, castID).Scan(&linked); err != nil {
		t.Fatal(err)
	}
	if linked != 0 {
		t.Fatal("a refused link still wrote")
	}
}

// DELETING THE GLOBAL RECORD UNDOES THE PAIRING AND NOT THE CAST. "These are not
// one character after all" must not take a work's cast list with it.
func TestDeletingACharacterLeavesEveryWorksCastStanding(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Ran"}, http.StatusCreated))
	ch := decode[characterDetailResp](t, c.mustDo("POST", "/characters", map[string]any{"name": "Hidetora"}, http.StatusCreated))
	res, err := srv.Store.DB.Exec(
		`INSERT INTO work_cast (user_id, kind, work_id, character, character_key) VALUES (1, 'movie', ?, 'Hidetora', ?)`,
		m.ID, store.CastKey("Hidetora"))
	if err != nil {
		t.Fatal(err)
	}
	castID, _ := res.LastInsertId()
	c.mustDo("PUT", "/cast/"+itoa(castID)+"/link", map[string]any{"character_id": ch.ID}, http.StatusNoContent)

	c.mustDo("DELETE", "/characters/"+itoa(ch.ID), nil, http.StatusNoContent)

	var name string
	var charID any
	if err := srv.Store.DB.QueryRow(
		`SELECT character, character_id FROM work_cast WHERE id = ?`, castID).Scan(&name, &charID); err != nil {
		t.Fatalf("the cast row went with the record: %v", err)
	}
	if name != "Hidetora" {
		t.Fatalf("the work stopped naming its character: %q", name)
	}
	if charID != nil {
		t.Fatalf("the pairing survived the delete: %v", charID)
	}
}
