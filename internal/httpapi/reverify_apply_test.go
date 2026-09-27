package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)

// A RE-VERIFY'S APPLY, WHEN THE LIBRARY MOVED BETWEEN THE REVIEW AND THE PRESS.
//
// The review shows each field as stored and what the suppliers say; the reader
// ticks and presses Apply, and the apply carries, per field, the stored value
// they were shown (expect). Everything is driven through the API as the review
// drives it, and the library read back as its pages read it.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the apply's
// wire shape (items of {type, id | kind+name, set, source, expect}, answered with
// results of {ok, error, note}), which is the contract the review is built to;
// and the words of the note an item whose field was left carries, which is what
// the review's result line shows the reader.
//
// What each one guards, in a sentence a person would say: a field somebody
// changed after the review is left as they wrote it, with a note saying so, while
// the item's other fields are written; an item every field of which changed
// writes nothing and is not a failure; an item that says nothing about what it
// was shown is applied as it always was; and a row that is gone is still not
// found.

type applyAnswer struct {
	Applied int `json:"applied"`
	Failed  int `json:"failed"`
	Results []struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
		Note  string `json:"note"`
	} `json:"results"`
}

func TestAnApplyLeavesAFieldThatChangedSinceTheReview(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	messiah := createdID(t, alice, "/books", map[string]any{"title": "Dune Messiah", "author": "Frank Herbert", "isbn": messiahISBN})
	gone := createdID(t, alice, "/books", map[string]any{"title": "Children of Dune", "author": "Frank Herbert"})
	emperor := createdID(t, alice, "/books", map[string]any{"title": "God Emperor of Dune", "author": "Frank Herbert"})
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Frank Herbert"}, http.StatusOK)

	// The review showed Dune and God Emperor with no description, Dune with no
	// year, and Frank Herbert with no bio. Then, before the press: alice writes
	// both descriptions and the author's bio herself, and deletes a book.
	alice.mustDo("PUT", fmt.Sprintf("/books/%d", dune), map[string]any{"title": "Dune", "author": "Frank Herbert",
		"isbn": duneISBN, "description": "My own words."}, http.StatusOK)
	alice.mustDo("PUT", fmt.Sprintf("/books/%d", emperor), map[string]any{"title": "God Emperor of Dune",
		"author": "Frank Herbert", "description": "Leto's."}, http.StatusOK)
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Frank Herbert", "bio": "Wrote Dune."}, http.StatusOK)
	alice.mustDo("DELETE", fmt.Sprintf("/books/%d", gone), nil, http.StatusOK)

	got := decode[applyAnswer](t, alice.mustDo("POST", "/metadata/reverify/apply", map[string]any{"items": []any{
		map[string]any{"type": "book", "id": dune, "source": "google",
			"set":    map[string]any{"description": "A desert planet.", "published_year": 1965},
			"expect": map[string]any{"description": nil, "published_year": 0}},
		map[string]any{"type": "person", "kind": "author", "name": "Frank Herbert",
			"set": map[string]any{"bio": "An American author."}, "expect": map[string]any{"bio": ""}},
		// Sent by a client that says nothing about what it showed.
		map[string]any{"type": "book", "id": messiah, "source": "google", "set": map[string]any{"description": "The sequel."}},
		map[string]any{"type": "book", "id": gone, "source": "google",
			"set": map[string]any{"published_year": 1976}, "expect": map[string]any{"published_year": 0}},
		map[string]any{"type": "book", "id": emperor, "source": "google",
			"set": map[string]any{"description": "The fourth novel."}, "expect": map[string]any{"description": ""}},
	}}, http.StatusOK))

	if len(got.Results) != 5 || got.Applied != 4 || got.Failed != 1 {
		t.Fatalf("the apply: %+v", got)
	}
	left := changedSinceTheCheck
	if r := got.Results[0]; !r.OK || r.Note != left+"description" {
		t.Errorf("Dune's result: %+v, want ok with the note %q", r, left+"description")
	}
	if r := got.Results[1]; !r.OK || r.Note != left+"bio" {
		t.Errorf("the author's result: %+v, want ok (nothing failed) with the note %q", r, left+"bio")
	}
	if r := got.Results[2]; !r.OK || r.Note != "" {
		t.Errorf("an item sent without expect: %+v", r)
	}
	if r := got.Results[3]; r.OK || !strings.Contains(r.Error, "not found") {
		t.Errorf("a deleted book's result: %+v, want not found", r)
	}
	if r := got.Results[4]; !r.OK || r.Note != left+"description" {
		t.Errorf("God Emperor's result: %+v, want ok (nothing failed) with the note %q", r, left+"description")
	}

	type book struct {
		Description string `json:"description"`
		Year        int    `json:"published_year"`
	}
	if b := decode[book](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK)); b.Description != "My own words." || b.Year != 1965 {
		t.Errorf("Dune after the apply: %+v, want her own description kept and the year written", b)
	}
	if b := decode[book](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", messiah), nil, http.StatusOK)); b.Description != "The sequel." {
		t.Errorf("Dune Messiah after the apply: %+v", b)
	}
	if b := decode[book](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", emperor), nil, http.StatusOK)); b.Description != "Leto's." {
		t.Errorf("God Emperor after the apply: %+v, want her own description kept", b)
	}
	author := decode[struct {
		Bio string `json:"bio"`
	}](t, alice.mustDo("GET", "/people/id/"+itoa(recordID(t, alice, "Frank Herbert")), nil, http.StatusOK))
	if author.Bio != "Wrote Dune." {
		t.Errorf("the author's bio after the apply: %q, want hers", author.Bio)
	}
}
