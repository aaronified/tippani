package httpapi

import (
	"net/http"
	"testing"
)

// The READ side of the identity model — the half 0056 and 0059 wrote and nothing
// asked for.
//
// Both migrations landed their links write-only on purpose: the credits, the cast
// and the two quote columns were pointed at records from the day they shipped, and
// the screens that read them are rebuilt with the person panel. This file is the
// endpoints that panel talks to, and every one of them was a 404 or a missing
// field before it.

// A PERFORMER'S LINES ARE THE LINKED ONES, AND THE TWO-HANDERS ARE COUNTED.
//
// SyncQuotePerson deliberately refuses to guess when a line names two people —
// autofillActor credits a line naming two characters to both their performers, and
// there is no honest single answer. A panel that listed only the linked ones would
// be quietly wrong about how many lines somebody has, which is the failure this
// second number exists to prevent.
func TestAPerformersRecordListsTheirLinesAndCountsTheSharedOnes(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Jurassic Park"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Clever girl", "character": "Muldoon", "actor": "Bob Peck",
	}, http.StatusCreated)
	// A two-hander: the name is printed, and the linker leaves the row unlinked
	// because neither performer is the answer on their own.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Hold on to your hats", "character": "Muldoon and Grant",
		"actor": "Bob Peck, Sam Neill",
	}, http.StatusCreated)

	id := personID(t, srv, 1, "Bob Peck")
	got := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(id), nil, 200))

	if len(got.Lines) != 1 {
		t.Fatalf("the record lists %d lines, want the one that points at it: %+v", len(got.Lines), got.Lines)
	}
	if got.Lines[0].Text != "Clever girl" || got.Lines[0].WorkTitle != "Jurassic Park" {
		t.Fatalf("the listed line is %+v", got.Lines[0])
	}
	if got.SharedLines != 1 {
		t.Fatalf("shared_lines = %d, want the two-hander counted rather than listed", got.SharedLines)
	}
}

// The spelling a line PRINTS is not always the record's name, and the record says
// which — a merge re-points ids and never rewrites a cast list.
func TestALinkedLineKeepsTheSpellingItPrints(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Jurassic Park"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Clever girl", "character": "Muldoon", "actor": "Bob Peck",
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Shoot her", "character": "Muldoon", "actor": "Robert Peck",
	}, http.StatusCreated)

	keep := personID(t, srv, 1, "Robert Peck")
	drop := personID(t, srv, 1, "Bob Peck")
	c.mustDo("POST", "/people/merge", map[string]any{"keep_id": keep, "drop_id": drop}, 200)

	got := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(keep), nil, 200))
	if len(got.Lines) != 2 {
		t.Fatalf("after the merge the record holds %d lines, want both", len(got.Lines))
	}
	var printed []string
	for _, l := range got.Lines {
		printed = append(printed, l.Name)
	}
	// One line still says "Bob Peck", and that is the faithful-spelling promise
	// rather than stale data — the alias the merge filed is what keeps it resolving.
	if !hasString(printed, "Bob Peck") || !hasString(printed, "Robert Peck") {
		t.Fatalf("the lines print %v, want each to keep the spelling it was written with", printed)
	}
}

// A PANEL'S LINES WEAR THE SAME CHARACTER CHIPS THE CARDS DO — the owner's
// ruling, which put the pills on Home's favourites and on the character and
// person pages together with the annotation cards.
//
// THE TWO SIDES ARE NOT SYMMETRICAL, AND THAT ASYMMETRY IS WHY THIS CASE EXISTS.
// A character's lines are linked THROUGH work_cast, so the name the line prints
// is already its character text; a person's are linked through `actor_id`, so
// the name it prints is the PERFORMER and the characters have to be carried
// separately. Fold the printed name on the person's side and the page matches
// "Claude Rains" against a cast keyed by character and draws nothing at all.
func TestAPanelsLinesCarryEveryCharacterNamedOnThem(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Casablanca"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Round up the usual suspects.",
		"character": "Renault, Rick", "actor": "Claude Rains",
	}, http.StatusCreated)

	// THE PERFORMER'S SIDE.
	who := personID(t, srv, 1, "Claude Rains")
	person := decode[personDetailResp](t, c.mustDo("GET", "/people/id/"+itoa(who), nil, 200))
	if len(person.Lines) != 1 {
		t.Fatalf("the performer holds %d lines, want the one", len(person.Lines))
	}
	// IN THE ORDER THE LINE NAMES THEM, which is not alphabetical and not the
	// cast's order — the reader typed it.
	if got := faceNames(person.Lines[0]); len(got) != 2 || got[0] != "Renault" || got[1] != "Rick" {
		t.Errorf("a performer's line names %v, want [Renault Rick] — the CHARACTERS, not the actor", got)
	}

	// THE CHARACTER'S SIDE. A line naming two characters is one the linker
	// refuses to resolve, so it is counted as shared rather than listed; this
	// single-speaker line is the one a character's panel actually lists.
	//
	// THE CAST ROW COMES FIRST, and that ordering is the feature rather than test
	// scaffolding: a line is linked to a character through work_cast, so a record
	// the reader has not put in the cast has no lines to list. SyncQuoteCast runs
	// on the write below and finds the row this one makes.
	cast := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
		map[string]any{"character": "Rick", "actor": "Humphrey Bogart"}, http.StatusCreated))
	if cast.CharacterID == 0 {
		t.Fatal("the cast row points at no character record")
	}
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "I was misinformed.", "character": "Rick",
	}, http.StatusCreated)
	got := decode[characterDetailResp](t, c.mustDo("GET", "/characters/"+itoa(cast.CharacterID), nil, 200))
	if len(got.Lines) == 0 {
		t.Fatal("the character's panel lists no lines at all")
	}
	for _, l := range got.Lines {
		if got := faceNames(l); len(got) == 0 {
			t.Errorf("the character's line %q carries no names at all", l.Text)
		}
	}
}

// faceNames is a line's chip row, in order.
func faceNames(l lineResp) []string {
	out := []string{}
	for _, f := range l.CharacterImages {
		out = append(out, f.Name)
	}
	return out
}

// ---- the record-keyed people list -------------------------------------------

type personRecordResp struct {
	ID        int64    `json:"id"`
	Name      string   `json:"name"`
	Kinds     []string `json:"kinds"`
	Spellings []string `json:"spellings"`
	Works     int      `json:"works"`
	Quotes    int      `json:"quotes"`
}

// ONE ROW PER RECORD, WHERE /people/names GIVES ONE PER PRINTED SPELLING.
//
// This is the whole reason the endpoint exists. A reader who has merged four
// spellings of Bulgakov into one record was still shown four rows in the Metadata
// review list, each with a quarter of the library hanging off it — which is the
// exact lie the identity model was built to stop telling.
func TestThePeopleRecordListIsOneRowPerRecordNotPerSpelling(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	bookA := createTestBook(t, c, "The Master and Margarita", "Mikhail Bulgakov")
	createTestBook(t, c, "Master i Margarita", "M. Bulgakov")

	keep := personID(t, srv, 1, "Mikhail Bulgakov")
	drop := personID(t, srv, 1, "M. Bulgakov")
	c.mustDo("POST", "/people/merge", map[string]any{"keep_id": keep, "drop_id": drop}, 200)

	// A spelling no cover prints, filed by hand — the alias arm.
	c.mustDo("POST", "/people/id/"+itoa(keep)+"/aliases", map[string]any{"alias": "Булгаков"}, http.StatusNoContent)
	// And a spelling that is ONLY a credit: how one cover prints them, filed
	// through the scope-1 endpoint and never an alias of anybody. Without this the
	// credit arm is covered for by the alias arm, because a merge files the
	// dropped name both ways.
	c.mustDo("PUT", "/credits", map[string]any{
		"kind": "book", "work_id": bookA, "role": "author", "person_id": keep, "credit_as": "M. A. Bulgakov",
	}, http.StatusNoContent)

	list := decode[struct {
		People []personRecordResp `json:"people"`
	}](t, c.mustDo("GET", "/people/records", nil, 200))

	var found *personRecordResp
	for i := range list.People {
		if list.People[i].ID == keep {
			found = &list.People[i]
		}
	}
	if found == nil {
		t.Fatalf("the survivor is not in the record list: %+v", list.People)
	}
	// The two books are ONE row with two works, not two rows with one each.
	if found.Works != 2 {
		t.Fatalf("the record reads %d works, want both books on the one record", found.Works)
	}
	for _, p := range list.People {
		if p.ID != keep && p.Name == "M. Bulgakov" {
			t.Fatalf("the dropped spelling is still its own row: %+v", p)
		}
	}
	// AND THE OTHER SPELLINGS ARE ON THE ROW, which is what makes one row able to
	// stand for the several the spelling list used to show.
	//
	// BOTH ARMS ARE ASSERTED BECAUSE THEY ARE TWO SOURCES. "M. Bulgakov" is here as
	// a credit_as — the merge gave the second book that spelling so its cover would
	// go on printing what it printed — and "Булгаков" is here as an ALIAS, filed by
	// hand and printed by nothing. A row that showed only one of the two would pass
	// half this assertion and be missing exactly the spellings a reader added.
	if !hasString(found.Spellings, "M. Bulgakov") {
		t.Fatalf("spellings = %v, want the spelling the second cover prints", found.Spellings)
	}
	if !hasString(found.Spellings, "Булгаков") {
		t.Fatalf("spellings = %v, want the hand-filed alias, which no work prints", found.Spellings)
	}
	if !hasString(found.Spellings, "M. A. Bulgakov") {
		t.Fatalf("spellings = %v, want the credit-only spelling, which is nobody's alias", found.Spellings)
	}
	// THE ROLES COME FROM THE LINKS, NOT FROM person_kinds. 0027's table is written
	// by the enrichment upsert and not by the credit path, so a record created by
	// adding a book is filed under no role there at all — which is most records in
	// any library, and would have shown an empty cell on nearly every row.
	if !hasString(found.Kinds, "author") {
		t.Fatalf("kinds = %v, want the role the links say this record plays", found.Kinds)
	}
}

// A performer reads as an actor and a speaker without anything having filed them
// under either — the same derivation, over the other three link columns.
func TestARecordsRolesComeFromItsLinks(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Jurassic Park"}, http.StatusCreated))
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{
		"character": "Muldoon", "actor": "Bob Peck",
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Clever girl", "character": "Muldoon", "actor": "Bob Peck",
	}, http.StatusCreated)

	list := decode[struct {
		People []personRecordResp `json:"people"`
	}](t, c.mustDo("GET", "/people/records", nil, 200))
	var peck *personRecordResp
	for i := range list.People {
		if list.People[i].Name == "Bob Peck" {
			peck = &list.People[i]
		}
	}
	if peck == nil {
		t.Fatalf("the performer is not in the record list: %+v", list.People)
	}
	if !hasString(peck.Kinds, "actor") {
		t.Fatalf("kinds = %v, want actor from the cast pairing and the line", peck.Kinds)
	}
	if peck.Quotes != 1 {
		t.Fatalf("quotes = %d, want the line that points at them", peck.Quotes)
	}

	// A PERFORMER WHO IS ONLY BILLED, with no line saved, is still an actor — the
	// arm the dialogue above would otherwise cover for. This is the ordinary case:
	// a cast list has forty names and a reader has kept lines from three of them.
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{
		"character": "Grant", "actor": "Sam Neill",
	}, http.StatusCreated)
	list = decode[struct {
		People []personRecordResp `json:"people"`
	}](t, c.mustDo("GET", "/people/records", nil, 200))
	var neill *personRecordResp
	for i := range list.People {
		if list.People[i].Name == "Sam Neill" {
			neill = &list.People[i]
		}
	}
	if neill == nil {
		t.Fatalf("the billed performer is not in the record list: %+v", list.People)
	}
	if !hasString(neill.Kinds, "actor") {
		t.Fatalf("kinds = %v, want actor from the cast pairing alone", neill.Kinds)
	}
	if neill.Quotes != 0 {
		t.Fatalf("quotes = %d, want none — no line of theirs was saved", neill.Quotes)
	}
}

// ---- a work's people --------------------------------------------------------

type workPeopleResp struct {
	Credits []struct {
		Role     string `json:"role"`
		PersonID int64  `json:"person_id"`
		Name     string `json:"name"`
		CreditAs string `json:"credit_as"`
	} `json:"credits"`
	Cast []struct {
		CastID           int64    `json:"cast_id"`
		Character        string   `json:"character"`
		CharacterID      int64    `json:"character_id"`
		Actor            string   `json:"actor"`
		ActorID          int64    `json:"actor_id"`
		CharacterAliases []string `json:"character_aliases"`
	} `json:"cast"`
	Speakers []struct {
		PersonID int64  `json:"person_id"`
		Name     string `json:"name"`
		Lines    int    `json:"lines"`
	} `json:"speakers"`
}

// THE DOOR THE IDENTITY MODEL HAD NO DOOR FOR: stand on a work and see the records
// behind it. Every person link on every screen opened a NAME before this.
func TestAWorksPeopleAreItsCreditsItsCastAndWhoItsQuotesName(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Jurassic Park", "director": "Steven Spielberg"}, http.StatusCreated))
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{
		"character": "Muldoon", "actor": "Bob Peck",
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Clever girl", "character": "Muldoon", "actor": "Bob Peck",
	}, http.StatusCreated)

	got := decode[workPeopleResp](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/people", nil, 200))

	if len(got.Credits) != 1 || got.Credits[0].Role != "director" || got.Credits[0].Name != "Steven Spielberg" {
		t.Fatalf("credits = %+v, want the director as a record", got.Credits)
	}
	if got.Credits[0].PersonID == 0 {
		t.Fatal("the credit carries no record id, so the panel has nothing to open")
	}
	// The cast row names BOTH records, which is what lets a character row link to
	// its character and to the performer beside it.
	if len(got.Cast) != 1 || got.Cast[0].CharacterID == 0 || got.Cast[0].ActorID == 0 {
		t.Fatalf("cast = %+v, want a row carrying both record ids", got.Cast)
	}
	// And who the work's own quotes point at, with how many lines each — a
	// different fact from being billed, and the one a reader asks when they want
	// "who says the things I saved".
	if len(got.Speakers) != 1 || got.Speakers[0].Lines != 1 || got.Speakers[0].Name != "Bob Peck" {
		t.Fatalf("speakers = %+v, want the one performer the saved line names", got.Speakers)
	}
}

// A BOOK HAS NO SPEAKERS, and that is the schema being honest rather than a branch
// that skips the query: `annotations` has no person column at all.
func TestABooksPeopleAreItsCreditsAndItsCharactersWithNoSpeakers(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	book := createTestBook(t, c, "The Master and Margarita", "Mikhail Bulgakov")
	c.mustDo("POST", "/books/"+itoa(book)+"/cast", map[string]any{"character": "Woland"}, http.StatusCreated)

	got := decode[workPeopleResp](t, c.mustDo("GET", "/books/"+itoa(book)+"/people", nil, 200))
	if len(got.Credits) != 1 || got.Credits[0].Role != "author" {
		t.Fatalf("credits = %+v, want the author", got.Credits)
	}
	if len(got.Cast) != 1 || got.Cast[0].Character != "Woland" || got.Cast[0].CharacterID == 0 {
		t.Fatalf("cast = %+v, want the character as a record", got.Cast)
	}
	// A book character has no performer, and the row says nothing rather than
	// carrying a zero that reads as one.
	if got.Cast[0].ActorID != 0 {
		t.Fatalf("a novel's character has an actor id: %+v", got.Cast[0])
	}
	if len(got.Speakers) != 0 {
		t.Fatalf("a book reported %d speakers; annotations have no person column", len(got.Speakers))
	}
}

// EVERY SPELLING A CHARACTER ANSWERS TO RIDES WITH ITS CAST ROW.
//
// Commit 4 marks a character's name inside a highlight and needs the aliases to do
// it — "Messire" is Woland in a novel that never bills that name. A record is
// library-wide, so it brings every spelling it has ever answered to and not only
// the ones filed against this book, which is the answer given when this was asked.
// One query for the whole cast rather than one per row: forty names is forty round
// trips for a list drawn in one go.
func TestAWorksCastCarriesEverySpellingItsCharactersAnswerTo(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	book := createTestBook(t, c, "The Master and Margarita", "Mikhail Bulgakov")
	other := createTestBook(t, c, "Master i Margarita", "M. Bulgakov")
	c.mustDo("POST", "/books/"+itoa(book)+"/cast", map[string]any{"character": "Woland"}, http.StatusCreated)
	c.mustDo("POST", "/books/"+itoa(other)+"/cast", map[string]any{"character": "Koroviev"}, http.StatusCreated)

	list := decode[struct {
		Characters []charHit `json:"characters"`
	}](t, c.mustDo("GET", "/characters", nil, 200))
	var woland int64
	for _, ch := range list.Characters {
		if ch.Name == "Woland" {
			woland = ch.ID
		}
	}
	// Filed while the reader was on the OTHER book — the record is library-wide, so
	// it counts here.
	c.mustDo("POST", "/characters/"+itoa(woland)+"/aliases", map[string]any{"alias": "Messire"}, http.StatusNoContent)

	got := decode[workPeopleResp](t, c.mustDo("GET", "/books/"+itoa(book)+"/people", nil, 200))
	if len(got.Cast) != 1 {
		t.Fatalf("cast = %+v", got.Cast)
	}
	if !hasString(got.Cast[0].CharacterAliases, "Messire") {
		t.Fatalf("the cast row carries %v, want the spelling filed on the record",
			got.Cast[0].CharacterAliases)
	}
	// And a character on a DIFFERENT work does not leak into this one's cast.
	for _, cst := range got.Cast {
		if cst.Character == "Koroviev" {
			t.Fatalf("another work's character is on this work's cast: %+v", got.Cast)
		}
	}
}

// Another account's work does not exist as far as this one is concerned.
func TestAWorksPeopleIsScopedToItsOwner(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	book := createTestBook(t, c, "The Master and Margarita", "Mikhail Bulgakov")
	bob := addUser(t, h, c, "bob")
	bob.mustDo("GET", "/books/"+itoa(book)+"/people", nil, http.StatusNotFound)
}

// The cast payload carries the two identity links, so a cast row can be a door.
func TestACastRowCarriesTheRecordIdsItPointsAt(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := createTestBook(t, c, "Moby-Dick", "Herman Melville")
	c.mustDo("POST", "/books/"+itoa(book)+"/cast", map[string]any{"character": "Ishmael"}, http.StatusCreated)

	list := decode[castListResp](t, c.mustDo("GET", "/books/"+itoa(book)+"/cast", nil, 200))
	if len(list.Cast) != 1 {
		t.Fatalf("cast = %+v", list.Cast)
	}
	if list.Cast[0].CharacterID == 0 {
		t.Fatal("the cast row carries no character_id, so nothing on the work can open the record")
	}
	// NOT PersonID, which is the provider's id in TMDB's or TheTVDB's id space —
	// the trap 0056 refused to walk into by naming its column actor_id.
	if list.Cast[0].PersonID != "" {
		t.Fatalf("a reader-typed row has a provider id: %q", list.Cast[0].PersonID)
	}
}
