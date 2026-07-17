package httpapi

// Tests for force-fetch & re-verify (ROADMAP §2): preview diffs without
// writing, apply only approved fields, per-item ownership and failure
// isolation. Providers are stubbed via the Server seams / fake TMDB.

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"tippani/internal/metadata"
)

type reverifyResp struct {
	Items []struct {
		Type   string `json:"type"`
		ID     int64  `json:"id"`
		Kind   string `json:"kind"`
		Name   string `json:"name"`
		Title  string `json:"title"`
		Status string `json:"status"`
		Source string `json:"source"`
		Error  string `json:"error"`
		Diffs  []struct {
			Field  string `json:"field"`
			Stored any    `json:"stored"`
			Fresh  any    `json:"fresh"`
		} `json:"diffs"`
	} `json:"items"`
	Checked int `json:"checked"`
	Changed int `json:"changed"`
}

type reverifyApplyResp struct {
	Applied int `json:"applied"`
	Failed  int `json:"failed"`
	Results []struct {
		Type  string `json:"type"`
		ID    int64  `json:"id"`
		OK    bool   `json:"ok"`
		Error string `json:"error"`
		Note  string `json:"note"`
	} `json:"results"`
}

func diffFields(t *testing.T, r reverifyResp, idx int) map[string]bool {
	t.Helper()
	out := map[string]bool{}
	for _, d := range r.Items[idx].Diffs {
		out[d.Field] = true
	}
	return out
}

func TestReverifyBookPreview(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(_ context.Context, isbn, title, _, _ string) ([]metadata.BookCandidate, error) {
		if isbn != "9780441013593" || title != "" {
			t.Errorf("expected an isbn-pinned lookup, got isbn=%q title=%q", isbn, title)
		}
		return []metadata.BookCandidate{{
			Source: "google", Title: "Dune", Author: "Frank Herbert", ISBN13: "9780441013593",
			Description: "fresh description", PublishedYear: 1965,
			Genres:   []string{"science fiction"},
			CoverURL: "https://covers.openlibrary.org/b/id/1-L.jpg",
		}}, nil
	}
	h := srv.Handler()
	c := signupAdmin(t, h)
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(q, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO books (user_id, title, author, isbn, description, published_year)
	      VALUES (1, 'Dune', 'Frank Herbert', '9780441013593', 'old description', 1965)`)
	exec(`INSERT INTO books (user_id, title) VALUES (1, 'No Identity')`)
	var pinned, bare int64
	srv.Store.DB.QueryRow(`SELECT id FROM books WHERE title = 'Dune'`).Scan(&pinned)
	srv.Store.DB.QueryRow(`SELECT id FROM books WHERE title = 'No Identity'`).Scan(&bare)

	res := decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"book_ids": []int64{pinned, bare}}, 200))
	if res.Checked != 2 || res.Changed != 1 {
		t.Fatalf("summary: %+v", res)
	}
	if res.Items[0].Status != "ok" || res.Items[0].Source != "google" {
		t.Fatalf("pinned item: %+v", res.Items[0])
	}
	fields := diffFields(t, res, 0)
	// Same title/author/year → no diff; description, genres and the missing
	// cover differ. The genre arrives title-cased.
	if !fields["description"] || !fields["genres"] || !fields["cover"] ||
		fields["title"] || fields["author"] || fields["published_year"] || fields["isbn"] {
		t.Fatalf("diff fields: %v", fields)
	}
	if res.Items[1].Status != "unpinned" {
		t.Fatalf("bare item should be unpinned: %+v", res.Items[1])
	}

	// Preview is read-only.
	var desc string
	srv.Store.DB.QueryRow(`SELECT description FROM books WHERE id = ?`, pinned).Scan(&desc)
	if desc != "old description" {
		t.Fatalf("preview wrote to the row: %q", desc)
	}

	// A provider failure is a per-item fetch_failed, not a 5xx.
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, errors.New("boom")
	}
	res = decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"book_ids": []int64{pinned}}, 200))
	if res.Items[0].Status != "fetch_failed" || res.Items[0].Error == "" {
		t.Fatalf("fetch failure: %+v", res.Items[0])
	}

	// Ownership: another user's id reads as not_found (no existence leak).
	bob := addUser(t, h, c, "bob")
	res = decode[reverifyResp](t, bob.mustDo("POST", "/metadata/reverify",
		map[string]any{"book_ids": []int64{pinned}}, 200))
	if res.Items[0].Status != "not_found" {
		t.Fatalf("cross-user: %+v", res.Items[0])
	}

	// Validation: empty selection and oversized batches are 400s.
	c.mustDo("POST", "/metadata/reverify", map[string]any{}, http.StatusBadRequest)
	big := make([]int64, 16)
	for i := range big {
		big[i] = int64(i + 1)
	}
	c.mustDo("POST", "/metadata/reverify", map[string]any{"book_ids": big}, http.StatusBadRequest)
}

func TestReverifyMoviePreview(t *testing.T) {
	srv := newTestServer(t)
	fake := newMatrixTMDB(t)
	defer fake.Close()
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"tmdb_id": 603}, http.StatusCreated))
	// Drift the stored row so the fresh TMDB payload differs.
	if _, err := srv.Store.DB.Exec(
		`UPDATE movies SET director = 'Someone Else', description = NULL WHERE id = ?`, m.ID); err != nil {
		t.Fatal(err)
	}

	res := decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"movie_ids": []int64{m.ID}}, 200))
	if res.Items[0].Status != "ok" || res.Items[0].Source != "tmdb" {
		t.Fatalf("movie item: %+v", res.Items[0])
	}
	fields := diffFields(t, res, 0)
	if !fields["director"] || !fields["description"] || fields["cast"] || fields["title"] {
		t.Fatalf("movie diff fields: %v", fields)
	}

	// Pinned to a source whose key is gone → fetch_failed with the key hint.
	srv.TMDB.Key = ""
	res = decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"movie_ids": []int64{m.ID}}, 200))
	if res.Items[0].Status != "fetch_failed" || !strings.Contains(res.Items[0].Error, "key") {
		t.Fatalf("keyless pinned movie: %+v", res.Items[0])
	}

	// A manual title-only movie is unpinned.
	bare := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Heat"}, http.StatusCreated))
	res = decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"movie_ids": []int64{bare.ID}}, 200))
	if res.Items[0].Status != "unpinned" {
		t.Fatalf("bare movie: %+v", res.Items[0])
	}
}

func TestReverifyPersonPreview(t *testing.T) {
	srv := newTestServer(t)
	srv.resolveAuthor = func(_ context.Context, name string, titles []string) (metadata.AuthorResolution, error) {
		if name != "Frank Herbert" || len(titles) != 1 {
			t.Errorf("resolveAuthor args: %q %v", name, titles)
		}
		return metadata.AuthorResolution{
			Key: "OL9X", Name: "Frank Herbert",
			ImageURL: "https://covers.openlibrary.org/a/id/9-L.jpg",
			Links:    map[string]string{"openlibrary": "https://openlibrary.org/authors/OL9X"},
		}, nil
	}
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{"title": "Dune", "author": "Frank Herbert"}, http.StatusCreated)

	// An unsaved person is unpinned (first-fetch stays the console's job).
	res := decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"people": []map[string]string{{"kind": "author", "name": "Frank Herbert"}}}, 200))
	if res.Items[0].Status != "unpinned" {
		t.Fatalf("unsaved person: %+v", res.Items[0])
	}

	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Frank Herbert", "bio": "keep me"}, 200)
	res = decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"people": []map[string]string{{"kind": "author", "name": "Frank Herbert"}}}, 200))
	if res.Items[0].Status != "ok" {
		t.Fatalf("saved person: %+v", res.Items[0])
	}
	fields := diffFields(t, res, 0)
	if !fields["identity"] || !fields["links"] || !fields["portrait"] {
		t.Fatalf("person diff fields: %v", fields)
	}
}

func TestReverifyApply(t *testing.T) {
	srv := newTestServer(t)
	fetched := []string{}
	srv.fetchImage = func(_ context.Context, rawURL, _ string) (string, error) {
		if strings.Contains(rawURL, "fails") {
			return "", errors.New("boom")
		}
		fetched = append(fetched, rawURL)
		return fmt.Sprintf("%016x", len(fetched)) + ".jpg", nil
	}
	h := srv.Handler()
	c := signupAdmin(t, h)
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(q, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO books (user_id, title, author, isbn, description) VALUES (1, 'Dune', 'F. Herbert', '9780441013593', 'old')`)
	exec(`INSERT INTO books (user_id, title, isbn) VALUES (1, 'Other', '9780316769488')`)
	var book, other int64
	srv.Store.DB.QueryRow(`SELECT id FROM books WHERE title = 'Dune'`).Scan(&book)
	srv.Store.DB.QueryRow(`SELECT id FROM books WHERE title = 'Other'`).Scan(&other)

	// Approved fields only: description + genres + cover change, title/author don't.
	res := decode[reverifyApplyResp](t, c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{
			"type": "book", "id": book,
			"set": map[string]any{
				"description": "fresh",
				"genres":      []string{"Science Fiction"},
				"cover":       "https://covers.openlibrary.org/b/id/1-L.jpg",
			},
		}},
	}, 200))
	if res.Applied != 1 || res.Failed != 0 || !res.Results[0].OK {
		t.Fatalf("apply: %+v", res)
	}
	var title, author, desc, cover string
	var genreCount int
	srv.Store.DB.QueryRow(`SELECT title, COALESCE(author,''), COALESCE(description,''), COALESCE(cover_path,'')
	                       FROM books WHERE id = ?`, book).Scan(&title, &author, &desc, &cover)
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM book_genres WHERE book_id = ?`, book).Scan(&genreCount)
	if title != "Dune" || author != "F. Herbert" || desc != "fresh" || cover == "" || genreCount != 1 {
		t.Fatalf("book after apply: %q %q %q %q genres=%d", title, author, desc, cover, genreCount)
	}

	// A failing approved image degrades to a note; text fields still commit.
	res = decode[reverifyApplyResp](t, c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{
			"type": "book", "id": book,
			"set":  map[string]any{"description": "fresher", "cover": "https://covers.openlibrary.org/fails.jpg"},
		}},
	}, 200))
	if res.Applied != 1 || !res.Results[0].OK || !strings.Contains(res.Results[0].Note, "cover") {
		t.Fatalf("degraded image apply: %+v", res)
	}
	srv.Store.DB.QueryRow(`SELECT description FROM books WHERE id = ?`, book).Scan(&desc)
	if desc != "fresher" {
		t.Fatalf("text not applied on image failure: %q", desc)
	}

	// isbn collision with another book → per-item duplicate, batch continues.
	res = decode[reverifyApplyResp](t, c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{
			{"type": "book", "id": book, "set": map[string]any{"isbn": "9780316769488"}},
			{"type": "book", "id": other, "set": map[string]any{"description": "still applies"}},
		},
	}, 200))
	if res.Applied != 1 || res.Failed != 1 || !strings.Contains(res.Results[0].Error, "duplicate") || !res.Results[1].OK {
		t.Fatalf("duplicate isolation: %+v", res)
	}

	// Unknown/empty fields are rejected per item; foreign rows read not found.
	res = decode[reverifyApplyResp](t, c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{"type": "book", "id": book, "set": map[string]any{"rating": 5}}},
	}, 200))
	if res.Failed != 1 || !strings.Contains(res.Results[0].Error, "unknown field") {
		t.Fatalf("whitelist: %+v", res)
	}
	bob := addUser(t, h, c, "bob")
	res = decode[reverifyApplyResp](t, bob.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{"type": "book", "id": book, "set": map[string]any{"description": "hijack"}}},
	}, 200))
	if res.Failed != 1 || res.Results[0].Error != "not found" {
		t.Fatalf("cross-user apply: %+v", res)
	}
}

func TestReverifyApplyMovieCast(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "The Matrix"}, http.StatusCreated))
	// A dialogue whose speaker has no actor yet — the applied cast names them.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Dodge this.", "character": "Trinity",
	}, http.StatusCreated)

	res := decode[reverifyApplyResp](t, c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{
			"type": "movie", "id": m.ID,
			"set": map[string]any{
				"director": "Lana Wachowski",
				"cast": []map[string]any{
					{"character": "Neo", "actor": "Keanu Reeves", "person_id": "6384"},
					{"character": "Trinity", "actor": "Carrie-Anne Moss", "person_id": "530"},
				},
			},
		}},
	}, 200))
	if res.Applied != 1 {
		t.Fatalf("movie apply: %+v", res)
	}
	var director, castJSON, actor string
	srv.Store.DB.QueryRow(`SELECT COALESCE(director,''), COALESCE(cast_json,'') FROM movies WHERE id = ?`, m.ID).
		Scan(&director, &castJSON)
	srv.Store.DB.QueryRow(`SELECT COALESCE(actor,'') FROM dialogues WHERE movie_id = ?`, m.ID).Scan(&actor)
	if director != "Lana Wachowski" || !strings.Contains(castJSON, "Carrie-Anne Moss") {
		t.Fatalf("movie after apply: %q %q", director, castJSON)
	}
	if actor != "Carrie-Anne Moss" {
		t.Fatalf("dialogue actor not backfilled from the applied cast: %q", actor)
	}
}

func TestReverifyApplyPerson(t *testing.T) {
	srv := newTestServer(t)
	srv.fetchImage = func(context.Context, string, string) (string, error) { return "portrait.jpg", nil }
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Frank Herbert", "bio": "keep me", "born": "1920"}, 200)

	res := decode[reverifyApplyResp](t, c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{
			"type": "person", "kind": "author", "name": "Frank Herbert",
			"set": map[string]any{
				"identity": "openlibrary:OL9X",
				"links":    "https://openlibrary.org/authors/OL9X",
				"portrait": "https://covers.openlibrary.org/a/id/9-L.jpg",
			},
		}},
	}, 200))
	if res.Applied != 1 {
		t.Fatalf("person apply: %+v", res)
	}
	var bio, born, links, source, sourceID, image string
	srv.Store.DB.QueryRow(`SELECT bio, born, links, source, source_id, image_path
	                       FROM people WHERE user_id = 1 AND kind = 'author' AND name = 'Frank Herbert'`).
		Scan(&bio, &born, &links, &source, &sourceID, &image)
	if bio != "keep me" || born != "1920" {
		t.Fatalf("bio/born clobbered: %q %q", bio, born)
	}
	if source != "openlibrary" || sourceID != "OL9X" || !strings.Contains(links, "OL9X") || image != "portrait.jpg" {
		t.Fatalf("person after apply: %q %q %q %q", source, sourceID, links, image)
	}
}
