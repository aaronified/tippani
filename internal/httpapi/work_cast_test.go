package httpapi

import (
	"net/http"
	"strings"
	"testing"

	"tippani/internal/store"
)

// A work's cast, as a list the reader owns (0048).
//
// Before this there was `movies.cast_json` and nothing else: a blob a metadata
// fetch wrote whole, that no screen anywhere could edit, and that is empty for
// nearly every game because Wikidata is the only free source of voice credits
// and its coverage is thin (TIP-META-018 measures it: 14 of 24 titles had none).
// So a mis-billed minor role was permanent and a game's speaker had no actor at
// all. Every test here would have been a 404 before the six routes landed.

// castListResp is the GET shape: the rows, and the machine value that says what
// the second column is. `actor_role` is deliberately not a word — the label
// belongs to the screen that renders it, in English and in Bengali together.
type castListResp struct {
	Cast      []castRow `json:"cast"`
	ActorRole string    `json:"actor_role"`
}

func createTestBook(t *testing.T, c *testClient, title, author string) int64 {
	t.Helper()
	rec := c.mustDo("POST", "/books", map[string]any{"title": title, "author": author},
		http.StatusCreated)
	return decode[bookDetail](t, rec).ID
}

// seedProviderCast writes rows the way a metadata fetch will: origin 'provider',
// a provider_key, a billing order. Written directly because the seed path is the
// next commit's — what is under test here is what the reader may do to a row a
// provider put there.
func seedProviderCast(t *testing.T, srv *Server, uid int64, kind string, workID int64, pairs ...[2]string) []int64 {
	t.Helper()
	var ids []int64
	for i, p := range pairs {
		res, err := srv.Store.DB.Exec(
			`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key,
			                        provider_key, person_id, image_url, billing, origin, source)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'provider', 'tmdb')`,
			uid, kind, workID, p[0], store.CastKey(p[0]), p[1], store.CastKey(p[1]),
			store.ProviderKey(p[0], p[1]), "6384", "https://img/x.jpg", i)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := res.LastInsertId()
		ids = append(ids, id)
	}
	return ids
}

func castOf(t *testing.T, c *testClient, path string) castListResp {
	t.Helper()
	return decode[castListResp](t, c.mustDo("GET", path, nil, http.StatusOK))
}

// THE BUG THIS FEATURE EXISTS FOR. A game's voice cast comes from Wikidata
// joined on the IGDB slug, and for most games that lookup finds nothing at all —
// so `cast_json` is '[]', the quote form's character typeahead has nothing to
// offer, and the voice actor could never be recorded anywhere. Now it can be
// typed, and the list says the second column is a VOICE actor.
func TestAGameWithNoVoiceCastCanStillNameItsVoiceActor(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	game := createGame(t, c, "Disco Elysium", "ZA/UM")
	// The normal state of a game: the lookup found nothing and left the blob empty.
	var blob string
	if err := srv.Store.DB.QueryRow(`SELECT cast_json FROM movies WHERE id = ?`, game).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if blob != "[]" {
		t.Fatalf("fixture is wrong — the game already has a cast: %s", blob)
	}

	before := castOf(t, c, "/movies/"+itoa(game)+"/cast")
	if len(before.Cast) != 0 {
		t.Fatalf("a game with no lookup should start empty: %+v", before.Cast)
	}
	if before.ActorRole != "voice" {
		t.Fatalf("actor_role = %q, want \"voice\" — a game's second column is the voice actor", before.ActorRole)
	}

	row := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(game)+"/cast", map[string]any{
		"character": "  Kim Kitsuragi ", "actor": " Jullian Champenois ",
	}, http.StatusCreated))
	if row.Character != "Kim Kitsuragi" || row.Actor != "Jullian Champenois" {
		t.Fatalf("both names should be trimmed and kept: %+v", row)
	}
	if row.Origin != "reader" {
		t.Fatalf("origin = %q, want \"reader\" — nothing seeded this and a refetch must never touch it", row.Origin)
	}

	after := castOf(t, c, "/movies/"+itoa(game)+"/cast")
	if len(after.Cast) != 1 || after.Cast[0].Actor != "Jullian Champenois" {
		t.Fatalf("the typed voice actor did not come back: %+v", after.Cast)
	}
}

// The pair unique, through the API: the same character and actor twice is a
// duplicate, and it is the FOLDED pair that decides — so a curly apostrophe, a
// different case and a stray space are all the same row.
func TestACastRowIsRefusedWhenItDuplicatesOneAlreadyThere(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := createFilm(t, c, "The Matrix", "The Wachowskis")
	c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "Neo", "actor": "Keanu Reeves"}, http.StatusCreated)
	c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "  neo ", "actor": "KEANU REEVES"}, http.StatusConflict)

	// The same character opposite a DIFFERENT actor is not a duplicate: a
	// provider legitimately bills one character twice, and so may a reader.
	c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "Neo", "actor": "Somebody Else"}, http.StatusCreated)

	// A character is required; a name longer than the free-text cap is refused.
	c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "   ", "actor": "Nobody"}, http.StatusBadRequest)
	c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": longName(129)}, http.StatusBadRequest)

	// And a correction cannot be made ONTO an existing pair either.
	rows := castOf(t, c, "/movies/"+itoa(film)+"/cast").Cast
	c.mustDo("PUT", "/cast/"+itoa(rows[1].ID),
		map[string]any{"character": "Neo", "actor": "Keanu Reeves"}, http.StatusConflict)
	// Correcting a row's own capitalisation is not a collision with itself.
	c.mustDo("PUT", "/cast/"+itoa(rows[0].ID),
		map[string]any{"character": "NEO", "actor": "Keanu Reeves"}, http.StatusOK)
}

// CORRECTING A PROVIDER ROW IS WHAT MAKES IT THE READER'S. `origin` goes
// provider -> corrected, which is the flag a refetch reads before it decides
// whether it may rewrite the two names. What it costs is in 0048's header: a
// name corrected wrongly stays wrong even after the provider agrees.
func TestCorrectingAProviderRowMarksItAsTheReaders(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	game := createGame(t, c, "Portal 2", "Valve")
	ids := seedProviderCast(t, srv, 1, "movie", game,
		[2]string{"Glados", "Ellen McLain"}, [2]string{"Wheatley", "Stephen Merchant"})

	row := decode[castRow](t, c.mustDo("PUT", "/cast/"+itoa(ids[0]), map[string]any{
		"character": "GLaDOS", "actor": "Ellen McLain",
	}, http.StatusOK))
	if row.Character != "GLaDOS" {
		t.Fatalf("the correction did not stick: %+v", row)
	}
	if row.Origin != "corrected" {
		t.Fatalf("origin = %q, want \"corrected\" — this is the flag that survives a refetch", row.Origin)
	}
	// The provider's own facts are untouched by a correction: they are what the
	// portrait pipeline and the quiz's distractor order read, and a refetch takes
	// them back regardless of who has edited the row.
	if row.PersonID != "6384" || row.ImageURL != "https://img/x.jpg" || row.Source != "tmdb" || row.Billing != 0 {
		t.Fatalf("a correction must not disturb the provider's columns: %+v", row)
	}
	// Its untouched sibling is still the provider's.
	list := castOf(t, c, "/movies/"+itoa(game)+"/cast")
	if len(list.Cast) != 2 || list.Cast[1].Origin != "provider" {
		t.Fatalf("the sibling should be untouched: %+v", list.Cast)
	}
	// The provider_key is KEPT, so the next fetch still matches this row rather
	// than inserting a second one beside it.
	var key string
	if err := srv.Store.DB.QueryRow(`SELECT provider_key FROM work_cast WHERE id = ?`, ids[0]).Scan(&key); err != nil {
		t.Fatal(err)
	}
	if key != store.ProviderKey("Glados", "Ellen McLain") {
		t.Fatalf("provider_key was rewritten by the correction: %q", key)
	}
}

// TWO DIFFERENT DELETES, and which one runs decides whether the next refetch
// undoes the deletion. A provider row is tombstoned so the merge can recognise
// and skip it; a reader-authored row is hard-deleted, because nothing will ever
// re-add it and a tombstone would be litter.
func TestDeletingAProviderRowLeavesATombstoneAndAReaderRowDoesNot(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := createFilm(t, c, "The Matrix", "The Wachowskis")
	seeded := seedProviderCast(t, srv, 1, "movie", film, [2]string{"Neo", "Keanu Reeves"})
	typed := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "The Oracle", "actor": "Gloria Foster"}, http.StatusCreated))

	c.mustDo("DELETE", "/cast/"+itoa(seeded[0]), nil, http.StatusNoContent)
	c.mustDo("DELETE", "/cast/"+itoa(typed.ID), nil, http.StatusNoContent)

	if got := castOf(t, c, "/movies/"+itoa(film)+"/cast").Cast; len(got) != 0 {
		t.Fatalf("both rows should be gone from the list: %+v", got)
	}
	var origin string
	if err := srv.Store.DB.QueryRow(`SELECT origin FROM work_cast WHERE id = ?`, seeded[0]).Scan(&origin); err != nil {
		t.Fatalf("the provider row must survive as a tombstone, or a refetch resurrects it: %v", err)
	}
	if origin != "removed" {
		t.Fatalf("origin = %q, want \"removed\"", origin)
	}
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM work_cast WHERE id = ?`, typed.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("a reader-authored row leaves no tombstone: nothing will ever re-add it")
	}

	// A tombstone is not a row: it cannot be corrected and cannot be deleted twice.
	c.mustDo("PUT", "/cast/"+itoa(seeded[0]),
		map[string]any{"character": "Neo", "actor": "Keanu Reeves"}, http.StatusNotFound)
	c.mustDo("DELETE", "/cast/"+itoa(seeded[0]), nil, http.StatusNotFound)
}

// Typing a deleted pair back REVIVES the tombstone in place rather than
// inserting beside it — keeping the provider_key, so the next fetch goes on
// matching this row instead of adding a second one, and marking it 'corrected',
// because the row is the reader's again.
func TestAddingBackADeletedPairRevivesItsTombstone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := createFilm(t, c, "The Matrix", "The Wachowskis")
	seeded := seedProviderCast(t, srv, 1, "movie", film, [2]string{"Neo", "Keanu Reeves"})
	c.mustDo("DELETE", "/cast/"+itoa(seeded[0]), nil, http.StatusNoContent)

	row := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "neo", "actor": "Keanu Reeves"}, http.StatusCreated))
	if row.ID != seeded[0] {
		t.Fatalf("a second row was inserted (%d) beside the tombstone (%d)", row.ID, seeded[0])
	}
	if row.Origin != "corrected" {
		t.Fatalf("origin = %q, want \"corrected\" — the row is the reader's again", row.Origin)
	}
	if row.Character != "neo" {
		t.Fatalf("the spelling the reader typed should win: %+v", row)
	}
	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT COUNT(*) FROM work_cast WHERE kind = 'movie' AND work_id = ?`, film).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("%d rows on the work — reviving must not leave the tombstone behind as well", n)
	}
}

// Ownership is a security property, not a filter: a foreign work and a foreign
// row are both NOT FOUND, because a 403 confirms the row exists. work_cast has
// no foreign key to books or movies — SQLite cannot point one column at two
// tables — so this check is the only thing stopping a row being attached to
// somebody else's shelf.
func TestAnotherUserCannotSeeOrEditThisWorksCast(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	book := createTestBook(t, alice, "Moby-Dick", "Herman Melville")
	film := createFilm(t, alice, "The Matrix", "The Wachowskis")
	row := decode[castRow](t, alice.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "Neo", "actor": "Keanu Reeves"}, http.StatusCreated))

	for _, tc := range []struct {
		method, path string
		body         any
	}{
		{"GET", "/books/" + itoa(book) + "/cast", nil},
		{"POST", "/books/" + itoa(book) + "/cast", map[string]any{"character": "Ishmael"}},
		{"GET", "/movies/" + itoa(film) + "/cast", nil},
		{"POST", "/movies/" + itoa(film) + "/cast", map[string]any{"character": "Trinity", "actor": "X"}},
		{"PUT", "/cast/" + itoa(row.ID), map[string]any{"character": "Mr Anderson", "actor": "X"}},
		{"DELETE", "/cast/" + itoa(row.ID), nil},
	} {
		bob.mustDo(tc.method, tc.path, tc.body, http.StatusNotFound)
	}

	// Nothing bob did touched it.
	if got := castOf(t, alice, "/movies/"+itoa(film)+"/cast").Cast; len(got) != 1 || got[0].Character != "Neo" {
		t.Fatalf("alice's cast was reachable: %+v", got)
	}
	// And bob's own reply for his own (absent) work is an empty list, not alice's.
	bobFilm := createFilm(t, bob, "The Matrix", "The Wachowskis")
	if got := castOf(t, bob, "/movies/"+itoa(bobFilm)+"/cast").Cast; len(got) != 0 {
		t.Fatalf("bob sees %+v", got)
	}
}

// A film in the bin comes back with its cast, tombstones included. work_cast has
// no foreign key, so nothing walks to it: the table is DECLARED in the snapshot
// list beside work_reads, exactly as 0024's table had to be. Before this, the
// restore would have looked like it worked.
func TestBinningAFilmAndRestoringItBringsBackItsCast(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := createFilm(t, c, "The Matrix", "The Wachowskis")
	seeded := seedProviderCast(t, srv, 1, "movie", film,
		[2]string{"Neo", "Keanu Reeves"}, [2]string{"Trinity", "Carrie-Anne Moss"})
	c.mustDo("PUT", "/cast/"+itoa(seeded[0]),
		map[string]any{"character": "Mr Anderson", "actor": "Keanu Reeves"}, http.StatusOK)
	c.mustDo("DELETE", "/cast/"+itoa(seeded[1]), nil, http.StatusNoContent)

	binned := decode[struct {
		TrashID int64 `json:"trash_id"`
	}](t, c.mustDo("DELETE", "/movies/"+itoa(film), nil, http.StatusOK))
	c.mustDo("POST", "/trash/"+itoa(binned.TrashID)+"/restore", nil, http.StatusOK)

	got := castOf(t, c, "/movies/"+itoa(film)+"/cast").Cast
	if len(got) != 1 || got[0].Character != "Mr Anderson" || got[0].Origin != "corrected" {
		t.Fatalf("the correction did not come back out of the bin: %+v", got)
	}
	// The tombstone came back too, which is what stops the next refetch putting
	// Trinity back after the reader deleted her.
	var removed int
	if err := srv.Store.DB.QueryRow(
		`SELECT COUNT(*) FROM work_cast WHERE kind = 'movie' AND work_id = ? AND origin = 'removed'`,
		film).Scan(&removed); err != nil {
		t.Fatal(err)
	}
	if removed != 1 {
		t.Fatalf("%d tombstones came back, want 1", removed)
	}
}

// A cast row's id is bookkeeping, not identity, and work_cast is deliberately
// NOT on idFloorTables — so SQLite may hand a binned row's id to a cast row
// typed on a different work in the meantime. The restore drops the id rather
// than failing the primary key and rolling back the whole film.
func TestRestoringACastAfterAnUnrelatedRowTookItsId(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := createFilm(t, c, "The Matrix", "The Wachowskis")
	other := createFilm(t, c, "Stalker", "Andrei Tarkovsky")
	binned := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "Neo", "actor": "Keanu Reeves"}, http.StatusCreated))

	bin := decode[struct {
		TrashID int64 `json:"trash_id"`
	}](t, c.mustDo("DELETE", "/movies/"+itoa(film), nil, http.StatusOK))
	// SQLite reuses a rowid freed by a DELETE, so this row lands on the id the
	// binned one had.
	taker := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(other)+"/cast",
		map[string]any{"character": "Stalker", "actor": "Aleksandr Kaidanovsky"}, http.StatusCreated))
	if taker.ID != binned.ID {
		t.Skipf("SQLite did not reissue the id (%d vs %d); the collision this guards is not reachable here",
			taker.ID, binned.ID)
	}
	c.mustDo("POST", "/trash/"+itoa(bin.TrashID)+"/restore", nil, http.StatusOK)

	if got := castOf(t, c, "/movies/"+itoa(film)+"/cast").Cast; len(got) != 1 || got[0].Character != "Neo" {
		t.Fatalf("the restored film lost its cast to an id collision: %+v", got)
	}
	if got := castOf(t, c, "/movies/"+itoa(other)+"/cast").Cast; len(got) != 1 || got[0].Character != "Stalker" {
		t.Fatalf("the row that took the id was disturbed: %+v", got)
	}
}

func longName(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = 'a'
	}
	return string(b)
}

// THE CAP HOLDS ON THE REVIVE PATH TOO, which is the one way past it that does
// not go through the INSERT.
//
// Adding back a deleted pair updates a tombstone in place rather than inserting
// beside it, and that branch used to return before reaching the count the insert
// path runs twenty lines below it. So a full list could be walked upwards one pair
// at a time — delete a credit, type it straight back, and the live list is 201.
// The cap exists so that one work's cast is a screen's worth of rows rather than a
// paging problem, and a bound with a door in it is not a bound.
func TestRevivingATombstoneStillAnswersToTheCap(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := createFilm(t, c, "Ensemble", "Somebody")
	pairs := make([][2]string, maxWorkCast)
	for i := range pairs {
		pairs[i] = [2]string{"Extra " + itoa(int64(i)), "Player " + itoa(int64(i))}
	}
	seeded := seedProviderCast(t, srv, 1, "movie", film, pairs...)

	// One credit deleted, which leaves the live list one under the cap and a
	// tombstone beside it — and the tombstone is not counted, correctly, because it
	// is not on the list being capped.
	c.mustDo("DELETE", "/cast/"+itoa(seeded[0]), nil, http.StatusNoContent)
	// The freed place is spent on something else, which is the reader's to spend.
	c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "One More", "actor": "Nobody"}, http.StatusCreated)

	// And now the deleted pair is typed back. There is no room for it: the answer is
	// the same refusal the insert path gives, not a 201 and a list of 201.
	c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": pairs[0][0], "actor": pairs[0][1]}, http.StatusBadRequest)

	var live int
	if err := srv.Store.DB.QueryRow(
		`SELECT COUNT(*) FROM work_cast WHERE kind = 'movie' AND work_id = ? AND origin <> 'removed'`,
		film).Scan(&live); err != nil {
		t.Fatal(err)
	}
	if live != maxWorkCast {
		t.Fatalf("%d live rows, want %d — reviving a tombstone put the list past its cap", live, maxWorkCast)
	}
}

// A QUERY FAILURE IS NOT "NO SUCH PAIR", and castPairTaken has to say which it
// means. It used to collapse every error into found=false, so a read that failed
// sent handleAddCast on to its INSERT — which then hit idx_work_cast_provider or
// idx_work_cast_pair and surfaced as a raw unique-index 500, on a request whose
// real answer was the 409 "already on this list". Two tabs adding at once is the
// way in: tx.QueryRow can come back SQLITE_BUSY, and a busy database is not an
// empty one.
//
// The failure is injected by taking the table away INSIDE the transaction, which
// is the only deterministic way to make one statement on a real SQLite file fail
// while the test still owns the database — newTestServer gives each test its own.
func TestCastPairTakenTellsAFailedReadFromAnEmptyOne(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := createFilm(t, c, "The Matrix", "The Wachowskis")
	seedProviderCast(t, srv, 1, "movie", film, [2]string{"Neo", "Keanu Reeves"})

	tx, err := srv.Store.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	// The pair is there: found, and no error.
	id, origin, found, err := castPairTaken(tx, 1, "movie", film,
		store.CastKey("neo"), store.CastKey("Keanu Reeves"), 0)
	if err != nil || !found || id == 0 || origin != castProvider {
		t.Fatalf("the seeded pair should be found cleanly: id=%d origin=%q found=%v err=%v",
			id, origin, found, err)
	}

	// A pair nobody has: NOT found, and still no error. This is the only "no" there
	// is, and it is the one the caller may act on.
	if _, _, found, err = castPairTaken(tx, 1, "movie", film,
		store.CastKey("Trinity"), store.CastKey("Carrie-Anne Moss"), 0); found || err != nil {
		t.Fatalf("an absent pair should read as a clean no: found=%v err=%v", found, err)
	}

	if _, err := tx.Exec(`DROP TABLE work_cast`); err != nil {
		t.Fatal(err)
	}
	_, _, found, err = castPairTaken(tx, 1, "movie", film,
		store.CastKey("neo"), store.CastKey("Keanu Reeves"), 0)
	if err == nil {
		t.Fatal("a query that could not run reported no error — the add path then " +
			"treats a failed check as an empty list and lets the INSERT raise the " +
			"unique-index violation instead of the 409 it means")
	}
	if found {
		t.Fatalf("a failed read must not claim to have found a row: found=%v", found)
	}
}

// The tile chooser, the counts, and the four fields 0063 put on the wire.

// whosChar is the wire shape of one cast row in the chooser. Named rather than
// written out per literal: the response type and the by-name index below both
// need it, and three copies of an anonymous struct are three places for the
// field set to drift apart.
type whosChar struct {
	CastID int64 `json:"cast_id"`
	// The RECORD behind the row, which is not the row: a work may bill one
	// character twice. Read by identity_counts_test.go, which needs the record a
	// billing resolved to in order to ask the character sheet about it.
	CharacterID int64  `json:"character_id"`
	Name        string `json:"name"`
	Quotes      int    `json:"quotes"`
	Favourites  int    `json:"favourites"`
}

type whosResp struct {
	Work struct {
		Kind      string `json:"kind"`
		ID        int64  `json:"id"`
		Title     string `json:"title"`
		MediaType string `json:"media_type"`
	} `json:"work"`
	Characters []whosChar `json:"characters"`
	People     []struct {
		ID    int64  `json:"id"`
		Name  string `json:"name"`
		Roles string `json:"roles"`
	} `json:"people"`
}

func charsByName(r whosResp) map[string]whosChar {
	out := map[string]whosChar{}
	for _, c := range r.Characters {
		out[c.Name] = c
	}
	return out
}

// A TILE OPENS EVERY CHARACTER IN THE WORK, not the one whose screen you came
// from — the owner's ruling. The prototype lists only the character on the path,
// which makes one cover behave differently depending on where it was pressed.
func TestATileListsEveryCharacterAndEveryoneCredited(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie", "director": "David Yates"},
		http.StatusCreated))
	for _, pair := range [][2]string{{"Harry", "Daniel Radcliffe"}, {"Ron", "Rupert Grint"}} {
		c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
			map[string]any{"character": pair[0], "actor": pair[1]}, http.StatusCreated)
	}

	got := decode[whosResp](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/whos-in-it", nil, http.StatusOK))
	if got.Work.Title != "Part 2" || got.Work.Kind != "movie" {
		t.Fatalf("work: %+v", got.Work)
	}
	if len(got.Characters) != 2 {
		t.Fatalf("characters: %+v", got.Characters)
	}
	names := map[string]bool{}
	for _, ch := range got.Characters {
		names[ch.Name] = true
		if ch.CastID == 0 {
			// The row and not the record: a work may bill one character twice, so
			// the cast id is what names a local screen.
			t.Fatalf("a character came back with no cast row: %+v", ch)
		}
	}
	if !names["Harry"] || !names["Ron"] {
		t.Fatalf("characters are %v", names)
	}
	// AND EVERYBODY CREDITED, in any role — the two performers and the director,
	// which is the half `work_person` holds rather than `work_cast`.
	people := map[string]string{}
	for _, p := range got.People {
		people[p.Name] = p.Roles
	}
	for _, want := range []string{"Daniel Radcliffe", "Rupert Grint", "David Yates"} {
		if _, ok := people[want]; !ok {
			t.Fatalf("%q is not among the credited: %+v", want, people)
		}
	}
}

// THE SECOND COUNT IS HOW MANY OF THOSE LINES THE READER FAVOURITED — the
// owner's ruling, replacing a count of distinct locators that could only ever
// read one on a library where nobody fills timestamps. So the fixture gives one
// character four lines and favourites two of them, and the pair is 4 and 2: a
// figure derived from the reader's own marks moves when they mark something,
// which is the whole property the number it replaced did not have.
func TestTheCountsAreThisCharactersQuotesAndTheirFavourites(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))
	cast := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
		map[string]any{"character": "Harry", "actor": "Daniel Radcliffe"}, http.StatusCreated))

	// Four lines, the first two favourited. Each quote text is distinct because a
	// dialogue's dedupe hash is over the WORDS — two identical lines in one film
	// are one line, which is right and is not what this fixture is testing.
	for i, fav := range []bool{true, true, false, false} {
		c.mustDo("POST", "/dialogues", map[string]any{
			"movie_id": m.ID, "quote": "line " + itoa(int64(i)),
			"character": "Harry", "speaker_cast_id": cast.ID, "favorite": fav,
		}, http.StatusCreated)
	}

	got := decode[whosResp](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/whos-in-it", nil, http.StatusOK))
	harry := charsByName(got)["Harry"]
	if harry.Quotes != 4 {
		t.Fatalf("quotes = %d, want 4: %+v", harry.Quotes, harry)
	}
	if harry.Favourites != 2 {
		t.Fatalf("favourites = %d, want 2 of the 4: %+v", harry.Favourites, harry)
	}
	// AND THE TWO ARE NOT THE SAME NUMBER, which is what the box exists to show.
	// A second figure that tracked the first would be decoration.
	if harry.Favourites == harry.Quotes {
		t.Fatalf("both counts read %d — the pair says nothing", harry.Quotes)
	}
}

// ANOTHER READER'S WORK IS NOT FOUND, never forbidden — a 403 would confirm the
// row exists.
func TestWhosInItRefusesAnotherReadersWork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))
	bob := addUser(t, h, c, "bob")
	bob.mustDo("GET", "/movies/"+itoa(m.ID)+"/whos-in-it", nil, http.StatusNotFound)
}

// A work's links out — 0062.
//
// A person has had a `links` column since the person panel learned to fetch
// reference pages and a character gained one in 0057. The thing a reader is most
// likely to want to open somewhere else — the work — had none, so a Goodreads
// page lived in the note on one of its quotes.

type linked struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
	Links string `json:"links"`
}

const twoLinks = "https://www.imdb.com/title/tt0084787/ https://example.org/a-review"

func TestABookKeepsItsLinks(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[linked](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Thing", "links": twoLinks,
	}, http.StatusCreated))
	if made.Links != twoLinks {
		t.Fatalf("create: %q", made.Links)
	}
	got := decode[linked](t, c.mustDo("GET", "/books/"+itoa(made.ID), nil, http.StatusOK))
	if got.Links != twoLinks {
		t.Fatalf("fetch: %q", got.Links)
	}
	// Full-state: a body that names no links clears them, like every other column
	// on this PUT.
	cleared := decode[linked](t, c.mustDo("PUT", "/books/"+itoa(made.ID),
		map[string]any{"title": "The Thing"}, http.StatusOK))
	if cleared.Links != "" {
		t.Fatalf("a full-state PUT left %q", cleared.Links)
	}
	c.mustDo("POST", "/books", map[string]any{
		"title": "Too Many", "links": strings.Repeat("https://example.org/x ", 400),
	}, http.StatusBadRequest)
}

func TestLinksRoundTripThroughTheExportAndTheQueue(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[linked](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Master and Margarita", "author": "Mikhail Bulgakov", "links": twoLinks,
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": made.ID, "quote": "Manuscripts don't burn",
	}, http.StatusCreated)

	md := c.mustDo("GET", "/books/"+itoa(made.ID)+"/export?format=md", nil, http.StatusOK).Body.String()
	// ONE LINE. The column is whitespace-separated already and a frontmatter value
	// is one line, so the export re-joins rather than inventing a list syntax.
	if !strings.Contains(md, "links: https://www.imdb.com/title/tt0084787/ https://example.org/a-review") {
		t.Fatalf("the export did not carry the links:\n%s", md)
	}

	c2 := signupAdmin(t, newTestServer(t).Handler())
	res := stage(t, c2, "/import/markdown", "mm.md", []byte(md))
	c2.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, http.StatusOK)
	list := decode[struct {
		Books []linked `json:"books"`
	}](t, c2.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 {
		t.Fatalf("the import made %d books", len(list.Books))
	}
	back := decode[linked](t, c2.mustDo("GET", "/books/"+itoa(list.Books[0].ID), nil, http.StatusOK))
	if back.Links != twoLinks {
		t.Fatalf("the round trip lost the links: %q", back.Links)
	}
}

// A GAME'S PUBLISHER WAS BEING LOST IN THE QUEUE, and had been since staging and
// 0042 met: the Markdown parser read it, the movies column existed, and the
// staged_works row between them had no slot for it — so importing a catalogue
// export dropped it in silence, with a successful import and matching counts.
// 0062's links would have landed in the identical hole.
func TestACatalogueImportKeepsThePublisherAndTheLinks(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	md := "---\ntitle: Disco Elysium\ntype: game\nyear: 2019\ndirector: ZA/UM\n" +
		"publisher: ZA/UM Studio\nlinks: https://www.igdb.com/games/disco-elysium\n---\n\n" +
		"> The world is a mess.\n- character: Kim Kitsuragi\n"
	res := stage(t, c, "/import/markdown", "game.md", []byte(md))
	c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, http.StatusOK)

	list := decode[struct {
		Movies []struct {
			ID        int64  `json:"id"`
			Title     string `json:"title"`
			Publisher string `json:"publisher"`
		} `json:"movies"`
	}](t, c.mustDo("GET", "/movies", nil, http.StatusOK))
	if len(list.Movies) != 1 {
		t.Fatalf("the import made %d titles", len(list.Movies))
	}
	got := decode[struct {
		Publisher string `json:"publisher"`
		Links     string `json:"links"`
	}](t, c.mustDo("GET", "/movies/"+itoa(list.Movies[0].ID), nil, http.StatusOK))
	if got.Publisher != "ZA/UM Studio" {
		t.Fatalf("the queue lost the publisher: %q", got.Publisher)
	}
	if got.Links != "https://www.igdb.com/games/disco-elysium" {
		t.Fatalf("the queue lost the links: %q", got.Links)
	}
}
