package httpapi

import (
	"net/http"
	"testing"
)

type metaLib struct {
	Books []struct {
		ID              int64 `json:"id"`
		HasCover        bool  `json:"has_cover"`
		HasIDs          bool  `json:"has_ids"`
		AnnotationCount int   `json:"annotation_count"`
	} `json:"books"`
	Movies []struct {
		ID            int64 `json:"id"`
		HasPoster     bool  `json:"has_poster"`
		HasCast       bool  `json:"has_cast"`
		HasSource     bool  `json:"has_source"`
		DialogueCount int   `json:"dialogue_count"`
	} `json:"movies"`
}

// TestMetadataLibrary: the overview flags a bare manual book/movie as missing
// cover/ids/poster/cast/source and reports the child counts.
func TestMetadataLibrary(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "The Wide Margin"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b.ID, "quote": "A margin is a promise."}, http.StatusCreated)
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Northline"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": m.ID, "quote": "Roll the reel."}, http.StatusCreated)

	lib := decode[metaLib](t, c.mustDo("GET", "/metadata/library", nil, 200))
	if len(lib.Books) != 1 || lib.Books[0].HasCover || lib.Books[0].HasIDs || lib.Books[0].AnnotationCount != 1 {
		t.Fatalf("book flags: %+v", lib.Books)
	}
	if len(lib.Movies) != 1 || lib.Movies[0].HasPoster || lib.Movies[0].HasCast || lib.Movies[0].HasSource || lib.Movies[0].DialogueCount != 1 {
		t.Fatalf("movie flags: %+v", lib.Movies)
	}
}

type remapResp struct {
	Remapped int `json:"remapped"`
	Refilled int `json:"refilled"`
}

// TestRemapSpeakers covers the reported pain: an imported label ("Evey Hammond")
// that doesn't match the supplier's cast character ("Evey") is remapped in bulk,
// renaming the dialogues and filling the actor from the cast.
func TestRemapSpeakers(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "V for Vendetta"}, http.StatusCreated))
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET cast_json = ? WHERE id = ?`,
		`[{"character":"Evey","actor":"Natalie Portman"},{"character":"V","actor":"Hugo Weaving"}]`, m.ID); err != nil {
		t.Fatal(err)
	}
	// "Evey Hammond" doesn't match the cast at create time -> actor empty.
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues",
		map[string]any{"movie_id": m.ID, "quote": "People should not be afraid.", "character": "Evey Hammond"}, http.StatusCreated))
	if d.Actor != "" {
		t.Fatalf("actor should be empty before remap: %+v", d)
	}

	res := decode[remapResp](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/remap-speakers", map[string]any{
		"mappings": []map[string]any{{"from": "Evey Hammond", "character": "Evey", "actor": ""}},
	}, 200))
	if res.Remapped != 1 {
		t.Fatalf("remapped = %d, want 1", res.Remapped)
	}
	list := decode[dlgList](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(m.ID), nil, 200))
	if len(list.Dialogues) != 1 || list.Dialogues[0].Character != "Evey" || list.Dialogues[0].Actor != "Natalie Portman" {
		t.Fatalf("after remap: %+v", list.Dialogues)
	}

	// A remap that leaves character unchanged but flips refill on backfills any
	// other empty actors from the cast.
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": m.ID, "quote": "Beneath this mask.", "character": "V"}, http.StatusCreated)
	// (character "V" matches the cast, so it already auto-filled; force an empty one)
	if _, err := srv.Store.DB.Exec(`UPDATE dialogues SET actor = NULL WHERE movie_id = ? AND character = 'V'`, m.ID); err != nil {
		t.Fatal(err)
	}
	res2 := decode[remapResp](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/remap-speakers", map[string]any{
		"mappings": []map[string]any{}, "refill": true,
	}, 200))
	if res2.Refilled < 1 {
		t.Fatalf("refill should have filled the V actor: %+v", res2)
	}
}
