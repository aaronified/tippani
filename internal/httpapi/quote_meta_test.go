package httpapi

import (
	"net/http"
	"testing"
)

type annList struct {
	Annotations []annotationRow `json:"annotations"`
}

// favorite on annotations: accepted on POST/PUT, echoed in
// responses, filterable on GET (PLAN §3).
func TestAnnotationFavorite(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune"}, http.StatusCreated))

	a1 := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Fear is the mind-killer.",
		"favorite": true,
	}, http.StatusCreated))
	if !a1.Favorite {
		t.Fatalf("a1: %+v", a1)
	}
	a2 := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "The spice must flow.",
	}, http.StatusCreated))
	if a2.Favorite {
		t.Fatalf("a2: %+v", a2)
	}

	// Filters.
	favs := decode[annList](t, c.mustDo("GET", "/annotations?favorite=1", nil, 200))
	if len(favs.Annotations) != 1 || favs.Annotations[0].ID != a1.ID {
		t.Fatalf("favorite filter: %+v", favs.Annotations)
	}
	c.mustDo("GET", "/annotations?favorite=yes", nil, http.StatusBadRequest)

	// Update is full state: omitting favorite clears it.
	upd := decode[annotationRow](t, c.mustDo("PUT", "/annotations/"+itoa(a1.ID), map[string]any{
		"quote": "Fear is the mind-killer.", "color": "yellow",
	}, 200))
	if upd.Favorite {
		t.Fatalf("update: %+v", upd)
	}
}

// favorite + tags on dialogues; tag usage counts span both join
// tables (PLAN §3: one tag vocabulary spans books and movies), and detached
// tags persist in the managed vocabulary (§10 — no auto-GC).
func TestDialogueFavoriteTags(t *testing.T) {
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
		"tags": []string{"shared", "classic", "Classic", " "}, "favorite": true,
	}, http.StatusCreated))
	if !d1.Favorite || !sameStrings(d1.Tags, []string{"classic", "shared"}) {
		t.Fatalf("d1: %+v", d1)
	}
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Round up the usual suspects.",
	}, http.StatusCreated)

	// The shared vocabulary lists both kinds' tags; "shared" is counted once
	// per join table.
	tg := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if !sameStrings(tagNames(tg.Tags), []string{"bookish", "classic", "shared"}) {
		t.Fatalf("tags: %+v", tg.Tags)
	}
	if sh := tg.Tags[2]; sh.Annotations != 1 || sh.Dialogues != 1 {
		t.Fatalf("shared tag usage: %+v", sh)
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

	// Update replaces the tag set; the detached "classic" stays in the
	// vocabulary at zero usage, "shared" keeps its annotation use.
	upd := decode[dialogueRow](t, c.mustDo("PUT", "/dialogues/"+itoa(d1.ID), map[string]any{
		"quote": "Here's looking at you, kid.", "tags": []string{"farewell"},
	}, 200))
	if upd.Favorite || !sameStrings(upd.Tags, []string{"farewell"}) {
		t.Fatalf("update: %+v", upd)
	}
	tg = decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if !sameStrings(tagNames(tg.Tags), []string{"bookish", "classic", "farewell", "shared"}) {
		t.Fatalf("tags after update: %+v", tg.Tags)
	}
	if cl := tg.Tags[1]; cl.Annotations != 0 || cl.Dialogues != 0 {
		t.Fatalf("classic should be unused: %+v", cl)
	}

	// Dialogue delete drops usage, not the tag.
	c.mustDo("DELETE", "/dialogues/"+itoa(d1.ID), nil, 200)
	tg = decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if !sameStrings(tagNames(tg.Tags), []string{"bookish", "classic", "farewell", "shared"}) {
		t.Fatalf("tags after dialogue delete: %+v", tg.Tags)
	}

	// Movie delete cascades dialogues and their join rows; the vocabulary —
	// including the now-unused "movie-only" — persists.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Play it, Sam.", "tags": []string{"movie-only"},
	}, http.StatusCreated)
	c.mustDo("DELETE", "/movies/"+itoa(movie.ID), nil, 200)
	tg = decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if !sameStrings(tagNames(tg.Tags), []string{"bookish", "classic", "farewell", "movie-only", "shared"}) {
		t.Fatalf("tags after movie delete: %+v", tg.Tags)
	}
	for _, tag := range tg.Tags {
		if tag.Dialogues != 0 {
			t.Fatalf("dialogue usage should be gone: %+v", tag)
		}
	}
}

// favorite parsed from a markdown binding survives the import
// (PLAN §5b: markdown/bookcision paths persist the field).
func TestImportMarkdownFavorite(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	md := "---\ntitle: T\n---\n\n> plain quote\n\n> starred quote\n- favorite: yes\n"
	res := decode[importResult](t, c.importFile("/import/markdown", "t.md", []byte(md)))
	if res.Added != 2 {
		t.Fatalf("import: %+v", res)
	}
	favs := decode[annList](t, c.mustDo("GET", "/annotations?favorite=1", nil, 200))
	if len(favs.Annotations) != 1 || favs.Annotations[0].Quote != "starred quote" {
		t.Fatalf("favorite after import: %+v", favs.Annotations)
	}
}
