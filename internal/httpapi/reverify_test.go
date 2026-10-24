package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"tippani/internal/metadata"
)

// Tests for force-fetch & re-verify (ROADMAP §2): preview diffs without
// writing, apply only approved fields, per-item ownership and failure
// isolation. Providers are stubbed via the Server seams / fake TMDB.

type reverifyResp struct {
	Items []struct {
		Type    string   `json:"type"`
		ID      int64    `json:"id"`
		Kind    string   `json:"kind"`
		Name    string   `json:"name"`
		Title   string   `json:"title"`
		Status  string   `json:"status"`
		Source  string   `json:"source"`
		Sources []string `json:"sources"`
		Error   string   `json:"error"`
		Diffs   []struct {
			Field  string `json:"field"`
			Stored any    `json:"stored"`
			Fresh  any    `json:"fresh"`
			Alts   []struct {
				Source string `json:"source"`
				Value  any    `json:"value"`
			} `json:"alts"`
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

// A person's re-verify offers the link it found with every name the reader gave
// their links still on them, and applying what it offered keeps them on the
// record; a check that found nothing the field lacks offers no links change at
// all, however the reader ordered their links.
func TestAPersonsReverifyKeepsTheNamesOnTheirLinks(t *testing.T) {
	const (
		imdb  = "https://www.imdb.com/name/nm0000123/"
		mine  = "https://example.org/essays"
		olib  = "https://openlibrary.org/authors/OL9X"
		named = imdb + " | The other one\n" + mine + " | Their essays"
	)
	srv := newTestServer(t)
	srv.resolveAuthor = func(context.Context, string, []string) (metadata.AuthorResolution, error) {
		return metadata.AuthorResolution{Key: "OL9X", Name: "Frank Herbert", Links: map[string]string{"openlibrary": olib}}, nil
	}
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{"title": "Dune", "author": "Frank Herbert"}, http.StatusCreated)
	p := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Frank Herbert", "links": named}, http.StatusOK))
	check := func() (links any, found bool) {
		t.Helper()
		res := decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
			map[string]any{"people": []map[string]string{{"kind": "author", "name": "Frank Herbert"}}}, http.StatusOK))
		if len(res.Items) != 1 || res.Items[0].Status != "ok" {
			t.Fatalf("the check: %+v", res.Items)
		}
		for _, d := range res.Items[0].Diffs {
			if d.Field == "links" {
				return d.Fresh, true
			}
		}
		return nil, false
	}

	fresh, found := check()
	want := imdb + " | The other one\n" + olib + "\n" + mine + " | Their essays"
	if !found || fresh != want {
		t.Fatalf("the links the check offers: %q (offered: %v), want\n%s", fresh, found, want)
	}
	res := decode[reverifyApplyResp](t, c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{"type": "person", "kind": "author", "name": "Frank Herbert", "set": map[string]any{"links": fresh}}},
	}, http.StatusOK))
	if res.Applied != 1 {
		t.Fatalf("the apply: %+v", res)
	}
	rec := decode[struct {
		Links string `json:"links"`
	}](t, c.mustDo("GET", fmt.Sprintf("/people/id/%d", p.ID), nil, http.StatusOK))
	if rec.Links != want {
		t.Fatalf("the record's links after the apply:\n%s\nwant\n%s", rec.Links, want)
	}

	// The same links, the reader's own way round: the fetched page is already
	// there, so there is nothing to review.
	c.mustDo("PUT", fmt.Sprintf("/people/id/%d", p.ID), map[string]any{"links": mine + " | Their essays\n" + olib}, http.StatusOK)
	if fresh, found := check(); found {
		t.Fatalf("a check that fetched nothing new offers the links %q", fresh)
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
			"set": map[string]any{"description": "fresher", "cover": "https://covers.openlibrary.org/fails.jpg"},
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
	// The error is checked. It used to be dropped, so when 0027 removed the
	// `kind` column this read failed and the test reported "bio/born clobbered"
	// — a real-looking data-loss failure caused by the query, not the code.
	if err := srv.Store.DB.QueryRow(`SELECT p.bio, p.born, p.links, p.source, p.source_id, p.image_path
	                       FROM people p JOIN person_kinds pk ON pk.person_id = p.id AND pk.kind = 'author'
	                       WHERE p.user_id = 1 AND p.name = 'Frank Herbert'`).
		Scan(&bio, &born, &links, &source, &sourceID, &image); err != nil {
		t.Fatal(err)
	}
	if bio != "keep me" || born != "1920" {
		t.Fatalf("bio/born clobbered: %q %q", bio, born)
	}
	if source != "openlibrary" || sourceID != "OL9X" || !strings.Contains(links, "OL9X") || image != "portrait.jpg" {
		t.Fatalf("person after apply: %q %q %q %q", source, sourceID, links, image)
	}
}

// A RE-VERIFY'S APPLY, WHEN THE LIBRARY MOVED BETWEEN THE REVIEW AND THE PRESS.
//
// The review shows each field as stored and what the suppliers say; the reader
// ticks and presses Apply, and the apply carries, per field, the stored value
// they were shown (expect). Everything is driven through the API as the review
// drives it, and the library read back as its pages read it.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the apply's
// wire shape (items of {type, id | kind+name, set, source, expect}, answered with
// results of {ok, error, note}), which is the contract the review is built to;
// the words of the note an item whose field was left carries, which is what the
// review's result line shows the reader; for the job, the queue given to the
// server as serve() gives it (queueing, jobs_api_test.go), the book supplier's
// seam for the check the review decides on (srv.searchBooks), the picture
// download's seam held until its request is cancelled, so that Stop is pressed
// with an item in hand (srv.fetchImage), and the job's counts' names, which
// jobs.js reads.
//
// What each one guards, in a sentence a person would say: a field somebody
// changed after the review is left as they wrote it, with a note saying so, while
// the item's other fields are written; an item every field of which changed
// writes nothing and is not a failure; an item that says nothing about what it
// was shown is applied as it always was; a field whose value the apply cannot
// read now is left, not taken for unchanged; a row that is gone is still not found;
// the review's Apply, as a job, does the same, says in its log what it wrote on
// each item, counts written, skipped and failed under the names the screens
// read, and marks the check it came from applied; and Stop ends it at once,
// leaving the item in hand untouched.

type applyAnswer struct {
	Applied int `json:"applied"`
	Failed  int `json:"failed"`
	Results []struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
		Note  string `json:"note"`
	} `json:"results"`
}

func TestAnApplyLeavesAFieldThatChangedSinceTheReview(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	messiah := createdID(t, alice, "/books", map[string]any{"title": "Dune Messiah", "author": "Frank Herbert", "isbn": messiahISBN})
	gone := createdID(t, alice, "/books", map[string]any{"title": "Children of Dune", "author": "Frank Herbert"})
	emperor := createdID(t, alice, "/books", map[string]any{"title": "God Emperor of Dune", "author": "Frank Herbert"})
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Frank Herbert"}, http.StatusOK)

	// The review showed Dune and God Emperor with no description, Dune with no
	// year, and Frank Herbert with no bio. Then, before the press: alice writes
	// both descriptions and the author's bio herself, and deletes a book.
	alice.mustDo("PUT", fmt.Sprintf("/books/%d", dune), map[string]any{"title": "Dune", "author": "Frank Herbert",
		"isbn": duneISBN, "description": "My own words."}, http.StatusOK)
	alice.mustDo("PUT", fmt.Sprintf("/books/%d", emperor), map[string]any{"title": "God Emperor of Dune",
		"author": "Frank Herbert", "description": "Leto's."}, http.StatusOK)
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Frank Herbert", "bio": "Wrote Dune."}, http.StatusOK)
	alice.mustDo("DELETE", fmt.Sprintf("/books/%d", gone), nil, http.StatusOK)

	got := decode[applyAnswer](t, alice.mustDo("POST", "/metadata/reverify/apply", map[string]any{"items": []any{
		map[string]any{"type": "book", "id": dune, "source": "google",
			"set":    map[string]any{"description": "A desert planet.", "published_year": 1965},
			"expect": map[string]any{"description": nil, "published_year": 0}},
		map[string]any{"type": "person", "kind": "author", "name": "Frank Herbert",
			"set": map[string]any{"bio": "An American author."}, "expect": map[string]any{"bio": ""}},
		// Sent by a client that says nothing about what it showed.
		map[string]any{"type": "book", "id": messiah, "source": "google", "set": map[string]any{"description": "The sequel."}},
		map[string]any{"type": "book", "id": gone, "source": "google",
			"set": map[string]any{"published_year": 1976}, "expect": map[string]any{"published_year": 0}},
		map[string]any{"type": "book", "id": emperor, "source": "google",
			"set": map[string]any{"description": "The fourth novel."}, "expect": map[string]any{"description": ""}},
	}}, http.StatusOK))

	if len(got.Results) != 5 || got.Applied != 4 || got.Failed != 1 {
		t.Fatalf("the apply: %+v", got)
	}
	left := changedSinceTheCheck
	if r := got.Results[0]; !r.OK || r.Note != left+"description" {
		t.Errorf("Dune's result: %+v, want ok with the note %q", r, left+"description")
	}
	if r := got.Results[1]; !r.OK || r.Note != left+"bio" {
		t.Errorf("the author's result: %+v, want ok (nothing failed) with the note %q", r, left+"bio")
	}
	if r := got.Results[2]; !r.OK || r.Note != "" {
		t.Errorf("an item sent without expect: %+v", r)
	}
	if r := got.Results[3]; r.OK || !strings.Contains(r.Error, "not found") {
		t.Errorf("a deleted book's result: %+v, want not found", r)
	}
	if r := got.Results[4]; !r.OK || r.Note != left+"description" {
		t.Errorf("God Emperor's result: %+v, want ok (nothing failed) with the note %q", r, left+"description")
	}

	type book struct {
		Description string `json:"description"`
		Year        int    `json:"published_year"`
	}
	if b := decode[book](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK)); b.Description != "My own words." || b.Year != 1965 {
		t.Errorf("Dune after the apply: %+v, want her own description kept and the year written", b)
	}
	if b := decode[book](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", messiah), nil, http.StatusOK)); b.Description != "The sequel." {
		t.Errorf("Dune Messiah after the apply: %+v", b)
	}
	if b := decode[book](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", emperor), nil, http.StatusOK)); b.Description != "Leto's." {
		t.Errorf("God Emperor after the apply: %+v, want her own description kept", b)
	}
	author := decode[struct {
		Bio string `json:"bio"`
	}](t, alice.mustDo("GET", "/people/id/"+itoa(recordID(t, alice, "Frank Herbert")), nil, http.StatusOK))
	if author.Bio != "Wrote Dune." {
		t.Errorf("the author's bio after the apply: %q, want hers", author.Bio)
	}
}

func TestAnApplyJobWritesWhatWasTickedAndMarksItsCheckApplied(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	duneAsTheSupplierHasIt(srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	gone := createdID(t, alice, "/books", map[string]any{"title": "Dune Messiah", "author": "Frank Herbert", "isbn": messiahISBN})
	check := alice.waitJob(alice.mustStart("reverify", map[string]any{"book_ids": []int64{dune, gone}}).ID, "succeeded")

	// The review, as the screen builds its Apply from it: every difference
	// ticked, the supplier's value to write and the stored value it showed.
	review := decode[struct {
		Result []struct {
			Type   string `json:"type"`
			ID     int64  `json:"id"`
			Source string `json:"source"`
			Diffs  []struct {
				Field  string          `json:"field"`
				Stored json.RawMessage `json:"stored"`
				Fresh  json.RawMessage `json:"fresh"`
			} `json:"diffs"`
		} `json:"result"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/jobs/%d/result", check.ID), nil, http.StatusOK))
	var items []any
	for _, it := range review.Result {
		set, expect := map[string]json.RawMessage{}, map[string]json.RawMessage{}
		for _, d := range it.Diffs {
			set[d.Field], expect[d.Field] = d.Fresh, d.Stored
		}
		items = append(items, map[string]any{"type": it.Type, "id": it.ID, "source": it.Source, "set": set, "expect": expect})
	}
	// Before the press, alice writes Dune's description herself and deletes the
	// other book.
	alice.mustDo("PUT", fmt.Sprintf("/books/%d", dune), map[string]any{"title": "Dune", "author": "Frank Herbert",
		"isbn": duneISBN, "description": "My own words."}, http.StatusOK)
	alice.mustDo("DELETE", fmt.Sprintf("/books/%d", gone), nil, http.StatusOK)

	apply := alice.waitJob(alice.mustStart("reverify-apply", map[string]any{"items": items, "from_job": check.ID}).ID, "succeeded")
	countsAre(t, apply, map[string]any{"applied": float64(1), "skipped": float64(1), "failed": float64(1)})
	if apply.FromJob == nil || *apply.FromJob != check.ID || !alice.job(check.ID).Applied {
		t.Fatalf("the apply names check %v and the check reads applied %t; want #%d and true",
			apply.FromJob, alice.job(check.ID).Applied, check.ID)
	}
	log := strings.Join(logOf(t, alice, apply.ID), "\n")
	for _, want := range []string{
		"info «Dune» — wrote pages, year; " + changedSinceTheCheck + "description",
		fmt.Sprintf("warn book #%d — failed: not found", gone),
	} {
		if !strings.Contains(log, want) {
			t.Errorf("the apply's log has no %q:\n%s", want, log)
		}
	}
	res := decode[struct {
		Result []struct {
			Type  string `json:"type"`
			ID    int64  `json:"id"`
			OK    bool   `json:"ok"`
			Error string `json:"error"`
			Note  string `json:"note"`
		} `json:"result"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/jobs/%d/result", apply.ID), nil, http.StatusOK)).Result
	if len(res) != 2 || !res[0].OK || res[0].ID != dune || res[0].Note != changedSinceTheCheck+"description" ||
		res[1].OK || res[1].Error != "not found" {
		t.Fatalf("the apply's results, as the review reads them: %+v", res)
	}
	b := decode[struct {
		Description string `json:"description"`
		Year        int    `json:"published_year"`
		Pages       int    `json:"pages"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK))
	if b.Description != "My own words." || b.Year != 1965 || b.Pages != 412 {
		t.Fatalf("Dune after the apply: %+v, want her description kept and the year and pages written", b)
	}
}

// A Stop pressed while the second item's cover is on its way ends the apply
// there: the first item keeps what was written on it; the second is left as it
// was — not "cover: fetch failed, other fields applied", nothing at all.
func TestAnApplyJobStoppedWithAnItemInHandLeavesThatItemUntouched(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	asked := make(chan struct{}, 1)
	downloads(t, srv)
	srv.fetchImage = func(ctx context.Context, rawURL, dir string) (string, error) {
		asked <- struct{}{}
		<-ctx.Done() // the second item's cover never arrives
		return "", ctx.Err()
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	first := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert"})
	second := createdID(t, alice, "/books", map[string]any{"title": "Dune Messiah", "author": "Frank Herbert"})

	job := alice.mustStart("reverify-apply", map[string]any{"items": []any{
		map[string]any{"type": "book", "id": first, "source": "openlibrary",
			"set": map[string]any{"published_year": 1965}, "expect": map[string]any{"published_year": 0}},
		map[string]any{"type": "book", "id": second, "source": "openlibrary",
			"set":    map[string]any{"published_year": 1969, "cover": "https://covers.openlibrary.org/b/id/1-L.jpg"},
			"expect": map[string]any{"published_year": 0, "cover": ""}},
	}})
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the apply never fetched the second item's cover")
	}
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	stopped := alice.waitJob(job.ID, "stopped")
	if stopped.Done != 1 {
		t.Fatalf("stopped after %d of %d items, want the one applied before the Stop", stopped.Done, stopped.Total)
	}
	countsAre(t, stopped, map[string]any{"applied": float64(1), "skipped": float64(0), "failed": float64(0)})
	book := func(id int64) (int, string) {
		b := decode[struct {
			Year  int    `json:"published_year"`
			Cover string `json:"cover_path"`
		}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", id), nil, http.StatusOK))
		return b.Year, b.Cover
	}
	if year, _ := book(first); year != 1965 {
		t.Fatalf("the first book's year after the stop: %d, want it written", year)
	}
	if year, cover := book(second); year != 0 || cover != "" {
		t.Fatalf("the second book after the stop: year %d, cover %q; want it untouched", year, cover)
	}
}

// A RE-VERIFY'S CHECK, AS A JOB: started as the review starts it
// (POST /jobs {kind: "reverify"}), its findings read back as the review reads
// them (GET /jobs/{id}/result), and the library read back as its pages read it.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the queue
// is given to the server as serve() gives it (queueing, jobs_api_test.go); the
// suppliers are the server's seams (srv.searchBooks for books, srv.resolveAuthor
// for an author), because a test may not reach the real ones, and one test holds
// the book supplier mid-answer so that Stop is pressed with an item in hand; and
// the wire fields of a job, its counts and the preview's items (type, title,
// status, diffs, field, stored, fresh, alts), which are the contract the review
// is built to; and how much one job may keep (jobs.MaxResult), which one test
// fills with descriptions a supplier would never send, because what it guards is
// what happens at that size.
//
// What each one guards, in a sentence a person would say: a check asks about
// every work and person it was given, says in its log what differs on each, keeps
// its findings for the review, counts the items and those with something to
// review under the names the screens read, and writes nothing; asked for empty
// fields only, it keeps only the differences that would fill one; Stop ends it at
// once, keeping what it found before the item in hand and nothing of that one;
// and a check that
// finds more than one job can keep keeps what fits, says which items it left,
// and still opens its review, each diff whole — its fresh value as the preview
// gave it even where that is not quite the first supplier's.

// duneAsTheSupplierHasIt is a book supplier that knows every ISBN as Dune with a
// description, a year and a page count.
func duneAsTheSupplierHasIt(srv *Server) {
	srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		if isbn == "" {
			return nil, nil
		}
		return []metadata.BookCandidate{{Source: "google", Title: "Dune", Author: "Frank Herbert", ISBN13: isbn,
			Description: "A desert planet.", PublishedYear: 1965, Pages: 412}}, nil
	}
}

type checkItem struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Status string `json:"status"`
	Diffs  []struct {
		Field string `json:"field"`
	} `json:"diffs"`
}

// checkFindings is a finished check's items as the review reads them, each as
// its title and the fields it found different.
func checkFindings(t *testing.T, c *testClient, id int64) map[string]string {
	t.Helper()
	res := decode[struct {
		Kind   string      `json:"kind"`
		Result []checkItem `json:"result"`
	}](t, c.mustDo("GET", fmt.Sprintf("/jobs/%d/result", id), nil, http.StatusOK))
	out := map[string]string{}
	for _, it := range res.Result {
		var fields []string
		for _, d := range it.Diffs {
			fields = append(fields, d.Field)
		}
		out[it.Title] = it.Status + " " + strings.Join(fields, ",")
	}
	return out
}

func TestACheckJobKeepsWhatDiffersForTheReviewAndWritesNothing(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	duneAsTheSupplierHasIt(srv)
	leGuinResolves(srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN,
		"description": "My own words."})
	bare := createdID(t, alice, "/books", map[string]any{"title": "No ISBN", "author": "Someone"})
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Ursula K. Le Guin"}, http.StatusOK)
	params := map[string]any{"book_ids": []int64{dune, bare},
		"people": []map[string]string{{"kind": "author", "name": "Ursula K. Le Guin"}}}

	job := alice.waitJob(alice.mustStart("reverify", params).ID, "succeeded")
	if job.Done != 3 || job.Total != 3 {
		t.Fatalf("the check's progress: %d of %d", job.Done, job.Total)
	}
	// Dune and Le Guin have something to review; the book with no ISBN does not.
	countsAre(t, job, map[string]any{"items": float64(3), "changes": float64(2)})
	found := checkFindings(t, alice, job.ID)
	if found["Dune"] != "ok description,published_year,pages" || found["No ISBN"] != "unpinned " ||
		!strings.HasPrefix(found["Ursula K. Le Guin"], "ok identity,") {
		t.Fatalf("the check's findings: %v", found)
	}
	log := strings.Join(logOf(t, alice, job.ID), "\n")
	for _, want := range []string{
		"info «Dune» — 3 differences: description, year, pages",
		"info «No ISBN» — unpinned, so there is nothing to ask",
		"info «Ursula K. Le Guin» — ",
	} {
		if !strings.Contains(log, want) {
			t.Errorf("the check's log has no %q:\n%s", want, log)
		}
	}

	// Asked for the empty fields only: the description the reader wrote is not
	// on offer to be overwritten, and the year and the page count still are.
	params["fills_only"] = true
	fills := alice.waitJob(alice.mustStart("reverify", params).ID, "succeeded")
	if got := checkFindings(t, alice, fills.ID)["Dune"]; got != "ok published_year,pages" {
		t.Fatalf("a fills-only check of Dune found %q, want its year and pages alone", got)
	}
	if log := strings.Join(logOf(t, alice, fills.ID), "\n"); !strings.Contains(log, "«Dune» — 2 differences: year, pages") {
		t.Errorf("the fills-only check's log:\n%s", log)
	}

	// A check writes nothing: that is the review's to decide.
	book := decode[struct {
		Description string `json:"description"`
		Year        int    `json:"published_year"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK))
	if book.Description != "My own words." || book.Year != 0 {
		t.Fatalf("Dune after two checks: %+v", book)
	}
}

// A Stop pressed while the second book is being looked up ends the check there:
// it keeps what it found on the first, and nothing on the second, whose lookup the
// Stop cut off — half an answer is not a finding.
func TestACheckJobStoppedWithAnItemInHandKeepsWhatItFoundBeforeIt(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	duneAsTheSupplierHasIt(srv)
	answer := srv.searchBooks
	asked := make(chan struct{}, 1)
	srv.searchBooks = func(ctx context.Context, isbn, title, author, key string) ([]metadata.BookCandidate, error) {
		if isbn == messiahISBN {
			asked <- struct{}{}
			<-ctx.Done() // the second book's supplier never answers
			return nil, ctx.Err()
		}
		return answer(ctx, isbn, title, author, key)
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	first := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	second := createdID(t, alice, "/books", map[string]any{"title": "Dune Messiah", "author": "Frank Herbert", "isbn": messiahISBN})

	job := alice.mustStart("reverify", map[string]any{"book_ids": []int64{first, second}})
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the check never asked about the second book")
	}
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	stopped := alice.waitJob(job.ID, "stopped")
	if stopped.Done != 1 {
		t.Fatalf("stopped after %d of %d items, want the one checked before the Stop", stopped.Done, stopped.Total)
	}
	countsAre(t, stopped, map[string]any{"items": float64(1), "changes": float64(1)})
	if found := checkFindings(t, alice, job.ID); len(found) != 1 || found["Dune"] == "" {
		t.Fatalf("a check stopped on its second book kept %v", found)
	}
}

// A CHECK THAT FINDS MORE THAN ONE JOB CAN KEEP. Two suppliers answer for every
// book, each with a description the size of a novel, so each book's findings are
// about a third of what one job may keep. The check keeps the books whose
// findings fit, says in its log which it left, and ends succeeded with its
// review — rather than failing at the end with nothing kept. And the review
// reads each kept diff whole: the supplier's value the check did not store
// twice is back in fresh.
func TestACheckThatFindsMoreThanAJobCanKeepKeepsWhatFits(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	google, openLibrary := strings.Repeat("g", 1_500_000), strings.Repeat("o", 1_500_000)
	srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		if isbn == "" {
			return nil, nil
		}
		return []metadata.BookCandidate{
			{Source: "google", Title: "Dune", Author: "Frank Herbert", ISBN13: isbn, Description: google},
			{Source: "openlibrary", Title: "Dune", Author: "Frank Herbert", ISBN13: isbn, Description: openLibrary},
		}, nil
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	var ids []int64
	for i, isbn := range []string{duneISBN, messiahISBN, "9780441005901", "9780441017607"} {
		ids = append(ids, createdID(t, alice, "/books", map[string]any{"title": fmt.Sprintf("Book %d", i+1), "author": "Frank Herbert", "isbn": isbn}))
	}

	job := alice.waitJob(alice.mustStart("reverify", map[string]any{"book_ids": ids}).ID, "succeeded")
	if job.Done != 2 || job.Total != 4 {
		t.Fatalf("the check's progress: %d of %d, want the two whose findings fit", job.Done, job.Total)
	}
	countsAre(t, job, map[string]any{"items": float64(2), "changes": float64(2)})
	want := "warn the findings reached what one check can keep (8 MB), so the last 2 of its 4 items, from «Book 3» on, are not in them"
	if log := strings.Join(logOf(t, alice, job.ID), "\n"); !strings.Contains(log, want) {
		t.Errorf("the check's log has no %q:\n%s", want, log)
	}

	review := decode[struct {
		Result []struct {
			Title string `json:"title"`
			Diffs []struct {
				Field string `json:"field"`
				Fresh string `json:"fresh"`
				Alts  []struct {
					Source string `json:"source"`
					Value  string `json:"value"`
				} `json:"alts"`
			} `json:"diffs"`
		} `json:"result"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/jobs/%d/result", job.ID), nil, http.StatusOK)).Result
	if len(review) != 2 || review[0].Title != "Book 1" || review[1].Title != "Book 2" {
		t.Fatalf("the review has %d items, want Book 1 and Book 2", len(review))
	}
	for _, it := range review {
		for _, d := range it.Diffs {
			if d.Field != "description" {
				continue
			}
			if d.Fresh != google || len(d.Alts) != 2 || d.Alts[0].Value != google || d.Alts[1].Value != openLibrary {
				t.Fatalf("%s's description in the review: fresh of %d bytes, %d alternatives; want Google's as fresh and both suppliers'",
					it.Title, len(d.Fresh), len(d.Alts))
			}
		}
	}
}
