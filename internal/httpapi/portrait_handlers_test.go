package httpapi

import (
	"context"
	"net/http"
	"testing"

	"tippani/internal/metadata"
)

// portraitResp mirrors POST /people/portrait's JSON.
type portraitResp struct {
	Resolved bool `json:"resolved"`
	Image    bool `json:"image"`
	Person   struct {
		ID        int64  `json:"id"`
		Kind      string `json:"kind"`
		Name      string `json:"name"`
		ImagePath string `json:"image_path"`
		Source    string `json:"source"`
		SourceID  string `json:"source_id"`
	} `json:"person"`
	Links map[string]string `json:"links"`
}

// An actor's portrait + identity come from the film's stored cast (person id +
// headshot URL harvested when the movie was added) with NO extra provider call —
// the stubbed fetchImage is handed exactly the cast's image_url.
func TestPersonPortraitActorFromCast(t *testing.T) {
	srv := newTestServer(t)
	var fetched string
	srv.fetchImage = func(_ context.Context, rawURL, _ string) (string, error) {
		fetched = rawURL
		return "bbbbbbbbbbbbbbbb.jpg", nil
	}
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Heat"}, http.StatusCreated))
	// TMDB-sourced cast carrying the identity we now capture from the credits.
	if _, err := srv.Store.DB.Exec(
		`UPDATE movies SET tmdb_id = 949, cast_json = ? WHERE id = ?`,
		`[{"character":"Neil McCauley","actor":"Robert De Niro","person_id":"380","image_url":"https://image.tmdb.org/t/p/original/de.jpg"}]`,
		m.ID); err != nil {
		t.Fatal(err)
	}
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Don't let yourself get attached.", "actor": "Robert De Niro",
	}, http.StatusCreated)

	res := decode[portraitResp](t, c.mustDo("POST", "/people/portrait",
		map[string]any{"kind": "actor", "name": "Robert De Niro"}, 200))
	if !res.Resolved || !res.Image {
		t.Fatalf("portrait not resolved: %+v", res)
	}
	if res.Person.Source != "tmdb" || res.Person.SourceID != "380" || res.Person.ImagePath == "" {
		t.Fatalf("actor identity not pinned: %+v", res.Person)
	}
	if fetched != "https://image.tmdb.org/t/p/original/de.jpg" {
		t.Fatalf("fetched %q, want the cast's headshot URL", fetched)
	}
}

// An author's portrait comes from ResolveAuthor; the handler must pass the
// library's book titles for the namesake cross-check, persist the OL key as the
// identity, store the photo, and echo the identity-resolved links.
func TestPersonPortraitAuthor(t *testing.T) {
	srv := newTestServer(t)
	var gotName string
	var gotTitles []string
	srv.resolveAuthor = func(_ context.Context, name string, titles []string) (metadata.AuthorResolution, error) {
		gotName, gotTitles = name, titles
		return metadata.AuthorResolution{
			Key: "OL2A", Name: "David Reich",
			ImageURL:    "https://covers.openlibrary.org/a/id/6157527-L.jpg",
			WikidataQID: "Q123",
			Links: map[string]string{
				"openlibrary": "https://openlibrary.org/authors/OL2A",
				"wikipedia":   "https://en.wikipedia.org/wiki/David_Reich_(geneticist)",
			},
		}, nil
	}
	var fetched string
	srv.fetchImage = func(_ context.Context, rawURL, _ string) (string, error) {
		fetched = rawURL
		return "cccccccccccccccc.jpg", nil
	}
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{
		"title": "Who We Are and How We Got Here", "author": "David Reich"}, http.StatusCreated)

	res := decode[portraitResp](t, c.mustDo("POST", "/people/portrait",
		map[string]any{"kind": "author", "name": "David Reich"}, 200))
	if gotName != "David Reich" {
		t.Fatalf("resolveAuthor got name %q", gotName)
	}
	if len(gotTitles) != 1 || gotTitles[0] != "Who We Are and How We Got Here" {
		t.Fatalf("book titles for cross-check = %v", gotTitles)
	}
	if !res.Resolved || res.Person.Source != "openlibrary" || res.Person.SourceID != "OL2A" || res.Person.ImagePath == "" {
		t.Fatalf("author identity not pinned: %+v", res.Person)
	}
	if res.Links["wikipedia"] == "" {
		t.Fatalf("identity-resolved links missing: %+v", res.Links)
	}
	if fetched != "https://covers.openlibrary.org/a/id/6157527-L.jpg" {
		t.Fatalf("fetched %q, want the resolved OL photo", fetched)
	}
}

// A director's portrait + identity come from the crew of the film's cached TMDB
// payload (movies.source_metadata): the person id + profile_path the credits
// carried, even though only the director's NAME was flattened onto
// movies.director. No TMDB key is needed for that recovery — the stubbed
// fetchImage is handed the profile URL built from the crew's profile_path.
func TestPersonPortraitDirectorFromCrew(t *testing.T) {
	srv := newTestServer(t)
	var fetched string
	srv.fetchImage = func(_ context.Context, rawURL, _ string) (string, error) {
		fetched = rawURL
		return "dddddddddddddddd.jpg", nil
	}
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Inception"}, http.StatusCreated))
	// The payload as cached at add-time: movies.director keeps only the name, but
	// credits.crew still carries the director's id + profile_path (and a non-
	// director crew member the resolver must skip).
	if _, err := srv.Store.DB.Exec(
		`UPDATE movies SET director = ?, tmdb_id = 27205, source_metadata = ? WHERE id = ?`,
		"Christopher Nolan",
		`{"credits":{"crew":[{"id":190,"name":"Wally Pfister","job":"Director of Photography","profile_path":"/wp.jpg"},{"id":525,"name":"Christopher Nolan","job":"Director","profile_path":"/cn.jpg"}]}}`,
		m.ID); err != nil {
		t.Fatal(err)
	}

	res := decode[portraitResp](t, c.mustDo("POST", "/people/portrait",
		map[string]any{"kind": "director", "name": "Christopher Nolan"}, 200))
	if !res.Resolved || !res.Image {
		t.Fatalf("portrait not resolved: %+v", res)
	}
	if res.Person.Source != "tmdb" || res.Person.SourceID != "525" || res.Person.ImagePath == "" {
		t.Fatalf("director identity not pinned: %+v", res.Person)
	}
	if fetched != "https://image.tmdb.org/t/p/original/cn.jpg" {
		t.Fatalf("fetched %q, want the crew's headshot URL", fetched)
	}
}

// No confident match: 200 with resolved:false and NO row written (so the UI can
// offer manual entry and we don't pin a wrong identity).
func TestPersonPortraitUnresolved(t *testing.T) {
	srv := newTestServer(t)
	srv.resolveAuthor = func(context.Context, string, []string) (metadata.AuthorResolution, error) {
		return metadata.AuthorResolution{}, nil // nothing confident
	}
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{"title": "Obscure", "author": "Unknown Person"}, http.StatusCreated)

	res := decode[portraitResp](t, c.mustDo("POST", "/people/portrait",
		map[string]any{"kind": "author", "name": "Unknown Person"}, 200))
	if res.Resolved || res.Image {
		t.Fatalf("expected unresolved: %+v", res)
	}
	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT COUNT(*) FROM people WHERE name = 'Unknown Person'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("unresolved portrait wrote %d rows, want 0", n)
	}
}
