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

// An actor's portrait + identity come from the film's cast (person id + headshot
// URL harvested when the movie was added) with NO extra provider call — the
// stubbed fetchImage is handed exactly the cast row's image_url.
//
// THE CAST IS work_cast NOW, not movies.cast_json (0048). This test used to seed
// the blob, which was the only place a cast had ever lived; it has to seed the
// mapping instead, because the blob holds nothing the reader has corrected and
// nothing at all on a game, so the resolver had to stop reading it. The
// assertions are unchanged — the point of the move is that this answer does not.
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
	// A TMDB-seeded row carrying the identity we capture from the credits.
	if _, err := srv.Store.DB.Exec(
		`UPDATE movies SET tmdb_id = 949 WHERE id = ?`, m.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key,
		                        provider_key, person_id, image_url, billing, origin, source)
		 VALUES (1, 'movie', ?, 'Neil McCauley', 'neil mccauley', 'Robert De Niro', 'robert de niro',
		         ?, '380', 'https://image.tmdb.org/t/p/original/de.jpg', 0, 'provider', 'tmdb')`,
		m.ID, "Neil McCauley\x1fRobert De Niro"); err != nil {
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

// A studio's portrait does not come from a book database.
//
// THIS IS THE PATH THAT WRITES THE ROW, and it is the one I missed first time.
// `resolvePersonPortrait` handled actor and director and fell EVERYTHING ELSE to
// the Open Library author lookup — a complete description of the world until
// 0040 added a seventh person kind that is not a person at all. So "fill in
// automatically" on Electronic Arts resolved it to an openlibrary.org/authors/
// record and stored that as its identity.
//
// Fixing /people/lookup (the "refetch links" button) left this untouched, which
// is why the wrong answer kept arriving: the button was never what put it there.
func TestStudioPortraitNeverUsesTheAuthorPath(t *testing.T) {
	srv := newTestServer(t)
	// The author resolver is the thing that must NOT be reached. If it is, the
	// test fails by recording the call rather than by asserting on a URL, which
	// would pass for the wrong reason if the provider simply had no record.
	called := false
	srv.resolveAuthor = func(ctx context.Context, name string, titles []string) (metadata.AuthorResolution, error) {
		called = true
		return metadata.AuthorResolution{Key: "OL7329153A", ImageURL: "https://covers.openlibrary.org/a/olid/OL7329153A-L.jpg"}, nil
	}
	c := signupAdmin(t, srv.Handler())

	// No IGDB key configured: the honest outcome is "nothing pinned", offering
	// the manual fields — NOT a fallback into a database of book authors.
	res := decode[portraitResp](t, c.mustDo("POST", "/people/portrait",
		map[string]any{"kind": "studio", "name": "Electronic Arts"}, 200))
	if called {
		t.Fatal("a studio was looked up as a book author — that is where openlibrary.org/authors/ came from")
	}
	if res.Resolved {
		t.Errorf("resolved = true with no IGDB key: %+v", res)
	}
	// And an author still goes to the author path, so the guard above is a
	// narrowing rather than a break.
	called = false
	c.mustDo("POST", "/people/portrait", map[string]any{"kind": "author", "name": "Ursula K. Le Guin"}, 200)
	if !called {
		t.Error("an author must still resolve through Open Library")
	}
}
