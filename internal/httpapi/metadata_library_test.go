package httpapi

import (
	"bytes"
	"image"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

type metaLib struct {
	Books []struct {
		ID              int64 `json:"id"`
		HasCover        bool  `json:"has_cover"`
		LowResCover     bool  `json:"low_res_cover"`
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
	DialogueStats struct {
		Total        int `json:"total"`
		MissingActor int `json:"missing_actor"`
	} `json:"dialogue_stats"`
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
	// A speakerless line (no character) — unfillable, must NOT count toward missing_actor.
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": m.ID, "quote": "Roll the reel."}, http.StatusCreated)
	// A line with a character but no actor — fillable, counts toward missing_actor.
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": m.ID, "quote": "You came back.", "character": "Mira"}, http.StatusCreated)

	lib := decode[metaLib](t, c.mustDo("GET", "/metadata/library", nil, 200))
	if len(lib.Books) != 1 || lib.Books[0].HasCover || lib.Books[0].HasIDs || lib.Books[0].AnnotationCount != 1 {
		t.Fatalf("book flags: %+v", lib.Books)
	}
	if len(lib.Movies) != 1 || lib.Movies[0].HasPoster || lib.Movies[0].HasCast || lib.Movies[0].HasSource || lib.Movies[0].DialogueCount != 2 {
		t.Fatalf("movie flags: %+v", lib.Movies)
	}
	if lib.DialogueStats.Total != 2 || lib.DialogueStats.MissingActor != 1 {
		t.Fatalf("dialogue stats should count only the fillable (char'd) line: %+v", lib.DialogueStats)
	}
}

// TestMetadataLibraryLowRes: a stored cover narrower than the refetch threshold
// is flagged low_res_cover; a wide one is not; an unmeasurable/absent cover is
// not falsely flagged.
func TestMetadataLibraryLowRes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	dir := srv.coversDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	writePNG := func(name string, w int) {
		t.Helper()
		var buf bytes.Buffer
		if err := png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, w, 10))); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, name), buf.Bytes(), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	writePNG("00000000000000a1.png", 100) // low-res
	writePNG("00000000000000a2.png", 900) // hi-res
	lo := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Lo"}, http.StatusCreated))
	hi := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Hi"}, http.StatusCreated))
	none := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "None"}, http.StatusCreated))
	if _, err := srv.Store.DB.Exec(`UPDATE books SET cover_path = ? WHERE id = ?`, "00000000000000a1.png", lo.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`UPDATE books SET cover_path = ? WHERE id = ?`, "00000000000000a2.png", hi.ID); err != nil {
		t.Fatal(err)
	}

	lib := decode[metaLib](t, c.mustDo("GET", "/metadata/library", nil, 200))
	byID := map[int64]bool{}
	for _, b := range lib.Books {
		byID[b.ID] = b.LowResCover
	}
	if !byID[lo.ID] {
		t.Fatalf("narrow cover not flagged low-res")
	}
	if byID[hi.ID] {
		t.Fatalf("wide cover wrongly flagged low-res")
	}
	if byID[none.ID] {
		t.Fatalf("coverless book wrongly flagged low-res")
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

	// A mapping whose target character is empty must be SKIPPED, never blanking
	// the label (silent data loss). The label stays "Evey".
	blank := decode[remapResp](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/remap-speakers", map[string]any{
		"mappings": []map[string]any{{"from": "Evey", "character": "", "actor": ""}},
	}, 200))
	if blank.Remapped != 0 {
		t.Fatalf("empty-character mapping should be skipped, got %+v", blank)
	}
	if l := decode[dlgList](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(m.ID), nil, 200)); l.Dialogues[0].Character != "Evey" {
		t.Fatalf("label must be unchanged by an empty-character mapping: %+v", l.Dialogues)
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
