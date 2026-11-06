package httpapi

import (
	"net/http"
	"testing"
)

type bookConfirmResp struct {
	NeedsConfirm bool `json:"needs_confirm"`
	Existing     []struct {
		ID     int64  `json:"id"`
		Title  string `json:"title"`
		Author string `json:"author"`
	} `json:"existing"`
}

// TestBookAddAsksAboutASameTitle covers a book entered by title alone: with no isbn or asin the unique
// index cannot fire, so a title typed twice used to make two rows with nothing said. It is held for
// confirmation as a film is (409 + needs_confirm + the look-alikes), and confirm_new adds it anyway.
func TestBookAddAsksAboutASameTitle(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	first := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/books", map[string]any{"title": "Fires of Heaven", "author": "Robert Jordan"}, http.StatusCreated))

	// The same title with a subtitle is a look-alike (the subtitle is cut at the colon, as in an import).
	confirm := decode[bookConfirmResp](t, c.mustDo("POST", "/books", map[string]any{"title": "Fires of Heaven: A Novel"}, http.StatusConflict))
	if !confirm.NeedsConfirm || len(confirm.Existing) != 1 || confirm.Existing[0].ID != first.ID {
		t.Fatalf("confirm payload: %+v", confirm)
	}
	if confirm.Existing[0].Author != "Robert Jordan" {
		t.Fatalf("the look-alike should carry its author so the reader can tell editions apart: %+v", confirm.Existing[0])
	}

	// Nothing was written by the refused attempt.
	list := decode[struct {
		Books []struct{ ID int64 } `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 {
		t.Fatalf("a held add must not create a row: %+v", list.Books)
	}

	// confirm_new adds it as a separate book (another edition is legitimate).
	c.mustDo("POST", "/books", map[string]any{"title": "Fires of Heaven: A Novel", "confirm_new": true}, http.StatusCreated)
	list = decode[struct {
		Books []struct{ ID int64 } `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 2 {
		t.Fatalf("expected 2 books after confirm_new: %+v", list.Books)
	}

	// A different title is not asked about.
	c.mustDo("POST", "/books", map[string]any{"title": "Dust of Dreams"}, http.StatusCreated)
}

// A reader's look-alikes are their own: another account's same-titled book is not one.
func TestBookAddIgnoresAnotherReadersTitles(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	alice.mustDo("POST", "/books", map[string]any{"title": "Walden"}, http.StatusCreated)
	bob := addUser(t, h, alice, "bob")
	bob.mustDo("POST", "/books", map[string]any{"title": "Walden"}, http.StatusCreated)
}
