package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"tippani/internal/metadata"
)

// THE PEOPLE ROW'S FETCH, ONE PRESS: POST /people/id/{id}/fetch.
//
// Driven through the API as the People console drives it: the row's Fetch sends
// the record's id and nothing else, and the record is read back as its panel
// reads it (GET /people/id/{id}), its picture as the page loads it
// (GET /covers/{file}).
//
// WHAT IT KNOWS, declared because a test here may not know the code: the
// suppliers are the server's own seams — Open Library's author resolution
// (srv.resolveAuthor), the portrait download (srv.fetchImage, which writes the
// file it names into the covers dir, as the real one does) and the IGDB client
// (srv.IGDB, pointed at a stub of its /companies answer) — because a test may not
// reach the real ones. Two records sharing a name are made by twoNamesakes
// (person_portrait_record_test.go), which writes the second into the table: the
// API resolves by name, so no request makes a second.
//
// What each one guards, in a sentence a person would say: a Fetch lands on the
// record I pressed and not on the one that shares its name, whose picture stays
// where it was; it keeps the names I gave my links and adds the page it found;
// another reader's record is not there for me to fetch; and a game studio is
// fetched from the games catalogue, not looked for among film people or authors.

type fetchedPerson struct {
	Person struct {
		ID        int64  `json:"id"`
		Name      string `json:"name"`
		ImagePath string `json:"image_path"`
		Bio       string `json:"bio"`
		Links     string `json:"links"`
		Source    string `json:"source"`
		SourceID  string `json:"source_id"`
	} `json:"person"`
	Links map[string]string `json:"links"`
}

// downloads stands in for the portrait download: each address it is asked for
// becomes a new file in the covers dir, named as the real downloader names one.
func downloads(t *testing.T, srv *Server) *[]string {
	t.Helper()
	var asked []string
	var n atomic.Int64
	srv.fetchImage = func(_ context.Context, rawURL, dir string) (string, error) {
		asked = append(asked, rawURL)
		name := fmt.Sprintf("%016x.jpg", n.Add(1))
		return name, os.WriteFile(filepath.Join(dir, name), []byte("jpeg"), 0o600)
	}
	return &asked
}

func TestAFetchLandsOnTheRecordPressedAndKeepsTheNamesOnItsLinks(t *testing.T) {
	srv := newTestServer(t)
	srv.resolveAuthor = func(_ context.Context, name string, _ []string) (metadata.AuthorResolution, error) {
		if name != "David Reich" {
			t.Errorf("resolved %q", name)
		}
		return metadata.AuthorResolution{
			Key: "OL1A", Name: "David Reich", Bio: "A geneticist.",
			ImageURL: "https://covers.openlibrary.org/a/id/1-L.jpg",
			Links:    map[string]string{"openlibrary": "https://openlibrary.org/authors/OL1A"},
		}, nil
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	first, second := twoNamesakes(t, srv, alice)

	// The first already has a picture of their own, chosen by the reader.
	srv.fetchUserImage = func(_ context.Context, _, dir string) (string, error) {
		name := "00000000000000f1.jpg"
		return name, os.WriteFile(filepath.Join(dir, name), []byte("jpeg"), 0o600)
	}
	alice.mustDo("PUT", "/people/id/"+itoa(first), map[string]any{"image_url": "https://example.test/first.jpg"}, http.StatusOK)
	// The second has a link the reader named.
	alice.mustDo("PUT", "/people/id/"+itoa(second), map[string]any{"links": "https://example.org/essays | Their essays"}, http.StatusOK)
	asked := downloads(t, srv)

	got := decode[fetchedPerson](t, alice.mustDo("POST", "/people/id/"+itoa(second)+"/fetch", nil, http.StatusOK))
	p := got.Person
	if p.ID != second || p.Source != "openlibrary" || p.SourceID != "OL1A" || p.Bio != "A geneticist." || p.ImagePath == "" {
		t.Fatalf("the record fetched: %+v", p)
	}
	if len(*asked) != 1 || (*asked)[0] != "https://covers.openlibrary.org/a/id/1-L.jpg" {
		t.Fatalf("downloaded %v", *asked)
	}
	wantLinks := "https://openlibrary.org/authors/OL1A\nhttps://example.org/essays | Their essays"
	if p.Links != wantLinks {
		t.Fatalf("the fetch answered links\n%s\nwant\n%s", p.Links, wantLinks)
	}
	if got.Links["openlibrary"] != "https://openlibrary.org/authors/OL1A" {
		t.Fatalf("the links it found: %v", got.Links)
	}

	// Read back as the panel reads it: kept, names and all.
	type record struct {
		ImagePath string `json:"image_path"`
		Bio       string `json:"bio"`
		Links     string `json:"links"`
		Source    string `json:"source"`
	}
	if r := decode[record](t, alice.mustDo("GET", "/people/id/"+itoa(second), nil, http.StatusOK)); r.Links != wantLinks || r.ImagePath != p.ImagePath {
		t.Fatalf("the record after its fetch: %+v", r)
	}
	alice.mustDo("GET", "/covers/"+p.ImagePath, nil, http.StatusOK)

	// THE NAMESAKE IS UNTOUCHED: no identity, no facts, no links, and its own
	// picture still on the record and on the disk.
	if r := decode[record](t, alice.mustDo("GET", "/people/id/"+itoa(first), nil, http.StatusOK)); r.Source != "" || r.Bio != "" || r.Links != "" || r.ImagePath != "00000000000000f1.jpg" {
		t.Fatalf("the namesake after the other's fetch: %+v", r)
	}
	alice.mustDo("GET", "/covers/00000000000000f1.jpg", nil, http.StatusOK)

	// Another reader has no such record, and nothing is looked up for them.
	bob := addUser(t, h, alice, "bob")
	*asked = nil
	bob.mustDo("POST", "/people/id/"+itoa(second)+"/fetch", nil, http.StatusNotFound)
	bob.mustDo("POST", "/people/id/999999/fetch", nil, http.StatusNotFound)
	bob.mustDo("POST", "/people/id/nobody/fetch", nil, http.StatusBadRequest)
	if len(*asked) != 0 {
		t.Fatalf("another reader's fetch downloaded %v", *asked)
	}
}

// igdbCompanies answers IGDB's token and /companies calls with one company.
func igdbCompanies(t *testing.T, company string) *metadata.IGDB {
	t.Helper()
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "token"):
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "t", "expires_in": 3600})
		case strings.Contains(r.URL.Path, "/companies"):
			_, _ = w.Write([]byte(company))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(stub.Close)
	return &metadata.IGDB{ClientID: "id", ClientSecret: "secret", BaseURL: stub.URL, TokenURL: stub.URL + "/token"}
}

func TestAStudiosFetchAsksTheGamesCatalogue(t *testing.T) {
	srv := newTestServer(t)
	srv.IGDB = igdbCompanies(t, `[{
		"id": 1, "name": "Electronic Arts", "url": "https://www.igdb.com/companies/electronic-arts",
		"logo": {"image_id": "cl1x"},
		"websites": [{"category": 1, "url": "https://www.ea.com"}, {"category": 4, "url": "https://en.wikipedia.org/wiki/Electronic_Arts"}]
	}]`)
	srv.resolveAuthor = func(context.Context, string, []string) (metadata.AuthorResolution, error) {
		t.Error("a studio was looked up as a book author")
		return metadata.AuthorResolution{}, nil
	}
	asked := downloads(t, srv)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/movies", map[string]any{"title": "Mass Effect", "media_type": "game", "director": "Electronic Arts"}, http.StatusCreated)
	var studio int64
	for _, p := range decode[struct {
		People []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"people"`
	}](t, c.mustDo("GET", "/people/records", nil, http.StatusOK)).People {
		if p.Name == "Electronic Arts" {
			studio = p.ID
		}
	}
	if studio == 0 {
		t.Fatal("the studio has no record in the People console")
	}

	p := decode[fetchedPerson](t, c.mustDo("POST", "/people/id/"+itoa(studio)+"/fetch", nil, http.StatusOK)).Person
	if p.Source != "igdb" || p.SourceID != "1" || p.ImagePath == "" {
		t.Fatalf("the studio after its fetch: %+v", p)
	}
	if len(*asked) != 1 || !strings.Contains((*asked)[0], "cl1x") {
		t.Fatalf("downloaded %v, want the company's logo", *asked)
	}
	// Its catalogue page and its encyclopaedia page, in the order links are
	// written; the studio's own site is not a provider page and is not kept.
	if want := "https://www.igdb.com/companies/electronic-arts\nhttps://en.wikipedia.org/wiki/Electronic_Arts"; p.Links != want {
		t.Fatalf("the studio's links:\n%s\nwant\n%s", p.Links, want)
	}
}
