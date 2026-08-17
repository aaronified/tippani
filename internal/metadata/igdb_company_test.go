package metadata

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Studio reference pages, from IGDB.
//
// THE BUG THIS EXISTS FOR: a game studio was being resolved through Open
// Library. `handlePersonLookup` split its providers "author-ish → Open Library,
// everything else → TMDB", which was a complete description of the world until
// 0040 added a seventh person kind that is not a person at all. `studio` fell
// into the else, and where it did not land on TMDB it landed on the author
// path — so Electronic Arts resolved to openlibrary.org/authors/OL7329153A and
// the panel proudly labelled it "VIA OPENLIBRARY".
//
// That is the worst shape a metadata bug takes: it does not fail. It returns a
// real record, about a real thing, that is not the thing you asked about.

func newIGDBCompanyStub(t *testing.T, body string) *IGDB {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "oauth2/token"):
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "t", "expires_in": 3600})
		case strings.Contains(r.URL.Path, "/companies"):
			w.Write([]byte(body))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return &IGDB{ClientID: "id", ClientSecret: "s", BaseURL: srv.URL, TokenURL: srv.URL + "/oauth2/token"}
}

func TestIGDBCompanyLinksResolvesAStudio(t *testing.T) {
	g := newIGDBCompanyStub(t, `[{
		"id": 1, "name": "Electronic Arts", "url": "https://www.igdb.com/companies/electronic-arts",
		"logo": {"image_id": "cl1x"},
		"websites": [{"category": 1, "url": "https://www.ea.com"}, {"category": 4, "url": "https://en.wikipedia.org/wiki/Electronic_Arts"}]
	}]`)
	links, logo, id, err := g.CompanyLinks(context.Background(), "Electronic Arts")
	if err != nil {
		t.Fatal(err)
	}
	if id != 1 {
		t.Errorf("id = %d — the portrait path pins an identity with it", id)
	}
	if links["igdb"] == "" {
		t.Fatalf("links = %v, want the IGDB page", links)
	}
	if links["official"] != "https://www.ea.com" {
		t.Errorf("official = %q", links["official"])
	}
	if !strings.Contains(links["wikipedia"], "wikipedia.org") {
		t.Errorf("wikipedia = %q", links["wikipedia"])
	}
	// The logo rides back on the same call: it is the portrait for this row, and
	// the two are one fact rather than two round trips.
	if logo != "cl1x" {
		t.Errorf("logo = %q, want the image id", logo)
	}
	// NOTHING FROM A BOOK OR FILM DATABASE. This is the assertion the whole file
	// is for — a studio must never come back carrying an author page.
	for k, v := range links {
		if strings.Contains(v, "openlibrary.org") || strings.Contains(v, "themoviedb.org") {
			t.Errorf("%s = %q — a studio is not a person and must not resolve to one", k, v)
		}
	}
}

// `search` RANKS, it does not filter, so "Electronic Arts" happily returns
// "Electronic Arts Seattle" as well. Taking the first hit would attach a
// subsidiary's logo and link to the parent and present it as fact.
func TestIGDBCompanyLinksRequireAnExactName(t *testing.T) {
	g := newIGDBCompanyStub(t, `[
		{"id": 2, "name": "Electronic Arts Seattle", "url": "https://www.igdb.com/companies/ea-seattle", "logo": {"image_id": "wrong"}},
		{"id": 1, "name": "Electronic Arts", "url": "https://www.igdb.com/companies/electronic-arts", "logo": {"image_id": "right"}}
	]`)
	links, logo, id, err := g.CompanyLinks(context.Background(), "Electronic Arts")
	if err != nil {
		t.Fatal(err)
	}
	if id != 1 {
		t.Errorf("id = %d, want the exact match's", id)
	}
	if logo != "right" || !strings.Contains(links["igdb"], "/electronic-arts") {
		t.Fatalf("links = %v, logo = %q — the near-miss won", links, logo)
	}
}

// A studio nobody has catalogued is a normal outcome, not a failure: the caller
// falls through to the manual fields.
func TestIGDBCompanyLinksAreEmptyRatherThanAnError(t *testing.T) {
	g := newIGDBCompanyStub(t, `[]`)
	links, logo, _, err := g.CompanyLinks(context.Background(), "A Studio Nobody Catalogued")
	if err != nil || len(links) != 0 || logo != "" {
		t.Fatalf("got %v / %q / %v — an unknown studio is empty, not an error", links, logo, err)
	}
}

func TestIGDBCompanyLinksIgnoreABlankName(t *testing.T) {
	// No stub call at all: a blank name must not reach the API.
	g := &IGDB{ClientID: "id", ClientSecret: "s", BaseURL: "http://127.0.0.1:0"}
	if links, _, _, err := g.CompanyLinks(context.Background(), "   "); err != nil || len(links) != 0 {
		t.Fatalf("got %v, %v", links, err)
	}
}
