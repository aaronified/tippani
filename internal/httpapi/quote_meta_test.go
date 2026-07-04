package httpapi

import (
	"net/http"
	"testing"
)

type annList struct {
	Annotations []annotationRow `json:"annotations"`
}

// favorite + rating on annotations: accepted on POST/PUT, echoed in
// responses, filterable on GET (PLAN §3).
func TestAnnotationFavoriteRating(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune"}, http.StatusCreated))

	a1 := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Fear is the mind-killer.",
		"favorite": true, "rating": 4,
	}, http.StatusCreated))
	if !a1.Favorite || a1.Rating != 4 {
		t.Fatalf("a1: %+v", a1)
	}
	a2 := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "The spice must flow.", "rating": 2,
	}, http.StatusCreated))
	if a2.Favorite || a2.Rating != 2 {
		t.Fatalf("a2: %+v", a2)
	}

	// Validation.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "x", "rating": 6}, http.StatusBadRequest)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "x", "rating": -1}, http.StatusBadRequest)

	// Filters.
	favs := decode[annList](t, c.mustDo("GET", "/annotations?favorite=1", nil, 200))
	if len(favs.Annotations) != 1 || favs.Annotations[0].ID != a1.ID {
		t.Fatalf("favorite filter: %+v", favs.Annotations)
	}
	rated := decode[annList](t, c.mustDo("GET", "/annotations?min_rating=3", nil, 200))
	if len(rated.Annotations) != 1 || rated.Annotations[0].ID != a1.ID {
		t.Fatalf("min_rating filter: %+v", rated.Annotations)
	}
	if all := decode[annList](t, c.mustDo("GET", "/annotations?min_rating=1", nil, 200)); len(all.Annotations) != 2 {
		t.Fatalf("min_rating=1: %+v", all.Annotations)
	}
	c.mustDo("GET", "/annotations?favorite=yes", nil, http.StatusBadRequest)
	c.mustDo("GET", "/annotations?min_rating=0", nil, http.StatusBadRequest)
	c.mustDo("GET", "/annotations?min_rating=abc", nil, http.StatusBadRequest)

	// Update is full state: omitting favorite/rating clears them.
	upd := decode[annotationRow](t, c.mustDo("PUT", "/annotations/"+itoa(a1.ID), map[string]any{
		"quote": "Fear is the mind-killer.", "color": "yellow",
	}, 200))
	if upd.Favorite || upd.Rating != 0 {
		t.Fatalf("update: %+v", upd)
	}
}

// favorite + rating + tags on dialogues; tag GC must consider both join
// tables (PLAN §3: one tag vocabulary spans books and movies).
func TestDialogueFavoriteRatingTags(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Casablanca"}, http.StatusCreated))
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Fear is the mind-killer.", "tags": []string{"shared", "bookish"},
	}, http.StatusCreated)

	d1 := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Here's looking at you, kid.",
		"tags": []string{"shared", "classic", "Classic", " "}, "favorite": true, "rating": 5,
	}, http.StatusCreated))
	if !d1.Favorite || d1.Rating != 5 || !sameStrings(d1.Tags, []string{"classic", "shared"}) {
		t.Fatalf("d1: %+v", d1)
	}
	d2 := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Round up the usual suspects.", "rating": 3,
	}, http.StatusCreated))

	// Validation.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "x", "rating": 6}, http.StatusBadRequest)

	// The shared vocabulary lists both kinds' tags.
	if tg := decode[namesResp](t, c.mustDo("GET", "/tags", nil, 200)); !sameStrings(tg.Tags, []string{"bookish", "classic", "shared"}) {
		t.Fatalf("tags: %v", tg.Tags)
	}

	// Filters.
	byTag := decode[dlgList](t, c.mustDo("GET", "/dialogues?tag=classic", nil, 200))
	if len(byTag.Dialogues) != 1 || byTag.Dialogues[0].ID != d1.ID {
		t.Fatalf("tag filter: %+v", byTag.Dialogues)
	}
	favs := decode[dlgList](t, c.mustDo("GET", "/dialogues?favorite=1", nil, 200))
	if len(favs.Dialogues) != 1 || favs.Dialogues[0].ID != d1.ID {
		t.Fatalf("favorite filter: %+v", favs.Dialogues)
	}
	rated := decode[dlgList](t, c.mustDo("GET", "/dialogues?min_rating=4", nil, 200))
	if len(rated.Dialogues) != 1 || rated.Dialogues[0].ID != d1.ID {
		t.Fatalf("min_rating filter: %+v", rated.Dialogues)
	}
	rated = decode[dlgList](t, c.mustDo("GET", "/dialogues?min_rating=3", nil, 200))
	if len(rated.Dialogues) != 2 || rated.Dialogues[1].ID != d2.ID { // both untimed -> id order
		t.Fatalf("min_rating=3: %+v", rated.Dialogues)
	}
	c.mustDo("GET", "/dialogues?min_rating=9", nil, http.StatusBadRequest)

	// Update replaces the tag set; the orphaned "classic" is GC'd, "shared"
	// survives via the annotation.
	upd := decode[dialogueRow](t, c.mustDo("PUT", "/dialogues/"+itoa(d1.ID), map[string]any{
		"quote": "Here's looking at you, kid.", "tags": []string{"farewell"},
	}, 200))
	if upd.Favorite || upd.Rating != 0 || !sameStrings(upd.Tags, []string{"farewell"}) {
		t.Fatalf("update: %+v", upd)
	}
	if tg := decode[namesResp](t, c.mustDo("GET", "/tags", nil, 200)); !sameStrings(tg.Tags, []string{"bookish", "farewell", "shared"}) {
		t.Fatalf("tags after update: %v", tg.Tags)
	}

	// Dialogue delete GCs its orphan tag.
	c.mustDo("DELETE", "/dialogues/"+itoa(d1.ID), nil, 200)
	if tg := decode[namesResp](t, c.mustDo("GET", "/tags", nil, 200)); !sameStrings(tg.Tags, []string{"bookish", "shared"}) {
		t.Fatalf("tags after dialogue delete: %v", tg.Tags)
	}

	// Movie delete cascades dialogues; annotation-held tags survive.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Play it, Sam.", "tags": []string{"movie-only"},
	}, http.StatusCreated)
	c.mustDo("DELETE", "/movies/"+itoa(movie.ID), nil, 200)
	if tg := decode[namesResp](t, c.mustDo("GET", "/tags", nil, 200)); !sameStrings(tg.Tags, []string{"bookish", "shared"}) {
		t.Fatalf("tags after movie delete: %v", tg.Tags)
	}
}

// favorite/rating parsed from markdown bindings survive the import
// (PLAN §5b: markdown/bookcision paths persist the new fields).
func TestImportMarkdownFavoriteRating(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	md := "---\ntitle: T\n---\n\n> plain quote\n\n> starred quote\n- favorite: yes\n- rating: 3\n"
	res := decode[importResult](t, c.importFile("/import/markdown", "t.md", []byte(md)))
	if res.Added != 2 {
		t.Fatalf("import: %+v", res)
	}
	favs := decode[annList](t, c.mustDo("GET", "/annotations?favorite=1", nil, 200))
	if len(favs.Annotations) != 1 || favs.Annotations[0].Quote != "starred quote" ||
		favs.Annotations[0].Rating != 3 {
		t.Fatalf("favorite after import: %+v", favs.Annotations)
	}
	if rated := decode[annList](t, c.mustDo("GET", "/annotations?min_rating=4", nil, 200)); len(rated.Annotations) != 0 {
		t.Fatalf("min_rating=4: %+v", rated.Annotations)
	}
}
