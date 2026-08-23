package httpapi

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// THE MERGE RULE, end to end (0048).
//
// A refetch may add credits the provider has started listing and may rewrite the
// ones nobody has touched. It must not change or remove a row the reader has
// corrected, typed or deleted. Before this commit no fetch path went near
// work_cast at all — a re-sync replaced `movies.cast_json` whole and the mapping
// sat where the migration's backfill had left it — so every test below fails on
// the half that proves the refetch REACHED the table, which is the half that
// makes "and it left my row alone" mean anything.

// castStub is a fake TMDB whose credits list is whatever the test last put in
// it. Swapping `cast` and re-syncing IS a refetch, and it is the only way to
// exercise a merge rule end to end: two different answers from one provider
// about one film.
type castStub struct{ cast string }

func newCastTMDB(t *testing.T, stub *castStub) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search/movie":
			_, _ = fmt.Fprint(w, `{"results":[{"id":603,"title":"Portal 2","release_date":"2011-04-19"}]}`)
		case "/movie/603":
			_, _ = fmt.Fprintf(w, `{"id":603,"title":"Portal 2","overview":"A test.","release_date":"2011-04-19",
				"genres":[{"name":"Action"}],
				"credits":{"cast":%s,"crew":[{"job":"Director","name":"Erik Wolpaw"}]}}`, stub.cast)
		default:
			http.NotFound(w, r)
		}
	}))
}

// castTMDBServer wires a server to a swappable fake TMDB and signs the admin in.
func castTMDBServer(t *testing.T, stub *castStub) (*Server, *testClient, func()) {
	t.Helper()
	srv := newTestServer(t)
	fake := newCastTMDB(t, stub)
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	c := signupAdmin(t, srv.Handler())
	return srv, c, fake.Close
}

// addFromTMDB creates the stub's film from its supplier id, which is the seed
// path: mergeProviderCast runs inside the insert's transaction.
func addFromTMDB(t *testing.T, c *testClient) movieDetail {
	t.Helper()
	return decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"tmdb_id": 603}, http.StatusCreated))
}

// resyncFromTMDB re-fetches the same supplier id — the refetch.
func resyncFromTMDB(t *testing.T, c *testClient, id int64) {
	t.Helper()
	c.mustDo("PUT", "/movies/"+itoa(id), map[string]any{"source": "tmdb", "source_id": "603"}, http.StatusOK)
}

// castRowFor finds a row by the character it currently names.
func castRowFor(t *testing.T, c *testClient, movieID int64, character string) castRow {
	t.Helper()
	for _, row := range castOf(t, c, "/movies/"+itoa(movieID)+"/cast").Cast {
		if row.Character == character {
			return row
		}
	}
	t.Fatalf("no cast row named %q on movie %d", character, movieID)
	return castRow{}
}

// A SEED IS A MERGE WITH NOTHING TO PROTECT, and it goes through the same
// function as a refetch so there is exactly one implementation of the rule.
//
// The last third of this test is the one that pins "no frontend work": the film
// page's `cast` field now comes from work_cast and the blob it used to come from
// is still written and read by nothing on this path.
func TestCreatingAFilmFromASourceSeedsTheMapping(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain","profile_path":"/e.jpg"},
	                         {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	if len(m.Cast) != 2 || m.Cast[0].Actor != "Ellen McLain" || m.Cast[1].Character != "Wheatley" {
		t.Fatalf("the create reply should carry the seeded cast in billing order: %+v", m.Cast)
	}
	if m.Cast[0].PersonID != "6384" || m.Cast[0].ImageURL == "" {
		t.Fatalf("the provider's own facts must ride along for the portrait pipeline: %+v", m.Cast[0])
	}

	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 2 {
		t.Fatalf("the mapping should hold both credits: %+v", list.Cast)
	}
	for i, row := range list.Cast {
		if row.Origin != "provider" {
			t.Fatalf("row %d origin = %q, want \"provider\" — a fetch seeded it", i, row.Origin)
		}
		if row.Source != "tmdb" {
			t.Fatalf("row %d source = %q, want \"tmdb\"", i, row.Source)
		}
		if row.Billing != i {
			t.Fatalf("row %d billing = %d — billing is the provider's own order", i, row.Billing)
		}
	}

	// The superseded blob is STILL WRITTEN — kept for one release because dropping
	// a column is the one migration step nobody can walk back by hand (0036/0037).
	var blob string
	if err := srv.Store.DB.QueryRow(`SELECT cast_json FROM movies WHERE id = ?`, m.ID).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if blob == "" || blob == "[]" {
		t.Fatalf("cast_json must go on being written for one more release: %q", blob)
	}
	// AND READ BY NOTHING. Empty it by hand and the film page, the cast list and
	// the quote form's auto-fill are all unchanged — which is what makes the whole
	// feature land without touching a single frontend file.
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET cast_json = '[]' WHERE id = ?`, m.ID); err != nil {
		t.Fatal(err)
	}
	again := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(m.ID), nil, http.StatusOK))
	if len(again.Cast) != 2 || again.Cast[0].Actor != "Ellen McLain" {
		t.Fatalf("the film page reads the mapping, not the blob: %+v", again.Cast)
	}
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "The cake is a lie.", "character": "GLaDOS",
	}, http.StatusCreated))
	if d.Actor != "Ellen McLain" {
		t.Fatalf("the auto-fill reads the mapping, not the blob: %+v", d)
	}
}

// (a) A PROVIDER ROW THE READER EDITED. The refetch takes the provider's facts
// and leaves both names exactly where the reader put them — for ever, which is
// the cost 0048's header states out loud: a name fixed wrongly stays wrong even
// after the provider agrees with the truth.
//
// The Wheatley half is what makes the GLaDOS half a real assertion. Both entries
// change their spelling in the second fetch; one is the reader's row and keeps
// the reader's spelling, the other is untouched and takes the provider's. Before
// this commit neither moved, because no fetch path went near the table.
func TestARefetchLeavesACorrectedNameAloneAndUpdatesTheUntouchedOnes(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"Glados","name":"Ellen McLain"},
	                         {"id":7,"character":"wheatley","name":"Stephen Merchant"}]`}
	_, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	glados := castRowFor(t, c, m.ID, "Glados")

	// The reader fixes the provider's capitalisation their own way.
	fixed := decode[castRow](t, c.mustDo("PUT", "/cast/"+itoa(glados.ID), map[string]any{
		"character": "GLaDOS", "actor": "Ellen McLain",
	}, http.StatusOK))
	if fixed.Origin != "corrected" {
		t.Fatalf("editing a provider row must mark it: origin = %q", fixed.Origin)
	}

	// The provider comes back with a different answer on BOTH rows, and this time
	// carries a headshot for GLaDOS that the first fetch did not have.
	stub.cast = `[{"id":6384,"character":"GLADOS","name":"Ellen McLain","profile_path":"/e.jpg"},
	              {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`
	resyncFromTMDB(t, c, m.ID)

	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 2 {
		t.Fatalf("the refetch changed the size of the list: %+v", list.Cast)
	}
	kept := castRowFor(t, c, m.ID, "GLaDOS")
	if kept.ID != glados.ID {
		t.Fatalf("the corrected row was replaced rather than kept: %d -> %d", glados.ID, kept.ID)
	}
	if kept.Origin != "corrected" {
		t.Fatalf("origin = %q — a corrected row stays corrected however often it is refetched", kept.Origin)
	}
	// The rule protects the two NAMES and nothing else: billing, person_id,
	// image_url and source are the provider's facts and a refetch takes them back
	// on every row, whoever has touched it.
	if kept.ImageURL == "" {
		t.Fatalf("a corrected row must still take the provider's own facts: %+v", kept)
	}
	// And the untouched sibling DID move: castRowFor fails unless a row is now
	// called "Wheatley", which is the proof the merge ran at all rather than the
	// corrected row surviving because nothing came near it.
	sibling := castRowFor(t, c, m.ID, "Wheatley")
	if sibling.Origin != "provider" {
		t.Fatalf("the untouched row should still be the provider's: %+v", sibling)
	}
}

// A refetch ADDS. The provider starts billing somebody it had left out, and the
// new row arrives as the provider's own, in the provider's order.
func TestARefetchAddsARowTheProviderHasStartedListing(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`}
	_, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	if got := len(castOf(t, c, "/movies/"+itoa(m.ID)+"/cast").Cast); got != 1 {
		t.Fatalf("seeded %d rows, want 1", got)
	}

	stub.cast = `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	              {"id":7,"character":"Wheatley","name":"Stephen Merchant","profile_path":"/s.jpg"}]`
	resyncFromTMDB(t, c, m.ID)

	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 2 {
		t.Fatalf("the new credit did not arrive: %+v", list.Cast)
	}
	added := list.Cast[1]
	if added.Character != "Wheatley" || added.Origin != "provider" || added.Billing != 1 ||
		added.PersonID != "7" || added.ImageURL == "" {
		t.Fatalf("the added row should be the provider's, in its own order, with its facts: %+v", added)
	}
}

// (c) A READER-AUTHORED ROW IS UNTOUCHED BY A REFETCH THAT DOES NOT MENTION IT.
// This is the case the whole feature exists for — a game's voice actor nobody
// publishes — tested on a film because a film is the only medium a refetch can
// reach.
//
// THE ROW HERE IS ONE THE PROVIDER HAS NEVER LISTED, so it has no provider_key and
// the merge's stored query genuinely does not see it. That is what this test
// covers and it is NOT the general protection, which is what the comment here used
// to claim: the moment the provider does list the pair, adoptCastRow gives the row
// a key and it is in the merge's set like any other. The origin checks are what
// hold from then on, and cast_protection_test.go is where they are pinned.
func TestAReaderAuthoredRowSurvivesARefetchThatDoesNotMentionIt(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`}
	_, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	mine := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{
		"character": "Announcer", "actor": "Mike Patton",
	}, http.StatusCreated))
	if mine.Origin != "reader" {
		t.Fatalf("origin = %q, want \"reader\"", mine.Origin)
	}

	// Two refetches, because "survives one fetch" and "survives" are different
	// claims and only the second one is the promise.
	resyncFromTMDB(t, c, m.ID)
	stub.cast = `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	              {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`
	resyncFromTMDB(t, c, m.ID)

	kept := castRowFor(t, c, m.ID, "Announcer")
	if kept.ID != mine.ID || kept.Actor != "Mike Patton" || kept.Origin != "reader" {
		t.Fatalf("a hand-typed credit must be untouchable: %+v", kept)
	}
}

// (b) A PROVIDER ROW THE READER DELETED IS NOT HANDED BACK. The delete leaves a
// tombstone precisely so the next fetch can recognise the pair and decline it;
// without one, every refetch would silently undo the deletion for ever.
func TestARemovedCastRowIsNotResurrectedByARefetch(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	                          {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	gone := castRowFor(t, c, m.ID, "Wheatley")
	c.mustDo("DELETE", "/cast/"+itoa(gone.ID), nil, http.StatusNoContent)

	resyncFromTMDB(t, c, m.ID)

	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 1 || list.Cast[0].Character != "GLaDOS" {
		t.Fatalf("the deleted credit came back: %+v", list.Cast)
	}
	// It is still on disk, as a tombstone — that is what did the declining, and
	// deleting it would be exactly how a deletion comes undone.
	var origin string
	if err := srv.Store.DB.QueryRow(`SELECT origin FROM work_cast WHERE id = ?`, gone.ID).Scan(&origin); err != nil {
		t.Fatalf("the tombstone must survive the refetch that read it: %v", err)
	}
	if origin != "removed" {
		t.Fatalf("origin = %q, want \"removed\"", origin)
	}
	// AND THE READER CAN STILL HAVE IT BACK, knowingly: typing the pair in again
	// revives the tombstone in place rather than colliding with it.
	back := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{
		"character": "Wheatley", "actor": "Stephen Merchant",
	}, http.StatusCreated))
	if back.ID != gone.ID || back.Origin != "corrected" {
		t.Fatalf("adding the pair back should revive that row: %+v", back)
	}
	// And now that it is the reader's again, the next refetch leaves it alone.
	resyncFromTMDB(t, c, m.ID)
	if row := castRowFor(t, c, m.ID, "Wheatley"); row.Origin != "corrected" {
		t.Fatalf("a revived row is the reader's: %+v", row)
	}
}

// ADOPTION. The reader types a credit the provider has not published yet and the
// provider catches up. Without this the insert would hit the pair UNIQUE and fail
// the entire refetch — a 500 on "look up again" because somebody had already got
// a name right by hand.
//
// The row stays THEIRS: it keeps its origin, so the next fetch may not rewrite the
// names on it either. What it gains is the provider's facts and the key that links
// it to the listing, so it is re-matched rather than duplicated next time.
func TestAdoptingAReaderRowTheProviderLaterAgreesWith(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	// Typed in the reader's own casing, which folds to the same pair the provider
	// will send.
	mine := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{
		"character": "wheatley", "actor": "stephen merchant",
	}, http.StatusCreated))

	stub.cast = `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	              {"id":7,"character":"Wheatley","name":"Stephen Merchant","profile_path":"/s.jpg"}]`
	resyncFromTMDB(t, c, m.ID)

	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 2 {
		t.Fatalf("the provider's entry should have been claimed, not duplicated: %+v", list.Cast)
	}
	adopted := castRowFor(t, c, m.ID, "wheatley")
	if adopted.ID != mine.ID {
		t.Fatalf("a second row was inserted beside the reader's: %d vs %d", adopted.ID, mine.ID)
	}
	if adopted.Origin != "reader" {
		t.Fatalf("origin = %q — claiming the row must not take it off the reader", adopted.Origin)
	}
	if adopted.PersonID != "7" || adopted.ImageURL == "" {
		t.Fatalf("the row should have gained the provider's facts: %+v", adopted)
	}
	var providerKey string
	if err := srv.Store.DB.QueryRow(
		`SELECT provider_key FROM work_cast WHERE id = ?`, mine.ID).Scan(&providerKey); err != nil {
		t.Fatal(err)
	}
	if providerKey == "" {
		t.Fatal("the adopted row must carry the provider key, or the next fetch duplicates it")
	}
	// Which the next fetch proves: still two rows, still the reader's spelling.
	resyncFromTMDB(t, c, m.ID)
	if list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast"); len(list.Cast) != 2 {
		t.Fatalf("the second refetch duplicated the adopted row: %+v", list.Cast)
	}
	if row := castRowFor(t, c, m.ID, "wheatley"); row.Origin != "reader" {
		t.Fatalf("the adopted row lost its provenance: %+v", row)
	}
}

// A provider RETRACTING one of its own rows takes it away, because an untouched
// provider row has no other author to answer to. This is the half of the rule
// that is not a protection, and it is what keeps a mis-credited person from
// living in the list for ever after the provider has removed them.
func TestAProviderRetractingItsOwnRowDropsIt(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	                          {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`}
	_, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	stub.cast = `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`
	resyncFromTMDB(t, c, m.ID)

	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 1 || list.Cast[0].Character != "GLaDOS" {
		t.Fatalf("a retracted provider row should go: %+v", list.Cast)
	}
}

// AN EMPTY LIST IS NOT A RETRACTION, and this is the one place the merge is
// deliberately more careful than the blob it replaces — which wrote '[]' and
// erased the lot.
//
// It matters because this app HAS a cast lookup that comes back empty as a matter
// of course: a game's voice credits are a second, best-effort Wikidata request
// that is allowed to fail so a failure there cannot fail the whole fetch. A
// provider that lists nobody is indistinguishable from a request that never
// asked, and a title genuinely losing its entire cast does not happen.
func TestAnEmptyProviderListIsNotARetraction(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	                          {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	stub.cast = `[]`
	resyncFromTMDB(t, c, m.ID)

	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 2 {
		t.Fatalf("a fetch that returned no cast must not empty the list: %+v", list.Cast)
	}
	// The blob, by contrast, is erased — exactly as it always was. It is written
	// for one more release and read by nothing, so this is not a behaviour change,
	// it is the behaviour being retired.
	var blob string
	if err := srv.Store.DB.QueryRow(`SELECT cast_json FROM movies WHERE id = ?`, m.ID).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if blob != "[]" {
		t.Fatalf("cast_json = %q — the superseded blob keeps its old behaviour", blob)
	}
}

// THE BUG THE FEATURE EXISTS FOR, now closed at the other end. A game's voice
// cast comes from Wikidata joined on the IGDB slug and for most games that lookup
// finds nothing at all (TIP-META-018: 14 of 24 measured titles), so the blob was
// '[]' and the auto-fill derived NOTHING for a game, every time, for ever. Name
// the voice actor once and every line that character speaks takes it.
func TestAGameLineTakesTheVoiceActorFromTheMapping(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	game := createGame(t, c, "Disco Elysium", "ZA/UM")
	// The normal state of a game: nothing was ever seeded.
	var blob string
	if err := srv.Store.DB.QueryRow(`SELECT cast_json FROM movies WHERE id = ?`, game).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if blob != "[]" {
		t.Fatalf("fixture is wrong — the game already has a cast blob: %s", blob)
	}
	// A line captured before anybody said who speaks it: no actor, and until this
	// commit there was nowhere the answer could ever have come from.
	before := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game, "quote": "It is a shithole.", "character": "Kim Kitsuragi",
	}, http.StatusCreated))
	if before.Actor != "" {
		t.Fatalf("nothing should have filled this yet: %+v", before)
	}

	c.mustDo("POST", "/movies/"+itoa(game)+"/cast", map[string]any{
		"character": "Kim Kitsuragi", "actor": "Jullian Champenois",
	}, http.StatusCreated)

	// The next line takes it on the way in.
	after := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game, "quote": "Detective, please.", "character": "  kim kitsuragi ",
	}, http.StatusCreated))
	if after.Actor != "Jullian Champenois" {
		t.Fatalf("the voice actor did not fill from the mapping: %+v", after)
	}
	// And a line already on the record is filled by the refill, which the remap
	// endpoint is the deliberate way to ask for.
	res := decode[remapResp](t, c.mustDo("POST", "/movies/"+itoa(game)+"/remap-speakers", map[string]any{
		"mappings": []map[string]any{}, "refill": true,
	}, http.StatusOK))
	if res.Refilled != 1 {
		t.Fatalf("refilled = %d, want 1 — the earlier line should fill from the mapping too", res.Refilled)
	}

	// A READER-TYPED ACTOR IS STILL NEVER OVERWRITTEN. The mapping fills a gap; it
	// does not adjudicate an answer.
	mine := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game, "quote": "Sorry about that.", "character": "Kim Kitsuragi",
		"actor": "Somebody Else",
	}, http.StatusCreated))
	if mine.Actor != "Somebody Else" {
		t.Fatalf("a typed actor must win: %+v", mine)
	}
}

// /metadata/fill's whole job is filling in what is missing, and until 0048 a cast
// was the one gap it could not see: []metadata.CastMember fell through
// missingStored's `default: return false`, so an unattended fill would never seed
// a cast onto a title that had none. Nothing covered it, because nothing had a
// reason to look.
func TestFillingTheGapsSeedsAnEmptyCast(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	// A title with a pinned identity and no cast — an IMDb import's leftovers, or
	// any row added before its supplier was configured.
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Portal 2"}, http.StatusCreated))
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET tmdb_id = 603 WHERE id = ?`, m.ID); err != nil {
		t.Fatal(err)
	}
	if got := len(castOf(t, c, "/movies/"+itoa(m.ID)+"/cast").Cast); got != 0 {
		t.Fatalf("fixture should start with no cast, has %d", got)
	}

	res := decode[struct {
		Results []struct {
			Status string   `json:"status"`
			Filled []string `json:"filled"`
		} `json:"results"`
	}](t, c.mustDo("POST", "/metadata/fill", map[string]any{"movie_ids": []int64{m.ID}}, http.StatusOK))
	if len(res.Results) != 1 || res.Results[0].Status != "ok" {
		t.Fatalf("fill: %+v", res.Results)
	}
	var sawCast bool
	for _, f := range res.Results[0].Filled {
		if f == "cast" {
			sawCast = true
		}
	}
	if !sawCast {
		t.Fatalf("a cast is a gap like any other: %+v", res.Results[0].Filled)
	}
	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 1 || list.Cast[0].Actor != "Ellen McLain" || list.Cast[0].Origin != "provider" {
		t.Fatalf("the fill should have seeded the mapping: %+v", list.Cast)
	}
	// And the empty blob is filled, which is the half of cast_json's conditional
	// write that is not about protecting the pre-0048 copy: there was none here, and
	// the column's last reader — the quiz's speaker distractors — still wants a list.
	var blob string
	if err := srv.Store.DB.QueryRow(`SELECT COALESCE(cast_json,'') FROM movies WHERE id = ?`,
		m.ID).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(blob, "Ellen McLain") {
		t.Fatalf("a title with no blob has nothing to protect: %q", blob)
	}
}

// The merge rule on the third provider write path: an APPROVED re-verify diff is
// still a refetch, so it may not rewrite a name the reader corrected. Approving
// it takes the provider's facts and leaves the names — which is also why
// approving a cast diff does not necessarily silence it.
func TestApplyingAReverifiedCastRespectsACorrection(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"Glados","name":"Ellen McLain"},
	                          {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	glados := castRowFor(t, c, m.ID, "Glados")
	c.mustDo("PUT", "/cast/"+itoa(glados.ID), map[string]any{
		"character": "GLaDOS", "actor": "Ellen McLain",
	}, http.StatusOK)

	// The provider now disagrees with both rows and bills a third person.
	stub.cast = `[{"id":6384,"character":"GLADOS","name":"Ellen McLain","profile_path":"/e.jpg"},
	              {"id":7,"character":"Wheatley","name":"Stephen Merchant"},
	              {"id":9,"character":"Cave Johnson","name":"J.K. Simmons"}]`

	prev := decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"movie_ids": []int64{m.ID}}, http.StatusOK))
	if len(prev.Items) != 1 || !diffFields(t, prev, 0)["cast"] {
		t.Fatalf("the fresh cast should be offered as a diff: %+v", prev.Items)
	}
	// Approve the cast and nothing else, in the shape the console sends: the
	// approved VALUE, not a field name — which is why applyReverifyMovie has to
	// guess the supplier (castSourceForWork) rather than being told it.
	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{"type": "movie", "id": m.ID, "set": map[string]any{
			"cast": []map[string]any{
				{"character": "GLADOS", "actor": "Ellen McLain", "person_id": "6384", "image_url": "https://img/e.jpg"},
				{"character": "Wheatley", "actor": "Stephen Merchant", "person_id": "7"},
				{"character": "Cave Johnson", "actor": "J.K. Simmons", "person_id": "9"},
			},
		}}},
	}, http.StatusOK)

	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 3 {
		t.Fatalf("the approved cast should have added the third credit: %+v", list.Cast)
	}
	kept := castRowFor(t, c, m.ID, "GLaDOS")
	if kept.ID != glados.ID || kept.Origin != "corrected" {
		t.Fatalf("an approved apply must not take the corrected row: %+v", kept)
	}
	if kept.ImageURL == "" {
		t.Fatalf("it should still have taken the provider's facts: %+v", kept)
	}
	if row := castRowFor(t, c, m.ID, "Cave Johnson"); row.Origin != "provider" || row.Billing != 2 {
		t.Fatalf("the added row should be the provider's, in its order: %+v", row)
	}
	// The superseded blob is NOT rewritten by this path — it is the pre-0048 copy,
	// and this path is also the unattended bulk fill's writer. It still holds the
	// seed's spelling and knows nothing about the credit just approved.
	var blob string
	if err := srv.Store.DB.QueryRow(`SELECT cast_json FROM movies WHERE id = ?`, m.ID).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(blob, `"Glados"`) || strings.Contains(blob, "Cave Johnson") {
		t.Fatalf("cast_json = %q — the frozen copy must survive an approved cast", blob)
	}
}

// The import path fills from the mapping too, which is the fourth and last caller
// of the auto-fill. An imported file carries a character and usually no actor, and
// before this the only thing that could name one was a blob no reader could write.
func TestAnImportedLineTakesItsActorFromTheMapping(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "V for Vendetta"}, http.StatusCreated))
	// Hand-typed, because that is the case the blob could never hold.
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{
		"character": "V", "actor": "Hugo Weaving",
	}, http.StatusCreated)

	res := decode[imdbImportResp](t, c.importApprove("/import/imdb-quotes", "v.htm", []byte(vForVendettaQuotes)))
	if res.MovieID != m.ID {
		t.Fatalf("the import should have anchored to the existing title: %+v", res)
	}
	list := decode[dlgList](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(m.ID), nil, http.StatusOK))
	if len(list.Dialogues) == 0 {
		t.Fatalf("nothing was imported: %+v", res)
	}
	var filled int
	for _, d := range list.Dialogues {
		if d.Character == "V" {
			if d.Actor != "Hugo Weaving" {
				t.Fatalf("an imported line should take the mapped actor: %+v", d)
			}
			filled++
		}
	}
	if filled == 0 {
		t.Fatalf("no line credited V: %+v", list.Dialogues)
	}
}
