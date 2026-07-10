package metadata

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// AuthorLinks: OL author search → author page link; remote_ids.wikidata →
// enwiki article via the EntityData hop.
func TestAuthorLinks(t *testing.T) {
	wikidata := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wiki/Special:EntityData/Q42.json" {
			t.Errorf("wikidata path = %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"entities":{"Q42":{"sitelinks":{"enwiki":{"title":"Douglas Adams"}}}}}`))
	}))
	defer wikidata.Close()
	ol := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search/authors.json":
			if q := r.URL.Query().Get("q"); q != "Douglas Adams" {
				t.Errorf("q = %q", q)
			}
			_, _ = w.Write([]byte(`{"docs":[{"key":"OL272947A"}]}`))
		case "/authors/OL272947A.json":
			_, _ = w.Write([]byte(`{"remote_ids":{"wikidata":"Q42"}}`))
		default:
			t.Errorf("unexpected OL path %s", r.URL.Path)
		}
	}))
	defer ol.Close()
	olOld, wdOld := openLibraryBase, wikidataBase
	openLibraryBase, wikidataBase = ol.URL, wikidata.URL
	t.Cleanup(func() { openLibraryBase, wikidataBase = olOld, wdOld })

	links, err := AuthorLinks(context.Background(), "Douglas Adams")
	if err != nil {
		t.Fatal(err)
	}
	if links["openlibrary"] != ol.URL+"/authors/OL272947A" {
		t.Errorf("openlibrary = %q", links["openlibrary"])
	}
	if links["wikipedia"] != "https://en.wikipedia.org/wiki/Douglas_Adams" {
		t.Errorf("wikipedia = %q", links["wikipedia"])
	}
}

// AuthorLinks with no search hit returns an empty map, not an error.
func TestAuthorLinksNoMatch(t *testing.T) {
	ol := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"docs":[]}`))
	}))
	defer ol.Close()
	olOld := openLibraryBase
	openLibraryBase = ol.URL
	t.Cleanup(func() { openLibraryBase = olOld })

	links, err := AuthorLinks(context.Background(), "Nobody Realname")
	if err != nil || len(links) != 0 {
		t.Fatalf("links = %v, err = %v; want empty, nil", links, err)
	}
}

// PersonLinks: TMDB person search + external_ids → tmdb/imdb/tvdb/wikipedia.
func TestTMDBPersonLinks(t *testing.T) {
	wikidata := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"entities":{"Q3296588":{"sitelinks":{"enwiki":{"title":"Humphrey Bogart"}}}}}`))
	}))
	defer wikidata.Close()
	tmdb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search/person":
			if q := r.URL.Query().Get("query"); q != "Humphrey Bogart" {
				t.Errorf("query = %q", q)
			}
			_, _ = w.Write([]byte(`{"results":[{"id":4110}]}`))
		case "/person/4110/external_ids":
			_, _ = w.Write([]byte(`{"imdb_id":"nm0000007","tvdb_id":78870,"wikidata_id":"Q3296588"}`))
		default:
			t.Errorf("unexpected TMDB path %s", r.URL.Path)
		}
	}))
	defer tmdb.Close()
	wdOld := wikidataBase
	wikidataBase = wikidata.URL
	t.Cleanup(func() { wikidataBase = wdOld })

	tm := &TMDB{Key: "v3key", BaseURL: tmdb.URL}
	links, err := tm.PersonLinks(context.Background(), "Humphrey Bogart")
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{
		"tmdb":      "https://www.themoviedb.org/person/4110",
		"imdb":      "https://www.imdb.com/name/nm0000007/",
		"tvdb":      "https://thetvdb.com/people/78870",
		"wikipedia": "https://en.wikipedia.org/wiki/Humphrey_Bogart",
	}
	for k, v := range want {
		if links[k] != v {
			t.Errorf("%s = %q, want %q", k, links[k], v)
		}
	}
}
