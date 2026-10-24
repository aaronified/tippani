package httpapi

import (
	"archive/zip"
	"bytes"
	"net/http"
	"strings"
	"testing"
	"time"
)

// seedExportBook builds the golden-test library: one book, four annotations
// covering chapterless entries, multi-line quotes, non-default bindings and
// a note-only annotation.
func seedExportBook(t *testing.T, c *testClient) bookDetail {
	t.Helper()
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Dune", "author": "Frank Herbert", "isbn": "9780441013593",
		"published_year": 1965, "genres": []string{"Science Fiction", "Classics"},
	}, http.StatusCreated))
	for _, body := range []map[string]any{
		{"quote": "Chapterless quote."},
		{"quote": "Fear is the mind-killer.\nI will face my fear.", "note": "my  note\nacross lines",
			"color": "blue", "chapter": "Book One", "location": "p.12",
			"tags": []string{"philosophy", "fear"}, "favorite": true},
		{"note": "A note-only thought.", "chapter": "Book One"},
		{"quote": "Second chapter quote.", "chapter": "Book Two"},
	} {
		body["book_id"] = book.ID
		c.mustDo("POST", "/annotations", body, http.StatusCreated)
	}
	return book
}

// __DATE__ stands in for today's date: manual annotations get noted_at = now,
// so every quote block exports a "- date:" binding (the test substitutes it).
const wantBookExport = `---
title: Dune
author: Frank Herbert
isbn: 9780441013593
year: 1965
genres: Classics, Science Fiction
type: book
---

> Chapterless quote.
- date: __DATE__

## Book One

> Fear is the mind-killer.
> I will face my fear.
- note: my note across lines
- color: blue
- tags: fear, philosophy
- loc: p.12
- date: __DATE__
- favorite: true

> A note-only thought.
- date: __DATE__

## Book Two

> Second chapter quote.
- date: __DATE__
`

func TestBookExport(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	book := seedExportBook(t, c)

	rec := c.mustDo("GET", "/books/"+itoa(book.ID)+"/export", nil, 200)
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/markdown") {
		t.Fatalf("content type: %q", ct)
	}
	if cd := rec.Header().Get("Content-Disposition"); cd != `attachment; filename="Dune.md"` {
		t.Fatalf("content disposition: %q", cd)
	}
	want := strings.ReplaceAll(wantBookExport, "__DATE__", time.Now().UTC().Format("2006-01-02"))
	if got := rec.Body.String(); got != want {
		t.Fatalf("export mismatch:\n--- got ---\n%s\n--- want ---\n%s", got, want)
	}
	c.mustDo("GET", "/books/999/export", nil, http.StatusNotFound)
	c.mustDo("GET", "/books/abc/export", nil, http.StatusBadRequest)
}

func TestMovieExport(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Casablanca", "director": "Michael Curtiz", "release_year": 1942,
		"genres": []string{"Drama"},
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Here's looking at you, kid.",
		"character": "Rick Blaine", "actor": "Humphrey Bogart", "timestamp": "01:15:00",
		"note": "iconic", "tags": []string{"classic"}, "favorite": true,
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{ // untimed -> sorts last
		"movie_id": movie.ID, "quote": "Round up the usual suspects.",
	}, http.StatusCreated)

	// "type: movie" is unconditional, not decoration: it is what routes the file
	// back to the catalogue importer, and a film with no director and unattributed
	// lines would otherwise re-import as a book (LooksLikeMovieMarkdown).
	want := `---
title: Casablanca
director: Michael Curtiz
year: 1942
genres: Drama
type: movie
---

> Here's looking at you, kid.
- character: Rick Blaine
- actor: Humphrey Bogart
- timestamp: 01:15:00
- note: iconic
- tags: classic
- favorite: true

> Round up the usual suspects.
`
	rec := c.mustDo("GET", "/movies/"+itoa(movie.ID)+"/export", nil, 200)
	if got := rec.Body.String(); got != want {
		t.Fatalf("export mismatch:\n--- got ---\n%s\n--- want ---\n%s", got, want)
	}
	c.mustDo("GET", "/movies/999/export", nil, http.StatusNotFound)
}

// TestImportMovieMarkdownRoundTrip: a catalogue export re-imports through the
// same /import/markdown endpoint (auto-detected as movie), anchors to the
// existing title (idempotent), and a show's media_type + director survive.
func TestImportMovieMarkdownRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Casablanca", "director": "Michael Curtiz", "release_year": 1942, "genres": []string{"Drama"},
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Here's looking at you, kid.", "character": "Rick Blaine",
		"actor": "Humphrey Bogart", "timestamp": "01:15:00", "favorite": true,
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": movie.ID, "quote": "Round up the usual suspects."}, http.StatusCreated)

	exported := c.mustDo("GET", "/movies/"+itoa(movie.ID)+"/export", nil, 200).Body.Bytes()
	type movieImportRes struct {
		MovieID int64 `json:"movie_id"`
		Created bool  `json:"created"`
		Added   int   `json:"added"`
		Skipped int   `json:"skipped"`
	}
	res := decode[movieImportRes](t, c.importApprove("/import/markdown", "casablanca.md", exported))
	if res.MovieID != movie.ID || res.Created || res.Added != 0 || res.Skipped != 2 {
		t.Fatalf("round trip: %+v (want anchored to movie %d, 0 added, 2 skipped)", res, movie.ID)
	}

	// A fresh show export creates the title with its media_type + director.
	showMD := "---\ntitle: Andor\ntype: show\nyear: 2022\ndirector: Tony Gilroy\n---\n\n> One way out.\n- character: Kino\n"
	sres := decode[movieImportRes](t, c.importApprove("/import/markdown", "andor.md", []byte(showMD)))
	if !sres.Created || sres.Added != 1 {
		t.Fatalf("show import: %+v", sres)
	}
	sm := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(sres.MovieID), nil, 200))
	if sm.MediaType != "show" || sm.Director != "Tony Gilroy" {
		t.Fatalf("show media_type/director not applied: %+v", sm)
	}
}

func TestExportZip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Two books whose titles sanitize to the same filename, plus one movie.
	c.mustDo("POST", "/books", map[string]any{"title": "Dune?"}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{"title": "Dune*"}, http.StatusCreated)
	c.mustDo("POST", "/movies", map[string]any{"title": "The Matrix"}, http.StatusCreated)

	rec := c.mustDo("GET", "/export", nil, 200)
	if ct := rec.Header().Get("Content-Type"); ct != "application/zip" {
		t.Fatalf("content type: %q", ct)
	}
	if cd := rec.Header().Get("Content-Disposition"); !strings.Contains(cd, "tippani-export.zip") {
		t.Fatalf("content disposition: %q", cd)
	}
	body := rec.Body.Bytes()
	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, f := range zr.File {
		names = append(names, f.Name)
	}
	want := []string{"books/Dune-.md", "books/Dune- (2).md", "movies/The Matrix.md"}
	if !sameStrings(names, want) {
		t.Fatalf("zip entries: %v", names)
	}
	// Each member is a rendered markdown file.
	f, err := zr.File[0].Open()
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	buf := make([]byte, 32)
	n, _ := f.Read(buf)
	if !strings.HasPrefix(string(buf[:n]), "---\ntitle: Dune?\n") {
		t.Fatalf("first member: %q", buf[:n])
	}
}

func TestExportOwnership(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	book := decode[bookDetail](t, alice.mustDo("POST", "/books",
		map[string]any{"title": "Dune"}, http.StatusCreated))
	movie := decode[movieDetail](t, alice.mustDo("POST", "/movies",
		map[string]any{"title": "Casablanca"}, http.StatusCreated))

	// Foreign ids answer 404 (no existence leak), like every other route.
	bob.mustDo("GET", "/books/"+itoa(book.ID)+"/export", nil, http.StatusNotFound)
	bob.mustDo("GET", "/movies/"+itoa(movie.ID)+"/export", nil, http.StatusNotFound)

	// Bob's library zip is empty; Alice's has both items.
	body := bob.mustDo("GET", "/export", nil, 200).Body.Bytes()
	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		t.Fatal(err)
	}
	if len(zr.File) != 0 {
		t.Fatalf("bob's zip: %v", zr.File)
	}
	body = alice.mustDo("GET", "/export", nil, 200).Body.Bytes()
	if zr, err = zip.NewReader(bytes.NewReader(body), int64(len(body))); err != nil || len(zr.File) != 2 {
		t.Fatalf("alice's zip: %v (%v)", zr.File, err)
	}
}

// A book's series and a film's collection survive the export/import round trip.
// Both were previously dropped on export — the frontmatter carried title,
// author, year and genres but never the series — so a library rebuilt from its
// own Markdown lost every series and collection it had.
func TestSeriesAndCollectionRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Deadhouse Gates", "author": "Steven Erikson",
		"series": "Malazan Book of the Fallen", "series_index": 2,
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID, "quote": "A quote."}, http.StatusCreated)

	md := c.mustDo("GET", "/books/"+itoa(book.ID)+"/export", nil, 200).Body.String()
	if !strings.Contains(md, "series: Malazan Book of the Fallen #2") {
		t.Fatalf("series missing from the export frontmatter:\n%s", md)
	}

	// Import into a second account so the value is genuinely re-parsed rather
	// than matched onto the existing row.
	c2 := addUser(t, h, c, "reader2")
	res := decode[importResult](t, c2.importApprove("/import/markdown", "deadhouse.md", []byte(md)))
	got := decode[bookDetail](t, c2.mustDo("GET", "/books/"+itoa(res.BookID), nil, 200))
	if got.Series != "Malazan Book of the Fallen" || got.SeriesIndex != 2 {
		t.Fatalf("book series did not round-trip: %q #%v", got.Series, got.SeriesIndex)
	}

	// Films call the same column a collection, and one can span a film and a show.
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Fire Walk With Me", "release_year": 1992, "series": "Twin Peaks", "series_index": 2,
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": movie.ID, "quote": "A line."}, http.StatusCreated)

	mmd := c.mustDo("GET", "/movies/"+itoa(movie.ID)+"/export", nil, 200).Body.String()
	if !strings.Contains(mmd, "collection: Twin Peaks #2") {
		t.Fatalf("collection missing from the export frontmatter:\n%s", mmd)
	}
	type movieImportRes struct {
		MovieID int64 `json:"movie_id"`
	}
	mres := decode[movieImportRes](t, c2.importApprove("/import/markdown", "fwwm.md", []byte(mmd)))
	gotM := decode[movieDetail](t, c2.mustDo("GET", "/movies/"+itoa(mres.MovieID), nil, 200))
	if gotM.Series != "Twin Peaks" || gotM.SeriesIndex != 2 {
		t.Fatalf("collection did not round-trip: %q #%v", gotM.Series, gotM.SeriesIndex)
	}

	// A collection with no position emits a bare name and re-parses as one.
	bare := "---\ntitle: Serenity\nyear: 2005\ncollection: Firefly\n---\n\n> A line.\n"
	bres := decode[movieImportRes](t, c2.importApprove("/import/markdown", "serenity.md", []byte(bare)))
	gotB := decode[movieDetail](t, c2.mustDo("GET", "/movies/"+itoa(bres.MovieID), nil, 200))
	if gotB.Series != "Firefly" || gotB.SeriesIndex != 0 {
		t.Fatalf("bare collection: %q #%v", gotB.Series, gotB.SeriesIndex)
	}
}

// A GAME'S EXPORT, ON THE EXACT BYTES. Two things are pinned here that a
// "contains" check would not: `type: game` — the line that was written as
// `type: movie` until 0047's round-trip half, so a game came home a film with its
// only locators stripped — and the placement of act and quest, which sit where a
// film's timestamp sits because they are what a game has instead of one.
func TestGameExport(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	game := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Disco Elysium", "director": "ZA/UM", "publisher": "ZA/UM",
		"release_year": 2019, "media_type": "game", "genres": []string{"RPG"},
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game.ID, "quote": "You are the man with the hangover.",
		"character": "Kim Kitsuragi", "act": "1", "quest": "The Whirling-in-Rags",
		// Sent and DROPPED: a game has no runtime to point into, so the server
		// clears it (normalizeLocator) and the file must not mention it.
		"timestamp": "01:12:40",
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game.ID, "quote": "A line with no locator at all.",
	}, http.StatusCreated)

	want := `---
title: Disco Elysium
director: ZA/UM
publisher: ZA/UM
year: 2019
genres: RPG
type: game
---

> A line with no locator at all.

> You are the man with the hangover.
- character: Kim Kitsuragi
- act: 1
- quest: The Whirling-in-Rags
`
	rec := c.mustDo("GET", "/movies/"+itoa(game.ID)+"/export", nil, http.StatusOK)
	if got := rec.Body.String(); got != want {
		t.Fatalf("export mismatch:\n--- got ---\n%s\n--- want ---\n%s", got, want)
	}
}

// The anthology round trip.
//
// The export makes exactly one claim about itself — that the order and the prose
// come back — and that claim is what this file tests. It is the only export whose
// content is partly the reader's own writing, so the failure it guards is not a
// missing field but a missing paragraph.
//
// WHAT IS DELIBERATELY NOT ASSERTED: that a book highlight comes back as a book
// highlight. The file carries no book, because an anthology is a reading document
// and the work a passage came from appears in it as an attribution rather than as
// a record with an ISBN. Every entry re-imports as a standalone quote, and the
// test says so explicitly rather than leaving it to be discovered.

type anthologyList struct {
	Anthologies []anthologyRow `json:"anthologies"`
}

func exportAnthology(t *testing.T, c *testClient, id int64) string {
	t.Helper()
	return c.mustDo("GET", "/anthologies/"+itoa(id)+"/export", nil, http.StatusOK).Body.String()
}

func listAnthologies(t *testing.T, c *testClient) []anthologyRow {
	t.Helper()
	return decode[anthologyList](t, c.mustDo("GET", "/anthologies", nil, http.StatusOK)).Anthologies
}

func setEntryNote(t *testing.T, c *testClient, id int64, kind string, itemID int64, note string) {
	t.Helper()
	c.mustDo("PUT", "/anthologies/"+itoa(id)+"/entries", map[string]any{
		"kind": kind, "item_id": itemID, "note": note,
	}, http.StatusNoContent)
}

// TestAnthologyRoundTrip is the claim in the plan's own words: an anthology with
// commentary exports and re-imports with its order and prose intact.
//
// Into a SECOND account, so nothing can pass by finding the rows already there —
// which is the way a round-trip test quietly stops testing anything.
func TestAnthologyRoundTrip(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	ann, dia, utt := threeKinds(t, alice)
	a := newAnthology(t, alice, "Cities and their ghosts")
	intro := "Three passages about the same idea.\n\nThey were written sixty years apart."
	alice.mustDo("PUT", "/anthologies/"+itoa(a.ID), map[string]any{
		"title": "Cities and their ghosts",
		// Two paragraphs, because the blank line between them is the only formatting
		// this field has and it is the first thing a round trip loses.
		"intro": intro,
	}, http.StatusNoContent)
	// Deliberately NOT the order they were created in: the order is the feature, so
	// the file has to carry one that is not the id order.
	addEntries(t, alice, a.ID, []map[string]any{
		{"kind": "utterance", "item_id": utt},
		{"kind": "book", "item_id": ann},
		{"kind": "screen", "item_id": dia},
	})
	setEntryNote(t, alice, a.ID, "utterance", utt, "A voice from outside either.")
	setEntryNote(t, alice, a.ID, "book", ann, "Calvino sets the terms.")
	setEntryNote(t, alice, a.ID, "screen", dia, "And the Zone answers him.")

	md := exportAnthology(t, alice, a.ID)

	bob := addUser(t, h, alice, "bob")
	staged := stageQuotesMD(t, bob, "cities.md", md)
	if staged.Staged != 3 {
		t.Fatalf("staged %d rows from a three-entry anthology", staged.Staged)
	}
	approveBatch(t, bob, staged.BatchID)

	list := listAnthologies(t, bob)
	if len(list) != 1 {
		t.Fatalf("the import made %d anthologies, want 1", len(list))
	}
	rebuilt := list[0]
	if rebuilt.Title != "Cities and their ghosts" {
		t.Errorf("title = %q", rebuilt.Title)
	}
	if rebuilt.Intro != intro {
		t.Errorf("the introduction did not survive:\n got %q\nwant %q", rebuilt.Intro, intro)
	}

	got := getAnthology(t, bob, rebuilt.ID)
	if len(got.Entries) != 3 {
		t.Fatalf("%d entries after the round trip, want 3", len(got.Entries))
	}
	// THE ORDER, which is what an anthology is. Asserted on the quotes rather than
	// on ids, because the ids are new — this is a different account.
	wantOrder := []string{
		"Give me blood, and I will give you freedom",
		"Cities, like dreams, are made of desires and fears.",
		"Let everything that has been planned come true.",
	}
	wantNotes := []string{
		"A voice from outside either.",
		"Calvino sets the terms.",
		"And the Zone answers him.",
	}
	for i, e := range got.Entries {
		if !strings.HasPrefix(e.Quote, wantOrder[i]) {
			t.Errorf("entry %d = %q, want it to start %q", i, e.Quote, wantOrder[i])
		}
		if e.Note != wantNotes[i] {
			t.Errorf("entry %d commentary = %q, want %q", i, e.Note, wantNotes[i])
		}
	}
	// AND THE STATED LOSS. Every entry is a standalone quote now, whatever it was:
	// the file carries no book and no film, so there is nothing to hang the other two
	// kinds off. Asserted rather than left to be found out.
	for _, e := range got.Entries {
		if e.Kind != kindUtterance {
			t.Errorf("entry %s:%d came back as %s; a re-imported anthology is standalone quotes",
				e.Kind, e.ItemID, e.Kind)
		}
	}
	// The attribution is what survives of the work: the book's title as the
	// occasion, its author as the speaker.
	var calvino anthologyEntryRow
	for _, e := range got.Entries {
		if strings.HasPrefix(e.Quote, "Cities, like dreams") {
			calvino = e
		}
	}
	if calvino.Source != "Invisible Cities" || calvino.Credit != "Italo Calvino" {
		t.Errorf("the book's attribution did not survive: %q / %q", calvino.Source, calvino.Credit)
	}
}

// TestReimportingAnAnthologyDoesNotDuplicateIt — the case that actually happens.
//
// Importing the same file twice is how a reader gets an anthology back after
// deleting it, and it is also just a double-click. The quotes collide on their
// dedupe hash and are skipped, and the naive reading of that is to skip the ENTRY
// too — which rebuilds the anthology empty. So a skipped quote is still filed,
// against the row it collided with.
func TestReimportingAnAnthologyDoesNotDuplicateIt(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	ann, _, _ := threeKinds(t, alice)
	a := newAnthology(t, alice, "Openings")
	addEntries(t, alice, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	setEntryNote(t, alice, a.ID, "book", ann, "The first line of the book.")
	md := exportAnthology(t, alice, a.ID)

	bob := addUser(t, h, alice, "bob")
	for i := 0; i < 2; i++ {
		staged := stageQuotesMD(t, bob, "openings.md", md)
		approveBatch(t, bob, staged.BatchID)
	}

	list := listAnthologies(t, bob)
	if len(list) != 1 {
		t.Fatalf("two imports of one file made %d anthologies", len(list))
	}
	got := getAnthology(t, bob, list[0].ID)
	if len(got.Entries) != 1 {
		t.Fatalf("%d entries after importing the same file twice, want 1", len(got.Entries))
	}
	if got.Entries[0].Note != "The first line of the book." {
		t.Errorf("the commentary did not survive the second import: %q", got.Entries[0].Note)
	}
}
