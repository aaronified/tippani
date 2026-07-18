package metadata

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBirthYear(t *testing.T) {
	cases := map[string]string{
		"11 March 1952": "1952",
		"1952-03-11":    "1952",
		"1952":          "1952",
		"March 1899":    "1899",
		"c. 1920":       "1920",
		"":              "",
		"unknown":       "unknown", // no 4-digit run → returned as-is
	}
	for in, want := range cases {
		if got := birthYear(in); got != want {
			t.Errorf("birthYear(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestParseOLBio(t *testing.T) {
	// Plain string form.
	if got := parseOLBio(json.RawMessage(`"  A short life.  "`)); got != "A short life." {
		t.Errorf("string bio = %q", got)
	}
	// Typed-text {type,value} form.
	if got := parseOLBio(json.RawMessage(`{"type":"/type/text","value":"Typed bio."}`)); got != "Typed bio." {
		t.Errorf("typed bio = %q", got)
	}
	// Absent / unparseable → empty.
	if got := parseOLBio(nil); got != "" {
		t.Errorf("nil bio = %q", got)
	}
}

// authorDetail now mines photos, the wikidata id, a Wikipedia article (top-level
// field OR the links array), the biography and the birth year.
func TestAuthorDetailEnriched(t *testing.T) {
	ol := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/authors/OL42A.json" {
			t.Errorf("path = %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{
			"photos":[-1, 7391],
			"remote_ids":{"wikidata":"Q42"},
			"links":[
				{"title":"home","url":"https://example.com"},
				{"title":"wiki","url":"https://en.wikipedia.org/wiki/Douglas_Adams"}
			],
			"bio":{"type":"/type/text","value":"English author."},
			"birth_date":"11 March 1952",
			"death_date":"11 May 2001"
		}`))
	}))
	defer ol.Close()
	old := openLibraryBase
	openLibraryBase = ol.URL
	t.Cleanup(func() { openLibraryBase = old })

	photoID, qid, wiki, bio, born, died := authorDetail(context.Background(), "OL42A")
	if photoID != 7391 {
		t.Errorf("photoID = %d, want 7391", photoID)
	}
	if qid != "Q42" {
		t.Errorf("qid = %q, want Q42", qid)
	}
	if wiki != "https://en.wikipedia.org/wiki/Douglas_Adams" {
		t.Errorf("wiki = %q", wiki)
	}
	if bio != "English author." {
		t.Errorf("bio = %q", bio)
	}
	if born != "1952" {
		t.Errorf("born = %q, want 1952", born)
	}
	if died != "2001" {
		t.Errorf("died = %q, want 2001", died)
	}
}
