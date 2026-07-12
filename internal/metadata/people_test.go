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

// ResolveAuthor disambiguates same-name authors by the book the person wrote:
// two "David Reich"s come back and the wrong one is the more-published (so a
// naive pick loses); only the geneticist's works include the library title, so
// he is chosen, and his OL photo + wikidata identity come back with him.
func TestResolveAuthorDisambiguatesByBook(t *testing.T) {
	ol := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search/authors.json":
			_, _ = w.Write([]byte(`{"docs":[
				{"key":"/authors/OL1A","name":"David Reich","work_count":40},
				{"key":"OL2A","name":"David Reich","work_count":3}
			]}`))
		case "/authors/OL1A/works.json":
			_, _ = w.Write([]byte(`{"entries":[{"title":"An Unrelated Symphony"}]}`))
		case "/authors/OL2A/works.json":
			_, _ = w.Write([]byte(`{"entries":[{"title":"Who We Are and How We Got Here: Ancient DNA"}]}`))
		case "/authors/OL2A.json":
			_, _ = w.Write([]byte(`{"photos":[6157527],"remote_ids":{"wikidata":"Q123"}}`))
		default:
			t.Errorf("unexpected OL path %s", r.URL.Path)
		}
	}))
	defer ol.Close()
	wikidata := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"entities":{"Q123":{"sitelinks":{"enwiki":{"title":"David Reich (geneticist)"}}}}}`))
	}))
	defer wikidata.Close()
	olOld, wdOld := openLibraryBase, wikidataBase
	openLibraryBase, wikidataBase = ol.URL, wikidata.URL
	t.Cleanup(func() { openLibraryBase, wikidataBase = olOld, wdOld })

	res, err := ResolveAuthor(context.Background(), "David Reich",
		[]string{"Who We Are and How We Got Here"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Key != "OL2A" {
		t.Fatalf("picked %q, want OL2A (the geneticist, chosen by book cross-check)", res.Key)
	}
	if res.ImageURL != "https://covers.openlibrary.org/a/id/6157527-L.jpg" {
		t.Errorf("image = %q", res.ImageURL)
	}
	if res.WikidataQID != "Q123" {
		t.Errorf("qid = %q", res.WikidataQID)
	}
	if res.Links["wikipedia"] != "https://en.wikipedia.org/wiki/David_Reich_%28geneticist%29" {
		t.Errorf("wikipedia = %q", res.Links["wikipedia"])
	}
}

// ResolveAuthor falls back to the Wikidata P18 image when Open Library has no
// author photo (photos absent / [-1]). Single candidate: nothing to disambiguate.
func TestResolveAuthorWikidataPhotoFallback(t *testing.T) {
	ol := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search/authors.json":
			_, _ = w.Write([]byte(`{"docs":[{"key":"OL9A","name":"Jane Solo","work_count":2}]}`))
		case "/authors/OL9A.json":
			_, _ = w.Write([]byte(`{"photos":[-1],"remote_ids":{"wikidata":"Q9"}}`))
		default:
			t.Errorf("unexpected OL path %s", r.URL.Path)
		}
	}))
	defer ol.Close()
	wikidata := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/w/api.php" && r.URL.Query().Get("action") == "wbgetclaims":
			if p := r.URL.Query().Get("property"); p != "P18" {
				t.Errorf("property = %q, want P18", p)
			}
			_, _ = w.Write([]byte(`{"claims":{"P18":[{"mainsnak":{"datavalue":{"value":"Jane Solo.jpg"}}}]}}`))
		case r.URL.Path == "/wiki/Special:EntityData/Q9.json":
			_, _ = w.Write([]byte(`{"entities":{"Q9":{"sitelinks":{}}}}`))
		default:
			t.Errorf("unexpected wikidata path %s?%s", r.URL.Path, r.URL.RawQuery)
		}
	}))
	defer wikidata.Close()
	olOld, wdOld := openLibraryBase, wikidataBase
	openLibraryBase, wikidataBase = ol.URL, wikidata.URL
	t.Cleanup(func() { openLibraryBase, wikidataBase = olOld, wdOld })

	res, err := ResolveAuthor(context.Background(), "Jane Solo", nil)
	if err != nil {
		t.Fatal(err)
	}
	want := "https://commons.wikimedia.org/wiki/Special:FilePath/Jane%20Solo.jpg?width=600"
	if res.ImageURL != want {
		t.Fatalf("image = %q, want %q", res.ImageURL, want)
	}
}

// When Open Library is sparse (no photo, no wikidata link) — the David Reich
// case — ResolveAuthor anchors on the book to reach Wikidata: the work's author
// (P50) gives the correct person (not a namesake), then P18 + enwiki.
func TestResolveAuthorBookWikidataFallback(t *testing.T) {
	ol := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search/authors.json":
			// Two namesakes; the wrong one is more published.
			_, _ = w.Write([]byte(`{"docs":[
				{"key":"OL_WRONG","name":"David Reich","work_count":40},
				{"key":"OL_RIGHT","name":"David Reich","work_count":2}
			]}`))
		case "/authors/OL_WRONG/works.json":
			_, _ = w.Write([]byte(`{"entries":[{"title":"You Could Lose an Eye"}]}`))
		case "/authors/OL_RIGHT/works.json":
			_, _ = w.Write([]byte(`{"entries":[{"title":"Who We Are and How We Got Here"}]}`))
		case "/authors/OL_RIGHT.json":
			// Sparse: no photo, no wikidata remote id.
			_, _ = w.Write([]byte(`{"photos":[],"remote_ids":{}}`))
		default:
			t.Errorf("unexpected OL path %s", r.URL.Path)
		}
	}))
	defer ol.Close()
	wikidata := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		switch {
		case r.URL.Path == "/w/api.php" && q.Get("action") == "wbsearchentities":
			_, _ = w.Write([]byte(`{"search":[{"id":"Q_BOOK"}]}`))
		case r.URL.Path == "/w/api.php" && q.Get("action") == "wbgetclaims" && q.Get("property") == "P50":
			_, _ = w.Write([]byte(`{"claims":{"P50":[{"mainsnak":{"datavalue":{"value":{"id":"Q_AUTHOR"}}}}]}}`))
		case r.URL.Path == "/w/api.php" && q.Get("action") == "wbgetclaims" && q.Get("property") == "P18":
			_, _ = w.Write([]byte(`{"claims":{"P18":[{"mainsnak":{"datavalue":{"value":"David Reich.jpg"}}}]}}`))
		case r.URL.Path == "/wiki/Special:EntityData/Q_AUTHOR.json":
			_, _ = w.Write([]byte(`{"entities":{"Q_AUTHOR":{"labels":{"en":{"value":"David E. Reich"}},"sitelinks":{"enwiki":{"title":"David Reich (geneticist)"}}}}}`))
		default:
			t.Errorf("unexpected wikidata path %s?%s", r.URL.Path, r.URL.RawQuery)
		}
	}))
	defer wikidata.Close()
	olOld, wdOld := openLibraryBase, wikidataBase
	openLibraryBase, wikidataBase = ol.URL, wikidata.URL
	t.Cleanup(func() { openLibraryBase, wikidataBase = olOld, wdOld })

	res, err := ResolveAuthor(context.Background(), "David Reich", []string{"Who We Are and How We Got Here"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Key != "OL_RIGHT" {
		t.Fatalf("picked %q, want OL_RIGHT (by the book cross-check)", res.Key)
	}
	if res.WikidataQID != "Q_AUTHOR" {
		t.Fatalf("qid = %q, want Q_AUTHOR (via the book's P50)", res.WikidataQID)
	}
	if res.ImageURL != "https://commons.wikimedia.org/wiki/Special:FilePath/David%20Reich.jpg?width=600" {
		t.Fatalf("image = %q", res.ImageURL)
	}
	if res.Links["wikipedia"] != "https://en.wikipedia.org/wiki/David_Reich_%28geneticist%29" {
		t.Fatalf("wikipedia = %q", res.Links["wikipedia"])
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
