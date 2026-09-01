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
	// The quotes that POINT AT this record, and how many further ones name it
	// alongside somebody else — 0059's read side, exercised in
	// identity_reads_test.go. On this struct rather than a second one: one payload
	// has one shape, and two would drift the first time a field was added.
	Lines []struct {
		ID        int64  `json:"id"`
		Kind      string `json:"kind"`
		Text      string `json:"text"`
		Name      string `json:"name"`
		WorkTitle string `json:"work_title"`
	} `json:"lines"`
	SharedLines int `json:"shared_lines"`
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

	// 200 with the bin entry's id, not 204: a global character record is authored
	// rather than attribution, so deleting one is undoable and the response says
	// where the way back is.
	c.mustDo("DELETE", "/characters/"+itoa(ch.ID), nil, http.StatusOK)

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

// "ON THIS WORK ONLY" HAS TO BE TRUE, because it is a sentence the panel prints
// under the field. A reader changing how one book credits an author must not
// discover afterwards that they renamed them on the other thirty.
func TestChangingHowOneWorkCreditsSomebodyLeavesTheOthersAlone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	a := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The Master and Margarita", "author": "Mikhail Bulgakov"}, http.StatusCreated))
	b := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The White Guard", "author": "Mikhail Bulgakov"}, http.StatusCreated))
	id := personIDFor(t, srv, 1, "Mikhail Bulgakov")

	c.mustDo("PUT", "/credits", map[string]any{
		"kind": "book", "work_id": a.ID, "role": "author", "person_id": id, "credit_as": "M. Bulgakov",
	}, http.StatusNoContent)

	first := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(a.ID), nil, http.StatusOK))
	second := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(b.ID), nil, http.StatusOK))
	if first.Author != "M. Bulgakov" {
		t.Fatalf("this work prints %q", first.Author)
	}
	if second.Author != "Mikhail Bulgakov" {
		t.Fatalf("the OTHER work changed too: %q", second.Author)
	}
	// And the record itself is untouched — which is the half a reader cannot see
	// from the shelf and would only discover on the person's page.
	got := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK))
	if got.Name != "Mikhail Bulgakov" {
		t.Fatalf("the record was renamed: %q", got.Name)
	}
	creditsMustAgree(t, srv, 1)
}

// AN EMPTY STRING IS THE CLEAR, and so is the record's own name: neither should
// leave a row claiming a deliberate re-crediting that says nothing.
func TestClearingTheWorksOwnSpellingFallsBackToTheRecord(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	b := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Solaris", "author": "Stanisław Lem"}, http.StatusCreated))
	id := personIDFor(t, srv, 1, "Stanisław Lem")

	set := func(as string) {
		t.Helper()
		c.mustDo("PUT", "/credits", map[string]any{
			"kind": "book", "work_id": b.ID, "role": "author", "person_id": id, "credit_as": as,
		}, http.StatusNoContent)
	}
	creditAs := func() string {
		t.Helper()
		var v string
		if err := srv.Store.DB.QueryRow(
			`SELECT credit_as FROM work_person WHERE kind='book' AND work_id=? AND role='author'`, b.ID).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}

	set("S. Lem")
	if creditAs() != "S. Lem" {
		t.Fatalf("credit_as %q", creditAs())
	}
	set("")
	if creditAs() != "" {
		t.Fatalf("the clear left %q", creditAs())
	}
	// Typing the record's own name is the same as clearing it: the row would
	// otherwise read as a deliberate re-crediting to the spelling already in use.
	set("Stanisław Lem")
	if creditAs() != "" {
		t.Fatalf("the record's own name was stored as a re-crediting: %q", creditAs())
	}
	after := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(b.ID), nil, http.StatusOK))
	if after.Author != "Stanisław Lem" {
		t.Fatalf("the book prints %q", after.Author)
	}
	creditsMustAgree(t, srv, 1)
}

// Another account's work is a 404, like every other id-keyed route here — and the
// credit is addressed by a composite key, which is more integers to guess with.
func TestChangingACreditNeedsToOwnTheWork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	b := decode[bookDetail](t, alice.mustDo("POST", "/books",
		map[string]any{"title": "Solaris", "author": "Stanisław Lem"}, http.StatusCreated))
	id := personIDFor(t, srv, 1, "Stanisław Lem")

	bob.mustDo("PUT", "/credits", map[string]any{
		"kind": "book", "work_id": b.ID, "role": "author", "person_id": id, "credit_as": "mine",
	}, http.StatusNotFound)

	after := decode[bookDetail](t, alice.mustDo("GET", "/books/"+itoa(b.ID), nil, http.StatusOK))
	if after.Author != "Stanisław Lem" {
		t.Fatalf("bob got through: %q", after.Author)
	}
}

// ---- merge, through the API -------------------------------------------------

// A MERGE MUST NOT REWRITE A SHELF. Two spellings of one person become one record,
// and every cover goes on saying exactly what it said — which is the property that
// makes this safe to offer, and the one a reader would never think to check.
func TestMergingTwoRecordsLeavesEveryCoverSayingWhatItSaid(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	a := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The Master and Margarita", "author": "Mikhail Bulgakov"}, http.StatusCreated))
	b := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The White Guard", "author": "M. Bulgakov"}, http.StatusCreated))
	keep := personIDFor(t, srv, 1, "Mikhail Bulgakov")
	drop := personIDFor(t, srv, 1, "M. Bulgakov")

	res := decode[struct {
		TrashID int64 `json:"trash_id"`
		Works   int   `json:"works"`
	}](t, c.mustDo("POST", "/people/merge", map[string]any{"keep_id": keep, "drop_id": drop}, http.StatusOK))
	if res.TrashID == 0 {
		t.Fatal("a merge parked no undo")
	}
	if res.Works != 1 {
		t.Fatalf("the merge moved %d credits, want 1", res.Works)
	}

	first := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(a.ID), nil, http.StatusOK))
	second := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(b.ID), nil, http.StatusOK))
	if first.Author != "Mikhail Bulgakov" || second.Author != "M. Bulgakov" {
		t.Fatalf("the merge rewrote a cover: %q / %q", first.Author, second.Author)
	}
	// One record, two books, and the dropped one is gone.
	got := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(keep), nil, http.StatusOK))
	if len(got.Credits) != 2 {
		t.Fatalf("the survivor holds %d credits: %+v", len(got.Credits), got.Credits)
	}
	if len(got.Aliases) != 1 || got.Aliases[0] != "M. Bulgakov" {
		t.Fatalf("the dropped name did not become an alias: %+v", got.Aliases)
	}
	c.mustDo("GET", "/people/id/"+itoa(drop), nil, http.StatusNotFound)
	creditsMustAgree(t, srv, 1)
}

// THE BIN HOLDS IT, which is this app's promise and a stronger one than the design
// pack makes for a merge. The entry is not a snapshot and cannot take the generic
// restore path, so this is the test that says the branch is wired.
func TestAMergeCanBeUndoneFromTheBin(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	a := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The Master and Margarita", "author": "Mikhail Bulgakov"}, http.StatusCreated))
	b := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The White Guard", "author": "M. Bulgakov"}, http.StatusCreated))
	keep := personIDFor(t, srv, 1, "Mikhail Bulgakov")
	drop := personIDFor(t, srv, 1, "M. Bulgakov")

	res := decode[struct {
		TrashID int64 `json:"trash_id"`
	}](t, c.mustDo("POST", "/people/merge", map[string]any{"keep_id": keep, "drop_id": drop}, http.StatusOK))

	// The bin names it in a way a reader can act on: which record went into which.
	list := decode[struct {
		Trash []struct {
			ID    int64  `json:"id"`
			Kind  string `json:"kind"`
			Label string `json:"label"`
		} `json:"trash"`
	}](t, c.mustDo("GET", "/trash", nil, http.StatusOK))
	var entry string
	for _, e := range list.Trash {
		if e.ID == res.TrashID {
			if e.Kind != "person-merge" {
				t.Fatalf("the entry's kind is %q", e.Kind)
			}
			entry = e.Label
		}
	}
	if entry != "M. Bulgakov → Mikhail Bulgakov" {
		t.Fatalf("the bin calls it %q", entry)
	}

	c.mustDo("POST", "/trash/"+itoa(res.TrashID)+"/restore", nil, http.StatusOK)

	// Both records are back, each holding its own book, each printing what it did.
	c.mustDo("GET", "/people/id/"+itoa(drop), nil, http.StatusOK)
	one := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(keep), nil, http.StatusOK))
	two := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(drop), nil, http.StatusOK))
	if len(one.Credits) != 1 || len(two.Credits) != 1 {
		t.Fatalf("credits after undo: %d / %d", len(one.Credits), len(two.Credits))
	}
	if len(one.Aliases) != 0 {
		t.Fatalf("undo left the invented alias behind: %+v", one.Aliases)
	}
	first := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(a.ID), nil, http.StatusOK))
	second := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(b.ID), nil, http.StatusOK))
	if first.Author != "Mikhail Bulgakov" || second.Author != "M. Bulgakov" {
		t.Fatalf("covers after undo: %q / %q", first.Author, second.Author)
	}
	creditsMustAgree(t, srv, 1)
}

func TestAMergeStaysInsideTheAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	alice.mustDo("POST", "/books", map[string]any{"title": "Solaris", "author": "Stanisław Lem"}, http.StatusCreated)
	bob.mustDo("POST", "/books", map[string]any{"title": "Theirs", "author": "Bob's Author"}, http.StatusCreated)
	mine := personIDFor(t, srv, 1, "Stanisław Lem")
	theirs := personIDFor(t, srv, 2, "Bob's Author")

	alice.mustDo("POST", "/people/merge", map[string]any{"keep_id": mine, "drop_id": theirs}, http.StatusNotFound)
	alice.mustDo("POST", "/people/merge", map[string]any{"keep_id": mine, "drop_id": mine}, http.StatusConflict)

	var n int
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM people WHERE user_id = 2`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatal("bob's record was touched")
	}
}

// SPLIT HANDS BACK A NAME AND NOT THE WORKS. Asserted rather than left implied, so
// nobody reads it later as a full reverse of a merge — the schema does not
// remember which work came from which record, and the endpoint does not pretend.
func TestSplittingAnAliasBackOutMakesARecordAndMovesNothing(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{"title": "The Master and Margarita", "author": "Mikhail Bulgakov"}, http.StatusCreated)
	b := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The White Guard", "author": "M. Bulgakov"}, http.StatusCreated))
	keep := personIDFor(t, srv, 1, "Mikhail Bulgakov")
	drop := personIDFor(t, srv, 1, "M. Bulgakov")
	c.mustDo("POST", "/people/merge", map[string]any{"keep_id": keep, "drop_id": drop}, http.StatusOK)

	made := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/people/id/"+itoa(keep)+"/split",
		map[string]any{"alias": "M. Bulgakov"}, http.StatusCreated))

	fresh := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(made.ID), nil, http.StatusOK))
	if fresh.Name != "M. Bulgakov" {
		t.Fatalf("the split record is called %q", fresh.Name)
	}
	if len(fresh.Credits) != 0 {
		t.Fatalf("split moved works: %+v", fresh.Credits)
	}
	// Both books are still the survivor's, and the second still prints its own name.
	survivor := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(keep), nil, http.StatusOK))
	if len(survivor.Credits) != 2 {
		t.Fatalf("the survivor holds %d credits after a split", len(survivor.Credits))
	}
	after := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(b.ID), nil, http.StatusOK))
	if after.Author != "M. Bulgakov" {
		t.Fatalf("the second book prints %q", after.Author)
	}
	creditsMustAgree(t, srv, 1)
}

// ---- the cast writes records, not only names --------------------------------

// THE ONE THAT SAYS THE MODEL IS ALIVE. 0056's backfill gave every existing cast
// row a character and a performer, and until this test's subject existed nothing
// in the running app did: a library upgraded on Tuesday had a character list, and
// every role added on Wednesday was invisible to it. Driven through the real
// endpoint, because the hole was never in the store — it was in what the handlers
// did and did not call.
func TestAddingACastRowPutsTheCharacterOnTheReviewList(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Ran"}, http.StatusCreated))

	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
		map[string]any{"character": "Hidetora Ichimonji", "actor": "Tatsuya Nakadai"}, http.StatusCreated)

	list := decode[struct {
		Characters []struct {
			ID    int64  `json:"id"`
			Name  string `json:"name"`
			Works int    `json:"works"`
		} `json:"characters"`
	}](t, c.mustDo("GET", "/characters", nil, http.StatusOK))
	if len(list.Characters) != 1 || list.Characters[0].Name != "Hidetora Ichimonji" {
		t.Fatalf("the character list holds %+v", list.Characters)
	}
	if list.Characters[0].Works != 1 {
		t.Fatalf("the record counts %d works", list.Characters[0].Works)
	}

	// And the other half of the pairing: the performer is a record too, and the
	// role reads back off it — which is what the actor's page draws.
	people := decode[struct {
		People []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"people"`
	}](t, c.mustDo("GET", "/people/search?q=Nakadai", nil, http.StatusOK))
	if len(people.People) != 1 {
		t.Fatalf("searching for the performer found %+v", people.People)
	}
	got := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(people.People[0].ID), nil, http.StatusOK))
	if len(got.Roles) != 1 || got.Roles[0].Character != "Hidetora Ichimonji" {
		t.Fatalf("the performer's roles: %+v", got.Roles)
	}
}

// CORRECTING A NAME IS NOT AN IDENTITY CHANGE. The row prints what this work
// prints; the record it points at was somebody's deliberate pick, and a typo fix
// must not re-aim it at every other work the record appears on.
func TestCorrectingACastNameDoesNotMoveTheRecord(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Solaris"}, http.StatusCreated))
	row := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
		map[string]any{"character": "Chris Kelvin", "actor": "Donatas Banionis"}, http.StatusCreated))

	before := decode[struct {
		Characters []struct {
			ID int64 `json:"id"`
		} `json:"characters"`
	}](t, c.mustDo("GET", "/characters", nil, http.StatusOK))
	if len(before.Characters) != 1 {
		t.Fatalf("one row, %d characters", len(before.Characters))
	}

	c.mustDo("PUT", "/cast/"+itoa(row.ID),
		map[string]any{"character": "Kris Kelvin", "actor": "Donatas Banionis"}, http.StatusOK)

	after := decode[struct {
		Characters []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"characters"`
	}](t, c.mustDo("GET", "/characters", nil, http.StatusOK))
	if len(after.Characters) != 1 || after.Characters[0].ID != before.Characters[0].ID {
		t.Fatalf("the correction made a second record: %+v", after.Characters)
	}
	// The record keeps the name it was created with; work_cast.character is what
	// carries the spelling this work prints. Renaming the record is its own act,
	// on its own panel.
	if after.Characters[0].Name != "Chris Kelvin" {
		t.Fatalf("the record was renamed by a cast correction: %q", after.Characters[0].Name)
	}
}

// THE PICKER SAYS WHAT IT IS ABOUT TO DESTROY. A merge list of bare names is
// unusable in the exact case it exists for — two records spelled the same — so
// each hit carries how much of the library hangs off it. The count spans both
// halves of the model: credits on works, and roles in a cast.
func TestTheMergePickerSaysHowMuchHangsOffEachRecord(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{"title": "Wise Blood", "author": "Orson Welles"}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{"title": "Mr Arkadin", "author": "Orson Welles"}, http.StatusCreated)
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Citizen Kane"}, http.StatusCreated))
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
		map[string]any{"character": "Charles Foster Kane", "actor": "Orson Welles"}, http.StatusCreated)

	got := decode[struct {
		People []struct {
			Name  string `json:"name"`
			Works int    `json:"works"`
		} `json:"people"`
	}](t, c.mustDo("GET", "/people/search?q=Welles", nil, http.StatusOK))
	if len(got.People) != 1 {
		t.Fatalf("hits: %+v", got.People)
	}
	// Two books credited and one role played.
	if got.People[0].Works != 3 {
		t.Fatalf("the record carries %d works, want 3 (two credits and a role)", got.People[0].Works)
	}
}
