package httpapi

import (
	"context"
	"net/http"
	"testing"

	"tippani/internal/metadata"
)

// A LINE ARRIVES WITH ITS CHARACTERS' PICTURES (0050).
//
// The fold is the point. A quote names its character as text and the picture
// hangs off a work_cast row keyed by store.CastKey(name) — a fold SQLite cannot
// perform, because its lower() has no Unicode tables. So the match is made in Go,
// and this asserts it works through the case and punctuation differences a reader
// actually types, not just on an exact string.
func TestADialogueArrivesWithItsCharacterPictures(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film, withArt, _ := seedTVDBCast(t, srv, c)

	srv.fetchImage = func(context.Context, string, string) (string, error) {
		return "waller-stored.jpg", nil
	}
	c.mustDo("POST", "/cast/"+itoa(withArt)+"/image", nil, http.StatusOK)

	// The line spells her differently from the cast row — lower case, and a
	// straight space. The fold is what has to bridge that.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "You're going to die.",
		"character": "amanda  waller", "actor": "Viola Davis",
	}, http.StatusCreated)
	// THE FOLD THAT A LOWERCASE WOULD MISS, and the direction matters. The cast row
	// is stored with a STRAIGHT apostrophe, so its folded key holds one; the LINE
	// is typed with a curly one. Only CastKey's punctuation fold bridges that —
	// strings.ToLower leaves the curly quote alone and finds nothing.
	//
	// The other direction proves nothing: a curly cast row is folded to straight on
	// write, so a straight line matches it under a plain lowercase too. The first
	// version of this test had it that way round and passed against ToLower.
	curly := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "D'Artagnan", "actor": "Somebody Else"},
		http.StatusCreated))
	if _, err := srv.Store.DB.Exec(
		`UPDATE work_cast SET character_image_path = ? WHERE id = ?`,
		"dartagnan-stored.jpg", curly.ID); err != nil {
		t.Fatal(err)
	}
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "All for one.", "character": "D’Artagnan",
	}, http.StatusCreated)
	// And a line whose character has no stored picture at all.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "Nothing to see.", "character": "Uncredited Extra",
	}, http.StatusCreated)

	type row struct {
		Quote           string `json:"quote"`
		CharacterImages []struct {
			Name string `json:"name"`
			Path string `json:"path"`
		} `json:"character_images"`
	}
	got := decode[struct {
		Dialogues []row `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(film), nil, http.StatusOK))
	if len(got.Dialogues) != 3 {
		t.Fatalf("want three lines, got %+v", got.Dialogues)
	}

	byQuote := map[string]row{}
	for _, d := range got.Dialogues {
		byQuote[d.Quote] = d
	}
	waller := byQuote["You're going to die."]
	if len(waller.CharacterImages) != 1 {
		t.Fatalf("the folded match failed: %+v", waller.CharacterImages)
	}
	if waller.CharacterImages[0].Path != "waller-stored.jpg" {
		t.Errorf("path = %q, want the stored picture", waller.CharacterImages[0].Path)
	}
	// THE NAME COMES OFF THE LINE, NOT OFF THE CAST ROW — the line is what the
	// reader is looking at. Lower case here, where the cast row says "Amanda
	// Waller": the fold is for MATCHING and must not leak into the display.
	// Internal whitespace is collapsed, because that is what SplitCredits does to
	// every credit in the app and a chip should not carry a double space.
	if waller.CharacterImages[0].Name != "amanda waller" {
		t.Errorf("name = %q, want the line's own spelling (case kept, spaces collapsed)",
			waller.CharacterImages[0].Name)
	}
	// The curly/straight apostrophe pair matched, which only CastKey's fold does.
	if d := byQuote["All for one."]; len(d.CharacterImages) != 1 ||
		d.CharacterImages[0].Path != "dartagnan-stored.jpg" {
		t.Errorf("the typographic fold failed: %+v — a plain lowercase would do this",
			d.CharacterImages)
	}
	// A character with no picture is ABSENT, not present-and-empty: the client has
	// to tell "no picture" from "no character" to know whether to fall back.
	if n := len(byQuote["Nothing to see."].CharacterImages); n != 0 {
		t.Errorf("a character with no stored picture produced %d entr(ies)", n)
	}
}

// TWO CHARACTERS ON ONE LINE get two pictures, in the order the line names them.
func TestALineNamingTwoCharactersGetsBothPictures(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film := createFilm(t, c, "Suicide Squad", "David Ayer")

	tx, err := srv.Store.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	err = mergeProviderCast(tx, 1, "movie", film, "tvdb", []metadata.CastMember{
		{Character: "Amanda Waller", Actor: "Viola Davis", CharacterImageURL: "https://artworks.thetvdb.com/w.jpg"},
		{Character: "Harley Quinn", Actor: "Margot Robbie", CharacterImageURL: "https://artworks.thetvdb.com/q.jpg"},
	})
	if err != nil {
		tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	n := 0
	srv.fetchImage = func(context.Context, string, string) (string, error) {
		n++
		return "stored-" + itoa(int64(n)) + ".jpg", nil
	}
	for _, row := range castOf(t, c, "/movies/"+itoa(film)+"/cast").Cast {
		c.mustDo("POST", "/cast/"+itoa(row.ID)+"/image", nil, http.StatusOK)
	}

	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "Enough.", "character": "Harley Quinn, Amanda Waller",
	}, http.StatusCreated)

	got := decode[struct {
		Dialogues []struct {
			CharacterImages []struct {
				Name string `json:"name"`
			} `json:"character_images"`
		} `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(film), nil, http.StatusOK))
	if len(got.Dialogues) != 1 {
		t.Fatalf("want one line, got %d", len(got.Dialogues))
	}
	names := []string{}
	for _, ci := range got.Dialogues[0].CharacterImages {
		names = append(names, ci.Name)
	}
	if len(names) != 2 || names[0] != "Harley Quinn" || names[1] != "Amanda Waller" {
		t.Fatalf("names = %v, want both in the order the line names them", names)
	}
}
