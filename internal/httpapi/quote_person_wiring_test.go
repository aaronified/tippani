package httpapi

import (
	"net/http"
	"testing"

	"tippani/internal/store"
)

// The per-quote person link, exercised through the API rather than the store.
//
// WHY THIS FILE EXISTS, and it is credits_wiring_test.go's argument one table
// over. 0059 gave dialogues.actor and utterances.speaker a record to point at;
// internal/store proves the link and the name agree for writes that go through
// SyncQuotePerson. What it cannot prove is that every HANDLER goes through it.
// Fourteen places write those two columns, and a handler that forgets is not a
// compile error and not a store test failure — it is a performer whose panel is
// missing the lines they said, found by a reader and by nobody else.
//
// So every assertion here drives a real request and then asks QuoteLinksAgree,
// which walks both tables comparing the printed name against the record.

// quoteLinksMustAgree fails with the row, not a count: the quote and both names
// are what say which handler forgot.
func quoteLinksMustAgree(t *testing.T, srv *Server, uid int64) {
	t.Helper()
	bad, err := store.QuoteLinksAgree(srv.Store.DB, uid, srv.creditSeps(uid))
	if err != nil {
		t.Fatalf("quote link check failed: %v", err)
	}
	for _, d := range bad {
		t.Errorf("%s %d: printed %q, linked %q", d.Kind, d.QuoteID, d.Printed, d.Linked)
	}
	if len(bad) > 0 {
		t.FailNow()
	}
}

// linesOf asks the question the person panel WILL ask: which quotes does this
// record hold? Asked of the database rather than of an endpoint because no
// endpoint answers it yet — 0059 lands the link, and the screen that reads it is
// rebuilt with the person panel. Naming that plainly here matters: a helper
// called "the person panel's question" reads as though the panel is wired, and
// it is not.
func linesOf(t *testing.T, srv *Server, personID int64) int {
	t.Helper()
	var n int
	if err := srv.Store.DB.QueryRow(`
		SELECT (SELECT COUNT(*) FROM dialogues WHERE actor_id = ?)
		     + (SELECT COUNT(*) FROM utterances WHERE speaker_id = ?)`,
		personID, personID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func personID(t *testing.T, srv *Server, uid int64, name string) int64 {
	t.Helper()
	var id int64
	if err := srv.Store.DB.QueryRow(
		`SELECT id FROM people WHERE user_id = ? AND name = ? ORDER BY id LIMIT 1`, uid, name).Scan(&id); err != nil {
		t.Fatalf("the library has no record of %q: %v", name, err)
	}
	return id
}

// A film line typed into the browser reaches the performer's panel.
func TestATypedFilmLineReachesItsActorsPanel(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Jurassic Park"}, http.StatusCreated))
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Clever girl", "character": "Muldoon", "actor": "Bob Peck",
	}, http.StatusCreated))

	if n := linesOf(t, srv, personID(t, srv, 1, "Bob Peck")); n != 1 {
		t.Fatalf("the actor's panel holds %d lines, want 1", n)
	}
	quoteLinksMustAgree(t, srv, 1)

	// AND THE EDIT FOLLOWS. Re-attributing the line must move it, or the panel
	// goes on claiming a quote that names somebody else.
	c.mustDo("PUT", "/dialogues/"+itoa(d.ID), map[string]any{
		"movie_id": m.ID, "quote": "Clever girl", "character": "Muldoon", "actor": "Robert Peck",
	}, http.StatusOK)
	if n := linesOf(t, srv, personID(t, srv, 1, "Bob Peck")); n != 0 {
		t.Fatalf("the old actor kept %d line(s) after the line was re-attributed", n)
	}
	if n := linesOf(t, srv, personID(t, srv, 1, "Robert Peck")); n != 1 {
		t.Fatalf("the new actor holds %d lines, want 1", n)
	}
	quoteLinksMustAgree(t, srv, 1)
}

// A standalone quote's speaker is a person too — and clearing it releases them.
func TestAStandaloneQuoteLinksAndUnlinksItsSpeaker(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	id := idOf(t, c.mustDo("POST", "/quotes", map[string]any{
		"quote": "The die is cast", "speaker": "Julius Caesar",
	}, http.StatusCreated).Body.Bytes())
	caesar := personID(t, srv, 1, "Julius Caesar")
	if n := linesOf(t, srv, caesar); n != 1 {
		t.Fatalf("the speaker holds %d quotes, want 1", n)
	}

	c.mustDo("PUT", "/quotes/"+itoa(id), map[string]any{
		"quote": "The die is cast", "speaker": "",
	}, http.StatusOK)
	if n := linesOf(t, srv, caesar); n != 0 {
		t.Fatalf("an unattributed quote still hangs off its old speaker (%d)", n)
	}
	quoteLinksMustAgree(t, srv, 1)
}

// The bulk field editor sets a speaker across a selection, and the panel follows.
// This path interpolates its column name, so no search for "UPDATE utterances SET
// speaker" would ever have found it — which is exactly why it gets a test.
func TestBulkSettingASpeakerMovesTheQuotes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	var ids []int64
	for _, q := range []string{"the first line", "the second line"} {
		ids = append(ids, idOf(t, c.mustDo("POST", "/quotes",
			map[string]any{"quote": q, "speaker": "Anon"}, http.StatusCreated).Body.Bytes()))
	}
	c.mustDo("POST", "/quotes/bulk", map[string]any{
		"ids": ids, "speaker": "Marcus Aurelius",
	}, http.StatusOK)

	if n := linesOf(t, srv, personID(t, srv, 1, "Marcus Aurelius")); n != 2 {
		t.Fatalf("the new speaker holds %d of the 2 quotes", n)
	}
	if n := linesOf(t, srv, personID(t, srv, 1, "Anon")); n != 0 {
		t.Fatalf("the old speaker kept %d quote(s)", n)
	}
	quoteLinksMustAgree(t, srv, 1)
}

// Find-and-replace over an actor name — the cleanup this endpoint exists for.
//
// It also pins the vocabulary: `kind: "quote"` is the word the API speaks for a
// standalone quote, and it resolved to no table at all until 0059's pass, so
// every replace over a speaker answered 500.
func TestFindAndReplaceOverASpeakerRelinksAndDoesNotCrash(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	id := idOf(t, c.mustDo("POST", "/quotes", map[string]any{
		"quote": "A line", "speaker": "Ursula LeGuin",
	}, http.StatusCreated).Body.Bytes())

	c.mustDo("POST", "/replace/apply", map[string]any{
		"kind": "quote", "ids": []int64{id}, "field": "speaker",
		"find": "LeGuin", "replace": "Le Guin",
	}, http.StatusOK)

	var printed string
	if err := srv.Store.DB.QueryRow(`SELECT speaker FROM utterances WHERE id = ?`, id).Scan(&printed); err != nil {
		t.Fatal(err)
	}
	if printed != "Ursula Le Guin" {
		t.Fatalf("find-and-replace left the speaker as %q", printed)
	}
	if n := linesOf(t, srv, personID(t, srv, 1, "Ursula Le Guin")); n != 1 {
		t.Fatalf("the corrected speaker holds %d quotes, want 1", n)
	}
	quoteLinksMustAgree(t, srv, 1)
}

// Renaming a person by NAME rewrites the strings and must leave the links
// pointing somewhere — the handler deletes redundant records at the end, and the
// foreign key is ON DELETE SET NULL, so a re-derive placed too early is silently
// undone by that delete.
func TestRenamingASpeakerByNameKeepsTheQuotesLinked(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "A line", "speaker": "Ursula LeGuin",
	}, http.StatusCreated)
	c.mustDo("POST", "/people/rename", map[string]any{
		"kind": "speaker", "from": "Ursula LeGuin", "to": "Ursula K. Le Guin",
	}, http.StatusOK)

	if n := linesOf(t, srv, personID(t, srv, 1, "Ursula K. Le Guin")); n != 1 {
		t.Fatalf("the renamed speaker holds %d quotes, want 1", n)
	}
	quoteLinksMustAgree(t, srv, 1)
}

// Renaming the RECORD renames what its quotes print — otherwise the record
// answers to a name none of its quotes carries, and the next unrelated edit
// resolves that old spelling into a second record.
func TestRenamingAPersonRecordRenamesTheirQuotes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	id := idOf(t, c.mustDo("POST", "/quotes", map[string]any{
		"quote": "A line", "speaker": "Ursula LeGuin",
	}, http.StatusCreated).Body.Bytes())
	p := personID(t, srv, 1, "Ursula LeGuin")

	c.mustDo("PUT", "/people/id/"+itoa(p), map[string]any{"name": "Ursula K. Le Guin"}, http.StatusOK)

	var printed string
	if err := srv.Store.DB.QueryRow(`SELECT speaker FROM utterances WHERE id = ?`, id).Scan(&printed); err != nil {
		t.Fatal(err)
	}
	if printed != "Ursula K. Le Guin" {
		t.Fatalf("the quote still says %q after its speaker's record was renamed", printed)
	}
	if n := linesOf(t, srv, p); n != 1 {
		t.Fatalf("the renamed record holds %d quotes, want 1", n)
	}
	quoteLinksMustAgree(t, srv, 1)

	// AND THE SECOND RECORD IS THE FAILURE THIS GUARDS. An edit to the quote must
	// not create one.
	c.mustDo("PUT", "/quotes/"+itoa(id), map[string]any{
		"quote": "A line", "speaker": "Ursula K. Le Guin", "note": "unrelated",
	}, http.StatusOK)
	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT COUNT(*) FROM people WHERE user_id = 1 AND name LIKE 'Ursula%'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("one person became %d after an ordinary edit", n)
	}
}

// A merge moves the quotes; the bin's undo brings them back. The words on the
// quote never move, which is why the link has to.
func TestMergingTwoPeopleMovesTheirQuotesAndUndoReturnsThem(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/quotes", map[string]any{"quote": "A", "speaker": "Bob Peck"}, http.StatusCreated)
	c.mustDo("POST", "/quotes", map[string]any{"quote": "B", "speaker": "Robert Peck"}, http.StatusCreated)
	bob := personID(t, srv, 1, "Bob Peck")
	robert := personID(t, srv, 1, "Robert Peck")

	c.mustDo("POST", "/people/merge", map[string]any{"keep_id": robert, "drop_id": bob}, http.StatusOK)
	if n := linesOf(t, srv, robert); n != 2 {
		t.Fatalf("the survivor holds %d of the 2 quotes", n)
	}
	// The spelling is untouched — the same promise the covers get.
	var printed string
	if err := srv.Store.DB.QueryRow(
		`SELECT speaker FROM utterances WHERE quote = 'A'`).Scan(&printed); err != nil {
		t.Fatal(err)
	}
	if printed != "Bob Peck" {
		t.Fatalf("the merge rewrote the quote to say %q", printed)
	}
	quoteLinksMustAgree(t, srv, 1)

	bin := decode[struct {
		Trash []struct {
			ID   int64  `json:"id"`
			Kind string `json:"kind"`
		} `json:"trash"`
	}](t, c.mustDo("GET", "/trash", nil, http.StatusOK))
	var entry int64
	for _, it := range bin.Trash {
		if it.Kind == "person-merge" {
			entry = it.ID
		}
	}
	if entry == 0 {
		t.Fatalf("the merge left no bin entry to undo: %+v", bin.Trash)
	}
	c.mustDo("POST", "/trash/"+itoa(entry)+"/restore", nil, http.StatusOK)
	if n := linesOf(t, srv, personID(t, srv, 1, "Bob Peck")); n != 1 {
		t.Fatalf("undo returned %d quote(s) to the record it came from, want 1", n)
	}
	quoteLinksMustAgree(t, srv, 1)
}

// Binning a quote and restoring it must not lose the link — and must not fail.
//
// THE FAILURE THIS GUARDS IS A ROLLED-BACK RESTORE. The bin's snapshot is a
// SELECT *, so it carries the person id; deleting the quote can take the person
// with it through the orphan sweep; and re-inserting a row that points at a
// person who no longer exists fails the foreign key and rolls the WHOLE restore
// back — losing the quote to protect a number.
func TestBinningAQuoteAndRestoringItKeepsItsSpeaker(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Jurassic Park"}, http.StatusCreated))
	id := idOf(t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Clever girl", "character": "Muldoon", "actor": "Bob Peck",
	}, http.StatusCreated).Body.Bytes())

	// SAVED AS A PERSON, which is what arms the trap: the orphan sweep only reaps
	// a record that has been filed under a role, and deleting this line is the
	// last thing naming them. So by the time the reader presses undo, the id in
	// the snapshot points at nobody.
	c.mustDo("PUT", "/people", map[string]any{
		"kind": "actor", "name": "Bob Peck", "bio": "played Muldoon",
	}, http.StatusOK)

	c.mustDo("DELETE", "/dialogues/"+itoa(id), nil, http.StatusOK)
	var gone int
	if err := srv.Store.DB.QueryRow(
		`SELECT COUNT(*) FROM people WHERE user_id = 1 AND name = 'Bob Peck'`).Scan(&gone); err != nil {
		t.Fatal(err)
	}
	if gone != 0 {
		t.Fatalf("the orphan sweep did not take the actor — this test no longer arms the trap it names")
	}

	bin := decode[struct {
		Trash []struct {
			ID   int64  `json:"id"`
			Kind string `json:"kind"`
		} `json:"trash"`
	}](t, c.mustDo("GET", "/trash", nil, http.StatusOK))
	if len(bin.Trash) == 0 {
		t.Fatalf("the quote was not binned")
	}
	c.mustDo("POST", "/trash/"+itoa(bin.Trash[0].ID)+"/restore", nil, http.StatusOK)

	if n := linesOf(t, srv, personID(t, srv, 1, "Bob Peck")); n != 1 {
		t.Fatalf("the restored line holds %d links to its actor, want 1", n)
	}
	quoteLinksMustAgree(t, srv, 1)
}

// GET /people/names carries the RECORD each spelling resolves to, which is what
// lets the duplicate card merge records instead of rewriting four hundred works.
//
// THE MERGED SPELLING IS THE CASE THAT MATTERS. After a merge both spellings are
// still printed on their quotes and both still list here; without the record id
// the card cannot tell they are already one person, and offers the same merge for
// ever.
func TestPeopleNamesCarriesTheRecordEachSpellingResolvesTo(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/quotes", map[string]any{"quote": "A", "speaker": "Bob Peck"}, http.StatusCreated)
	c.mustDo("POST", "/quotes", map[string]any{"quote": "B", "speaker": "Robert Peck"}, http.StatusCreated)
	bob := personID(t, srv, 1, "Bob Peck")
	robert := personID(t, srv, 1, "Robert Peck")

	names := func() map[string]int64 {
		t.Helper()
		got := decode[struct {
			People []struct {
				Name     string `json:"name"`
				PersonID int64  `json:"person_id"`
			} `json:"people"`
		}](t, c.mustDo("GET", "/people/names?kind=speaker", nil, http.StatusOK))
		out := map[string]int64{}
		for _, p := range got.People {
			out[p.Name] = p.PersonID
		}
		return out
	}

	before := names()
	if before["Bob Peck"] != bob || before["Robert Peck"] != robert {
		t.Fatalf("the two spellings resolve to %v, want %d and %d", before, bob, robert)
	}

	c.mustDo("POST", "/people/merge", map[string]any{"keep_id": robert, "drop_id": bob}, http.StatusOK)

	after := names()
	if _, ok := after["Bob Peck"]; !ok {
		t.Fatalf("the merged-away spelling vanished from the list: %v", after)
	}
	if after["Bob Peck"] != robert || after["Robert Peck"] != robert {
		t.Fatalf("after the merge the spellings resolve to %v, want both at %d", after, robert)
	}
}

// THE FOUR SITES THE TWO TESTS ABOVE DO NOT REACH, and the reason this block
// exists: the file's own header says fourteen places write those columns, and a
// walk that only ever runs after a typed create is a walk that certifies the one
// path nobody was worried about. An import, a cast refill and a speaker remap all
// write `actor` without a reader ever typing it, and each of them is a bulk write
// over a whole film.

// A film's cast filling in the actor on lines that arrived without one — the
// retroactive half of the autofill rule, reached from the cast, the resync and
// the re-verify apply.
func TestFillingActorsFromTheCastLinksTheLinesItFills(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Jurassic Park"}, http.StatusCreated))
	// A line with a character and NO actor, which is what an import leaves behind
	// when it lands before the cast exists.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Clever girl", "character": "Muldoon",
	}, http.StatusCreated)
	if n := linesOf(t, srv, 0); n != 0 {
		t.Fatalf("a line with no actor is already linked to something")
	}

	// Naming who plays the role is what fills it.
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{
		"character": "Muldoon", "actor": "Bob Peck",
	}, http.StatusCreated)
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/remap-speakers", map[string]any{
		"mappings": []map[string]any{}, "refill": true,
	}, http.StatusOK)

	var printed string
	if err := srv.Store.DB.QueryRow(`SELECT COALESCE(actor, '') FROM dialogues WHERE movie_id = ?`, m.ID).Scan(&printed); err != nil {
		t.Fatal(err)
	}
	if printed != "Bob Peck" {
		t.Fatalf("the refill wrote %q — this test is no longer exercising the fill", printed)
	}
	if n := linesOf(t, srv, personID(t, srv, 1, "Bob Peck")); n != 1 {
		t.Fatalf("the filled line reached %d of the actor's panel, want 1", n)
	}
	quoteLinksMustAgree(t, srv, 1)
}

// Remapping a film's speakers — the ONE path that deliberately rewrites an actor
// the reader already had, and therefore the one that can leave a link pointing at
// the person the line no longer names.
func TestRemappingSpeakersMovesTheLinkWithTheName(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "V for Vendetta"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Who are you?", "character": "Evey", "actor": "N. Portman",
	}, http.StatusCreated)
	old := personID(t, srv, 1, "N. Portman")

	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/remap-speakers", map[string]any{
		"mappings": []map[string]any{{"from": "Evey", "character": "Evey Hammond", "actor": "Natalie Portman"}},
	}, http.StatusOK)

	if n := linesOf(t, srv, old); n != 0 {
		t.Fatalf("the old spelling kept %d line(s) after the remap", n)
	}
	if n := linesOf(t, srv, personID(t, srv, 1, "Natalie Portman")); n != 1 {
		t.Fatalf("the remapped performer holds %d lines, want 1", n)
	}
	quoteLinksMustAgree(t, srv, 1)
}

// An import, all the way through the staging queue it has to be approved out of.
// Both arms: the lines that land, and the enrichment a second copy of the same
// file performs on the ones already there.
func TestImportedLinesAndQuotesReachTheirPeople(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	const page = `<html><body><script id="__NEXT_DATA__" type="application/json">` +
		`{"props":{"pageProps":{"contentData":{"data":{"title":{"id":"tt0434409",` +
		`"titleText":{"text":"V for Vendetta","__typename":"TitleText"},` +
		`"releaseYear":{"year":2005,"endYear":null,"__typename":"YearRange"},` +
		`"titleType":{"id":"movie","text":"Movie","isSeries":false,"__typename":"TitleType"},` +
		`"quotes":{"total":1,"edges":[` +
		`{"node":{"__typename":"TitleQuote","id":"qt1","displayableArticle":{"body":{"plainText":"\n* V: People should not be afraid of their governments.\n","__typename":"Markdown"}}}}` +
		`]}}}}}}}</script></body></html>`

	if rec := c.importApprove("/import/imdb-quotes", "v.htm", []byte(page)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	// The imported line names a CHARACTER and no actor, so it links to nobody —
	// which is the correct answer and not the one worth asserting. Naming the
	// performer on the cast and refilling is what puts it in a panel.
	var movieID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM movies WHERE user_id = 1`).Scan(&movieID); err != nil {
		t.Fatal(err)
	}
	c.mustDo("POST", "/movies/"+itoa(movieID)+"/cast", map[string]any{
		"character": "V", "actor": "Hugo Weaving",
	}, http.StatusCreated)
	c.mustDo("POST", "/movies/"+itoa(movieID)+"/remap-speakers", map[string]any{
		"mappings": []map[string]any{}, "refill": true,
	}, http.StatusOK)
	if n := linesOf(t, srv, personID(t, srv, 1, "Hugo Weaving")); n != 1 {
		t.Fatalf("the imported line holds %d links to its performer, want 1", n)
	}
	quoteLinksMustAgree(t, srv, 1)

	// THE ENRICHMENT ARM. The same file again: every line collides, and the
	// COALESCE backfill fills whatever was still blank. A caller that has just
	// written a COALESCE does not know what landed, which is exactly why the
	// linker reads the column back rather than being told.
	if rec := c.importApprove("/import/imdb-quotes", "v.htm", []byte(page)); rec.Code != http.StatusOK {
		t.Fatalf("re-import: %d %s", rec.Code, rec.Body)
	}
	if n := linesOf(t, srv, personID(t, srv, 1, "Hugo Weaving")); n != 1 {
		t.Fatalf("the re-import left the performer holding %d lines", n)
	}
	quoteLinksMustAgree(t, srv, 1)
}
