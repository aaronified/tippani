package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

// mkBook creates a book with arbitrary fields and returns its id.
func mkBook(t *testing.T, c *testClient, body map[string]any) int64 {
	t.Helper()
	rec := c.mustDo("POST", "/books", body, 201)
	var b struct {
		ID int64 `json:"id"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &b)
	return b.ID
}

func bookGenres(t *testing.T, c *testClient, id int64) []string {
	t.Helper()
	rec := c.mustDo("GET", fmt.Sprintf("/books/%d", id), nil, 200)
	var b struct {
		Genres []string `json:"genres"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &b)
	return b.Genres
}

// TestBulkUpdateBooks: batch author rename + series set + genre union across a
// selection, scoped to the caller's own books.
func TestBulkUpdateBooks(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	a := mkBook(t, c, map[string]any{"title": "Gardens of the Moon", "author": "steven erikson", "genres": []string{"fantasy"}})
	b := mkBook(t, c, map[string]any{"title": "Deadhouse Gates", "author": "steven erikson"})
	other := mkBook(t, c, map[string]any{"title": "Unrelated", "author": "someone else"})

	// Rename the author + set a series on the two Malazan books; add a genre.
	newAuthor := "Steven Erikson"
	series := "Malazan Book of the Fallen"
	rec := c.mustDo("POST", "/books/bulk", map[string]any{
		"ids": []int64{a, b}, "author": newAuthor, "series": series, "add_genres": []string{"epic"},
	}, 200)
	if res := decode[map[string]int](t, rec); res["updated"] != 2 {
		t.Fatalf("updated = %d, want 2", res["updated"])
	}

	get := func(id int64) map[string]any {
		var m map[string]any
		_ = json.Unmarshal(c.mustDo("GET", fmt.Sprintf("/books/%d", id), nil, 200).Body.Bytes(), &m)
		return m
	}
	for _, id := range []int64{a, b} {
		m := get(id)
		if m["author"] != "Steven Erikson" || m["series"] != series {
			t.Fatalf("book %d not updated: author=%v series=%v", id, m["author"], m["series"])
		}
	}
	// Genre union: 'a' had fantasy, now +epic; 'b' had none, now epic. Genres are
	// stored Title-Cased.
	if g := bookGenres(t, c, a); len(g) != 2 {
		t.Fatalf("book a genres = %v, want 2 (Fantasy+Epic)", g)
	}
	if g := bookGenres(t, c, b); len(g) != 1 || g[0] != "Epic" {
		t.Fatalf("book b genres = %v, want [Epic]", g)
	}
	// The unselected book is untouched (series unset serializes as "").
	if m := get(other); m["author"] != "someone else" || (m["series"] != nil && m["series"] != "") {
		t.Fatalf("unselected book changed: %v / %v", m["author"], m["series"])
	}
}

// TestGenreNormalization pins the user's rule: a comma always divides a genre,
// and genres are Title-Cased — except tokens that arrive all-caps (acronyms like
// "YA"), which are kept as-is. "Fiction, fantasy, general" + "YA" must store as
// four genres: Fiction, Fantasy, General, YA.
func TestGenreNormalization(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	id := mkBook(t, c, map[string]any{"title": "Genre Test", "genres": []string{"Fiction, fantasy, general", "YA"}})

	got := bookGenres(t, c, id)
	want := map[string]bool{"Fiction": true, "Fantasy": true, "General": true, "YA": true}
	if len(got) != 4 {
		t.Fatalf("genres = %v, want 4 (split on comma + title-cased)", got)
	}
	for _, g := range got {
		if !want[g] {
			t.Fatalf("unexpected genre %q in %v (want %v)", g, got, want)
		}
	}
}

// TestBulkUpdateCrossUser: a user's bulk op can't touch another user's books.
func TestBulkUpdateCrossUser(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	victim := mkBook(t, admin, map[string]any{"title": "Admin Book", "author": "orig"})
	// Bob tries to rename admin's book → no matching (owned) ids → 404.
	bob.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{victim}, "author": "hijack"}, http.StatusNotFound)
	var m map[string]any
	_ = json.Unmarshal(admin.mustDo("GET", fmt.Sprintf("/books/%d", victim), nil, 200).Body.Bytes(), &m)
	if m["author"] != "orig" {
		t.Fatalf("victim author changed to %v", m["author"])
	}
}

// TestDuplicatesAndMerge: fuzzy-title duplicate detection then a merge that
// re-points annotations, dedupes a colliding quote, and deletes the source.
func TestDuplicatesAndMerge(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	a := mkBook(t, c, map[string]any{"title": "Dune", "author": "Frank Herbert", "genres": []string{"scifi"}})
	b := mkBook(t, c, map[string]any{"title": "Dune: Special Edition", "author": "Frank Herbert", "genres": []string{"classic"}})
	mkBook(t, c, map[string]any{"title": "Dune Messiah"}) // distinct — must NOT group

	// Both books get the same quote (collision on merge) + b gets a unique one.
	c.mustDo("POST", "/annotations", map[string]any{"book_id": a, "quote": "Fear is the mind-killer."}, 201)
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b, "quote": "Fear is the mind-killer."}, 201)
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b, "quote": "He who controls the spice controls the universe."}, 201)

	// Detection: exactly one group of two (Dune + Dune: Special Edition).
	dups := decode[struct {
		Groups [][]dupBook `json:"groups"`
	}](t, c.mustDo("GET", "/metadata/duplicates", nil, 200))
	if len(dups.Groups) != 1 || len(dups.Groups[0]) != 2 {
		t.Fatalf("duplicate groups = %+v, want one group of 2", dups.Groups)
	}

	// Merge b into a: a keeps its quote + gains b's unique one; the colliding
	// duplicate is dropped; b is deleted; genres union.
	c.mustDo("POST", "/books/merge", map[string]any{"into": a, "from": []int64{b}}, 200)
	c.mustDo("GET", fmt.Sprintf("/books/%d", b), nil, http.StatusNotFound)

	anns := decode[struct {
		Annotations []struct {
			Quote string `json:"quote"`
		} `json:"annotations"`
	}](t, c.mustDo("GET", fmt.Sprintf("/annotations?book_id=%d", a), nil, 200))
	if len(anns.Annotations) != 2 {
		t.Fatalf("merged annotations = %d, want 2 (dedup collision dropped)", len(anns.Annotations))
	}
	if g := bookGenres(t, c, a); len(g) != 2 {
		t.Fatalf("merged genres = %v, want 2 (scifi+classic)", g)
	}
}

// THE DUPLICATE FINDER COVERS EVERY WORK, NOT JUST BOOKS. The owner, over the
// Works console: it should "cover all works". It read the books table alone, so
// a film imported twice — the commonest way to acquire a duplicate, since two
// sources spell a title differently — was invisible to the one control whose
// whole job is finding exactly that.
//
// THE THREE CASES THAT MATTER, and two of them are about NOT grouping:
//
//   - two spellings of one film DO group, on the same fuzzy title rule books use;
//   - a film and a SHOW of the same name do NOT, because the remake, the
//     adaptation and the tie-in are different works and offering to merge them is
//     offering to destroy one;
//   - a novel and its adaptation do NOT, which is the case a single keyspace
//     would have got wrong by default — a book and its film share a title almost
//     by definition.
//
// THE MUTATION: drop the media type from the screen-work group key and the
// film/show case fails — they land in one group of two. Drop the "book"/
// "movie" prefixes and the novel joins its own adaptation.
func TestDuplicateScanCoversEveryKindOfWork(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	// Two spellings of one film, plus a distinct film that must stand alone.
	mkMovie(t, c, "Blade Runner")
	mkMovie(t, c, "Blade Runner: The Final Cut")
	mkMovie(t, c, "Heat")

	// A book with the same title as a film. Not a duplicate of anything.
	mkBook(t, c, map[string]any{"title": "Heat"})

	dups := decode[struct {
		Groups [][]dupBook `json:"groups"`
	}](t, c.mustDo("GET", "/metadata/duplicates", nil, 200))

	if len(dups.Groups) != 1 {
		t.Fatalf("want exactly one duplicate group (the two Blade Runners); got %+v", dups.Groups)
	}
	g := dups.Groups[0]
	if len(g) != 2 {
		t.Fatalf("the group should hold both spellings of the film; got %+v", g)
	}
	for _, w := range g {
		if w.Kind != "movie" {
			t.Errorf("a screen work's row should say so; got kind %q for %q", w.Kind, w.Title)
		}
		if w.MediaType == "" {
			t.Errorf("a screen work's row should carry its media type; got none for %q", w.Title)
		}
	}
}

// AND A FILM DOES NOT GROUP WITH A SHOW OF THE SAME NAME. Split from the case
// above because it needs a work whose media_type differs, and because it is the
// half a single title key would silently get wrong.
func TestDuplicateScanKeepsFilmsAndSeriesApart(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	mkMovie(t, c, "Fargo") // the film
	// "show", which is this app's word for it — the first draft of this test said
	// "series" and the server refused it, which is the vocabulary check earning
	// its place.
	c.mustDo("POST", "/movies", map[string]any{"title": "Fargo", "media_type": "show"}, 201)
	dups := decode[struct {
		Groups [][]dupBook `json:"groups"`
	}](t, c.mustDo("GET", "/metadata/duplicates", nil, 200))
	if len(dups.Groups) != 0 {
		t.Fatalf("a film and a show sharing a name are two works, not a duplicate; got %+v", dups.Groups)
	}
}
