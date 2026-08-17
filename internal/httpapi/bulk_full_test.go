package httpapi

import (
	"net/http"
	"testing"
)

// Editing a selection field by field, and merging two rows into one.
//
// THE RULE THE OWNER SET: everything is editable over a selection except the
// work's own name and the quote's own words. Those two are not a taste
// judgement — every other field can sensibly hold one value across a selection
// (five books by one author, one series, one year), and a title cannot. Setting
// it over a selection does not correct five records, it destroys four and leaves
// five rows nothing can tell apart afterwards.
//
// Two more are absent for a harder reason than taste, and these tests pin that
// too: the supplier ids each carry a UNIQUE index per user, so a bulk set is a
// constraint violation rather than merely a bad idea.

func TestBulkEditsEveryWorkFieldExceptTheName(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	b1 := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "One", "author": "A"}, 201).Body.Bytes())
	b2 := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "Two", "author": "B"}, 201).Body.Bytes())

	c.mustDo("POST", "/books/bulk", map[string]any{
		"ids": []int64{b1, b2}, "author": "Ursula K. Le Guin", "translator": "T. Translator",
		"editor": "E. Editor", "published_year": 1974, "description": "a shared note",
		"favorite": true, "series": "Hainish",
	}, 200)

	for _, id := range []int64{b1, b2} {
		got := decode[map[string]any](t, c.mustDo("GET", "/books/"+itoa(id), nil, 200))
		for k, want := range map[string]any{
			"author": "Ursula K. Le Guin", "translator": "T. Translator",
			"editor": "E. Editor", "description": "a shared note", "series": "Hainish",
		} {
			if got[k] != want {
				t.Errorf("book %d %s = %v, want %v", id, k, got[k], want)
			}
		}
		if got["favorite"] != true {
			t.Errorf("book %d favorite = %v", id, got["favorite"])
		}
		if got["published_year"] != float64(1974) {
			t.Errorf("book %d year = %v", id, got["published_year"])
		}
	}
	// The titles are untouched — which is the assertion the whole rule rests on.
	one := decode[map[string]any](t, c.mustDo("GET", "/books/"+itoa(b1), nil, 200))
	two := decode[map[string]any](t, c.mustDo("GET", "/books/"+itoa(b2), nil, 200))
	if one["title"] != "One" || two["title"] != "Two" {
		t.Fatalf("a bulk edit renamed the works: %v / %v", one["title"], two["title"])
	}
}

func TestBulkEditsEveryTitleFieldIncludingTheMedium(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	m1 := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "A Film"}, 201).Body.Bytes())
	m2 := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Another"}, 201).Body.Bytes())

	// media_type over a selection is the one somebody importing a shelf of games
	// as films actually needs.
	c.mustDo("POST", "/movies/bulk", map[string]any{
		"ids": []int64{m1, m2}, "media_type": "game", "director": "Bethesda",
		"release_year": 2011, "description": "d", "favorite": true,
	}, 200)
	for _, id := range []int64{m1, m2} {
		got := decode[map[string]any](t, c.mustDo("GET", "/movies/"+itoa(id), nil, 200))
		if got["media_type"] != "game" || got["director"] != "Bethesda" {
			t.Errorf("movie %d = %v", id, got)
		}
	}
	// And an illegal medium is a 400 the caller can act on, not a 500 out of the
	// CHECK constraint.
	c.mustDo("POST", "/movies/bulk", map[string]any{"ids": []int64{m1}, "media_type": "podcast"}, http.StatusBadRequest)
}

func TestBulkEditsAQuoteWithoutTouchingItsWords(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	b := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "B"}, 201).Body.Bytes())
	a1 := idOf(t, c.mustDo("POST", "/annotations", map[string]any{"book_id": b, "quote": "first line"}, 201).Body.Bytes())
	a2 := idOf(t, c.mustDo("POST", "/annotations", map[string]any{"book_id": b, "quote": "second line"}, 201).Body.Bytes())

	c.mustDo("POST", "/annotations/bulk", map[string]any{
		"ids": []int64{a1, a2}, "chapter": "3", "location": "142", "note": "one thought about both",
	}, 200)
	// There is no single-annotation GET; the list is the read.
	list := decode[struct {
		Annotations []map[string]any `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(b), nil, 200))
	if len(list.Annotations) != 2 {
		t.Fatalf("annotations = %d", len(list.Annotations))
	}
	words := map[string]bool{}
	for _, got := range list.Annotations {
		if got["chapter"] != "3" || got["location"] != "142" || got["note"] != "one thought about both" {
			t.Errorf("annotation = %v", got)
		}
		words[got["quote"].(string)] = true
	}
	// EACH KEPT ITS OWN WORDS. If the bulk edit could write `quote`, these two
	// would now be one sentence twice.
	if !words["first line"] || !words["second line"] {
		t.Fatalf("a bulk edit rewrote the quotes themselves: %v", words)
	}

	// A FIELD THIS KIND HAS NO COLUMN FOR IS A 400. Answering 200 would report a
	// change that never happened, which is indistinguishable from one that did —
	// the same rule parseSearchFacets states for an unknown facet.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{a1}, "character": "Rick"}, http.StatusBadRequest)
	c.mustDo("POST", "/quotes/bulk", map[string]any{"ids": []int64{1}, "chapter": "3"}, http.StatusBadRequest)
}

// The Catalogue's half of the merge, which the roadmap correctly said did not
// exist. Books have had it since duplicates became findable.
func TestMergeMoviesMovesTheLinesAndUnionsTheGenres(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	keep := idOf(t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Blade Runner", "genres": []string{"sci-fi"},
	}, 201).Body.Bytes())
	dupe := idOf(t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Blade  Runner", "genres": []string{"noir"},
	}, 201).Body.Bytes())
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": dupe, "quote": "time to die"}, 201)
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": keep, "quote": "wake up"}, 201)

	res := decode[map[string]any](t, c.mustDo("POST", "/movies/merge", map[string]any{
		"into": keep, "from": []int64{dupe},
	}, 200))
	if res["merged"] != float64(1) {
		t.Fatalf("merge = %v", res)
	}
	// The source is gone and its line came across rather than going with it.
	c.mustDo("GET", "/movies/"+itoa(dupe), nil, http.StatusNotFound)
	lines := decode[struct {
		Dialogues []map[string]any `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(keep), nil, 200))
	if len(lines.Dialogues) != 2 {
		t.Fatalf("lines on the survivor = %d, want both", len(lines.Dialogues))
	}
	// Genres union rather than the target's winning.
	got := decode[map[string]any](t, c.mustDo("GET", "/movies/"+itoa(keep), nil, 200))
	gs, _ := got["genres"].([]any)
	if len(gs) != 2 {
		t.Fatalf("genres = %v, want the union of both", got["genres"])
	}
}

func TestMergeMoviesRefusesWhatIsNotYours(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	mine := idOf(t, admin.mustDo("POST", "/movies", map[string]any{"title": "Mine"}, 201).Body.Bytes())
	theirs := idOf(t, bob.mustDo("POST", "/movies", map[string]any{"title": "Theirs"}, 201).Body.Bytes())

	// Somebody else's row as the target: 404, never a merge.
	admin.mustDo("POST", "/movies/merge", map[string]any{"into": theirs, "from": []int64{mine}}, http.StatusNotFound)
	// Somebody else's row as a source: dropped, so nothing distinct is left.
	admin.mustDo("POST", "/movies/merge", map[string]any{"into": mine, "from": []int64{theirs}}, http.StatusBadRequest)
	// And theirs is still there.
	bob.mustDo("GET", "/movies/"+itoa(theirs), nil, 200)
}
