package httpapi

import (
	"net/http"
	"testing"
)

// HOW MANY OF A CHARACTER'S APPEARANCES HAVE A FACE — the one fact the characters
// console could not state, and the one the v3 pack's row is built around
// ("3 works · 1 of 3 have a face", metadata.dc.html:718).
//
// WHY IT IS ON THE REF AND NOT A COUNT. A character wears a different face in
// every work — the face lives on `work_cast`, not on the character — so the
// question is per appearance. A count would answer "how many" and could not
// answer "which one is missing", which is the more useful of the two and the one
// a reader acts on.

type charFaceRef struct {
	Kind    string `json:"kind"`
	ID      int64  `json:"id"`
	Title   string `json:"title"`
	HasFace bool   `json:"has_face"`
}

type charFaceRow struct {
	ID      int64         `json:"id"`
	Name    string        `json:"name"`
	WorksIn []charFaceRef `json:"works_in"`
}

func charFaceList(t *testing.T, c *testClient) []charFaceRow {
	t.Helper()
	return decode[struct {
		Characters []charFaceRow `json:"characters"`
	}](t, c.mustDo("GET", "/characters", nil, http.StatusOK)).Characters
}

func TestEachAppearanceSaysWhetherItHasAFace(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	// Two works, one character in both. The picture is stored against the cast
	// row, which is what makes this a per-appearance fact at all.
	charID, _ := oneWoland(t, c)
	// THE SAME RECORD IN A SECOND WORK, added through the character rather than
	// through the work's cast: a cast row naming "Woland" on another book makes a
	// SECOND character record, which is the backfill's whole design and the thing
	// this console exists to let a reader merge.
	second := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Master and Margarita", "media_type": "movie"},
		http.StatusCreated)).ID
	c.mustDo("POST", "/characters/"+itoa(charID)+"/works",
		map[string]any{"kind": "movie", "work_id": second}, http.StatusOK)

	for _, row := range charFaceList(t, c) {
		for _, w := range row.WorksIn {
			if w.HasFace {
				t.Fatalf("%s in %q reports a face before one was chosen", row.Name, w.Title)
			}
		}
	}

	// Give exactly one of the two appearances a face.
	if _, err := srv.Store.DB.Exec(
		`UPDATE work_cast SET character_image_path = 'characters/woland.jpg'
		  WHERE character_id = ? AND kind = 'movie' AND work_id = ?`, charID, second); err != nil {
		t.Fatal(err)
	}

	var faced, bare int
	for _, row := range charFaceList(t, c) {
		if row.ID != charID {
			continue
		}
		if len(row.WorksIn) != 2 {
			t.Fatalf("Woland turns up in %d works, want 2", len(row.WorksIn))
		}
		for _, w := range row.WorksIn {
			if w.HasFace {
				faced++
				if w.ID != second {
					t.Fatalf("the face landed on %q rather than the work it was set on", w.Title)
				}
			} else {
				bare++
			}
		}
	}
	if faced != 1 || bare != 1 {
		t.Fatalf("one of two appearances has a face: got %d with, %d without", faced, bare)
	}
}

// A CHARACTER CAST TWICE ON ONE WORK IS ONE APPEARANCE. A role and its voice are
// two cast rows against the same book, and they can differ in whether a face was
// chosen — which is why the query groups rather than taking DISTINCT over the
// columns including the flag. DISTINCT would return the work twice, once each
// way, and the console would read two works where there is one.
func TestTwoCastRowsOnOneWorkAreOneAppearance(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	charID, _ := oneWoland(t, c)

	// A FILM, because only a film has performers — and a performer is what makes
	// two rows of one character on one work possible: the role and its voice.
	film := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Master and Margarita", "media_type": "movie"},
		http.StatusCreated)).ID
	c.mustDo("POST", "/characters/"+itoa(charID)+"/works",
		map[string]any{"kind": "movie", "work_id": film, "actor": "Oleg Basilashvili"},
		http.StatusOK)
	twin := decode[castOut](t, c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "Woland", "actor": "Valentin Gaft"}, http.StatusCreated))
	c.mustDo("PUT", "/cast/"+itoa(twin.ID)+"/link",
		map[string]any{"character_id": charID}, http.StatusNoContent)
	if _, err := srv.Store.DB.Exec(
		`UPDATE work_cast SET character_image_path = 'characters/woland.jpg' WHERE id = ?`,
		twin.ID); err != nil {
		t.Fatal(err)
	}

	for _, row := range charFaceList(t, c) {
		if row.ID != charID {
			continue
		}
		// The book Woland came from, and the film they are cast on twice.
		if len(row.WorksIn) != 2 {
			t.Fatalf("two cast rows on one film gave %d appearances in all, want 2", len(row.WorksIn))
		}
		var onFilm []charFaceRef
		for _, w := range row.WorksIn {
			if w.Kind == "movie" {
				onFilm = append(onFilm, w)
			}
		}
		if len(onFilm) != 1 {
			t.Fatalf("the film is listed %d times, want once", len(onFilm))
		}
		if !onFilm[0].HasFace {
			t.Fatal("the appearance has a face on one of its two rows and reports none")
		}
	}
}
