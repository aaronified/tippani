package httpapi

import (
	"net/http"
	"testing"
)

// WHO SUPPLIED A PERSON'S PORTRAIT AND EACH OF THEIR LINKS. The owner chose
// "Every path" records its source and, for a person's page, "Links auto/you +
// portrait source": the pack's §1.3, each link marked auto (the app found it) or
// you (the reader pasted it), and the portrait tagged with its supplier.
//
// SETUP KNOWS the people table (seedPerson writes a record straight in, as other
// people tests do) and persistPortraitOn, the write every portrait fetch goes
// through: a fetch needs a supplier the offline test server cannot reach.

type personSources struct {
	ImageSource string            `json:"image_source"`
	LinkSources map[string]string `json:"link_sources"`
}

func TestALinkTheReaderAddsIsTheirsAndAFetchedOneIsTheSuppliers(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := seedPerson(t, srv, 1, "author", "Ursula K. Le Guin")
	read := func() personSources {
		return decode[personSources](t, c.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK))
	}

	// A FETCH ADDS ONE, credited to the supplier that answered.
	if err := srv.saveFetchedPerson(1, id, "author", portraitFind{}, map[string]string{"openlibrary": "https://openlibrary.org/authors/OL1A"}); err != nil {
		t.Fatal(err)
	}
	if got := read().LinkSources["https://openlibrary.org/authors/OL1A"]; got != "openlibrary" {
		t.Errorf("a fetched link is credited to %q, want openlibrary", got)
	}

	// THE READER ADDS ONE: theirs, and the fetched one keeps its credit.
	links := "https://openlibrary.org/authors/OL1A\nhttps://ursulakleguin.com"
	c.mustDo("PUT", "/people/id/"+itoa(id), map[string]any{"links": links}, http.StatusOK)
	got := read().LinkSources
	if got["https://ursulakleguin.com"] != "manual" || got["https://openlibrary.org/authors/OL1A"] != "openlibrary" {
		t.Errorf("after the reader's link: %v", got)
	}

	// A FACT SAVE RE-SENDS THE SAME LINKS: nothing moves.
	c.mustDo("PUT", "/people/id/"+itoa(id), map[string]any{"links": links, "bio": "Writer."}, http.StatusOK)
	if again := read().LinkSources; again["https://openlibrary.org/authors/OL1A"] != "openlibrary" {
		t.Errorf("an unchanged links field re-credited a link: %v", again)
	}

	// A LINK REMOVED IS FORGOTTEN.
	c.mustDo("PUT", "/people/id/"+itoa(id), map[string]any{"links": "https://ursulakleguin.com"}, http.StatusOK)
	if left := read().LinkSources; len(left) != 1 || left["https://ursulakleguin.com"] != "manual" {
		t.Errorf("a removed link is still recorded: %v", left)
	}
}

func TestAPortraitSaysWhoSuppliedItAndCountsForThatSupplier(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := seedPerson(t, srv, 1, "author", "Mary Shelley")

	// An author's identity is Open Library's, but this picture came from Wikimedia.
	tx, err := srv.Store.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	f := portraitFind{source: "openlibrary", sourceID: "OL2A", image: "shelley.jpg",
		imageSource: pictureSupplier("https://upload.wikimedia.org/wikipedia/commons/shelley.jpg", "openlibrary")}
	if _, err := persistPortraitOn(tx, 1, id, "author", f); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	if got := decode[personSources](t, c.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK)).ImageSource; got != "wikimedia" {
		t.Errorf("the portrait is credited to %q, want wikimedia", got)
	}
	rows := decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources
	if w := sourceNamed(t, rows, "wikimedia"); w.People != 1 || w.Fields != 1 {
		t.Errorf("Wikimedia's row reads %d fields | %d people, want 1 | 1", w.Fields, w.People)
	}
	if o := sourceNamed(t, rows, "openlibrary"); o.People != 0 {
		t.Errorf("Open Library is credited with the picture it did not supply: %d people", o.People)
	}
}

// A TRANSLATOR'S AND AN EDITOR'S LINKS COME FROM OPEN LIBRARY, as an author's do:
// lookupLinks asks it for all three book kinds, and the credit said TMDB for two
// of them until a changelog pass read the two functions side by side.
func TestABookPersonsFetchedLinkIsOpenLibrarys(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	for _, kind := range []string{"translator", "editor"} {
		id := seedPerson(t, srv, 1, kind, "Mirra Ginsburg "+kind)
		url := "https://openlibrary.org/authors/OL9A-" + kind
		if err := srv.saveFetchedPerson(1, id, kind, portraitFind{}, map[string]string{"openlibrary": url}); err != nil {
			t.Fatal(err)
		}
		got := decode[personSources](t, c.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK)).LinkSources[url]
		if got != "openlibrary" {
			t.Errorf("the %s's fetched link is credited to %q, want openlibrary", kind, got)
		}
	}
}
