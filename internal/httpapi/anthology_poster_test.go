package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// AN ANTHOLOGY THAT READS LIKE A BOOK (0092): a landscape poster and a description the reader writes.
//
// WHAT IS AT RISK. Both are front matter, written through routes of their own and not the full-state
// PUT, so the way each goes wrong is the way the cover and the epigraph already did: a poster file that
// outlives its anthology, a description cleared by a client that never heard of it, and a LIST row that
// does not carry what the page does (the list had no cover at all until this change, so a list could
// not draw a picture it was never told about).

type posterRow struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	CoverPath   string `json:"cover_path"`
	PosterPath  string `json:"poster_path"`
	Description string `json:"description"`
}

func listedAnthology(t *testing.T, c *testClient, id int64) posterRow {
	t.Helper()
	list := decode[struct {
		Anthologies []posterRow `json:"anthologies"`
	}](t, c.mustDo("GET", "/anthologies", nil, http.StatusOK))
	for _, a := range list.Anthologies {
		if a.ID == id {
			return a
		}
	}
	t.Fatalf("anthology %d is not in the list", id)
	return posterRow{}
}

func detailOf(t *testing.T, c *testClient, id int64) posterRow {
	t.Helper()
	return decode[struct {
		Anthology posterRow `json:"anthology"`
	}](t, c.mustDo("GET", "/anthologies/"+itoa(id), nil, http.StatusOK)).Anthology
}

func TestADescriptionIsKeptOnThePageAndOnTheListRow(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	an := newAnthology(t, c, "Proverbs")

	c.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/front",
		map[string]any{"epigraph": "", "dedication": "", "description": "A small book of old sayings.\n\nGathered by hand."}, http.StatusNoContent)

	want := "A small book of old sayings.\n\nGathered by hand."
	if got := detailOf(t, c, an.ID).Description; got != want {
		t.Fatalf("the page says %q, want %q", got, want)
	}
	if got := listedAnthology(t, c, an.ID).Description; got != want {
		t.Fatalf("the list row says %q, want %q", got, want)
	}
}

func TestAClientThatNeverHeardOfTheDescriptionDoesNotClearIt(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	an := newAnthology(t, c, "Proverbs")
	c.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/front",
		map[string]any{"epigraph": "", "dedication": "", "description": "Typed by hand."}, http.StatusNoContent)

	// an app built before the description saves the other two front-matter fields, and nothing else
	c.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/front",
		map[string]any{"epigraph": "A line.", "dedication": "For you."}, http.StatusNoContent)

	got := detailOf(t, c, an.ID)
	if got.Description != "Typed by hand." {
		t.Fatalf("the description was cleared by a request that did not name it: %q", got.Description)
	}
	// and naming it empty does clear it, which is how a reader takes it away
	c.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/front",
		map[string]any{"epigraph": "", "dedication": "", "description": ""}, http.StatusNoContent)
	if got := detailOf(t, c, an.ID).Description; got != "" {
		t.Fatalf("an empty description did not clear it: %q", got)
	}
}

func TestTheDescriptionIsBoundedAndIsNotSomebodyElses(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	an := newAnthology(t, c, "Proverbs")
	c.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/front",
		map[string]any{"epigraph": "", "dedication": "", "description": strings.Repeat("x", anthologyDescriptionMax+1)},
		http.StatusBadRequest)

	bob := addUser(t, srv.Handler(), c, "bob")
	bob.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/front",
		map[string]any{"epigraph": "", "dedication": "", "description": "mine now"}, http.StatusNotFound)
	bob.mustDo("POST", "/anthologies/"+itoa(an.ID)+"/poster", nil, http.StatusNotFound)
	bob.mustDo("DELETE", "/anthologies/"+itoa(an.ID)+"/poster", nil, http.StatusNotFound)
}

func TestAPosterIsUploadedReplacedAndRemovedWithItsFile(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	an := newAnthology(t, c, "Posters")

	uploadPictureTo(t, c, "/anthologies/"+itoa(an.ID)+"/poster", pngWithPad(11), http.StatusOK)
	first := detailOf(t, c, an.ID).PosterPath
	if first == "" {
		t.Fatal("no poster after the upload")
	}
	if got := listedAnthology(t, c, an.ID).PosterPath; got != first {
		t.Fatalf("the list row names the poster %q, the page names %q", got, first)
	}
	if _, err := os.Stat(filepath.Join(srv.coversDir(), first)); err != nil {
		t.Fatalf("the poster file was not stored: %v", err)
	}
	// the poster is not the cover: the two are separate pictures
	if detailOf(t, c, an.ID).CoverPath != "" {
		t.Fatal("uploading a poster set the cover")
	}

	uploadPictureTo(t, c, "/anthologies/"+itoa(an.ID)+"/poster", pngWithPad(12), http.StatusOK)
	second := detailOf(t, c, an.ID).PosterPath
	if second == first {
		t.Fatal("the poster did not change")
	}
	if _, err := os.Stat(filepath.Join(srv.coversDir(), first)); err == nil {
		t.Errorf("the replaced poster's file is still on disk")
	}

	c.mustDo("DELETE", "/anthologies/"+itoa(an.ID)+"/poster", nil, http.StatusNoContent)
	if detailOf(t, c, an.ID).PosterPath != "" {
		t.Errorf("the poster is still named after it was removed")
	}
	if _, err := os.Stat(filepath.Join(srv.coversDir(), second)); err == nil {
		t.Errorf("the removed poster's file is still on disk")
	}
}

func TestDeletingAnAnthologyDeletesItsPosterFile(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	an := newAnthology(t, c, "Gone")
	uploadPictureTo(t, c, "/anthologies/"+itoa(an.ID)+"/poster", pngWithPad(13), http.StatusOK)
	poster := detailOf(t, c, an.ID).PosterPath
	c.mustDo("DELETE", "/anthologies/"+itoa(an.ID), nil, http.StatusNoContent)
	if _, err := os.Stat(filepath.Join(srv.coversDir(), poster)); err == nil {
		t.Errorf("the poster file outlived its anthology")
	}
}

func TestTheCapabilitiesNameThePoster(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	caps := decode[struct {
		Revision int      `json:"api_revision"`
		Features []string `json:"features"`
	}](t, c.mustDo("GET", "/capabilities", nil, http.StatusOK))
	if caps.Revision < 10 {
		t.Fatalf("revision %d, want 10 or more", caps.Revision)
	}
	found := false
	for _, f := range caps.Features {
		found = found || f == "anthology-poster"
	}
	if !found {
		t.Fatalf("features %v do not name anthology-poster", caps.Features)
	}
}
