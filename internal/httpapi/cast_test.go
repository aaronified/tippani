package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"tippani/internal/store"
)

// TAKING THE PERFORMER OFF A CREDIT IS NOT TAKING THE CHARACTER OFF THE WORK.
//
// THE REPORT, the owner's, arrived as three symptoms of one cause: "this was
// created by accidentally deleting the actor within the character card. the
// character card opened prior to that. however, that should not make the
// character card inaccessible. and that should also remove the actor from the
// quote (not the work, because that is via a different route)."
//
// The ✕ on a credit row called `DELETE /cast/{id}`, which removes the whole
// casting. So the character left the work — and a character that has left the
// work has no cast row for a quote's chip to open, which is why the chip went
// dead — while the LINE went on printing "played by" the performer the casting
// no longer had, because a film line stores that name itself.
//
// TWO FACTS, TWO ROUTES, AND THE OWNER NAMED THE DISTINCTION: the work is left
// through the sheet's own dashed verb, and this ✕ is only about who is on the
// credit.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that a work's cast
// lives in `work_cast` while a line's own credit is `dialogues.actor`.
func TestTakingThePerformerOffLeavesTheCharacterOnTheWork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Anand", "media_type": "movie"}, http.StatusCreated))
	row := decode[doorRow](t, c.mustDo("POST", "/movies/"+itoa(film.ID)+"/cast",
		map[string]any{"character": "Anand", "actor": "Rajesh Khanna"}, http.StatusCreated))
	line := decode[struct{ ID int64 }](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "बाबुमोशाय", "character": "Anand", "actor": "Rajesh Khanna",
	}, http.StatusCreated))

	c.mustDo("DELETE", "/cast/"+itoa(row.ID)+"/actor", nil, http.StatusNoContent)

	// ── THE CHARACTER IS STILL ON THE WORK, which is the first half: a casting
	// that is gone has nothing for a chip to open.
	var character, actor, origin string
	if err := srv.Store.DB.QueryRow(
		`SELECT COALESCE(character, ''), COALESCE(actor, ''), origin FROM work_cast WHERE id = ?`,
		row.ID).Scan(&character, &actor, &origin); err != nil {
		t.Fatalf("the casting is gone entirely: %v", err)
	}
	if character != "Anand" {
		t.Fatalf("the character left the work: %q", character)
	}
	if origin == "removed" {
		t.Fatal("the casting was tombstoned, so the character's chip has nothing left to open")
	}
	if actor != "" {
		t.Fatalf("the performer is still on the credit: %q", actor)
	}
	var actorID any
	if err := srv.Store.DB.QueryRow(`SELECT actor_id FROM work_cast WHERE id = ?`, row.ID).Scan(&actorID); err != nil {
		t.Fatal(err)
	}
	if actorID != nil {
		t.Fatalf("the credit still points at the person record: %v", actorID)
	}

	// ── AND ITS CHIP STILL OPENS, asked through the read the client actually
	// gates the press on rather than by looking at the column again.
	after := decode[doorList](t, c.mustDo("GET", "/movies/"+itoa(film.ID)+"/cast", nil, http.StatusOK))
	var found bool
	for _, r := range after.Cast {
		if r.Character != "Anand" {
			continue
		}
		found = true
		if r.CharacterID == 0 {
			t.Error("the casting survived with no character record — its chip opens nothing")
		}
	}
	if !found {
		t.Fatal("the character is not on the work's cast list any more")
	}

	// ── AND THE LINE LOSES THEM TOO, which is the second half. A line's credit is
	// a copy of the casting's answer, so a casting naming nobody must not leave
	// the line naming somebody.
	var lineActor string
	var lineActorID any
	if err := srv.Store.DB.QueryRow(
		`SELECT COALESCE(actor, ''), actor_id FROM dialogues WHERE id = ?`, line.ID).
		Scan(&lineActor, &lineActorID); err != nil {
		t.Fatal(err)
	}
	if lineActor != "" || lineActorID != nil {
		t.Fatalf("the quote still names the performer: %q / %v", lineActor, lineActorID)
	}

	// ── AND THE WORK IS UNTOUCHED, which is the distinction the owner drew: the
	// film is left through a different route and this one must not take it.
	var title string
	if err := srv.Store.DB.QueryRow(`SELECT title FROM movies WHERE id = ?`, film.ID).Scan(&title); err != nil {
		t.Fatalf("the film went with the performer: %v", err)
	}
}

// castRowOut is castOut plus the field this file is about; the older shape is left
// alone because a dozen tests read it and none of them care about a description.
type castRowOut struct {
	ID          int64  `json:"id"`
	Character   string `json:"character"`
	Actor       string `json:"actor"`
	Origin      string `json:"origin"`
	Description string `json:"description"`
}

// castEdit has carried `description` since the character page got a per-work
// editor, and PUT has always honoured it. POST accepted it, validated it, capped
// it — and then left it off the INSERT, so "add this character with this note"
// stored the character and dropped the note, replying 201 with the empty string it
// had just failed to save.

func TestAddingACastRowKeepsTheDescriptionItWasSent(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	bookID := createTestBook(t, c, "The Master and Margarita", "Mikhail Bulgakov")

	row := decode[castRowOut](t, c.mustDo("POST", "/books/"+itoa(bookID)+"/cast", map[string]any{
		"character": "Woland", "description": "The professor of black magic.",
	}, http.StatusCreated))
	if row.Description != "The professor of black magic." {
		t.Fatalf("the reply came back with description %q", row.Description)
	}

	list := decode[struct {
		Cast []castRowOut `json:"cast"`
	}](t, c.mustDo("GET", "/books/"+itoa(bookID)+"/cast", nil, http.StatusOK))
	if len(list.Cast) != 1 || list.Cast[0].Description != "The professor of black magic." {
		t.Fatalf("the stored row is %+v", list.Cast)
	}
}

func TestRevivingACastRowTakesANewDescriptionAndKeepsTheOldOne(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	bookID := createTestBook(t, c, "The Master and Margarita", "Mikhail Bulgakov")
	base := "/books/" + itoa(bookID) + "/cast"
	// A QUOTE NAMES THE CHARACTER, which is what makes the delete below a tombstone
	// rather than a hard delete: a reader-typed row nothing quotes and no provider
	// seeded is removed outright, and the row that comes back after that is a new
	// row with nothing to preserve. See handleDeleteCast.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "A cat the size of a hog", "character": "Behemoth",
	}, http.StatusCreated)

	first := decode[castRowOut](t, c.mustDo("POST", base, map[string]any{
		"character": "Behemoth", "description": "A cat the size of a hog.",
	}, http.StatusCreated))
	c.mustDo("DELETE", "/cast/"+itoa(first.ID), nil, http.StatusNoContent)

	// ABSENT LEAVES IT, which is the pointer's contract on the PUT and has to be
	// the same contract here: the row being revived is the row that was there, and
	// a caller who said nothing about the description did not ask to clear it.
	back := decode[castRowOut](t, c.mustDo("POST", base, map[string]any{
		"character": "Behemoth",
	}, http.StatusCreated))
	if back.ID != first.ID {
		t.Fatalf("the tombstone was not revived: %d then %d", first.ID, back.ID)
	}
	if back.Description != "A cat the size of a hog." {
		t.Fatalf("reviving cleared the description: %q", back.Description)
	}

	c.mustDo("DELETE", "/cast/"+itoa(first.ID), nil, http.StatusNoContent)
	again := decode[castRowOut](t, c.mustDo("POST", base, map[string]any{
		"character": "Behemoth", "description": "Woland's retinue.",
	}, http.StatusCreated))
	if again.Description != "Woland's retinue." {
		t.Fatalf("reviving ignored the description sent with it: %q", again.Description)
	}
}

// THE UNATTENDED FILL AND THE FROZEN BLOB (0048).
//
// /metadata/fill is the one provider path with no human in it: fifteen titles a
// call, no diff on screen, chunked over a whole selection by the client. Both
// tests here are about what that licenses and what it does not.
//
// Neither could have existed before 0048, because missingStored returned false
// for a []metadata.CastMember — a cast was the one gap the gap-filler could not
// see, so it never sent the field and never reached either of these paths.

// fillOnce runs the endpoint over one film and hands back the field names it
// claims to have written.
func fillOnce(t *testing.T, c *testClient, movieID int64) []string {
	t.Helper()
	res := decode[struct {
		Results []struct {
			Status string   `json:"status"`
			Filled []string `json:"filled"`
			Error  string   `json:"error"`
		} `json:"results"`
	}](t, c.mustDo("POST", "/metadata/fill", map[string]any{"movie_ids": []int64{movieID}}, http.StatusOK))
	if len(res.Results) != 1 || res.Results[0].Status != "ok" {
		t.Fatalf("fill: %+v", res.Results)
	}
	return res.Results[0].Filled
}

// A CAST THE READER EMPTIED IS NOT A GAP, and an empty list is not proof that
// nobody has curated it.
//
// Deleting a provider row leaves a TOMBSTONE, and a tombstone is filtered out of
// every read but the merge's — deliberately, because it is not part of the cast
// any more. So the re-verify diff's stored side is honestly empty, missingStored
// honestly says "missing", and the unattended fill then offered back the very
// list somebody had just finished deleting.
//
// The merge refused it, exactly as designed — which made the visible symptom the
// worse one: the endpoint reported `filled: ["cast"]` over a write that landed
// nothing at all. A bulk button that says it wrote something it did not is how a
// reader learns to distrust every count it prints.
func TestAnUnattendedFillDoesNotReseedACastTheReaderEmptied(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	                          {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	seeded := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast").Cast
	if len(seeded) != 2 {
		t.Fatalf("fixture: %+v", seeded)
	}
	// Every credit deleted on purpose — two tombstones and an empty list, which is
	// the state the whole feature exists to make possible.
	for _, row := range seeded {
		c.mustDo("DELETE", "/cast/"+itoa(row.ID), nil, http.StatusNoContent)
	}
	var tombstones int
	if err := srv.Store.DB.QueryRow(
		`SELECT COUNT(*) FROM work_cast WHERE kind = 'movie' AND work_id = ? AND origin = 'removed'`,
		m.ID).Scan(&tombstones); err != nil {
		t.Fatal(err)
	}
	if tombstones != 2 {
		t.Fatalf("fixture: %d tombstones, want 2", tombstones)
	}

	for _, field := range fillOnce(t, c, m.ID) {
		if field == "cast" {
			t.Fatal(`fill claimed to have filled "cast" — the reader deleted every ` +
				`credit, the merge wrote nothing, and the count said otherwise`)
		}
	}
	if list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast").Cast; len(list) != 0 {
		t.Fatalf("a fill must not hand back a deleted cast: %+v", list)
	}
}

// THE FROZEN BLOB SURVIVES AN APPROVED CAST.
//
// movies.cast_json is kept for one release for one reason: if 0048's backfill is
// wrong about somebody's library, that blob is the only copy in existence of what
// the provider said before the mapping took over. applyReverifyMovie is the path
// that must not spend it, because it is ALSO what /metadata/fill applies through
// — so a bulk button with no diff on screen was rewriting the one copy there is,
// per title, across a whole selection.
//
// It is filled where it is empty and never overwritten, which keeps the pre-0048
// copy on every title that has one. Freezing it is also what starved the column's
// last reader — the quiz's speaker distractors, which have since moved to
// work_cast (cast_speaker_test.go), because a frozen column with a reader on it is
// a pool that goes stale the first time a diff is approved.
func TestApprovingACastDoesNotOverwriteTheFrozenBlob(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"Glados","name":"Ellen McLain"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	blobOf := func() string {
		t.Helper()
		var blob string
		if err := srv.Store.DB.QueryRow(`SELECT COALESCE(cast_json,'') FROM movies WHERE id = ?`,
			m.ID).Scan(&blob); err != nil {
			t.Fatal(err)
		}
		return blob
	}
	seedBlob := blobOf()
	if !strings.Contains(seedBlob, "Ellen McLain") {
		t.Fatalf("fixture: the create path writes the blob whole: %q", seedBlob)
	}

	// The provider now bills a second person, and the reader approves the lot.
	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{"type": "movie", "id": m.ID, "set": map[string]any{
			"cast": []map[string]any{
				{"character": "Glados", "actor": "Ellen McLain", "person_id": "6384"},
				{"character": "Cave Johnson", "actor": "J.K. Simmons", "person_id": "9"},
			},
		}}},
	}, http.StatusOK)

	if list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast").Cast; len(list) != 2 {
		t.Fatalf("the approved cast should have landed in the mapping: %+v", list)
	}
	if got := blobOf(); got != seedBlob {
		t.Fatalf("the frozen blob was rewritten:\n before %q\n after  %q", seedBlob, got)
	}
}

// The other half of the same statement: a title whose blob is '[]' has no
// pre-0048 copy to protect, so it is filled rather than refused. This is the shape
// /metadata/fill meets most often, an IMDb import's leftovers with a pinned id and
// nothing else.
//
// What the fill is FOR has narrowed since the distractors moved off the column —
// the CASE is what keeps `cast_json` in the UPDATE's column list, which is what a
// cast-only approval proves ownership with — and the behaviour is pinned either
// way, because the last assertion below is that half of it.
func TestAnEmptyBlobIsStillFilledByAnApprovedCast(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Matrix"}, http.StatusCreated))

	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{"type": "movie", "id": m.ID, "set": map[string]any{
			"cast": []map[string]any{{"character": "Neo", "actor": "Keanu Reeves", "person_id": "6384"}},
		}}},
	}, http.StatusOK)

	var blob string
	if err := srv.Store.DB.QueryRow(`SELECT COALESCE(cast_json,'') FROM movies WHERE id = ?`,
		m.ID).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(blob, "Keanu Reeves") {
		t.Fatalf("an empty blob is a gap, not a copy worth keeping: %q", blob)
	}
	// And a cast-only approval still lands: with no other approved field, the
	// conditional cast_json statement is the ONLY column in the UPDATE, and it is
	// what proves the row is the caller's.
	if list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast").Cast; len(list) != 1 {
		t.Fatalf("a cast-only approval must still write the mapping: %+v", list)
	}
}

// A LINE ARRIVES WITH ITS CHARACTERS' PICTURES (0050).
//
// The fold is the point. A quote names its character as text and the picture
// hangs off a work_cast row keyed by store.CastKey(name) — a fold SQLite cannot
// perform, because its lower() has no Unicode tables. So the match is made in Go,
// and this asserts it works through the case and punctuation differences a reader
// actually types, not just on an exact string.
func TestADialogueArrivesWithItsCharacterPictures(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film, withArt, _ := seedTVDBCast(t, srv, c)

	srv.fetchImage = func(context.Context, string, string) (string, error) {
		return "waller-stored.jpg", nil
	}
	c.mustDo("POST", "/cast/"+itoa(withArt)+"/image", nil, http.StatusOK)

	// The line spells her differently from the cast row — lower case, and a
	// straight space. The fold is what has to bridge that.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "You're going to die.",
		"character": "amanda  waller", "actor": "Viola Davis",
	}, http.StatusCreated)
	// THE FOLD THAT A LOWERCASE WOULD MISS, and the direction matters. The cast row
	// is stored with a STRAIGHT apostrophe, so its folded key holds one; the LINE
	// is typed with a curly one. Only CastKey's punctuation fold bridges that —
	// strings.ToLower leaves the curly quote alone and finds nothing.
	//
	// The other direction proves nothing: a curly cast row is folded to straight on
	// write, so a straight line matches it under a plain lowercase too. The first
	// version of this test had it that way round and passed against ToLower.
	curly := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "D'Artagnan", "actor": "Somebody Else"},
		http.StatusCreated))
	if _, err := srv.Store.DB.Exec(
		`UPDATE work_cast SET character_image_path = ? WHERE id = ?`,
		"dartagnan-stored.jpg", curly.ID); err != nil {
		t.Fatal(err)
	}
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "All for one.", "character": "D’Artagnan",
	}, http.StatusCreated)
	// And a line whose character has no stored picture at all.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "Nothing to see.", "character": "Uncredited Extra",
	}, http.StatusCreated)

	type row struct {
		Quote           string `json:"quote"`
		CharacterImages []struct {
			Name string `json:"name"`
			Path string `json:"path"`
		} `json:"character_images"`
	}
	got := decode[struct {
		Dialogues []row `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(film), nil, http.StatusOK))
	if len(got.Dialogues) != 3 {
		t.Fatalf("want three lines, got %+v", got.Dialogues)
	}

	byQuote := map[string]row{}
	for _, d := range got.Dialogues {
		byQuote[d.Quote] = d
	}
	waller := byQuote["You're going to die."]
	if len(waller.CharacterImages) != 1 {
		t.Fatalf("the folded match failed: %+v", waller.CharacterImages)
	}
	if waller.CharacterImages[0].Path != "waller-stored.jpg" {
		t.Errorf("path = %q, want the stored picture", waller.CharacterImages[0].Path)
	}
	// THE NAME COMES OFF THE LINE, NOT OFF THE CAST ROW — the line is what the
	// reader is looking at. Lower case here, where the cast row says "Amanda
	// Waller": the fold is for MATCHING and must not leak into the display.
	// Internal whitespace is collapsed, because that is what SplitCredits does to
	// every credit in the app and a chip should not carry a double space.
	if waller.CharacterImages[0].Name != "amanda waller" {
		t.Errorf("name = %q, want the line's own spelling (case kept, spaces collapsed)",
			waller.CharacterImages[0].Name)
	}
	// The curly/straight apostrophe pair matched, which only CastKey's fold does.
	if d := byQuote["All for one."]; len(d.CharacterImages) != 1 ||
		d.CharacterImages[0].Path != "dartagnan-stored.jpg" {
		t.Errorf("the typographic fold failed: %+v — a plain lowercase would do this",
			d.CharacterImages)
	}
	// A CHARACTER WITH NO PICTURE IS PRESENT WITH AN EMPTY PATH, which is the
	// reversal of what this case used to assert. It read "absent, not
	// present-and-empty", on the reasoning that a face row must be able to tell
	// "no picture" from "no character" — and the empty path tells it just as well,
	// while dropping the entry told the client nothing about a character it was
	// then unable to name. The card stops printing its own character text once any
	// chip draws, so a dropped name is a name the reader loses.
	extra := byQuote["Nothing to see."].CharacterImages
	if len(extra) != 1 {
		t.Fatalf("a character with no stored picture produced %d entr(ies), want 1", len(extra))
	}
	if extra[0].Name != "Uncredited Extra" || extra[0].Path != "" {
		t.Errorf("got %+v, want the name with an empty path", extra[0])
	}
}

// A LIBRARY WITH NO CHARACTER ART AT ALL STILL GETS THE ROSTER, which is the
// case the picture gate hid. All three fill sites ran the fold inside
// `if found := loadCharacterImages(...); len(found) > 0`, so a reader who had
// never stored a single character picture — most readers, and every new library —
// got `character_images` on no line whatsoever. The client draws a chip per entry
// and the card stops printing its own character text once any chip draws, so the
// two states that gate produced were "chips for the pictured names only" and "no
// chips at all", and the second is not an empty state: it is a card that names
// nobody where the reader typed three names.
func TestALineNamesItsCharactersWithNoStoredArtAnywhere(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Casablanca"}, http.StatusCreated)).ID

	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "Round up the usual suspects.",
		"character": "Rick, Ilsa, Sam",
	}, http.StatusCreated)

	type row struct {
		CharacterImages []struct {
			Name string `json:"name"`
			Path string `json:"path"`
		} `json:"character_images"`
	}
	got := decode[struct {
		Dialogues []row `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(film), nil, http.StatusOK))
	if len(got.Dialogues) != 1 {
		t.Fatalf("want one line, got %d", len(got.Dialogues))
	}
	names := []string{}
	for _, ci := range got.Dialogues[0].CharacterImages {
		if ci.Path != "" {
			t.Errorf("%s carries a path %q on a library with no art", ci.Name, ci.Path)
		}
		names = append(names, ci.Name)
	}
	// IN THE ORDER THE READER TYPED THEM, and all three of them: the row is what
	// the card shows instead of the text it no longer prints.
	if len(names) != 3 || names[0] != "Rick" || names[1] != "Ilsa" || names[2] != "Sam" {
		t.Errorf("got %v, want [Rick Ilsa Sam]", names)
	}
}

// A BOOK'S CHARACTER GETS A PICTURE TOO (0050), and the parity guard is what
// caught this being missing.
//
// Nobody plays Ahab, so a book quote has a character and no actor at all — which
// is exactly why leaving books out would have been the wrong kind of incomplete:
// a chip falling back to the author on one screen and drawing the character on
// another, for the same reader, with nothing saying why.
func TestABookQuoteArrivesWithItsCharacterPicture(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Moby-Dick", "author": "Herman Melville"}, http.StatusCreated))

	// A cast row on a BOOK takes no actor (0047) — the API refuses one.
	row := decode[castRow](t, c.mustDo("POST", "/books/"+itoa(book.ID)+"/cast",
		map[string]any{"character": "Ahab"}, http.StatusCreated))
	if _, err := srv.Store.DB.Exec(
		`UPDATE work_cast SET character_image_path = ? WHERE id = ?`, "ahab.jpg", row.ID); err != nil {
		t.Fatal(err)
	}

	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "From hell's heart I stab at thee.",
		"character": "ahab",
	}, http.StatusCreated)

	got := decode[struct {
		Annotations []struct {
			CharacterImages []struct {
				Name string `json:"name"`
				Path string `json:"path"`
			} `json:"character_images"`
		} `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(book.ID), nil, http.StatusOK))

	if len(got.Annotations) != 1 {
		t.Fatalf("want one annotation, got %d", len(got.Annotations))
	}
	imgs := got.Annotations[0].CharacterImages
	if len(imgs) != 1 || imgs[0].Path != "ahab.jpg" {
		t.Fatalf("book quote's character pictures = %+v, want the one stored for Ahab", imgs)
	}
	// The name off the line, lower case as typed — the fold is for matching only.
	if imgs[0].Name != "ahab" {
		t.Errorf("name = %q, want the line's own spelling", imgs[0].Name)
	}
}

// A CAST ROW IS A DOOR, and this is the property rather than any one writer's fix.
//
// THE SPECIFICATION. `work_cast.character_id` is what makes a cast row openable:
// `characterImagesFor` puts it on the wire, the client gates a chip's press on
// it, and the work-level character screen is reached with it. So a cast row
// without one draws a pill with a name, a face and a performer under it, and
// does nothing at all when pressed. A reader cannot tell the difference until
// they press it.
//
// WHY IT IS WRITTEN OVER THE ENDPOINTS AND NOT OVER ONE FUNCTION. There are four
// ways a cast row comes into existence — a row added by hand, a name adopted off
// a quote line, "add a work to this character", and a provider fetch. A test per
// writer is a test per fix; asking the question of the routes themselves is the
// property, and the sweep at the end of the first case asks it of every row the
// work holds however it got there, so a fifth route reaching that work has to
// answer too.
//
// WHAT IT DOES NOT REACH, stated rather than implied. The provider fetch
// (`cast.go`) needs a stubbed TMDB or TheTVDB and is not exercised here, so this
// file covers THREE of the four writers by name. That is a gap and not a
// technicality: a fetched cast is the biggest single source of cast rows there
// is. Until it has a stub, `LinkCastRow` being the one mechanism all four share
// is what carries it — neutering that function's character branch fails every
// case below, which is the evidence that the property is about the mechanism and
// not about three call sites.
//
// IT ALSO REPLACES A TEST THAT COULD NOT FAIL. `internal/store/onetime_cast_records_test.go`
// asserted the same column through a one-time pass, and with that pass's body
// replaced by `return nil` all four of its cases still passed: the work was being
// done by `backfillCast` in the sibling 3.1.0 pass, which runs in the same boot.
// The pass was redundant and is deleted; this asks the question where a reader
// would notice the answer.

type doorRow struct {
	ID          int64  `json:"id"`
	Character   string `json:"character"`
	Actor       string `json:"actor"`
	CharacterID int64  `json:"character_id"`
}
type doorList struct {
	Cast []doorRow `json:"cast"`
}

func TestEveryRouteThatCreatesACastRowMakesItADoor(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Casablanca", "media_type": "movie"}, http.StatusCreated))
	book := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The Master and Margarita"}, http.StatusCreated))

	// ── ROUTE 1: added by hand, on a film and on a book. A book has a cast too;
	// 0048 keyed the table on (kind, work_id) for exactly that reason.
	byHand := decode[doorRow](t, c.mustDo("POST", "/movies/"+itoa(film.ID)+"/cast",
		map[string]any{"character": "Rick Blaine", "actor": "Humphrey Bogart"}, http.StatusCreated))
	if byHand.CharacterID == 0 {
		t.Error("a cast row added by hand to a film has no character record — its chip opens nothing")
	}
	bookHand := decode[doorRow](t, c.mustDo("POST", "/books/"+itoa(book.ID)+"/cast",
		map[string]any{"character": "Woland"}, http.StatusCreated))
	if bookHand.CharacterID == 0 {
		t.Error("a cast row added by hand to a book has no character record")
	}

	// ── ROUTE 2: adopted off a quote line. A dialogue naming a character the
	// work's cast has never heard of is reconciled when that cast list is next
	// read — which is the moment the app has always chosen for it.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID,
		"quote":    "Here's looking at you, kid.", "character": "Ilsa Lund", "actor": "Ingrid Bergman",
	}, http.StatusCreated)
	after := decode[doorList](t, c.mustDo("GET", "/movies/"+itoa(film.ID)+"/cast", nil, http.StatusOK))
	var adopted *doorRow
	for i := range after.Cast {
		if after.Cast[i].Character == "Ilsa Lund" {
			adopted = &after.Cast[i]
		}
	}
	if adopted == nil {
		t.Fatal("a character named on a line was never adopted onto the work's cast")
	}
	if adopted.CharacterID == 0 {
		t.Error("a cast row adopted from a quote line has no character record — its chip opens nothing")
	}

	// ── ROUTE 3: a work added FROM the character's own screen, which arrives at
	// the table from the opposite direction — the character record exists first
	// and the cast row is made to point at it. It is the one writer that has
	// always had an id to hand, which is exactly why it is worth asserting: a
	// route that cannot get this wrong today is a route whose next edit can.
	if byHand.CharacterID == 0 {
		t.Fatal("no character record to add a work to")
	}
	second := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Passage to Marseille", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("POST", "/characters/"+itoa(byHand.CharacterID)+"/works",
		map[string]any{"kind": "movie", "work_id": second.ID, "actor": "Humphrey Bogart"}, http.StatusOK)
	other := decode[doorList](t, c.mustDo("GET", "/movies/"+itoa(second.ID)+"/cast", nil, http.StatusOK))
	if len(other.Cast) == 0 {
		t.Fatal("adding a work to a character wrote no cast row")
	}
	for _, r := range other.Cast {
		if r.CharacterID == 0 {
			t.Errorf("the row \"add a work to this character\" wrote (%q) opens nothing", r.Character)
		}
		// AND IT OPENS THE CHARACTER YOU ADDED THE WORK TO, which on this route is
		// the whole question and is NOT the same one as above. `LinkCastRow` fills
		// a null id by resolving the NAME within the work, so a row that lost its
		// id here still comes back a door — pointing at a record the reader never
		// chose, or at a fresh one that splits the character in two. Asking only
		// "is there an id" passes on exactly that: the mutation that replaces this
		// INSERT's id with nil leaves every row openable and every name intact,
		// and the only visible symptom is a character quietly becoming two.
		// character_works.go's own comment names the hazard — "under the wrong
		// record — silently, and permanently".
		if r.CharacterID != byHand.CharacterID {
			t.Errorf("added a work to character %d and the row landed on character %d — the reader's choice was resolved away",
				byHand.CharacterID, r.CharacterID)
		}
	}

	// ── AND EVERY ROW THE WORK HOLDS, however it got there. The sweep is the
	// point: a route this test does not know about still has to answer.
	for _, r := range after.Cast {
		if r.Character != "" && r.CharacterID == 0 {
			t.Errorf("cast row %d (%q) is drawn as a door and opens nothing", r.ID, r.Character)
		}
	}
}

// AND TWO WORKS BILLING ONE NAME ARE TWO CHARACTERS, which is the other half of
// the specification and the half a careless fix breaks.
//
// "Narrator", "Mother" and "The Doctor" recur across unrelated works and are not
// one person. The repo's own rule, from `board_handlers.go`: a wrongly-split name
// is visible and a wrongly-merged one hides a whole person. So the resolver keys
// on (kind, work, folded name) — and within ONE work the name collapses, because
// a work billing the same character twice is two rows about one character, which
// is what a per-row performer is for.
func TestOneWorkFoldsANameAndTwoWorksDoNot(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	a := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Godfather", "media_type": "movie"}, http.StatusCreated))
	b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Godfather Part II", "media_type": "movie"}, http.StatusCreated))

	// One work, one character, two performers — a young Vito and an old one.
	young := decode[doorRow](t, c.mustDo("POST", "/movies/"+itoa(a.ID)+"/cast",
		map[string]any{"character": "Vito Corleone", "actor": "Marlon Brando"}, http.StatusCreated))
	old := decode[doorRow](t, c.mustDo("POST", "/movies/"+itoa(a.ID)+"/cast",
		map[string]any{"character": "Vito Corleone", "actor": "Robert De Niro"}, http.StatusCreated))
	if young.CharacterID == 0 || old.CharacterID == 0 {
		t.Fatalf("a cast row has no character record: %d / %d", young.CharacterID, old.CharacterID)
	}
	if young.CharacterID != old.CharacterID {
		t.Errorf("one work's two rows for one character got two records (%d, %d) — the reader would see the same part twice",
			young.CharacterID, old.CharacterID)
	}

	// A second work billing the same name is a different character until a reader
	// says otherwise. Merge is their verb, and it is visible.
	elsewhere := decode[doorRow](t, c.mustDo("POST", "/movies/"+itoa(b.ID)+"/cast",
		map[string]any{"character": "Vito Corleone", "actor": "Robert De Niro"}, http.StatusCreated))
	if elsewhere.CharacterID == young.CharacterID {
		t.Errorf("two works billing one name were welded into record %d — a wrongly-merged name hides a whole person",
			young.CharacterID)
	}
}

// provider_key IS FROZEN AT SEED (0048), and these two tests are the whole of
// its enforcement.
//
// The key's one job is to match an entry in a provider's list to the row that
// entry seeded last time, which makes it the merge's identity anchor: the
// retraction pass and carryWorkCast both read a row's provenance through it. An
// anchor that moves is not one, and adoptCastRow used to move it — it rewrote the
// key onto whatever the fetched entry had computed, whenever the provider changed
// its own casing.
//
// Both tests below drive the SAME pair through the SAME provider twice, which is
// the only way to see a key that flips: one refetch looks like a correction, two
// show it swapping back.

// castProviderKeys reads a work's provider keys in billing order — the column
// nothing on the wire reports, because no client has any business knowing it.
func castProviderKeys(t *testing.T, srv *Server, movieID int64) []string {
	t.Helper()
	rows, err := srv.Store.DB.Query(
		`SELECT provider_key FROM work_cast WHERE kind = 'movie' AND work_id = ?
		 ORDER BY billing, id`, movieID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			t.Fatal(err)
		}
		out = append(out, k)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}

// A PROVIDER THAT BILLS ONE PERSON TWICE, in two casings, is exactly the double
// billing 0048's backfill has an INSERT OR IGNORE for — and the merge has to
// reach the same answer the backfill does: the first entry gets the row and the
// second is dropped.
//
// It could not, because one row is reachable by TWO fetched entries: entry one by
// its provider key, entry two by its folded pair through adoptCastRow. So entry
// two arrived at a row the loop had already written, re-keyed it, and — because a
// freshly INSERTED row was never marked as seen — rewrote its names and its
// billing too. The row ended up recording whichever spelling the provider
// happened to list second, and then swapped back and forth on every refetch as
// the two entries took turns matching by key.
func TestADoubleBilledProviderEntryDoesNotFlipTheRowsKey(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"Neo","name":"Keanu Reeves"},
	                          {"id":6384,"character":"neo","name":"keanu reeves"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	want := store.ProviderKey("Neo", "Keanu Reeves")

	// Three passes: the seed and two refetches. Nothing about the row may move on
	// any of them, and a key that flips needs the second refetch to be visible.
	for pass, label := range []string{"the seed", "the first refetch", "the second refetch"} {
		if pass > 0 {
			resyncFromTMDB(t, c, m.ID)
		}
		list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
		if len(list.Cast) != 1 {
			t.Fatalf("%s: the pair unique allows one row, got %+v", label, list.Cast)
		}
		if list.Cast[0].Character != "Neo" || list.Cast[0].Actor != "Keanu Reeves" {
			t.Fatalf("%s: the entry that seeded the row must keep it, got %q / %q",
				label, list.Cast[0].Character, list.Cast[0].Actor)
		}
		if list.Cast[0].Billing != 0 {
			t.Fatalf("%s: billing = %d — the second entry took the row over",
				label, list.Cast[0].Billing)
		}
		if keys := castProviderKeys(t, srv, m.ID); len(keys) != 1 || keys[0] != want {
			t.Fatalf("%s: provider keys = %q, want [%q] — the merge's identity anchor moved",
				label, keys, want)
		}
	}
}

// A SUPPLIER RE-CASING ITS OWN NAME is the case the re-key was written for, and
// the case that proves it wrong. The folded pair does not move, so the row is
// found either way; only the key the fetched entry computes has changed.
//
// The row takes the new spelling, because it is an untouched provider row and the
// provider is its only author. Its KEY does not, because the key records which
// entry seeded it, and the next fetch finds it by folded pair regardless — one
// extra indexed lookup, in exchange for a column that means the same thing on
// every boot.
func TestAProviderRecasingANameDoesNotRekeyTheRowItSeeded(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"Neo","name":"Keanu Reeves"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	seeded := store.ProviderKey("Neo", "Keanu Reeves")
	if keys := castProviderKeys(t, srv, m.ID); len(keys) != 1 || keys[0] != seeded {
		t.Fatalf("the seed should key the row by the entry that made it: %q", keys)
	}

	// Same person, same folded pair, a different key.
	stub.cast = `[{"id":6384,"character":"NEO","name":"KEANU REEVES","profile_path":"/k.jpg"}]`
	for _, label := range []string{"the first refetch", "the second refetch"} {
		resyncFromTMDB(t, c, m.ID)
		row := castRowFor(t, c, m.ID, "NEO")
		if row.Actor != "KEANU REEVES" {
			t.Fatalf("%s: an untouched provider row takes the provider's spelling: %+v", label, row)
		}
		if row.ImageURL == "" {
			t.Fatalf("%s: and its facts: %+v", label, row)
		}
		if keys := castProviderKeys(t, srv, m.ID); len(keys) != 1 || keys[0] != seeded {
			t.Fatalf("%s: provider keys = %q, want [%q] — the key is frozen at seed",
				label, keys, seeded)
		}
	}
}

// THE ACTOR→PORTRAIT RESOLVER READS THE MAPPING (0048).
//
// Pinning an actor to a provider id from the cast of a film they are IN is the
// whole reason this path exists: the film is the disambiguator, so the id is
// exact. The fallback when nothing is pinned is a by-name person search that the
// code's own comment calls namesake-prone.
//
// Until 0048 the lookup read movies.cast_json — a blob no /cast edit has ever
// written. So the two things the mapping added, a corrected name and a game's
// voice cast, were exactly the two the resolver could not see, and every one of
// them fell through to the namesake-prone search. Both tests below are that fall.

// portraitTMDB is a fake TMDB that ALSO answers the person endpoints, so a
// by-name fallback SUCCEEDS. That is what makes these tests assertions: without
// it the fallback fails too, and a broken lookup is indistinguishable from a
// correct one that found nothing.
func portraitTMDB(t *testing.T, cast string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search/movie":
			_, _ = fmt.Fprint(w, `{"results":[{"id":603,"title":"Portal 2","release_date":"2011-04-19"}]}`)
		case "/movie/603":
			_, _ = fmt.Fprintf(w, `{"id":603,"title":"Portal 2","overview":"A test.","release_date":"2011-04-19",
				"credits":{"cast":%s,"crew":[]}}`, cast)
		case "/search/person":
			// The namesake. A different id, and a headshot of somebody else.
			_, _ = fmt.Fprint(w, `{"results":[{"id":111111,"profile_path":"/namesake.jpg"}]}`)
		default:
			// Every /person/{id} lookup, whichever id got there.
			_, _ = fmt.Fprintf(w, `{"id":0,"biography":"A bio.","birthday":"1943-08-17",
				"profile_path":"%s"}`, "/from-person-"+r.URL.Path[len("/person/"):])
		}
	}))
}

// A NAME THE READER CORRECTS MUST GO ON MATCHING.
//
// The mapping fills dialogues.actor now, so a quote saved after a correction
// carries the corrected spelling and the people page shows it. The blob still
// held the provider's misspelling, so the lookup missed and resolveActorMeta fell
// through to the by-name search — pinning whatever namesake TMDB returns first,
// on a person whose exact id was sitting on the cast row all along.
func TestACorrectedActorNameStillPinsThePortraitFromTheCast(t *testing.T) {
	srv := newTestServer(t)
	fake := portraitTMDB(t, `[{"id":380,"character":"Neil McCauley","name":"Robert De Nero","profile_path":"/de.jpg"}]`)
	defer fake.Close()
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	var fetched string
	srv.fetchImage = func(_ context.Context, rawURL, _ string) (string, error) {
		fetched = rawURL
		return "bbbbbbbbbbbbbbbb.jpg", nil
	}
	c := signupAdmin(t, srv.Handler())

	m := addFromTMDB(t, c)
	misspelt := castRowFor(t, c, m.ID, "Neil McCauley")
	if misspelt.Actor != "Robert De Nero" {
		t.Fatalf("fixture: %+v", misspelt)
	}
	c.mustDo("PUT", "/cast/"+itoa(misspelt.ID), map[string]any{
		"character": "Neil McCauley", "actor": "Robert De Niro",
	}, http.StatusOK)

	// The chip on the people page exists because a quote names them — and the name
	// the quote carries is the corrected one, taken from the mapping on save.
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Don't let yourself get attached.", "character": "Neil McCauley",
	}, http.StatusCreated))
	if d.Actor != "Robert De Niro" {
		t.Fatalf("the auto-fill should have taken the corrected name: %+v", d)
	}

	res := decode[portraitResp](t, c.mustDo("POST", "/people/portrait",
		map[string]any{"kind": "actor", "name": "Robert De Niro"}, http.StatusOK))
	if !res.Resolved || !res.Image {
		t.Fatalf("portrait not resolved: %+v", res)
	}
	if res.Person.Source != "tmdb" || res.Person.SourceID != "380" {
		t.Fatalf("actor identity = %s:%s — the cast row's own person id is exact, and the "+
			"by-name search it fell back to is namesake-prone",
			res.Person.Source, res.Person.SourceID)
	}
	if fetched != "https://image.tmdb.org/t/p/original/de.jpg" {
		t.Fatalf("fetched %q, want the cast row's own headshot", fetched)
	}
}

// A GAME'S VOICE ACTOR HAS NOWHERE ELSE TO COME FROM. For most games the blob is
// '[]' (TIP-META-018 measures it: 14 of 24 titles have no Wikidata credits at
// all), and the whole point of the mapping is that the voice cast can now be
// typed or seeded into it. Read from the blob, every one of those actors resolved
// by name.
//
// It also pins the SOURCE WORD. The row names its own supplier now, so a
// Wikidata-seeded credit says 'wikidata' where the blob path labelled it from the
// film's tmdb_id/tvdb_id and said 'tvdb' about a QID. A QID is not a TMDB person
// id and must never be handed to /person/{id}; nor may the by-name search be
// allowed to replace it with a namesake's, which is what this fake returns.
func TestAGamesVoiceActorResolvesFromItsOwnCastRow(t *testing.T) {
	srv := newTestServer(t)
	fake := portraitTMDB(t, `[]`)
	defer fake.Close()
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	var fetched string
	srv.fetchImage = func(_ context.Context, rawURL, _ string) (string, error) {
		fetched = rawURL
		return "cccccccccccccccc.jpg", nil
	}
	c := signupAdmin(t, srv.Handler())

	game := createGame(t, c, "Portal 2", "Valve")
	// The shape the Wikidata voice-cast join writes: a QID for a person id and a
	// Commons portrait. Written directly because the provider path for it is a
	// second best-effort request that a test has no business standing up.
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key,
		                        provider_key, person_id, image_url, billing, origin, source)
		 VALUES (1, 'movie', ?, 'GLaDOS', ?, 'Ellen McLain', ?, ?, 'Q3050810',
		         'https://commons/mclain.jpg', 0, 'provider', 'wikidata')`,
		game, store.CastKey("GLaDOS"), store.CastKey("Ellen McLain"),
		store.ProviderKey("GLaDOS", "Ellen McLain")); err != nil {
		t.Fatal(err)
	}
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game, "quote": "The cake is a lie.", "character": "GLaDOS",
	}, http.StatusCreated)

	res := decode[portraitResp](t, c.mustDo("POST", "/people/portrait",
		map[string]any{"kind": "actor", "name": "Ellen McLain"}, http.StatusOK))
	if !res.Resolved || !res.Image {
		t.Fatalf("portrait not resolved: %+v", res)
	}
	if res.Person.Source != "wikidata" || res.Person.SourceID != "Q3050810" {
		t.Fatalf("identity = %s:%s — a game's credit is Wikidata's, and a QID must not "+
			"be swapped for whatever a by-name TMDB search returns first",
			res.Person.Source, res.Person.SourceID)
	}
	if fetched != "https://commons/mclain.jpg" {
		t.Fatalf("fetched %q, want the cast row's own headshot", fetched)
	}
}

// A DELETED CREDIT IS NOT A PLACE TO GET A HEADSHOT FROM. The tombstone keeps the
// row's names and its facts so a refetch can decline to resurrect it — which
// makes it exactly the kind of row a lookup that forgets to filter will find.
func TestADeletedCastRowGivesNoPortrait(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Heat"}, http.StatusCreated))
	seeded := seedProviderCast(t, srv, 1, "movie", m.ID, [2]string{"Neil McCauley", "Robert De Niro"})
	c.mustDo("DELETE", "/cast/"+itoa(seeded[0]), nil, http.StatusNoContent)

	// No TMDB key, so there is no fallback to confuse the answer with: the only
	// thing that could resolve this is the tombstone.
	src, pid, img := srv.actorPortraitFromCast(1, "Robert De Niro")
	if src != "" || pid != "" || img != "" {
		t.Fatalf("a tombstone answered a portrait lookup: %q %q %q", src, pid, img)
	}
}

// WHAT ACTUALLY ENFORCES THE MERGE RULE (0048).
//
// Two of the mechanisms 0048's header names as protections turned out to be
// unpinned: a skeptic deleted each one and the whole suite went on passing. That
// is worse than an unprotected row, because the comment reads as a guarantee and
// the next person to tidy the function has nothing telling them they broke it.
//
// So this file is the other half of cast_merge_test.go. Where that file proves the
// RULE ("my row survived"), each test here fails when a specific STATEMENT is
// removed, and its comment names the statement. Both cases need a fetch that has
// stopped listing something or has changed its own spelling — which is why no
// existing test reached them: every one of those either keeps the provider's list
// constant or changes a name on a row that is still in it.

// THE STATEMENT: `row.origin != castProvider` in mergeProviderCast's retraction
// pass. Delete it and this test fails with the reader's row gone.
//
// A HAND-TYPED ROW IS NOT PROTECTED "BY CONSTRUCTION", which is what 0048 and
// cast.go both said, and that claim is why this case was missed. The claim was
// that a reader row has no provider_key and the merge reads only rows that have
// one, so a refetch cannot see it at all. True on the day it is typed, and false
// from the first fetch in which the provider catches up: adoptCastRow gives that
// row a provider key, deliberately, so the listing is re-matched rather than
// duplicated beside it. From then on the row IS in the merge's set, and the only
// thing between it and a DELETE is the origin check in the retraction pass.
//
// TestAdoptingAReaderRowTheProviderLaterAgreesWith stops one step short of this:
// it refetches twice with the provider still listing the entry, so the retraction
// pass never considers the row. The provider dropping it again is the case, and it
// is not exotic — it is what happens when a supplier tidies an uncredited part
// back out of its list after the reader has already typed it in.
func TestARetractionLeavesTheReadersAdoptedRowAlone(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	mine := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{
		"character": "wheatley", "actor": "stephen merchant",
	}, http.StatusCreated))

	// The provider catches up, and adoption claims the row — the step that makes it
	// visible to every later merge.
	stub.cast = `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	              {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`
	resyncFromTMDB(t, c, m.ID)
	var key string
	if err := srv.Store.DB.QueryRow(
		`SELECT provider_key FROM work_cast WHERE id = ?`, mine.ID).Scan(&key); err != nil {
		t.Fatal(err)
	}
	if key == "" {
		t.Fatal("the row was not adopted, so this test is not testing what it says it is")
	}

	// And now the provider drops the entry again. The row is in the merge's stored
	// set, the fresh list does not account for it, and it must not go.
	stub.cast = `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`
	resyncFromTMDB(t, c, m.ID)

	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 2 {
		t.Fatalf("a retraction deleted the reader's own row: %+v", list.Cast)
	}
	kept := castRowFor(t, c, m.ID, "wheatley")
	if kept.ID != mine.ID || kept.Actor != "stephen merchant" || kept.Origin != "reader" {
		t.Fatalf("a hand-typed credit must survive the provider changing its mind: %+v", kept)
	}
}

// THE SAME STATEMENT, on the other origin it protects: a correction. Delete the
// origin check and this test fails on its first assertion — the corrected row is
// deleted outright the moment the provider stops listing the entry behind it.
//
// The second half is the retraction comment's own claim, which was equally
// unpinned: a retracted correction KEEPS ITS PROVIDER KEY, so the provider listing
// that person again re-matches the row instead of adding a second one beside it.
// Clear the key on retraction rather than keeping the row and the count below
// reads 3.
func TestARetractedCorrectionIsKeptAndStillRematched(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	                          {"id":7,"character":"wheatley","name":"Stephen Merchant"}]`}
	_, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	w := castRowFor(t, c, m.ID, "wheatley")
	c.mustDo("PUT", "/cast/"+itoa(w.ID), map[string]any{
		"character": "Wheatley", "actor": "Stephen Merchant",
	}, http.StatusOK)

	stub.cast = `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`
	resyncFromTMDB(t, c, m.ID)

	kept := castRowFor(t, c, m.ID, "Wheatley")
	if kept.ID != w.ID || kept.Origin != "corrected" {
		t.Fatalf("a retraction took a name the reader had fixed: %+v", kept)
	}

	// The provider lists the person again, in its own spelling. The row's frozen key
	// still matches that entry, so it is claimed rather than duplicated — and the
	// correction survives being re-matched, which is what makes the protection
	// permanent rather than good for one fetch.
	stub.cast = `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	              {"id":7,"character":"wheatley","name":"Stephen Merchant"}]`
	resyncFromTMDB(t, c, m.ID)

	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 2 {
		t.Fatalf("the re-listed entry was added beside the correction instead of claiming it: %+v", list.Cast)
	}
	again := castRowFor(t, c, m.ID, "Wheatley")
	if again.ID != w.ID || again.Origin != "corrected" {
		t.Fatalf("the correction did not survive the provider agreeing with it again: %+v", again)
	}
}

// THE STATEMENT: the empty `case castRemoved:` in mergeProviderCast's switch. Fold
// it into the provider case — `case castProvider, castRemoved:` — and this test
// fails on the tombstone's stored names; let it fall through to `default:` instead
// and it fails on the billing and the portrait URL.
//
// WHAT THAT BRANCH DOES AND DOES NOT ENFORCE, because the comment on it claimed
// the wrong one. It is NOT what stops a deleted row coming back: nothing in the
// merge writes `origin` at all, so a tombstone stays a tombstone down every
// branch, and what makes it invisible is handleDeleteCast keeping the row plus the
// `origin <> 'removed'` filter on every read.
// TestARemovedCastRowIsNotResurrectedByARefetch pins that, and it passes with this
// branch deleted — which is exactly how the branch came to look load-bearing while
// pinning nothing.
//
// What it does enforce is narrower and real: A TOMBSTONE RECORDS WHAT THE READER
// DELETED, IN THE WORDS THEY WERE LOOKING AT. It is the one row in the table
// nobody can see, so the export is the only place it is ever shown back to them —
// and if a refetch may rewrite it, the file describes their deletion in a spelling
// they never saw and re-orders it against the list.
//
// THE ROUTE IN IS A SUPPLIER RE-CASING ITS OWN NAMES, which no other test in the
// feature exercises. Re-casing changes the provider key and not the folded pair, so
// the fresh entry misses byKey and lands in adoptCastRow — which returns the
// TOMBSTONE rather than passing over it. That is a second unpinned statement on
// the same path: add `AND origin <> 'removed'` to that lookup and the entry
// inserts a fresh live row instead, resurrecting the credit by the side door,
// which is what the first two assertions below catch.
func TestARecasedRefetchNeitherRevivesNorRewritesTheTombstone(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	                          {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	gone := castRowFor(t, c, m.ID, "Wheatley")
	if gone.Billing != 1 || gone.ImageURL != "" {
		t.Fatalf("the fixture is wrong: this row must start second-billed and with no headshot: %+v", gone)
	}
	c.mustDo("DELETE", "/cast/"+itoa(gone.ID), nil, http.StatusNoContent)

	// The supplier re-cases both names AND bills the entry first, and now has a
	// portrait for it. All three are things the provider owns on a live row and must
	// not write onto a deletion.
	stub.cast = `[{"id":7,"character":"WHEATLEY","name":"STEPHEN MERCHANT","profile_path":"/s.jpg"},
	              {"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`
	resyncFromTMDB(t, c, m.ID)

	// Not revived, and not duplicated either — adoptCastRow found the tombstone.
	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 1 || list.Cast[0].Character != "GLaDOS" {
		t.Fatalf("the deleted credit came back under the provider's new casing: %+v", list.Cast)
	}
	var rows int
	if err := srv.Store.DB.QueryRow(
		`SELECT COUNT(*) FROM work_cast WHERE kind = 'movie' AND work_id = ?`, m.ID).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if rows != 2 {
		t.Fatalf("work_cast holds %d rows, want 2 — a second row was inserted beside the tombstone", rows)
	}

	// And the tombstone still says what the reader deleted.
	var character, actor, origin, imageURL string
	var billing int
	if err := srv.Store.DB.QueryRow(
		`SELECT character, actor, billing, origin, image_url FROM work_cast WHERE id = ?`, gone.ID).
		Scan(&character, &actor, &billing, &origin, &imageURL); err != nil {
		t.Fatal(err)
	}
	if character != "Wheatley" || actor != "Stephen Merchant" {
		t.Fatalf("the tombstone was rewritten to %q / %q — it records the row the reader deleted, "+
			"in the words they were looking at when they deleted it", character, actor)
	}
	if billing != 1 || imageURL != "" || origin != "removed" {
		t.Fatalf("a refetch wrote the provider's facts onto a deletion: billing %d, image %q, origin %q",
			billing, imageURL, origin)
	}

	// THE CONSEQUENCE, in the one place a tombstone is ever shown back: the file.
	// The whole line is asserted rather than a substring, because the defect this
	// pins moves the deletion to the head of the list as well as respelling it.
	md := c.mustDo("GET", "/movies/"+itoa(m.ID)+"/export", nil, http.StatusOK).Body.String()
	want := "cast: GLaDOS — Ellen McLain; Wheatley — Stephen Merchant (removed)"
	if !strings.Contains(md, want) {
		t.Fatalf("the export should carry the reader's own deletion record, %q:\n%s", want, md)
	}
}

// THE QUIZ'S "WHO SAID THIS?" POOL COMES FROM THE MAPPING (0048).
//
// This file used to hold TestAGamesTypedVoiceCastIsNotYetAQuizDistractor: a
// tripwire that ASSERTED THE DEFECT, written to fail the day somebody pointed
// quizPools at work_cast so that a known gap was announced rather than
// discovered. It has fired, and these are its fixtures with the assertions turned
// round.
//
// WHY IT WAS LIFTED HERE and not, as it planned, in the commit that drops
// movies.cast_json. Making applyReverifyMovie's cast_json write FILL-ONLY was
// correct and fixed a real defect — /metadata/fill applies through that function,
// and a bulk button with no human in it was rewriting the one pre-0048 copy of
// what the provider said. But castActors was the column's last reader, so the
// freeze starved it: an approved cast diff now writes the mapping and not the
// blob, and the pool went permanently stale, while resyncMovieFromSource still
// replaces the blob whole — one title answering "who else is in this film?" two
// different ways depending on which button the reader pressed. Unfreezing the
// blob hands the first defect back. Moving the reader fixes both, and takes the
// deferral with it.

// poolCast is one work's distractor pool as quizPools builds it.
func poolCast(t *testing.T, srv *Server, uid, movieID int64) []string {
	t.Helper()
	pools, err := srv.quizPools(uid, reviewScope{screen: true}, 1)
	if err != nil {
		t.Fatal(err)
	}
	return pools.byKey[kindScreen+":"+itoa(movieID)].cast
}

// A GAME'S TYPED VOICE CAST IS A DISTRACTOR NOW — the deferral, lifted.
//
// IGDB has no credit endpoint and the Wikidata join finds nothing for most titles
// (TIP-META-018: 14 of 24 measured games had no usable voice cast), so
// movies.cast_json is '[]' for nearly every game and always was. The voice cast
// somebody had just finished typing fed the quote form's autofill, the film page,
// the portrait resolver and the export — and did not feed the one screen that
// would ask them about it.
func TestAGamesTypedVoiceCastFeedsTheQuiz(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	game := createGame(t, c, "Portal 2", "Valve")
	film := createFilm(t, c, "Heat", "Michael Mann")

	// The game's voice cast exists ONLY in work_cast, which for a game is the
	// normal state and not an unusual fixture.
	for _, pair := range [][2]string{
		{"GLaDOS", "Ellen McLain"},
		{"Wheatley", "Stephen Merchant"},
		{"Cave Johnson", "J.K. Simmons"},
	} {
		c.mustDo("POST", "/movies/"+itoa(game)+"/cast", map[string]any{
			"character": pair[0], "actor": pair[1],
		}, http.StatusCreated)
	}
	var blob string
	if err := srv.Store.DB.QueryRow(`SELECT cast_json FROM movies WHERE id = ?`, game).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if blob != "[]" {
		t.Fatalf("cast_json = %q — typing a cast row must not write the blob, or this test proves nothing", blob)
	}

	// THE FILM IS THE CONTROL, and it is what says the loader reads the mapping
	// rather than merely reading something: its mapping and its blob disagree, the
	// way they do on every title whose cast has been corrected or approved since
	// 0048, and only one of the two answers is the reader's.
	seedProviderCast(t, srv, 1, "movie", film,
		[2]string{"Neil McCauley", "Robert De Niro"}, [2]string{"Vincent Hanna", "Al Pacino"})
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET cast_json = ? WHERE id = ?`,
		`[{"character":"Nobody","actor":"A Name The Mapping Does Not Have"}]`, film); err != nil {
		t.Fatal(err)
	}

	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game, "quote": "The cake is a lie.", "character": "GLaDOS",
	}, http.StatusCreated)

	// uid 1 is the admin this suite's signup creates, as seedProviderCast assumes.
	pools, err := srv.quizPools(1, reviewScope{screen: true}, 1)
	if err != nil {
		t.Fatal(err)
	}

	gameCast := pools.byKey[kindScreen+":"+itoa(game)].cast
	want := []string{"Ellen McLain", "Stephen Merchant", "J.K. Simmons"}
	if len(gameCast) != len(want) {
		t.Fatalf("the game's pool = %+v, want %+v — a game's credits live in the mapping "+
			"and nowhere else, so reading the blob offered the card nothing at all", gameCast, want)
	}
	for i := range want {
		if gameCast[i] != want[i] {
			t.Fatalf("the game's pool[%d] = %q, want %q — billing order is roughly \"how likely "+
				"is this person to be the answer\", so it is the order of the wrong answers too",
				i, gameCast[i], want[i])
		}
	}

	filmCast := pools.byKey[kindScreen+":"+itoa(film)].cast
	if len(filmCast) != 2 || filmCast[0] != "Robert De Niro" || filmCast[1] != "Al Pacino" {
		t.Fatalf("the film's pool = %+v, want the mapping's two actors — a stale blob is "+
			"exactly what an approved cast diff leaves behind", filmCast)
	}

	// AND THE CARD IS ACTUALLY ASKABLE, which is the end of the chain and the only
	// part the reader sees. Before this the game's whole pool was the one actor
	// already saved on a quoted line — which the distractor design calls the
	// inferior pool in as many words, because offering people the reader has
	// already quoted makes the answer guessable from familiarity.
	card := reviewCard{Kind: kindScreen, ID: game, Direction: dirSpeaker,
		Quote: "The cake is a lie.", Title: "Portal 2", Character: "GLaDOS", Actor: "Ellen McLain"}
	if !attachSpeaker(&card, kindScreen+":"+itoa(game), pools, 7, tierMedium) {
		t.Fatal("no speaker card from a three-strong typed voice cast")
	}
	if len(card.Options) < speakerMinOptions {
		t.Fatalf("too few faces to be a question: %+v", card.Options)
	}
	if card.Options[card.Answer] != "Ellen McLain" {
		t.Fatalf("the answer option is not the line's voice actor: %+v (answer %d)", card.Options, card.Answer)
	}
	// The game's OWN cast supplies the distractors first, which is the whole point
	// of the direction — three actors from elsewhere in the library make the answer
	// guessable from familiarity rather than from the game. (The card still widens
	// to the library for its fourth face, because two distractors is one short of
	// quizOptions; that fallback is not what is under test here.)
	offered := map[string]bool{}
	for _, o := range card.Options {
		offered[o] = true
	}
	for _, a := range []string{"Stephen Merchant", "J.K. Simmons"} {
		if !offered[a] {
			t.Errorf("%q is in this game's voice cast and was not offered: %+v", a, card.Options)
		}
	}
}

// THE POOL FOLLOWS AN APPROVED CAST, which is the half the freeze broke.
//
// The blob is written whole by the create-from-source path and then never again
// by an approval — that is what "fill-only" means — so a title whose provider list
// has grown since it was added has a mapping the pool could not see. Measured on
// this fixture: two rows in the mapping, one name in the pool.
//
// AND THREE THINGS ARE LEFT OUT ON PURPOSE, because each would put something on
// the card that is not an answer somebody could pick.
func TestTheQuizPoolFollowsTheMappingAndLeavesOutWhatIsNotAnAnswer(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	// The provider now bills a second person and the reader approves the lot. This
	// is applyReverifyMovie, which writes the mapping and leaves the frozen blob
	// exactly as the create path wrote it.
	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{"type": "movie", "id": m.ID, "set": map[string]any{
			"cast": []map[string]any{
				{"character": "GLaDOS", "actor": "Ellen McLain", "person_id": "6384"},
				{"character": "Cave Johnson", "actor": "J.K. Simmons", "person_id": "9"},
			},
		}}},
	}, http.StatusOK)

	pool := poolCast(t, srv, 1, m.ID)
	if len(pool) != 2 {
		t.Fatalf("pool = %+v, want both approved actors — the blob still holds only the one "+
			"the create path wrote, so a card built from it goes stale the first time a "+
			"diff is approved and never recovers", pool)
	}

	// A TOMBSTONE IS NOT AN OPTION. The reader deleted the credit; offering it as a
	// wrong answer is the resurrection `origin` exists to refuse.
	gone := castRowFor(t, c, m.ID, "Cave Johnson")
	c.mustDo("DELETE", "/cast/"+itoa(gone.ID), nil, http.StatusNoContent)
	pool = poolCast(t, srv, 1, m.ID)
	if len(pool) != 1 || pool[0] != "Ellen McLain" {
		t.Fatalf("pool = %+v after a deletion, want just the credit that is still on the list", pool)
	}

	// A ROW WITH NO ACTOR IS NOT AN OPTION either — every book character has none,
	// and so does a game credit whose voice actor is still unknown. A nameless
	// distractor is not a distractor.
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{"character": "Chell"},
		http.StatusCreated)
	if pool = poolCast(t, srv, 1, m.ID); len(pool) != 1 {
		t.Fatalf("pool = %+v — a credit with no actor has no face to offer", pool)
	}

	// AND AN ACTOR BILLED TWICE IS ONE FACE. A role played young and old is two
	// credits and one person to choose between.
	seedProviderCast(t, srv, 1, "movie", m.ID,
		[2]string{"Young Vito", "Robert De Niro"}, [2]string{"Vito", "Robert De Niro"})
	pool = poolCast(t, srv, 1, m.ID)
	if len(pool) != 2 {
		t.Fatalf("pool = %+v, want two distinct faces — a double-billed actor is offered once", pool)
	}

	// A BOOK'S CHARACTERS STAY OUT OF THE SCREEN POOL. They are cast rows on the
	// same table, they have no actor by design, and the screen pool is keyed by
	// movies.id — so a book id colliding with a film id is the way they would leak.
	book := createTestBook(t, c, "Moby-Dick", "Herman Melville")
	c.mustDo("POST", "/books/"+itoa(book)+"/cast", map[string]any{"character": "Ahab"},
		http.StatusCreated)
	if got := poolCast(t, srv, 1, m.ID); len(got) != 2 {
		t.Fatalf("pool = %+v after a book gained a character — the screen pool is "+
			"kind = 'movie' only", got)
	}
}

// A CHARACTER NAMED ON A LINE IS OPENABLE FROM THE LINE.
//
// THE SPECIFICATION. The app draws a chip per character named on a quote — a
// face and a name — and `chipRows` gates the press on `character_id`. So a chip
// whose entry has no id draws exactly like one that opens and does nothing at
// all, which is worse than no chip: the reader has already decided to go
// through it. The whole of 0056 was to make that possible, and
// `cast_from_quotes.go` exists to give a quoted character the cast row the id
// hangs off.
//
// WHY IT IS ASKED OF THE READ AND NOT OF THE ADOPTION FUNCTION. Testing
// `adoptQuoteCharacters` directly says the adoption works, which was never in
// doubt — it did work, and had exactly one caller, the cast-list read. So a
// character was openable if and only if somebody had happened to open that
// work's cast list first, and the two screens where a reader actually meets a
// character never do. A test per function passes on that arrangement; asking the
// property of the ENDPOINT THAT DRAWS THE CHIP is what catches it.
//
// The three cases below are the three shapes of the same question: a film line,
// a book line, and a character with no performer — the last because that is how
// the report arrived ("character cards without actors do not open"), and it is
// worth pinning that the actor has nothing to do with it.

type chipEntry struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	CastID      int64  `json:"cast_id"`
	CharacterID int64  `json:"character_id"`
}

type chipLine struct {
	ID              int64       `json:"id"`
	Quote           string      `json:"quote"`
	Character       string      `json:"character"`
	CharacterImages []chipEntry `json:"character_images"`
}

func TestEveryCharacterNamedOnALineCanBeOpenedFromIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Third Man", "media_type": "movie"}, http.StatusCreated))
	book := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The Fires of Heaven"}, http.StatusCreated))

	// A line naming a character AND a performer.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "I never knew the old Vienna.",
		"character": "Holly Martins", "actor": "Joseph Cotten",
	}, http.StatusCreated)
	// A line naming a character and NOBODY — the case the report came in on. An
	// unperformed character is a character: a narrator, an intertitle, a voice.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "You can see now?", "character": "Intertitle",
	}, http.StatusCreated)
	// And a book's highlight, which has no performer by design — 0047 refuses
	// `annotations.actor` — so if the door depended on one, no book would have any.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Dovie'andi se tovya sagain.", "character": "Matrim Cauthon",
	}, http.StatusCreated)

	// ── THE READ A READER ACTUALLY MAKES. Not the work's cast list — the list of
	// lines, which is what Quotes and Home draw their chips from. Nothing here
	// opens a cast list first, because a reader on those screens has not.
	for _, tc := range []struct {
		what, path, character string
	}{
		{"a film line with a performer", "/dialogues", "Holly Martins"},
		{"a film line with nobody named", "/dialogues", "Intertitle"},
		{"a book highlight", "/annotations", "Matrim Cauthon"},
	} {
		var lines []chipLine
		if tc.path == "/dialogues" {
			lines = decode[struct {
				Dialogues []chipLine `json:"dialogues"`
			}](t, c.mustDo("GET", tc.path, nil, http.StatusOK)).Dialogues
		} else {
			lines = decode[struct {
				Annotations []chipLine `json:"annotations"`
			}](t, c.mustDo("GET", tc.path, nil, http.StatusOK)).Annotations
		}
		var got *chipEntry
		for i := range lines {
			for j := range lines[i].CharacterImages {
				if lines[i].CharacterImages[j].Name == tc.character {
					got = &lines[i].CharacterImages[j]
				}
			}
		}
		if got == nil {
			t.Errorf("%s: %q is named on the line and gets no chip at all", tc.what, tc.character)
			continue
		}
		if got.CharacterID == 0 {
			t.Errorf("%s: the chip for %q has no character record — it draws a name and a face and opens nothing",
				tc.what, tc.character)
		}
	}
}

// AND READING THE LINES TWICE DOES NOT MAKE TWO CHARACTERS, which is the other
// half of it and the half a careless fix breaks. The read writes, so it has to be
// idempotent: a reader refreshing Quotes must not accumulate a cast row per
// refresh, and `origin = 'removed'` — a reader saying they do not want this
// character — must stay removed however many times the list is drawn.
func TestDrawingTheChipsTwiceAddsNothing(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Sunset Boulevard", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "I am big.", "character": "Norma Desmond", "actor": "Gloria Swanson",
	}, http.StatusCreated)

	count := func() int {
		return len(decode[doorList](t, c.mustDo("GET", "/movies/"+itoa(film.ID)+"/cast", nil, http.StatusOK)).Cast)
	}
	c.mustDo("GET", "/dialogues", nil, http.StatusOK)
	first := count()
	if first == 0 {
		t.Fatal("drawing the chips adopted nothing at all")
	}
	for i := 0; i < 3; i++ {
		c.mustDo("GET", "/dialogues", nil, http.StatusOK)
	}
	if n := count(); n != first {
		t.Errorf("four reads of the same list left %d cast rows where one read left %d — the read is not idempotent",
			n, first)
	}
}

// A CHIP CARRIES WHO PLAYS THE CHARACTER IT NAMES.
//
// THE REPORT, the owner's, of a two-hander on a film's page: "as for cards in
// work pages, single character cards are fine. multi-character ones still has a
// separate actor line."
//
// THE SPECIFICATION behind it, which is the app's standing rule about a fact
// appearing once per card: a chip says "this character, played by that person",
// and what the chip says does not get a line of its own underneath. A card with
// ONE character obeyed it — the chip's second line came off the stored speaker
// link — and a card with two did not, because the pairing was carried for the
// stored speaker alone and every other name on the line came back with the
// character and nothing else. So the card had to fall back to a PLAYED BY line
// naming both performers, and the reader read the same two names twice.
//
// WHY IT IS ASKED OF THE READ. The pairing lives in `work_cast`, one row per
// casting, and the chips are drawn from what the LIST endpoints serve — Quotes,
// Home and a work's own page all draw from the same payload. A test of the fold
// in isolation would say the fold works; what was wrong is that the fact never
// left the database.
//
// AND A BOOK ANSWERS EMPTY, deliberately. 0047 refuses `annotations.actor` and a
// book's cast has no performer, so an empty second line there is the honest
// answer rather than a missing one — pinned below so a later change cannot start
// inventing one.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that a line names
// its characters as free text split on the reader's separators, while the
// performer hangs off the work's cast row for that character.

type performerEntry struct {
	Name       string `json:"name"`
	Actor      string `json:"actor"`
	ActorImage string `json:"actor_image"`
	ActorID    int64  `json:"actor_id"`
}

type performerLine struct {
	ID              int64            `json:"id"`
	Quote           string           `json:"quote"`
	CharacterImages []performerEntry `json:"character_images"`
	SpeakerCast     *performerEntry  `json:"speaker_cast"`
}

func TestEveryCharacterOnALineCarriesItsOwnPerformer(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Two for the Road", "media_type": "movie"}, http.StatusCreated))
	book := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Moby-Dick"}, http.StatusCreated))

	// The work's cast: two characters, two performers, which is the fact a card
	// should be able to print beside each name without asking again.
	c.mustDo("POST", "/movies/"+itoa(film.ID)+"/cast",
		map[string]any{"character": "Mark Wallace", "actor": "Albert Finney"}, http.StatusCreated)
	c.mustDo("POST", "/movies/"+itoa(film.ID)+"/cast",
		map[string]any{"character": "Joanna Wallace", "actor": "Audrey Hepburn"}, http.StatusCreated)

	// A line both of them speak. Exactly one can be the stored speaker, which is
	// the whole point: the other used to come back bare.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "Just wish that you'd stop sniping.",
		"character": "Mark Wallace, Joanna Wallace", "actor": "Albert Finney, Audrey Hepburn",
	}, http.StatusCreated)
	// AND A LINE WITH ONE SPEAKER, because the stored-speaker chip is served by a
	// different query in a different file (`quote_speaker.go`) with the same hole,
	// and a two-hander gets no `speaker_cast` at all — the linker leaves it
	// deliberately unlinked, so an assertion made only against the line above
	// would be a branch that never runs.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "You don't say much, do you.",
		"character": "Mark Wallace", "actor": "Albert Finney",
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Call me Ishmael.", "character": "Ishmael",
	}, http.StatusCreated)

	lines := decode[struct {
		Dialogues []performerLine `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues", nil, http.StatusOK)).Dialogues

	want := map[string]string{"Mark Wallace": "Albert Finney", "Joanna Wallace": "Audrey Hepburn"}
	seen := map[string]performerEntry{}
	speakers := 0
	for i := range lines {
		for _, e := range lines[i].CharacterImages {
			if _, ok := want[e.Name]; ok {
				seen[e.Name] = e
			}
		}
		if sp := lines[i].SpeakerCast; sp != nil && sp.Name != "" {
			speakers++
			// ── AND THE STORED SPEAKER'S OWN ROW, which is served by a different
			// query in a different file and had the same hole.
			if sp.Actor != "" && sp.ActorID == 0 {
				t.Errorf("the speaker chip names %q and carries no record for them, so the chooser's third question answers no",
					sp.Actor)
			}
		}
	}
	for name, actor := range want {
		got, drawn := seen[name]
		if !drawn {
			t.Errorf("%q is named on the line and gets no chip at all", name)
			continue
		}
		if got.Actor != actor {
			t.Errorf("the chip for %q says its performer is %q, so the card has to print %q on a line of its own underneath",
				name, got.Actor, actor)
		}
		// ── AND ENOUGH TO OPEN THEM. The owner's ruling on what a chip asks is
		// "the work-character, global-character … or the people", and the chooser
		// gates that third door on the performer's record id. Without it the row
		// draws and declines, which is the state every chip was in — survivable
		// while the card printed a PLAYED BY line with a door on it, and not now
		// that the line goes wherever the chips already name them.
		if got.ActorID == 0 {
			t.Errorf("the chip for %q names %q and carries no record for them, so pressing it can never reach their page",
				name, got.Actor)
		}
	}

	if speakers == 0 {
		t.Fatal("no line came back with a stored speaker, so the speaker half of this case never ran")
	}

	// ── AND A BOOK'S CHARACTER STAYS BARE. Nothing plays Ishmael.
	notes := decode[struct {
		Annotations []performerLine `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations", nil, http.StatusOK)).Annotations
	for i := range notes {
		for _, e := range notes[i].CharacterImages {
			if e.Name == "Ishmael" && e.Actor != "" {
				t.Errorf("a book's character came back played by %q — 0047 gives a highlight no performer to be right about", e.Actor)
			}
		}
	}
}

// HOW MANY OF A CHARACTER'S APPEARANCES HAVE A FACE — the one fact the characters
// console could not state, and the one the v3 pack's row is built around
// ("3 works · 1 of 3 have a face", metadata.dc.html:718).
//
// WHY IT IS ON THE REF AND NOT A COUNT. A character wears a different face in
// every work — the face lives on `work_cast`, not on the character — so the
// question is per appearance. A count would answer "how many" and could not
// answer "which one is missing", which is the more useful of the two and the one
// a reader acts on.

type charFaceRef struct {
	Kind    string `json:"kind"`
	ID      int64  `json:"id"`
	Title   string `json:"title"`
	HasFace bool   `json:"has_face"`
}

type charFaceRow struct {
	ID      int64         `json:"id"`
	Name    string        `json:"name"`
	WorksIn []charFaceRef `json:"works_in"`
}

func charFaceList(t *testing.T, c *testClient) []charFaceRow {
	t.Helper()
	return decode[struct {
		Characters []charFaceRow `json:"characters"`
	}](t, c.mustDo("GET", "/characters", nil, http.StatusOK)).Characters
}

func TestEachAppearanceSaysWhetherItHasAFace(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	// Two works, one character in both. The picture is stored against the cast
	// row, which is what makes this a per-appearance fact at all.
	charID, _ := oneWoland(t, c)
	// THE SAME RECORD IN A SECOND WORK, added through the character rather than
	// through the work's cast: a cast row naming "Woland" on another book makes a
	// SECOND character record, which is the backfill's whole design and the thing
	// this console exists to let a reader merge.
	second := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Master and Margarita", "media_type": "movie"},
		http.StatusCreated)).ID
	c.mustDo("POST", "/characters/"+itoa(charID)+"/works",
		map[string]any{"kind": "movie", "work_id": second}, http.StatusOK)

	for _, row := range charFaceList(t, c) {
		for _, w := range row.WorksIn {
			if w.HasFace {
				t.Fatalf("%s in %q reports a face before one was chosen", row.Name, w.Title)
			}
		}
	}

	// Give exactly one of the two appearances a face.
	if _, err := srv.Store.DB.Exec(
		`UPDATE work_cast SET character_image_path = 'characters/woland.jpg'
		  WHERE character_id = ? AND kind = 'movie' AND work_id = ?`, charID, second); err != nil {
		t.Fatal(err)
	}

	var faced, bare int
	for _, row := range charFaceList(t, c) {
		if row.ID != charID {
			continue
		}
		if len(row.WorksIn) != 2 {
			t.Fatalf("Woland turns up in %d works, want 2", len(row.WorksIn))
		}
		for _, w := range row.WorksIn {
			if w.HasFace {
				faced++
				if w.ID != second {
					t.Fatalf("the face landed on %q rather than the work it was set on", w.Title)
				}
			} else {
				bare++
			}
		}
	}
	if faced != 1 || bare != 1 {
		t.Fatalf("one of two appearances has a face: got %d with, %d without", faced, bare)
	}
}

// A CHARACTER CAST TWICE ON ONE WORK IS ONE APPEARANCE. A role and its voice are
// two cast rows against the same book, and they can differ in whether a face was
// chosen — which is why the query groups rather than taking DISTINCT over the
// columns including the flag. DISTINCT would return the work twice, once each
// way, and the console would read two works where there is one.
func TestTwoCastRowsOnOneWorkAreOneAppearance(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	charID, _ := oneWoland(t, c)

	// A FILM, because only a film has performers — and a performer is what makes
	// two rows of one character on one work possible: the role and its voice.
	film := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Master and Margarita", "media_type": "movie"},
		http.StatusCreated)).ID
	c.mustDo("POST", "/characters/"+itoa(charID)+"/works",
		map[string]any{"kind": "movie", "work_id": film, "actor": "Oleg Basilashvili"},
		http.StatusOK)
	twin := decode[castOut](t, c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "Woland", "actor": "Valentin Gaft"}, http.StatusCreated))
	c.mustDo("PUT", "/cast/"+itoa(twin.ID)+"/link",
		map[string]any{"character_id": charID}, http.StatusNoContent)
	if _, err := srv.Store.DB.Exec(
		`UPDATE work_cast SET character_image_path = 'characters/woland.jpg' WHERE id = ?`,
		twin.ID); err != nil {
		t.Fatal(err)
	}

	for _, row := range charFaceList(t, c) {
		if row.ID != charID {
			continue
		}
		// The book Woland came from, and the film they are cast on twice.
		if len(row.WorksIn) != 2 {
			t.Fatalf("two cast rows on one film gave %d appearances in all, want 2", len(row.WorksIn))
		}
		var onFilm []charFaceRef
		for _, w := range row.WorksIn {
			if w.Kind == "movie" {
				onFilm = append(onFilm, w)
			}
		}
		if len(onFilm) != 1 {
			t.Fatalf("the film is listed %d times, want once", len(onFilm))
		}
		if !onFilm[0].HasFace {
			t.Fatal("the appearance has a face on one of its two rows and reports none")
		}
	}
}
