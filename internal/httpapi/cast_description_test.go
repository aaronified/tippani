package httpapi

import (
	"net/http"
	"testing"
)

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
