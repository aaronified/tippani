package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"tippani/internal/metadata"
)

// WHO SUPPLIED A PERSON'S PORTRAIT AND EACH OF THEIR LINKS. The owner chose
// "Every path" records its source and, for a person's page, "Links auto/you +
// portrait source": the pack's §1.3, each link marked auto (the app found it) or
// you (the reader pasted it), and the portrait tagged with its supplier.
//
// The person cases press the person's Fetch (POST /people/id/{id}/fetch), save
// the person as the page's form does (PUT /people/id/{id}), or merge two (POST
// /people/merge), and read the record (GET /people/id/{id}) and the Sources rows
// (GET /metadata/status) back. The character cases set a picture as the reader's
// strip does (POST /cast/{id}/image, PUT /characters/{id}/image), remove a role
// (DELETE /cast/{id}) or merge two characters (POST /characters/merge), and read
// the Sources rows back.
//
// SETUP KNOWS the people table (seedPerson writes a record straight in, as other
// people tests do; personIDFor finds one by name); works and roles made through
// the API: POST /books, POST /movies (by title, or by tmdb_id through
// addFromTMDB), POST /movies/{id}/cast, twoWolands' two books with a Woland each
// (POST /books/{id}/cast, GET /characters), a quote (POST /quotes) for a speaker,
// and POST /trash/{id}/restore for a binned work; and the seams the offline test
// server needs, because it has no supplier to ask: srv.resolveAuthor (Open
// Library's author match), srv.authorLinks (Open Library's links for a name),
// srv.fetchImage (the portrait download), srv.fetchUserImage (a picture from an
// address the reader gave), and srv.TMDB's Key and BaseURL pointed at a fake TMDB
// for the film whose role is removed.

type personSources struct {
	ImageSource string            `json:"image_source"`
	LinkSources map[string]string `json:"link_sources"`
}

// openLibraryKnows makes Open Library match every name with the given portrait
// address and one link of its own.
func openLibraryKnows(srv *Server, imageURL string) {
	srv.resolveAuthor = func(_ context.Context, name string, _ []string) (metadata.AuthorResolution, error) {
		return metadata.AuthorResolution{Key: "OL1A", Name: name, Bio: "Wrote books.", ImageURL: imageURL,
			Links: map[string]string{"openlibrary": "https://openlibrary.org/authors/OL1A"}}, nil
	}
	srv.fetchImage = func(context.Context, string, string) (string, error) { return "bbbbbbbbbbbbbbbb.jpg", nil }
}

func fetchPersonByID(c *testClient, id int64) personSources {
	c.t.Helper()
	c.mustDo("POST", "/people/id/"+itoa(id)+"/fetch", nil, http.StatusOK)
	return decode[personSources](c.t, c.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK))
}

func TestALinkTheReaderAddsIsTheirsAndAFetchedOneIsTheSuppliers(t *testing.T) {
	srv := newTestServer(t)
	openLibraryKnows(srv, "")
	c := signupAdmin(t, srv.Handler())
	id := seedPerson(t, srv, 1, "author", "Ursula K. Le Guin")
	read := func() personSources {
		return decode[personSources](t, c.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK))
	}

	// A FETCH ADDS ONE, credited to the supplier that answered.
	if got := fetchPersonByID(c, id).LinkSources["https://openlibrary.org/authors/OL1A"]; got != "openlibrary" {
		t.Errorf("a fetched link is credited to %q, want openlibrary", got)
	}
	// AND THE PERSON COUNTS FOR IT, with no portrait at all: Open Library gave the
	// record its identity, its facts and a link.
	if o := sourceNamed(t, decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources, "openlibrary"); o.People != 1 {
		t.Errorf("Open Library's row counts %d people for an author it supplied everything but a picture for", o.People)
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
	// An author's identity is Open Library's, but this picture came from Wikimedia.
	openLibraryKnows(srv, "https://upload.wikimedia.org/wikipedia/commons/shelley.jpg")
	c := signupAdmin(t, srv.Handler())
	id := seedPerson(t, srv, 1, "author", "Mary Shelley")

	if got := fetchPersonByID(c, id).ImageSource; got != "wikimedia" {
		t.Errorf("the portrait is credited to %q, want wikimedia", got)
	}
	rows := decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources
	if w := sourceNamed(t, rows, "wikimedia"); w.People != 1 || w.Fields != 1 {
		t.Errorf("Wikimedia's row reads %d fields | %d people, want 1 | 1", w.Fields, w.People)
	}
	if o := sourceNamed(t, rows, "openlibrary"); o.Fields != 0 || o.People != 1 {
		t.Errorf("Open Library's row reads %d fields | %d people: the picture is not its field, the person is still one it supplied",
			o.Fields, o.People)
	}
}

// A SPEAKER'S LINKS ARE OPEN LIBRARY'S WHEN OPEN LIBRARY GAVE THEM. A speaker's
// portrait and links come from Open Library's author match, while a speaker's
// own link lookup asks TMDB, so a credit read off the role alone said TMDB.
func TestASpeakersFetchedLinksAreCreditedToTheSupplierThatGaveThem(t *testing.T) {
	srv := newTestServer(t)
	openLibraryKnows(srv, "")
	c := signupAdmin(t, srv.Handler())
	c.mustDo("POST", "/quotes", map[string]any{"quote": "Imagination is more important than knowledge.", "speaker": "Albert Einstein"}, http.StatusCreated)
	id := personIDFor(t, srv, 1, "Albert Einstein")
	if got := fetchPersonByID(c, id).LinkSources["https://openlibrary.org/authors/OL1A"]; got != "openlibrary" {
		t.Errorf("a speaker's link Open Library gave is credited to %q", got)
	}
}

// A TRANSLATOR'S AND AN EDITOR'S LINKS COME FROM OPEN LIBRARY, as an author's do:
// when the author match finds nobody, the fetch asks for links alone, and Open
// Library is who it asks for all three book kinds. The credit said TMDB for two
// of them until a changelog pass read the two functions side by side.
func TestABookPersonsFetchedLinkIsOpenLibrarys(t *testing.T) {
	for _, kind := range []string{"translator", "editor"} {
		srv := newTestServer(t)
		srv.resolveAuthor = func(context.Context, string, []string) (metadata.AuthorResolution, error) {
			return metadata.AuthorResolution{}, nil
		}
		url := "https://openlibrary.org/authors/OL9A-" + kind
		srv.authorLinks = func(context.Context, string) (map[string]string, error) {
			return map[string]string{"openlibrary": url}, nil
		}
		c := signupAdmin(t, srv.Handler())
		c.mustDo("POST", "/books", map[string]any{"title": "The Master and Margarita", "author": "Mikhail Bulgakov", kind: "Mirra Ginsburg"}, http.StatusCreated)
		if got := fetchPersonByID(c, personIDFor(t, srv, 1, "Mirra Ginsburg")).LinkSources[url]; got != "openlibrary" {
			t.Errorf("the %s's fetched link is credited to %q, want openlibrary", kind, got)
		}
	}
}

// A CHARACTER'S PICTURE IS THE STRIP'S SUPPLIER'S OR THE READER'S, on a cast row
// and on the character's own record alike, and it is a field on that supplier's
// Sources row. A cast row's picture was credited by its address's host, so a
// strip pick from an unknown host was nobody's and a pasted one could be a
// supplier's; and no character picture was counted at all.
func TestACharacterPictureIsTheStripsSupplierOrTheReaders(t *testing.T) {
	srv := newTestServer(t)
	n := 0
	srv.fetchUserImage = func(context.Context, string, string) (string, error) {
		n++
		return fmt.Sprintf("%016x.jpg", n), nil
	}
	c := signupAdmin(t, srv.Handler())
	film := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies", map[string]any{"title": "Anand", "media_type": "movie"}, http.StatusCreated))
	row := decode[doorRow](t, c.mustDo("POST", "/movies/"+itoa(film.ID)+"/cast",
		map[string]any{"character": "Anand", "actor": "Rajesh Khanna"}, http.StatusCreated))
	fields := func() int {
		return sourceNamed(t, decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources, "google-images").Fields
	}

	c.mustDo("POST", "/cast/"+itoa(row.ID)+"/image", map[string]any{"image_url": "https://pics.example/anand.jpg", "image_source": "google-images"}, http.StatusOK)
	if got := fields(); got != 1 {
		t.Errorf("a cast row's strip pick: Google Images' row reads %d fields, want 1", got)
	}
	c.mustDo("PUT", "/characters/"+itoa(row.CharacterID)+"/image", map[string]any{"image_url": "https://pics.example/anand2.jpg", "image_source": "google-images"}, http.StatusOK)
	if got := fields(); got != 2 {
		t.Errorf("and the record's: Google Images' row reads %d fields, want 2", got)
	}
	// A pasted address names no supplier: the reader's, and no supplier's field,
	// even on a host a supplier owns, which a credit by host would give it.
	c.mustDo("POST", "/cast/"+itoa(row.ID)+"/image", map[string]any{"image_url": "https://upload.wikimedia.org/wikipedia/commons/anand.jpg"}, http.StatusOK)
	rows := decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources
	if got, w := sourceNamed(t, rows, "google-images").Fields, sourceNamed(t, rows, "wikimedia").Fields; got != 1 || w != 0 {
		t.Errorf("a pasted picture replaced the strip's: Google Images reads %d fields and Wikimedia %d, want 1 and 0", got, w)
	}
}

// A ROLE THE READER TOOK OFF IS NOT COUNTED. Removing a supplier's cast row keeps
// it as a tombstone, picture and all (a role the reader added is deleted
// outright), and the count is of what the library holds.
func TestARemovedRolesPictureIsNotCounted(t *testing.T) {
	srv := newTestServer(t)
	fake := portraitTMDB(t, `[{"id":380,"character":"Neil McCauley","name":"Robert De Niro","profile_path":"/de.jpg"}]`)
	t.Cleanup(fake.Close)
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	srv.fetchUserImage = func(context.Context, string, string) (string, error) { return "dddddddddddddddd.jpg", nil }
	c := signupAdmin(t, srv.Handler())
	m := addFromTMDB(t, c)
	row := castRowFor(t, c, m.ID, "Neil McCauley")
	fields := func() int {
		return sourceNamed(t, decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources, "google-images").Fields
	}
	c.mustDo("POST", "/cast/"+itoa(row.ID)+"/image", map[string]any{"image_url": "https://pics.example/neil.jpg", "image_source": "google-images"}, http.StatusOK)
	if got := fields(); got != 1 {
		t.Fatalf("setup: Google Images reads %d fields, want 1", got)
	}
	c.mustDo("DELETE", "/cast/"+itoa(row.ID), nil, http.StatusNoContent)
	if got := fields(); got != 0 {
		t.Errorf("a removed role's picture still counts: Google Images reads %d fields, want 0", got)
	}
}

// A PERSON COUNTS FOR A LINK ALONE: no portrait and no identity, one link Open
// Library gave.
func TestAPersonCountsForASupplierThatGaveOnlyALink(t *testing.T) {
	srv := newTestServer(t)
	srv.resolveAuthor = func(context.Context, string, []string) (metadata.AuthorResolution, error) {
		return metadata.AuthorResolution{}, nil
	}
	srv.authorLinks = func(context.Context, string) (map[string]string, error) {
		return map[string]string{"openlibrary": "https://openlibrary.org/authors/OL3A"}, nil
	}
	c := signupAdmin(t, srv.Handler())
	id := seedPerson(t, srv, 1, "author", "Mirra Ginsburg")
	fetchPersonByID(c, id)
	if o := sourceNamed(t, decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources, "openlibrary"); o.People != 1 || o.Fields != 0 {
		t.Errorf("Open Library's row reads %d fields | %d people for a person it gave one link, want 0 | 1", o.Fields, o.People)
	}
}

// A CHARACTER MERGE BORROWS THE PICTURE'S CREDIT WITH THE PICTURE, as a person's
// does: the survivor had none, takes the other's, and stays on its supplier's
// count.
func TestACharacterMergeCarriesThePicturesCredit(t *testing.T) {
	srv := newTestServer(t)
	n := 0
	srv.fetchUserImage = func(context.Context, string, string) (string, error) {
		n++
		return fmt.Sprintf("%016x.jpg", n), nil
	}
	c := signupAdmin(t, srv.Handler())
	keep, drop, _, _ := twoWolands(t, srv, c)
	c.mustDo("PUT", "/characters/"+itoa(drop)+"/image", map[string]any{"image_url": "https://pics.example/woland.jpg", "image_source": "google-images"}, http.StatusOK)
	c.mustDo("POST", "/characters/merge", map[string]any{"keep_id": keep, "drop_id": drop}, http.StatusOK)
	if got := sourceNamed(t, decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources, "google-images").Fields; got != 1 {
		t.Errorf("the survivor borrowed the picture and not its credit: Google Images reads %d fields, want 1", got)
	}
}

// A MERGE BORROWS WHO SUPPLIED WHAT IT BORROWS. The survivor takes the dropped
// record's portrait and links where its own are empty, and their credits come
// with them: the portrait keeps its tag, the links their marks, and the person
// stays on its supplier's count. An undo puts the survivor's own back.
func TestAMergeCarriesThePortraitAndLinksCredits(t *testing.T) {
	srv := newTestServer(t)
	openLibraryKnows(srv, "https://upload.wikimedia.org/wikipedia/commons/shelley.jpg")
	c := signupAdmin(t, srv.Handler())
	keep := seedPerson(t, srv, 1, "author", "Mary Shelley")
	drop := seedPerson(t, srv, 1, "author", "Mary W. Shelley")
	fetchPersonByID(c, drop)
	merged := decode[struct {
		TrashID int64 `json:"trash_id"`
	}](t, c.mustDo("POST", "/people/merge", map[string]any{"keep_id": keep, "drop_id": drop}, http.StatusOK))
	got := decode[personSources](t, c.mustDo("GET", "/people/id/"+itoa(keep), nil, http.StatusOK))
	if got.ImageSource != "wikimedia" || got.LinkSources["https://openlibrary.org/authors/OL1A"] != "openlibrary" {
		t.Errorf("the survivor borrowed a portrait and a link and not their credits: %+v", got)
	}
	c.mustDo("POST", "/trash/"+itoa(merged.TrashID)+"/restore", nil, http.StatusOK)
	if back := decode[personSources](t, c.mustDo("GET", "/people/id/"+itoa(keep), nil, http.StatusOK)); back.ImageSource != "" || len(back.LinkSources) != 0 {
		t.Errorf("an undone merge left the borrowed credits on the survivor: %+v", back)
	}
}
