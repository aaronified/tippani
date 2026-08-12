package httpapi

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

// Putting things back.
//
// The restore is the half of the bin that has to be RIGHT rather than merely
// present, because its failures are the ones nobody catches: a book that comes
// back without its quotes, quotes that come back without their tags, a card that
// comes back having forgotten a year of review history. Every one of those looks
// like a working restore from the outside.
//
// So each case asserts VALUES through the app's own endpoints — what the reader
// would see — rather than counting rows in the tables.

type trashList struct {
	Trash []trashRow `json:"trash"`
	Days  int        `json:"days"`
}

func binOf(t *testing.T, c *testClient) trashList {
	t.Helper()
	return decode[trashList](t, c.mustDo("GET", "/trash", nil, 200))
}

func restore(t *testing.T, c *testClient, id int64, want int) {
	t.Helper()
	c.mustDo("POST", "/trash/"+itoa(id)+"/restore", nil, want)
}

func TestRestoreBringsBackABookWithEverythingUnderIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := idOf(t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Dispossessed", "author": "Ursula K. Le Guin",
		"published_year": 1974, "genres": []string{"science fiction"},
	}, 201).Body.Bytes())
	cover := "beefbeefbeefbeef.png"
	if err := os.WriteFile(filepath.Join(srv.coversDir(), cover), pngMagic, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`UPDATE books SET cover_path = ? WHERE id = ?`, cover, bookID); err != nil {
		t.Fatal(err)
	}
	annID := idOf(t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "You cannot buy the revolution",
		"chapter": "1", "location": "42", "color": "blue", "tags": []string{"politics"},
	}, 201).Body.Bytes())
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO item_reviews (kind, item_id, stability, review_count, last_result, last_touched_at)
		 VALUES ('book', ?, 33.5, 4, 'got', '2026-07-01T00:00:00Z')`, annID); err != nil {
		t.Fatal(err)
	}

	c.mustDo("DELETE", "/books/"+itoa(bookID), nil, http.StatusOK)
	bin := binOf(t, c)
	if len(bin.Trash) != 1 || bin.Trash[0].Kind != "book" || bin.Trash[0].ChildCount != 1 {
		t.Fatalf("bin: %+v", bin.Trash)
	}
	if bin.Days != 30 {
		t.Fatalf("retention window reported as %d, want the 30-day default", bin.Days)
	}
	restore(t, c, bin.Trash[0].ID, http.StatusOK)

	// THE SAME IDS. Nothing was renumbered, so a bookmark still resolves — which is
	// what the id floor bought.
	b := decode[struct {
		ID        int64    `json:"id"`
		Title     string   `json:"title"`
		Author    string   `json:"author"`
		Published int      `json:"published_year"`
		Cover     string   `json:"cover_path"`
		Genres    []string `json:"genres"`
	}](t, c.mustDo("GET", "/books/"+itoa(bookID), nil, 200))
	if b.ID != bookID || b.Title != "The Dispossessed" || b.Author != "Ursula K. Le Guin" || b.Published != 1974 {
		t.Fatalf("book came back as %+v", b)
	}
	if b.Cover != cover {
		t.Errorf("cover_path = %q, want %q", b.Cover, cover)
	}
	if len(b.Genres) != 1 || b.Genres[0] != "Science Fiction" {
		t.Errorf("genres came back as %+v", b.Genres)
	}
	// The picture is back in the cover store, not still parked in the bin's corner.
	if _, err := os.Stat(filepath.Join(srv.coversDir(), cover)); err != nil {
		t.Errorf("the cover did not come back: %v", err)
	}
	if _, err := os.Stat(filepath.Join(srv.trashDir(), cover)); !os.IsNotExist(err) {
		t.Error("the cover is still parked; unpark moves, it does not copy")
	}

	anns := decode[annList](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, 200)).Annotations
	if len(anns) != 1 {
		t.Fatalf("quotes came back: %+v", anns)
	}
	a := anns[0]
	if a.ID != annID || a.Quote != "You cannot buy the revolution" || a.Chapter != "1" ||
		a.Location != "42" || a.Color != "blue" {
		t.Fatalf("quote came back as %+v", a)
	}
	if len(a.Tags) != 1 || a.Tags[0] != "politics" {
		t.Errorf("tags came back as %+v", a.Tags)
	}

	// The review schedule, which is the thing a restore is most likely to lose:
	// item_reviews has no foreign key, so nothing about the insert would have
	// complained if the writer had never carried it.
	var stability float64
	var count int
	if err := srv.Store.DB.QueryRow(
		`SELECT stability, review_count FROM item_reviews WHERE kind = 'book' AND item_id = ?`, annID).
		Scan(&stability, &count); err != nil {
		t.Fatalf("the review schedule did not come back: %v", err)
	}
	if stability != 33.5 || count != 4 {
		t.Errorf("review row came back as stability=%v count=%d", stability, count)
	}

	// And the bin is empty: a restored entry is spent, not left behind to be
	// restored twice.
	if got := binOf(t, c); len(got.Trash) != 0 {
		t.Fatalf("the bin still holds %+v", got.Trash)
	}
}

func TestRestoredQuoteIsSearchableAgain(t *testing.T) {
	// The FTS index follows the rows through their own triggers, so a restore
	// re-indexes for free — but only if the row genuinely goes back in through an
	// INSERT. This is the test that would catch a "clever" restore that wrote the
	// rows some other way.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := createBook(t, c, "A Wizard of Earthsea")
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": "the unspoken word beneath"}, 201).Body.Bytes())

	c.mustDo("DELETE", "/annotations/"+itoa(id), nil, http.StatusOK)
	if hits := decode[searchResults](t, c.mustDo("GET", "/search?q=unspoken", nil, 200)); len(hits.Annotations) != 0 {
		t.Fatalf("a binned quote is still searchable: %+v", hits.Annotations)
	}
	restore(t, c, binOf(t, c).Trash[0].ID, http.StatusOK)
	hits := decode[searchResults](t, c.mustDo("GET", "/search?q=unspoken", nil, 200))
	if len(hits.Annotations) != 1 {
		t.Fatalf("a restored quote must be searchable again: %+v", hits.Annotations)
	}
}

func TestRestoreRebuildsATagDeletedInTheMeantime(t *testing.T) {
	// The reason the writer carries tag ROWS and not just join rows. A tag is
	// managed vocabulary: it outlives the quotes that use it, and it can be deleted
	// while one of them sits in the bin. A join row pointing at an id that is gone
	// fails the foreign key, so the restore re-creates the tag by NAME.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := createBook(t, c, "Sandworm Studies")
	id := idOf(t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "The spice must flow", "tags": []string{"politics"},
	}, 201).Body.Bytes())
	c.mustDo("DELETE", "/annotations/"+itoa(id), nil, http.StatusOK)

	// Delete the tag itself while the quote is in the bin.
	var tagID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM tags WHERE name = 'politics'`).Scan(&tagID); err != nil {
		t.Fatal(err)
	}
	c.mustDo("DELETE", "/tags/"+itoa(tagID), nil, http.StatusOK)

	restore(t, c, binOf(t, c).Trash[0].ID, http.StatusOK)
	anns := decode[annList](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, 200)).Annotations
	if len(anns) != 1 || len(anns[0].Tags) != 1 || anns[0].Tags[0] != "politics" {
		t.Fatalf("the tag did not come back with the quote: %+v", anns)
	}
}

func TestRestoreSurvivesAnIdRaceWithANewRow(t *testing.T) {
	// The case the id floor exists for, end to end: delete the newest quote (the
	// one whose id SQLite would hand out again), create another, then restore. Both
	// have to exist afterwards, with their own ids.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := createBook(t, c, "A Wizard of Earthsea")
	first := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": "the first line"}, 201).Body.Bytes())
	c.mustDo("DELETE", "/annotations/"+itoa(first), nil, http.StatusOK)
	second := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": "the second line"}, 201).Body.Bytes())
	if second == first {
		t.Fatalf("the id was reused: %d", second)
	}
	restore(t, c, binOf(t, c).Trash[0].ID, http.StatusOK)

	anns := decode[annList](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, 200)).Annotations
	if len(anns) != 2 {
		t.Fatalf("both quotes should exist: %+v", anns)
	}
	byID := map[int64]string{}
	for _, a := range anns {
		byID[a.ID] = a.Quote
	}
	if byID[first] != "the first line" || byID[second] != "the second line" {
		t.Fatalf("ids and quotes do not line up: %+v", byID)
	}

	// And the floor is still above both, so the next create cannot collide either.
	third := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": "the third line"}, 201).Body.Bytes())
	if third <= second || third == first {
		t.Fatalf("after a restore the next id was %d (first=%d second=%d)", third, first, second)
	}
}

func TestSomebodyElsesBinIsNotFound(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	bookID := createBook(t, admin, "The Dispossessed")
	admin.mustDo("DELETE", "/books/"+itoa(bookID), nil, http.StatusOK)
	entry := binOf(t, admin).Trash[0]

	// Bob cannot see it, restore it, read it or throw it away.
	if got := binOf(t, bob); len(got.Trash) != 0 {
		t.Fatalf("bob can see somebody else's bin: %+v", got.Trash)
	}
	bob.mustDo("GET", "/trash/"+itoa(entry.ID), nil, http.StatusNotFound)
	restore(t, bob, entry.ID, http.StatusNotFound)
	bob.mustDo("DELETE", "/trash/"+itoa(entry.ID), nil, http.StatusNotFound)

	// And none of that consumed it: the owner can still put it back.
	restore(t, admin, entry.ID, http.StatusOK)
	admin.mustDo("GET", "/books/"+itoa(bookID), nil, http.StatusOK)

	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM books`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("books after the restore: %d", n)
	}
}

func TestRestoringTwiceIsNotFoundTheSecondTime(t *testing.T) {
	// An Undo tapped twice, or two clients racing the same one. The entry is
	// deleted in the same transaction that puts the rows back, so the second
	// attempt has nothing to find and writes nothing — rather than inserting the
	// same book again and failing on its primary key halfway through.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := createBook(t, c, "Sandworm Studies")
	c.mustDo("DELETE", "/books/"+itoa(bookID), nil, http.StatusOK)
	id := binOf(t, c).Trash[0].ID

	restore(t, c, id, http.StatusOK)
	restore(t, c, id, http.StatusNotFound)

	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM books`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("the second restore duplicated the book: %d rows", n)
	}
}

func TestTheBinListsWhatIsInsideAnEntry(t *testing.T) {
	// The expanded row in Settings reads the payload it already has, so this
	// asserts the quotes are reported — and that the response is a summary rather
	// than the whole snapshot, because a chevron should not hand over a database
	// dump.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := createBook(t, c, "The Dispossessed")
	for _, q := range []string{"first quote here", "second quote here"} {
		c.mustDo("POST", "/annotations", map[string]any{"book_id": bookID, "quote": q, "color": "blue"}, 201)
	}
	c.mustDo("DELETE", "/books/"+itoa(bookID), nil, http.StatusOK)

	id := binOf(t, c).Trash[0].ID
	got := decode[struct {
		Entry    trashRow `json:"entry"`
		Contents []struct {
			Text  string `json:"text"`
			Color string `json:"color"`
		} `json:"contents"`
	}](t, c.mustDo("GET", "/trash/"+itoa(id), nil, 200))
	if got.Entry.Label != "The Dispossessed" || got.Entry.ChildCount != 2 {
		t.Fatalf("entry: %+v", got.Entry)
	}
	if len(got.Contents) != 2 {
		t.Fatalf("contents: %+v", got.Contents)
	}
	seen := map[string]string{}
	for _, c := range got.Contents {
		seen[c.Text] = c.Color
	}
	if seen["first quote here"] != "blue" || seen["second quote here"] != "blue" {
		t.Fatalf("contents did not carry the quotes and their colours: %+v", seen)
	}
}

func TestEmptyingTheBinRemovesTheFilesToo(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := createBook(t, c, "Sandworm Studies")
	cover := "0123456789abcdef.png"
	if err := os.WriteFile(filepath.Join(srv.coversDir(), cover), pngMagic, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`UPDATE books SET cover_path = ? WHERE id = ?`, cover, bookID); err != nil {
		t.Fatal(err)
	}
	c.mustDo("DELETE", "/books/"+itoa(bookID), nil, http.StatusOK)
	if _, err := os.Stat(filepath.Join(srv.trashDir(), cover)); err != nil {
		t.Fatalf("the cover was not parked: %v", err)
	}

	var out struct {
		Removed int `json:"removed"`
	}
	if err := json.Unmarshal(c.mustDo("DELETE", "/trash", nil, 200).Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out.Removed != 1 {
		t.Fatalf("removed = %d, want 1", out.Removed)
	}
	if _, err := os.Stat(filepath.Join(srv.trashDir(), cover)); !os.IsNotExist(err) {
		t.Error("emptying the bin left the parked cover on disk")
	}
	if got := binOf(t, c); len(got.Trash) != 0 {
		t.Fatalf("the bin is not empty: %+v", got.Trash)
	}
}

func TestEmptyingYourBinLeavesEverybodyElsesAlone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	adminBook := createBook(t, admin, "The Dispossessed")
	admin.mustDo("DELETE", "/books/"+itoa(adminBook), nil, http.StatusOK)
	bobBook := createBook(t, bob, "Sandworm Studies")
	bob.mustDo("DELETE", "/books/"+itoa(bobBook), nil, http.StatusOK)

	bob.mustDo("DELETE", "/trash", nil, http.StatusOK)
	if got := binOf(t, admin); len(got.Trash) != 1 {
		t.Fatalf("bob emptying his bin touched the admin's: %+v", got.Trash)
	}
	_ = srv
}

func TestRetentionWindowIsAPreference(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	if got := binOf(t, c).Days; got != 30 {
		t.Fatalf("default window = %d, want 30", got)
	}
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"trashDays": 7}, 200)
	if got := binOf(t, c).Days; got != 7 {
		t.Fatalf("window after setting 7 = %d", got)
	}
	// NEVER IS -1, NOT 0: an absent field unmarshals to 0, so 0 has to keep
	// meaning "nobody has set this" or every account that predates the bin would
	// read as never-expire and the purge would never run for any of them.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"trashDays": -1}, 200)
	if got := binOf(t, c).Days; got != -1 {
		t.Fatalf("window after setting never = %d, want -1", got)
	}
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"trashDays": 5}, http.StatusBadRequest)
	if got := binOf(t, c).Days; got != -1 {
		t.Fatalf("a refused value changed the window to %d", got)
	}
	// A preferences PUT that says nothing about the bin leaves it alone — the
	// partial-update contract every other field here follows.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"accent": "olive"}, 200)
	if got := binOf(t, c).Days; got != -1 {
		t.Fatalf("an unrelated preference change reset the window to %d", got)
	}
}
