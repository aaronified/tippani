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

// ---- ensembles ------------------------------------------------------------
//
// A line spoken by two characters is stored as one label, "V, Evey". The remap
// matched the WHOLE stored string, so a mapping for "V" matched nothing — and
// answered 200 with a remapped count of 0, which reads as "there was nothing to
// do" rather than "I could not do it". The screen offering "V, Evey" as a single
// remappable row was the visible half of the same bug.
//
// These pin the component behaviour, including the case where the fix must
// deliberately NOT act.

func vendetta(t *testing.T, srv *Server, c *testClient) movieDetail {
	t.Helper()
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "V for Vendetta"}, http.StatusCreated))
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET cast_json = ? WHERE id = ?`,
		`[{"character":"Evey","actor":"Natalie Portman"},{"character":"V","actor":"Hugo Weaving"}]`, m.ID); err != nil {
		t.Fatal(err)
	}
	return m
}

// setDialogue writes character/actor directly, because the point is a row that
// arrived from an import already carrying a compound label.
func setDialogue(t *testing.T, srv *Server, id int64, character, actor string) {
	t.Helper()
	if _, err := srv.Store.DB.Exec(`UPDATE dialogues SET character = ?, actor = ? WHERE id = ?`,
		character, actor, id); err != nil {
		t.Fatal(err)
	}
}

// TestRemapSpeakerComponents is the whole component family as one table: seed a
// dialogue into a known (character, actor) state, POST ONE mapping, read the row
// back. Only the seed pair, the mapping and the two expected strings vary.
//
// Each row builds its OWN movie (vendetta) on the shared server, so the movie_id
// filter leaves Dialogues[0] unambiguous inside every subtest; the server and the
// signup are shared because no row can see another row's movie.
func TestRemapSpeakerComponents(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	cases := []struct {
		name          string
		quote         string
		seedCharacter string
		seedActor     string
		from          string
		toCharacter   string
		toActor       string
		// wantRemapped is -1 where the case never asserted the count.
		wantRemapped  int
		wantCharacter string
		wantActor     string
	}{
		{
			// Only the matched component moves. The co-credit and the separator survive
			// exactly, which is what metadata.ReplaceCredit is for.
			name:          "one name inside an ensemble is rewritten",
			quote:         "Beneath this mask.",
			seedCharacter: "V Codename, Evey Hammond",
			seedActor:     "Hugo Weaving, Natalie Portman",
			from:          "V Codename", toCharacter: "V", toActor: "Hugo Weaving",
			wantRemapped:  1,
			wantCharacter: "V, Evey Hammond",
			wantActor:     "Hugo Weaving, Natalie Portman",
		},
		{
			// The actor is spliced AT THE SAME INDEX, not appended and not overwritten.
			// Slot 1 replaced, slot 0 untouched. Getting this backwards would credit
			// Natalie Portman with V's line.
			name:          "the actor is spliced at the matching position",
			quote:         "Remember, remember.",
			seedCharacter: "V, Evey Hammond",
			seedActor:     "Hugo Weaving, WRONG NAME",
			from:          "Evey Hammond", toCharacter: "Evey", toActor: "Natalie Portman",
			wantRemapped:  -1,
			wantCharacter: "V, Evey",
			wantActor:     "Hugo Weaving, Natalie Portman",
		},
		{
			// WHEN THE LISTS DO NOT LINE UP, THE ACTOR IS LEFT ALONE. Imported rows carry
			// a different number of actors than characters often enough that guessing a
			// slot is the wrong default: a wrong pairing is invisible and would be read as
			// data the user entered. The character rename still happens — that part is
			// unambiguous.
			//
			// Three characters, one actor: nothing in the row says which one it belongs to.
			name:          "the actor is left alone when it cannot tell which is which",
			quote:         "Ideas are bulletproof.",
			seedCharacter: "V, Evey Hammond, Finch",
			seedActor:     "Hugo Weaving",
			from:          "Evey Hammond", toCharacter: "Evey", toActor: "Natalie Portman",
			wantRemapped:  -1,
			wantCharacter: "V, Evey, Finch",
			wantActor:     "Hugo Weaving",
		},
		{
			// The single-speaker path is the common one and must be unchanged: both fields
			// set outright, which is what fills a missing actor from the cast.
			//
			// This case used to build its row through POST /dialogues with character
			// "Evey Hammond". That label doesn't match this cast, so the create path
			// leaves the actor empty (TestRemapSpeakers pins exactly that) — seeding
			// ("Evey Hammond", "") reproduces the same state.
			name:          "both fields are still set for one speaker",
			quote:         "People should not be afraid.",
			seedCharacter: "Evey Hammond",
			seedActor:     "",
			from:          "Evey Hammond", toCharacter: "Evey", toActor: "",
			wantRemapped:  -1,
			wantCharacter: "Evey",
			wantActor:     "Natalie Portman",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// Rebound to the subtest's t so a failed request names its own subtest.
			c := &testClient{t: t, h: h, cookie: c.cookie}
			m := vendetta(t, srv, c)

			d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues",
				map[string]any{"movie_id": m.ID, "quote": tc.quote, "character": "x"}, http.StatusCreated))
			setDialogue(t, srv, d.ID, tc.seedCharacter, tc.seedActor)

			res := decode[remapResp](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/remap-speakers", map[string]any{
				"mappings": []map[string]any{{"from": tc.from, "character": tc.toCharacter, "actor": tc.toActor}},
			}, 200))
			if tc.wantRemapped >= 0 && res.Remapped != tc.wantRemapped {
				t.Fatalf("remapped = %d, want %d — an ensemble line must be reachable", res.Remapped, tc.wantRemapped)
			}

			got := decode[dlgList](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(m.ID), nil, 200)).Dialogues[0]
			if got.Character != tc.wantCharacter {
				t.Fatalf("character = %q, want %q — the rename must still happen", got.Character, tc.wantCharacter)
			}
			if got.Actor != tc.wantActor {
				t.Fatalf("actor = %q, want %q — the right slot, untouched rather than guessed", got.Actor, tc.wantActor)
			}
		})
	}
}
