package httpapi

import (
	"net/http"
	"testing"
)

// Putting a character in a work, taking them out of one, and choosing their face.
//
// THESE THREE ARE THE CHARACTER PAGE, in the owner's own words: "so that i can
// merge them easily or tag them to multiple works (or remove works), see work wise
// images that has been added to them, or actors assigned in different works".
// Merge shipped with 0056's endpoints; the tagging, the untagging and the picture
// are these.
//
// WHAT MAKES THE UNTAG WORTH THIRTY LINES OF TEST rather than three. A character
// named on one of a work's own quotes is ADOPTED back onto its cast on the next
// read (cast_from_quotes.go), for ever. So "remove this character from this book"
// has to answer for the quotes or it is not a removal — it either undoes itself
// or leaves a work whose lines name a character its cast denies. The ruling is
// refuse-and-ask, and the two ways forward are rewrite the lines or clear them.

type castOut struct {
	ID          int64  `json:"id"`
	Character   string `json:"character"`
	Actor       string `json:"actor"`
	CharacterID int64  `json:"character_id"`
	Origin      string `json:"origin"`
}

type appearanceOut struct {
	CastID      int64  `json:"cast_id"`
	Kind        string `json:"kind"`
	WorkID      int64  `json:"work_id"`
	WorkTitle   string `json:"work_title"`
	Actor       string `json:"actor"`
	Image       string `json:"image"`
	Cover       string `json:"cover"`
	MediaType   string `json:"media_type"`
	Description string `json:"description"`
}

type charDetailFull struct {
	ID          int64           `json:"id"`
	Name        string          `json:"name"`
	ImagePath   string          `json:"image_path"`
	Appearances []appearanceOut `json:"appearances"`
}

// oneWoland seeds a single character record via a book's cast and hands back its
// id, so each test starts from the state the app actually produces.
func oneWoland(t *testing.T, c *testClient) (charID, bookID int64) {
	t.Helper()
	bookID = createTestBook(t, c, "The Master and Margarita", "Mikhail Bulgakov")
	row := decode[castOut](t, c.mustDo("POST", "/books/"+itoa(bookID)+"/cast",
		map[string]any{"character": "Woland"}, http.StatusCreated))
	if row.CharacterID == 0 {
		t.Fatalf("the seed cast row was not linked to a character record: %+v", row)
	}
	return row.CharacterID, bookID
}

// lineOf reads one annotation back out of the book's list. There is no
// `GET /annotations/{id}` — the list is the only read — so the fetch is by book
// and the row is picked out here.
func lineOf(t *testing.T, c *testClient, bookID, id int64) annotationRow {
	t.Helper()
	rows := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, http.StatusOK)).Annotations
	for _, a := range rows {
		if a.ID == id {
			return a
		}
	}
	t.Fatalf("annotation %d is not in the book's list", id)
	return annotationRow{}
}

func charDetail(t *testing.T, c *testClient, id int64) charDetailFull {
	t.Helper()
	return decode[charDetailFull](t, c.mustDo("GET", "/characters/"+itoa(id), nil, http.StatusOK))
}

func TestTaggingACharacterOntoASecondWorkUsesTheRecordAndNotTheName(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	charID, _ := oneWoland(t, c)

	// A SECOND BOOK ALREADY HOLDING A DIFFERENT WOLAND. This is the case the
	// endpoint exists for: `POST /books/{id}/cast` takes a name, and a name would
	// find THIS book's Woland and file the row under that record instead — which is
	// the accidental welding 0056 refuses. Nothing in the reply would say so.
	other := createTestBook(t, c, "Master i Margarita", "M. Bulgakov")
	c.mustDo("POST", "/books/"+itoa(other)+"/cast", map[string]any{"character": "Woland"}, http.StatusCreated)

	third := createTestBook(t, c, "A Country Doctor's Notebook", "Bulgakov")
	added := decode[castOut](t, c.mustDo("POST", "/characters/"+itoa(charID)+"/works",
		map[string]any{"kind": "book", "work_id": third}, http.StatusOK))
	if added.CharacterID != charID {
		t.Fatalf("the new row was filed under character %d, not %d", added.CharacterID, charID)
	}

	got := charDetail(t, c, charID)
	if len(got.Appearances) != 2 {
		t.Fatalf("want two appearances after tagging a second work, got %d: %+v", len(got.Appearances), got.Appearances)
	}
	titles := map[string]bool{}
	for _, a := range got.Appearances {
		titles[a.WorkTitle] = true
	}
	if !titles["The Master and Margarita"] || !titles["A Country Doctor's Notebook"] {
		t.Fatalf("the wrong two works: %+v", got.Appearances)
	}
	// And the OTHER book's Woland — a different record — did not follow.
	for _, a := range got.Appearances {
		if a.WorkTitle == "Master i Margarita" {
			t.Fatalf("a same-named character on another work was welded in: %+v", a)
		}
	}
}

func TestTaggingRefusesTheSameWorkTwiceAndRefusesABookAnActor(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	charID, bookID := oneWoland(t, c)

	c.mustDo("POST", "/characters/"+itoa(charID)+"/works",
		map[string]any{"kind": "book", "work_id": bookID}, http.StatusConflict)

	// A book has characters, not a cast — 0047's line, enforced by the cast list's
	// own validator so the two paths cannot drift apart.
	other := createTestBook(t, c, "Heart of a Dog", "Bulgakov")
	c.mustDo("POST", "/characters/"+itoa(charID)+"/works",
		map[string]any{"kind": "book", "work_id": other, "actor": "Oleg Basilashvili"}, http.StatusBadRequest)

	// Somebody else's work is not found, never forbidden.
	bob := addUser(t, h, c, "bob")
	bobsBook := createTestBook(t, bob, "The White Guard", "Bulgakov")
	c.mustDo("POST", "/characters/"+itoa(charID)+"/works",
		map[string]any{"kind": "book", "work_id": bobsBook}, http.StatusNotFound)
}

func TestRemovingAWorkIsRefusedWhileItsQuotesNameTheCharacter(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	charID, bookID := oneWoland(t, c)
	for _, q := range []string{"Manuscripts don't burn", "Never talk to strangers"} {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": bookID, "quote": q, "character": "Woland",
		}, http.StatusCreated)
	}
	castID := charDetail(t, c, charID).Appearances[0].CastID

	// REFUSED, WITH THE NUMBER. The count is the whole point of the body: the
	// dialog it raises has to say how many lines it is about to rewrite, and a
	// reader guessing is the difference between fixing two and rewriting ninety.
	rec := c.mustDo("DELETE", "/characters/"+itoa(charID)+"/works/"+itoa(castID), nil, http.StatusConflict)
	body := decode[struct {
		Quotes int `json:"quotes"`
	}](t, rec)
	if body.Quotes != 2 {
		t.Fatalf("the refusal did not carry the count: %+v", body)
	}
	// And nothing was written.
	if n := len(charDetail(t, c, charID).Appearances); n != 1 {
		t.Fatalf("a refused removal removed something anyway: %d appearances left", n)
	}
}

func TestRemovingAWorkAfterReplacingTheSpeakersOnEveryQuote(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	charID, bookID := oneWoland(t, c)
	solo := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "Manuscripts don't burn", "character": "Woland",
	}, http.StatusCreated))
	// A LINE THAT NAMES THREE. The one being removed goes and the other two stay
	// exactly where they were — an emptied column here would be two speakers
	// destroyed to satisfy a removal about a third.
	crowd := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "The whole retinue", "character": "Behemoth, Woland, Azazello",
	}, http.StatusCreated))
	castID := charDetail(t, c, charID).Appearances[0].CastID

	c.mustDo("DELETE", "/characters/"+itoa(charID)+"/works/"+itoa(castID)+"?quotes=replace&to=Messire",
		nil, http.StatusOK)

	got := lineOf(t, c, bookID, solo.ID)
	if got.Character != "Messire" {
		t.Fatalf("the solo line reads %q", got.Character)
	}
	// IN PLACE, not appended: the order a reader typed their speakers in is the
	// order the line reads in, and on a two-hander it is the difference between a
	// conversation and its reverse.
	got = lineOf(t, c, bookID, crowd.ID)
	if got.Character != "Behemoth, Messire, Azazello" {
		t.Fatalf("the crowded line reads %q", got.Character)
	}
	if n := len(charDetail(t, c, charID).Appearances); n != 0 {
		t.Fatalf("the work is still on the character: %d appearances", n)
	}
	// AND IT STAYS OFF. Adoption puts a quoted character back on a work's cast on
	// the next read, for ever — which is why the quotes had to be answered for.
	c.mustDo("GET", "/books/"+itoa(bookID)+"/cast", nil, http.StatusOK)
	if n := len(charDetail(t, c, charID).Appearances); n != 0 {
		t.Fatalf("reading the work's cast put the character back: %d appearances", n)
	}
}

func TestARemovalOnlyReachesTheCastRowsOfItsOwnCharacter(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	charID, bookID := oneWoland(t, c)
	other := decode[castOut](t, c.mustDo("POST", "/books/"+itoa(bookID)+"/cast",
		map[string]any{"character": "Behemoth"}, http.StatusCreated))

	// Two ids in a path is two chances to name the wrong pair. Untagging Behemoth's
	// row THROUGH Woland's record is not found — their own data either way, and
	// still not the removal they asked for.
	c.mustDo("DELETE", "/characters/"+itoa(charID)+"/works/"+itoa(other.ID), nil, http.StatusNotFound)
	if n := len(charDetail(t, c, charID).Appearances); n != 1 {
		t.Fatalf("the guard removed something: %d appearances", n)
	}
}

func TestPromotingOneAppearancePictureToTheRecordAndClearingItAgain(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	charID, _ := oneWoland(t, c)
	castID := charDetail(t, c, charID).Appearances[0].CastID

	// AN APPEARANCE WITH NO PICTURE CANNOT BE PROMOTED, and says so rather than
	// storing an empty path that reads as "cleared".
	c.mustDo("PUT", "/characters/"+itoa(charID)+"/image",
		map[string]any{"cast_id": castID}, http.StatusBadRequest)

	// The picture is stored by the cast row, as every character picture is; this
	// endpoint only says which of them IS the character.
	if _, err := srv.Store.DB.Exec(
		`UPDATE work_cast SET character_image_path = 'characters/woland.jpg' WHERE id = ?`, castID); err != nil {
		t.Fatal(err)
	}
	c.mustDo("PUT", "/characters/"+itoa(charID)+"/image",
		map[string]any{"cast_id": castID}, http.StatusOK)
	if got := charDetail(t, c, charID); got.ImagePath != "characters/woland.jpg" {
		t.Fatalf("the record's picture is %q", got.ImagePath)
	}
	c.mustDo("PUT", "/characters/"+itoa(charID)+"/image", map[string]any{"path": ""}, http.StatusOK)
	if got := charDetail(t, c, charID); got.ImagePath != "" {
		t.Fatalf("clearing left %q", got.ImagePath)
	}
}

func TestPromotingRefusesAPictureBelongingToAnotherCharacter(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	charID, bookID := oneWoland(t, c)
	other := decode[castOut](t, c.mustDo("POST", "/books/"+itoa(bookID)+"/cast",
		map[string]any{"character": "Behemoth"}, http.StatusCreated))
	if _, err := srv.Store.DB.Exec(
		`UPDATE work_cast SET character_image_path = 'characters/cat.jpg' WHERE id = ?`, other.ID); err != nil {
		t.Fatal(err)
	}
	c.mustDo("PUT", "/characters/"+itoa(charID)+"/image",
		map[string]any{"cast_id": other.ID}, http.StatusNotFound)
}

// ---- what a character is on ONE work ---------------------------------------

// A PART PLAYED TWICE ON ONE FILM. `idx_work_cast_pair` is unique on
// (kind, work_id, character_key, actor_key), so two live rows may share a folded
// character name as long as their performers differ — young and old Vito, a part
// recast between seasons, a role dubbed by a second voice. Selecting the quotes to
// refuse over BY NAME made those two rows one: taking either off the film counted,
// and offered to rewrite, the other one's lines. This is the case the speaker link
// exists to answer, and the first place in the app that depends on it rather than
// merely maintaining it.
func TestRemovingOneOfTwoCastRowsForOnePartLeavesTheOthersQuotesAlone(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	movieID := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "The Godfather"}, http.StatusCreated).Body.Bytes())
	first := decode[castOut](t, c.mustDo("POST", "/movies/"+itoa(movieID)+"/cast",
		map[string]any{"character": "Vito Corleone", "actor": "Marlon Brando"}, http.StatusCreated))
	second := decode[castOut](t, c.mustDo("POST", "/movies/"+itoa(movieID)+"/cast",
		map[string]any{"character": "Vito Corleone", "actor": "Robert De Niro"}, http.StatusCreated))
	if first.CharacterID == 0 || first.CharacterID != second.CharacterID {
		t.Fatalf("one part should be one record: %d and %d", first.CharacterID, second.CharacterID)
	}

	line := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movieID, "quote": "I'm gonna make him an offer he can't refuse",
		"character": "Vito Corleone", "actor": "Marlon Brando",
	}, http.StatusCreated))
	if got := speakerCast(t, srv, "dialogues", line.ID); got != first.ID {
		t.Fatalf("the line linked to %d, want Brando's row %d", got, first.ID)
	}

	// De Niro's row has no lines of its own, so the removal has nothing to ask
	// about and goes straight through. By name it had two.
	c.mustDo("DELETE", "/characters/"+itoa(second.CharacterID)+"/works/"+itoa(second.ID), nil, http.StatusOK)

	if got := speakerCast(t, srv, "dialogues", line.ID); got != first.ID {
		t.Fatalf("the surviving row's line now points at %d, want %d", got, first.ID)
	}
	for _, d := range decode[dlgList](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(movieID), nil, http.StatusOK)).Dialogues {
		if d.ID == line.ID && d.Character != "Vito Corleone" {
			t.Fatalf("the quote's speaker was rewritten to %q", d.Character)
		}
	}
}
