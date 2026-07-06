package metadata

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const googleJSON = `{"items":[{"id":"vol1","volumeInfo":{
  "title":"Fooled by Randomness",
  "authors":["Nassim Taleb","Second Author"],
  "description":"On luck.",
  "publishedDate":"2004-04-14",
  "categories":["Business","Psychology"],
  "industryIdentifiers":[
    {"type":"ISBN_10","identifier":"0306406152"},
    {"type":"ISBN_13","identifier":"9780306406157"}],
  "imageLinks":{"thumbnail":"http://books.google.com/thumb?id=vol1"}}}]}`

const openLibraryJSON = `{"docs":[{
  "key":"/works/OL123W",
  "title":"Fooled by Randomness",
  "author_name":["Nassim Nicholas Taleb"],
  "first_publish_year":2001,
  "cover_i":240727,
  "subject":["s1","s2","s3","s4","s5","s6","s7","s8"],
  "series":["Incerto #2"]}]}`

func setBases(t *testing.T, google, openLibrary string) {
	t.Helper()
	gOld, oOld := googleBase, openLibraryBase
	googleBase, openLibraryBase = google, openLibrary
	t.Cleanup(func() { googleBase, openLibraryBase = gOld, oOld })
}

func jsonServer(t *testing.T, body string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestSearchBooksMergesSources(t *testing.T) {
	gsrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/books/v1/volumes" {
			t.Errorf("google path = %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("q"); got != "isbn:9780306406157" {
			t.Errorf("google q = %q", got)
		}
		if _, has := r.URL.Query()["key"]; has {
			t.Error("anonymous search must not send a key param")
		}
		if ua := r.Header.Get("User-Agent"); ua != userAgent {
			t.Errorf("user agent = %q", ua)
		}
		_, _ = w.Write([]byte(googleJSON))
	}))
	defer gsrv.Close()
	osrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/search.json" {
			t.Errorf("ol path = %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("isbn") != "9780306406157" || q.Get("limit") != "5" {
			t.Errorf("ol query = %v", q)
		}
		_, _ = w.Write([]byte(openLibraryJSON))
	}))
	defer osrv.Close()
	setBases(t, gsrv.URL, osrv.URL)

	got, err := SearchBooks(context.Background(), "9780306406157", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d candidates, want 2", len(got))
	}

	g := got[0]
	if g.Source != "google" || g.SourceID != "vol1" || g.Title != "Fooled by Randomness" {
		t.Errorf("google candidate = %+v", g)
	}
	if g.Author != "Nassim Taleb, Second Author" {
		t.Errorf("author = %q", g.Author)
	}
	if g.ISBN13 != "9780306406157" {
		t.Errorf("isbn13 = %q", g.ISBN13)
	}
	if g.Description != "On luck." || g.PublishedYear != 2004 {
		t.Errorf("desc/year = %q/%d", g.Description, g.PublishedYear)
	}
	if len(g.Genres) != 2 || g.Genres[0] != "Business" {
		t.Errorf("genres = %v", g.Genres)
	}
	if g.CoverURL != "https://books.google.com/thumb?id=vol1" {
		t.Errorf("cover = %q, want https upgrade", g.CoverURL)
	}

	ol := got[1]
	if ol.Source != "openlibrary" || ol.SourceID != "/works/OL123W" {
		t.Errorf("ol candidate = %+v", ol)
	}
	if ol.Author != "Nassim Nicholas Taleb" || ol.PublishedYear != 2001 {
		t.Errorf("ol author/year = %q/%d", ol.Author, ol.PublishedYear)
	}
	if ol.ISBN13 != "9780306406157" {
		t.Errorf("ol isbn13 = %q", ol.ISBN13)
	}
	if len(ol.Genres) != 6 {
		t.Errorf("ol genres = %v, want capped at 6", ol.Genres)
	}
	if ol.Series != "Incerto" || ol.SeriesIndex != 2 {
		t.Errorf("ol series = %q #%v, want Incerto #2", ol.Series, ol.SeriesIndex)
	}
	if ol.CoverURL != "https://covers.openlibrary.org/b/id/240727-L.jpg" {
		t.Errorf("ol cover = %q", ol.CoverURL)
	}
}

func TestSearchBooksBestEffort(t *testing.T) {
	boom := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer boom.Close()
	osrv := jsonServer(t, openLibraryJSON)

	// Google down, Open Library up -> still get OL's candidates.
	setBases(t, boom.URL, osrv.URL)
	got, err := SearchBooks(context.Background(), "9780306406157", "", "")
	if err != nil {
		t.Fatalf("one source up should not error: %v", err)
	}
	if len(got) != 1 || got[0].Source != "openlibrary" {
		t.Fatalf("got %+v", got)
	}

	// Both down -> error.
	setBases(t, boom.URL, boom.URL)
	if _, err := SearchBooks(context.Background(), "9780306406157", "", ""); err == nil {
		t.Fatal("want error when both sources fail")
	}

	// Title search queries both sources; when both are down it errors.
	if _, err := SearchBooks(context.Background(), "", "whatever", ""); err == nil {
		t.Fatal("want error for title search when both sources fail")
	}
}

// Title-only searches now query Open Library by title too — a keyless fallback
// that matters when Google is quota-blocked (PLAN §6).
func TestSearchBooksTitleOnly(t *testing.T) {
	gsrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("q"); got != "intitle:the black swan" {
			t.Errorf("google q = %q", got)
		}
		_, _ = w.Write([]byte(googleJSON))
	}))
	defer gsrv.Close()
	osrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("title"); got != "the black swan" {
			t.Errorf("ol title query = %q", got)
		}
		if _, has := r.URL.Query()["isbn"]; has {
			t.Error("title-only search must not send an isbn param to open library")
		}
		_, _ = w.Write([]byte(openLibraryJSON))
	}))
	defer osrv.Close()
	setBases(t, gsrv.URL, osrv.URL)

	got, err := SearchBooks(context.Background(), "", "the black swan", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].Source != "google" || got[1].Source != "openlibrary" {
		t.Fatalf("got %+v", got)
	}
	if got[1].ISBN13 != "" {
		t.Errorf("title-only OL candidate should carry no echoed isbn, got %q", got[1].ISBN13)
	}
}

// The optional settings-managed Google Books key is appended to the volumes
// query only — Open Library stays anonymous (PLAN §6).
func TestSearchBooksGoogleKey(t *testing.T) {
	gotKey := ""
	gsrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.URL.Query().Get("key")
		_, _ = w.Write([]byte(googleJSON))
	}))
	defer gsrv.Close()
	osrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, has := r.URL.Query()["key"]; has {
			t.Error("open library must not receive the google key")
		}
		_, _ = w.Write([]byte(openLibraryJSON))
	}))
	defer osrv.Close()
	setBases(t, gsrv.URL, osrv.URL)

	if _, err := SearchBooks(context.Background(), "9780306406157", "", "sekret&key"); err != nil {
		t.Fatal(err)
	}
	if gotKey != "sekret&key" { // query-escaped on the wire, decoded back here
		t.Fatalf("google key = %q", gotKey)
	}
}

func TestSearchBooksCap(t *testing.T) {
	items := make([]string, 10)
	for i := range items {
		items[i] = fmt.Sprintf(`{"id":"v%d","volumeInfo":{"title":"T%d"}}`, i, i)
	}
	gsrv := jsonServer(t, `{"items":[`+strings.Join(items, ",")+`]}`)
	osrv := jsonServer(t, openLibraryJSON)
	setBases(t, gsrv.URL, osrv.URL)

	got, err := SearchBooks(context.Background(), "9780306406157", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 8 {
		t.Fatalf("got %d candidates, want cap of 8", len(got))
	}
}

func TestDeriveSeriesFromTitle(t *testing.T) {
	cases := []struct {
		title, subtitle, wantName string
		wantIdx                   float64
	}{
		// series in a parenthetical (the real Google/OL shape for Malazan)
		{"Reaper's Gale (Malazan Book of Fallen 7) (Malazan Book of the Fallen)", "", "Malazan Book of Fallen", 7},
		// series after a colon (subtitle folded into the title)
		{"Reaper's Gale: The Malazan Book of the Fallen 7", "", "The Malazan Book of the Fallen", 7},
		// series in a separate subtitle field (Google splits it out)
		{"Reaper's Gale", "The Malazan Book of the Fallen 7", "The Malazan Book of the Fallen", 7},
		// a descriptive subtitle with no trailing number is NOT a series
		{"Sapiens: A Brief History of Humankind", "", "", 0},
		// a plain title with nothing series-like
		{"Dune", "", "", 0},
	}
	for _, c := range cases {
		name, idx := deriveSeriesFromTitle(c.title, c.subtitle)
		if name != c.wantName || idx != c.wantIdx {
			t.Errorf("deriveSeriesFromTitle(%q, %q) = (%q, %v), want (%q, %v)",
				c.title, c.subtitle, name, idx, c.wantName, c.wantIdx)
		}
	}
}
