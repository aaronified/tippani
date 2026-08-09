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
		if q.Get("isbn") != "9780306406157" || q.Get("limit") != "10" {
			t.Errorf("ol query = %v", q)
		}
		_, _ = w.Write([]byte(openLibraryJSON))
	}))
	defer osrv.Close()
	setBases(t, gsrv.URL, osrv.URL)

	got, err := SearchBooks(context.Background(), "9780306406157", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	// ONE record, not two. An ISBN names one book, so the providers are two
	// partial accounts of it rather than two things to choose between — and
	// choosing a row would mean inheriting that row's gaps wholesale.
	if len(got) != 1 {
		t.Fatalf("got %d candidates, want one merged record", len(got))
	}
	m := got[0]

	// Open Library titles the WORK; Google titles the edition in hand.
	if m.Title != "Fooled by Randomness" {
		t.Errorf("title = %q", m.Title)
	}
	// The longest credit wins, which here means keeping the SECOND AUTHOR rather
	// than the fuller spelling of the first. That is the right trade: a dropped
	// co-author is data the library cannot get back, and a missing middle name is
	// a cosmetic difference the credit splitter already tolerates.
	if m.Author != "Nassim Taleb, Second Author" {
		t.Errorf("author = %q", m.Author)
	}
	if m.ISBN13 != "9780306406157" {
		t.Errorf("isbn13 = %q", m.ISBN13)
	}
	// 2001, not the 2004 in this fixture's publishedDate. Google reports the
	// EDITION's date; Open Library reports first_publish_year. A work cannot have
	// been written after an edition of it was printed, so the earlier one answers
	// the question — a four-year quibble on a modern paperback, and eighteen
	// centuries on the Meditations.
	if m.PublishedYear != 2001 {
		t.Errorf("year = %d, want the first publication", m.PublishedYear)
	}
	// Google carries the blurb; Open Library usually carries none.
	if m.Description != "On luck." {
		t.Errorf("description = %q", m.Description)
	}
	// Google's hi-res fife render beats Open Library's -L.jpg (https upgraded,
	// query re-encoded alphabetically).
	if m.CoverURL != "https://books.google.com/thumb?fife=w1280-h1920&id=vol1" {
		t.Errorf("cover = %q, want the Google hi-res render", m.CoverURL)
	}
	// The union of two vocabularies that barely overlap, capped.
	if len(m.Genres) < 6 || m.Genres[0] != "Business" {
		t.Errorf("genres = %v, want Google's first then Open Library's subjects", m.Genres)
	}
	// Series only Open Library knew about.
	if m.Series != "Incerto" || m.SeriesIndex != 2 {
		t.Errorf("series = %q #%v, want Incerto #2", m.Series, m.SeriesIndex)
	}
	// Both identities survive, so either can be re-verified later.
	if m.GoogleID != "vol1" || m.OpenLibraryID != "/works/OL123W" {
		t.Errorf("ids = %q / %q", m.GoogleID, m.OpenLibraryID)
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
	got, err := SearchBooks(context.Background(), "9780306406157", "", "", "")
	if err != nil {
		t.Fatalf("one source up should not error: %v", err)
	}
	if len(got) != 1 || got[0].Source != "openlibrary" {
		t.Fatalf("got %+v", got)
	}

	// Both down -> error.
	setBases(t, boom.URL, boom.URL)
	if _, err := SearchBooks(context.Background(), "9780306406157", "", "", ""); err == nil {
		t.Fatal("want error when both sources fail")
	}

	// Title search queries both sources; when both are down it errors.
	if _, err := SearchBooks(context.Background(), "", "whatever", "", ""); err == nil {
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

	got, err := SearchBooks(context.Background(), "", "the black swan", "", "")
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
// SearchBooks ranks a name+author match first: the exact "Dune" by Frank
// Herbert outranks a box set and a study guide that a title-only search would
// otherwise surface ahead of it.
func TestSearchBooksRanksByAuthor(t *testing.T) {
	google := `{"items":[
	  {"id":"box","volumeInfo":{"title":"Frank Herbert's Dune Saga 6-Book Boxed Set","authors":["Frank Herbert"],"imageLinks":{"thumbnail":"http://books.google.com/thumb?id=box"}}},
	  {"id":"guide","volumeInfo":{"title":"Dune (SparkNotes Literature Guide)","authors":["SparkNotes"],"imageLinks":{"thumbnail":"http://books.google.com/thumb?id=guide"}}},
	  {"id":"novel","volumeInfo":{"title":"Dune","authors":["Frank Herbert"],"imageLinks":{"thumbnail":"http://books.google.com/thumb?id=novel"}}}
	]}`
	gsrv := jsonServer(t, google)
	osrv := jsonServer(t, `{"docs":[]}`)
	setBases(t, gsrv.URL, osrv.URL)

	got, err := SearchBooks(context.Background(), "", "Dune", "Frank Herbert", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) < 3 {
		t.Fatalf("got %d candidates, want 3", len(got))
	}
	if got[0].Title != "Dune" || !strings.Contains(got[0].Author, "Frank Herbert") {
		t.Fatalf("ranking put %q by %q first; want the exact 'Dune' by Frank Herbert", got[0].Title, got[0].Author)
	}
}

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

	if _, err := SearchBooks(context.Background(), "9780306406157", "", "", "sekret&key"); err != nil {
		t.Fatal(err)
	}
	if gotKey != "sekret&key" { // query-escaped on the wire, decoded back here
		t.Fatalf("google key = %q", gotKey)
	}
}

// The cap belongs to TEXT searches now. An ISBN names one book, so that path
// returns a single merged record and can never reach a cap — whereas a title
// search is exactly where a provider hands back forty near-misses.
func TestSearchBooksCap(t *testing.T) {
	items := make([]string, 15)
	for i := range items {
		items[i] = fmt.Sprintf(`{"id":"v%d","volumeInfo":{"title":"T%d"}}`, i, i)
	}
	gsrv := jsonServer(t, `{"items":[`+strings.Join(items, ",")+`]}`)
	osrv := jsonServer(t, openLibraryJSON)
	setBases(t, gsrv.URL, osrv.URL)

	got, err := SearchBooks(context.Background(), "", "T", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != maxBookCandidates {
		t.Fatalf("got %d candidates, want cap of %d", len(got), maxBookCandidates)
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
