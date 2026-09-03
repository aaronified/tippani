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
	// A CHARACTER WITH NO PICTURE IS PRESENT WITH AN EMPTY PATH, which is the
	// reversal of what this case used to assert. It read "absent, not
	// present-and-empty", on the reasoning that a face row must be able to tell
	// "no picture" from "no character" — and the empty path tells it just as well,
	// while dropping the entry told the client nothing about a character it was
	// then unable to name. The card stops printing its own character text once any
	// chip draws, so a dropped name is a name the reader loses.
	extra := byQuote["Nothing to see."].CharacterImages
	if len(extra) != 1 {
		t.Fatalf("a character with no stored picture produced %d entr(ies), want 1", len(extra))
	}
	if extra[0].Name != "Uncredited Extra" || extra[0].Path != "" {
		t.Errorf("got %+v, want the name with an empty path", extra[0])
	}
}

// A LIBRARY WITH NO CHARACTER ART AT ALL STILL GETS THE ROSTER, which is the
// case the picture gate hid. All three fill sites ran the fold inside
// `if found := loadCharacterImages(...); len(found) > 0`, so a reader who had
// never stored a single character picture — most readers, and every new library —
// got `character_images` on no line whatsoever. The client draws a chip per entry
// and the card stops printing its own character text once any chip draws, so the
// two states that gate produced were "chips for the pictured names only" and "no
// chips at all", and the second is not an empty state: it is a card that names
// nobody where the reader typed three names.
func TestALineNamesItsCharactersWithNoStoredArtAnywhere(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Casablanca"}, http.StatusCreated)).ID

	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "Round up the usual suspects.",
		"character": "Rick, Ilsa, Sam",
	}, http.StatusCreated)

	type row struct {
		CharacterImages []struct {
			Name string `json:"name"`
			Path string `json:"path"`
		} `json:"character_images"`
	}
	got := decode[struct {
		Dialogues []row `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(film), nil, http.StatusOK))
	if len(got.Dialogues) != 1 {
		t.Fatalf("want one line, got %d", len(got.Dialogues))
	}
	names := []string{}
	for _, ci := range got.Dialogues[0].CharacterImages {
		if ci.Path != "" {
			t.Errorf("%s carries a path %q on a library with no art", ci.Name, ci.Path)
		}
		names = append(names, ci.Name)
	}
	// IN THE ORDER THE READER TYPED THEM, and all three of them: the row is what
	// the card shows instead of the text it no longer prints.
	if len(names) != 3 || names[0] != "Rick" || names[1] != "Ilsa" || names[2] != "Sam" {
		t.Errorf("got %v, want [Rick Ilsa Sam]", names)
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

// A BOOK'S CHARACTER GETS A PICTURE TOO (0050), and the parity guard is what
// caught this being missing.
//
// Nobody plays Ahab, so a book quote has a character and no actor at all — which
// is exactly why leaving books out would have been the wrong kind of incomplete:
// a chip falling back to the author on one screen and drawing the character on
// another, for the same reader, with nothing saying why.
func TestABookQuoteArrivesWithItsCharacterPicture(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Moby-Dick", "author": "Herman Melville"}, http.StatusCreated))

	// A cast row on a BOOK takes no actor (0047) — the API refuses one.
	row := decode[castRow](t, c.mustDo("POST", "/books/"+itoa(book.ID)+"/cast",
		map[string]any{"character": "Ahab"}, http.StatusCreated))
	if _, err := srv.Store.DB.Exec(
		`UPDATE work_cast SET character_image_path = ? WHERE id = ?`, "ahab.jpg", row.ID); err != nil {
		t.Fatal(err)
	}

	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "From hell's heart I stab at thee.",
		"character": "ahab",
	}, http.StatusCreated)

	got := decode[struct {
		Annotations []struct {
			CharacterImages []struct {
				Name string `json:"name"`
				Path string `json:"path"`
			} `json:"character_images"`
		} `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(book.ID), nil, http.StatusOK))

	if len(got.Annotations) != 1 {
		t.Fatalf("want one annotation, got %d", len(got.Annotations))
	}
	imgs := got.Annotations[0].CharacterImages
	if len(imgs) != 1 || imgs[0].Path != "ahab.jpg" {
		t.Fatalf("book quote's character pictures = %+v, want the one stored for Ahab", imgs)
	}
	// The name off the line, lower case as typed — the fold is for matching only.
	if imgs[0].Name != "ahab" {
		t.Errorf("name = %q, want the line's own spelling", imgs[0].Name)
	}
}
