package httpapi

import (
	"net/http"
	"testing"
)

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
