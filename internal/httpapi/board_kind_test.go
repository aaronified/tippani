package httpapi

// Board kinds (0037) — what a board HOLDS, which is not what it is called.
//
// The rules worth a test here are the two that would each fail in silence:
//
//   - a kind survives every other edit, because a full-state PUT that forgets it
//     turns a proverb board into a plain one and nothing on screen says so;
//   - a kind is not a name, in both directions — renaming a proverb board keeps
//     it one, and calling a plain board "Proverbs" does not make it one.
//
// The second is the whole reason 0037 added a column instead of matching on the
// name, and it is the rule 0036 spent a paragraph insisting on.

import (
	"net/http"
	"testing"
)

func newProverbBoard(t *testing.T, c *testClient, name string, langs ...string) boardRow {
	t.Helper()
	body := map[string]any{"name": name, "kind": "proverb"}
	if langs != nil {
		body["languages"] = langs
	}
	return decode[boardRow](t, c.mustDo("POST", "/boards", body, http.StatusCreated))
}

func boardByID(t *testing.T, c *testClient, id int64) boardRow {
	t.Helper()
	for _, b := range listBoards(t, c).Boards {
		if b.ID == id {
			return b
		}
	}
	t.Fatalf("board %d is not in the list", id)
	return boardRow{}
}

// The offer the whole feature exists for: a reader with no quotes could not reach
// Proverbs at all after 0036, because its seed reads FROM utterances.
func TestAProverbBoardCanBeMadeOnAnEmptyAccount(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// Nothing has been saved, so there is nothing for 0036's seed to have made.
	if got := listBoards(t, c); len(got.Boards) != 0 {
		t.Fatalf("a fresh account should start with no boards, got %+v", got.Boards)
	}

	b := newProverbBoard(t, c, "Proverbs", "Bengali", "Hindi")
	if b.Kind != "proverb" {
		t.Fatalf("kind = %q, want proverb", b.Kind)
	}
	got := boardByID(t, c, b.ID)
	if got.Kind != "proverb" || len(got.Languages) != 2 {
		t.Fatalf("board did not come back as it went in: %+v", got)
	}
	if got.Languages[0] != "Bengali" || got.Languages[1] != "Hindi" {
		t.Fatalf("languages lost their order: %+v", got.Languages)
	}
}

// A board with no kind is plain, so every client written against 1.14.0 and
// every board in an older export keeps working untouched.
func TestABoardWithNoKindIsPlain(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	b := newBoard(t, c, "Kennedy")
	if b.Kind != "plain" {
		t.Fatalf("kind = %q, want plain", b.Kind)
	}
	// And it is [] rather than null, so a client never has to check for both.
	if got := boardByID(t, c, b.ID); got.Languages == nil {
		t.Fatal("languages came back null; it must always be an array")
	}
}

// THE TRAP, for the fourth time. 0034 caught it on translator, 0035 on category,
// 0036 on board_id: a writer that was complete on the day it was written becomes
// lossy the moment a column is added beside it. Hiding a board is the one PUT
// that sends every field without the reader having typed any of them.
func TestAFullStatePutCarriesTheKindAndItsLanguages(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	b := newProverbBoard(t, c, "Proverbs", "Bengali")

	// Exactly what the Hide menu item sends: the board's own fields back, plus
	// the one thing that changed.
	c.mustDo("PUT", "/boards/"+itoa(b.ID), map[string]any{
		"name": b.Name, "description": b.Description, "color": b.Color,
		"image_path": b.ImagePath, "hidden": true,
		"kind": b.Kind, "languages": b.Languages,
	}, http.StatusNoContent)

	got := boardByID(t, c, b.ID)
	if !got.Hidden {
		t.Fatal("the board did not hide")
	}
	if got.Kind != "proverb" {
		t.Fatalf("hiding a proverb board made it %q", got.Kind)
	}
	if len(got.Languages) != 1 || got.Languages[0] != "Bengali" {
		t.Fatalf("hiding a board lost its languages: %+v", got.Languages)
	}
}

// The rule 0036 insists on, tested in both directions, because a future reader of
// this code will be tempted by exactly one of them.
func TestAKindIsNotAName(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// Renaming a proverb board keeps it one. The name is the reader's; the kind
	// is what the board holds.
	b := newProverbBoard(t, c, "Proverbs", "Bengali")
	c.mustDo("PUT", "/boards/"+itoa(b.ID), map[string]any{
		"name": "Grandmother", "kind": "proverb", "languages": []string{"Bengali"},
	}, http.StatusNoContent)
	if got := boardByID(t, c, b.ID); got.Kind != "proverb" || got.Name != "Grandmother" {
		t.Fatalf("a renamed proverb board stopped being one: %+v", got)
	}

	// And calling a plain board "Proverbs" does not make it one. This is the
	// case a name-matching implementation would get wrong, and the reader would
	// have no way to see why their board behaved oddly.
	p := newBoard(t, c, "Proverbs")
	if got := boardByID(t, c, p.ID); got.Kind != "proverb" && got.Kind != "plain" {
		t.Fatalf("unexpected kind %q", got.Kind)
	} else if got.Kind == "proverb" {
		t.Fatal("a board called Proverbs was treated as a proverb board by its NAME")
	}
}

// Languages belong to a proverb board and are dropped from any other rather than
// refused: switching the kind back is a change of mind, not an error, and a list
// left sitting invisibly in the row would reappear later for no reason.
func TestLanguagesAreDroppedFromAPlainBoard(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	b := newProverbBoard(t, c, "Proverbs", "Bengali", "Hindi")

	c.mustDo("PUT", "/boards/"+itoa(b.ID), map[string]any{
		"name": "Proverbs", "kind": "plain", "languages": []string{"Bengali", "Hindi"},
	}, http.StatusNoContent)

	if got := boardByID(t, c, b.ID); len(got.Languages) != 0 {
		t.Fatalf("a plain board kept its languages: %+v", got.Languages)
	}
}

func TestTheLanguageListIsTidiedRatherThanTrusted(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	b := decode[boardRow](t, c.mustDo("POST", "/boards", map[string]any{
		"name": "Proverbs", "kind": "proverb",
		// Blank entries, whitespace, and the same language twice in two casings.
		"languages": []string{" Bengali ", "", "   ", "bengali", "Hindi"},
	}, http.StatusCreated))

	got := boardByID(t, c, b.ID)
	if len(got.Languages) != 2 {
		t.Fatalf("languages were not deduplicated: %+v", got.Languages)
	}
	// The FIRST spelling wins, so a reader's own capitalisation is what is kept
	// rather than whichever casing happened to arrive last.
	if got.Languages[0] != "Bengali" || got.Languages[1] != "Hindi" {
		t.Fatalf("languages = %+v, want [Bengali Hindi]", got.Languages)
	}
}

func TestAnUnknownKindIsRefused(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/boards", map[string]any{"name": "Songs", "kind": "song"}, http.StatusBadRequest)
}
