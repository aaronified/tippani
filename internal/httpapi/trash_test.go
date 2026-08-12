package httpapi

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

// The bin's writer: what a delete parks, and whether it is all of it.
//
// THE SNAPSHOT IS THE WHOLE FEATURE AND ITS FAILURE MODE IS DELAYED. A payload
// that quietly stops carrying a table, or a column, produces a restore that looks
// like it worked — the book comes back, the quotes come back, and the review
// schedule everyone spent a year building is silently reset to a new card. Nobody
// finds that out on the day.
//
// So these assert VALUES, not counts, and they name every table that travels:
// three of them (item_reviews, work_reads, and the genre/tag rows) are reachable
// only because the writer carries a declared list rather than walking the foreign
// keys, and an FK walk is exactly what a later refactor would reach for.

// trashSnapshot reads the one bin entry the test just made, straight from the
// table. GET /trash does not exist yet, and going through the DB is the right
// level for a test about what was written rather than what is reported.
type trashEntry struct {
	ID         int64
	Kind       string
	Label      string
	ChildCount int
	Payload    map[string][]map[string]any
	Files      []string
}

func onlyTrashEntry(t *testing.T, srv *Server) trashEntry {
	t.Helper()
	var e trashEntry
	var payload, files string
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM trash`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("expected exactly one bin entry, found %d", n)
	}
	if err := srv.Store.DB.QueryRow(
		`SELECT id, kind, label, child_count, payload, files FROM trash`).
		Scan(&e.ID, &e.Kind, &e.Label, &e.ChildCount, &payload, &files); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte(payload), &e.Payload); err != nil {
		t.Fatalf("payload is not readable JSON: %v\n%s", err, payload)
	}
	if err := json.Unmarshal([]byte(files), &e.Files); err != nil {
		t.Fatalf("file list is not readable JSON: %v\n%s", err, files)
	}
	return e
}

// rowWith finds a snapshot row by one column's value, so an assertion can name
// the quote it is talking about instead of indexing into an array.
func rowWith(t *testing.T, rows []map[string]any, col string, want any) map[string]any {
	t.Helper()
	for _, r := range rows {
		if stringOf(r[col]) == want {
			return r
		}
	}
	t.Fatalf("no row with %s = %v in %+v", col, want, rows)
	return nil
}

func TestDeletingAQuoteBinsItWholeAndItIsGone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "A Wizard of Earthsea")
	id := idOf(t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id":  bookID,
		"quote":    "Only in silence the word",
		"note":     "the opening of the Creation of Ea",
		"chapter":  "1",
		"location": "12",
		"color":    "blue",
		"tags":     []string{"magic", "names"},
	}, 201).Body.Bytes())

	// A review schedule, which is the row an FK walk cannot find: item_reviews is
	// keyed (kind, item_id) with no foreign key and is cleared by a trigger, so it
	// has to be read BEFORE the delete or it is gone with no trace.
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO item_reviews (kind, item_id, stability, review_count, last_result, last_touched_at)
		 VALUES ('book', ?, 42.5, 7, 'got', '2026-08-01T00:00:00Z')`, id); err != nil {
		t.Fatal(err)
	}

	c.mustDo("DELETE", "/annotations/"+itoa(id), nil, http.StatusOK)

	// Really deleted: the bin is a snapshot, not a soft delete, and every query in
	// the app has to keep working without knowing the bin exists.
	var live int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM annotations WHERE id = ?`, id).Scan(&live); err != nil {
		t.Fatal(err)
	}
	if live != 0 {
		t.Fatal("the row is still there — the bin must not be a soft delete")
	}

	e := onlyTrashEntry(t, srv)
	if e.Kind != "annotation" {
		t.Fatalf("kind = %q", e.Kind)
	}
	if e.Label != "Only in silence the word" {
		t.Fatalf("label = %q; a quote's label is its own first words", e.Label)
	}

	row := rowWith(t, e.Payload["annotations"], "quote", "Only in silence the word")
	for col, want := range map[string]string{
		"note": "the opening of the Creation of Ea", "chapter": "1", "location": "12", "color": "blue",
	} {
		if got := stringOf(row[col]); got != want {
			t.Errorf("snapshot %s = %q, want %q", col, got, want)
		}
	}

	if got := len(e.Payload["annotation_tags"]); got != 2 {
		t.Errorf("tag joins carried: %d, want 2", got)
	}
	// The tag ROWS travel too, by name, because a tag can be deleted before the
	// restore and a join row pointing at a missing tag fails the foreign key.
	names := map[string]bool{}
	for _, r := range e.Payload["tags"] {
		names[stringOf(r["name"])] = true
	}
	if !names["magic"] || !names["names"] {
		t.Errorf("tag names carried: %+v", names)
	}

	revs := e.Payload["item_reviews"]
	if len(revs) != 1 {
		t.Fatalf("the review schedule was not carried: %+v", revs)
	}
	if n, _ := intOf(revs[0]["review_count"]); n != 7 {
		t.Errorf("review_count = %v, want 7 — a restored quote must not come back as a new card", revs[0]["review_count"])
	}
	if s, _ := revs[0]["stability"].(float64); s != 42.5 {
		t.Errorf("stability = %v, want 42.5", revs[0]["stability"])
	}
}

func TestDeletingABookBinsEverythingUnderIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// A book with a cover, a genre, two quotes and a read log entry.
	bookID := idOf(t, c.mustDo("POST", "/books", map[string]any{
		"title":  "The Dispossessed",
		"author": "Ursula K. Le Guin",
		"genres": []string{"science fiction"},
	}, 201).Body.Bytes())
	cover := "abcdef0123456789.png"
	if err := os.WriteFile(filepath.Join(srv.coversDir(), cover), pngMagic, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`UPDATE books SET cover_path = ? WHERE id = ?`, cover, bookID); err != nil {
		t.Fatal(err)
	}
	for _, q := range []string{"You cannot buy the revolution", "Where does a thought come from"} {
		c.mustDo("POST", "/annotations", map[string]any{"book_id": bookID, "quote": q}, 201)
	}
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO work_reads (user_id, kind, work_id, started_at, finished_at)
		 VALUES (?, 'book', ?, '2026-01-01', '2026-02-02')`, 1, bookID); err != nil {
		t.Fatal(err)
	}

	c.mustDo("DELETE", "/books/"+itoa(bookID), nil, http.StatusOK)

	e := onlyTrashEntry(t, srv)
	if e.Kind != "book" || e.Label != "The Dispossessed" {
		t.Fatalf("entry = %q / %q", e.Kind, e.Label)
	}
	// ONE ENTRY PER USER ACTION: the count is what the bin's summary line says, so
	// "The Dispossessed + 2 quotes" has to be true of the payload.
	if e.ChildCount != 2 {
		t.Fatalf("child_count = %d, want 2", e.ChildCount)
	}
	if len(e.Payload["annotations"]) != 2 {
		t.Fatalf("quotes carried: %+v", e.Payload["annotations"])
	}
	rowWith(t, e.Payload["annotations"], "quote", "You cannot buy the revolution")
	rowWith(t, e.Payload["annotations"], "quote", "Where does a thought come from")

	// The genre join AND the genre row, because genres are garbage-collected on
	// delete: by the time the transaction ends, the last book's genre is gone.
	if len(e.Payload["book_genres"]) != 1 {
		t.Errorf("genre joins carried: %+v", e.Payload["book_genres"])
	}
	// Genres are title-cased on the way in (titleCaseGenre), so the snapshot
	// carries what the table holds rather than what the request said.
	rowWith(t, e.Payload["genres"], "name", "Science Fiction")

	// The read log, the other table with no foreign key.
	reads := e.Payload["work_reads"]
	if len(reads) != 1 || stringOf(reads[0]["finished_at"]) != "2026-02-02" {
		t.Errorf("read log carried: %+v", reads)
	}

	// The cover is PARKED, not deleted: it has left the cover store and is waiting
	// in the bin's corner of it.
	if e.Files == nil || e.Files[0] != cover {
		t.Fatalf("file list = %+v, want the cover", e.Files)
	}
	if _, err := os.Stat(filepath.Join(srv.coversDir(), cover)); !os.IsNotExist(err) {
		t.Error("the cover is still in the cover store; it should have moved")
	}
	if _, err := os.Stat(filepath.Join(srv.trashDir(), cover)); err != nil {
		t.Errorf("the cover was not parked: %v", err)
	}
}

func TestBinCarriesEveryColumnTheTableHas(t *testing.T) {
	// The claim that the snapshot reads its shape from the DATABASE rather than a
	// list written in Go. A hand-written list is the failure this guards: it stops
	// carrying the column added next release, and the loss only shows up months
	// later, on a restore, as a field quietly back at its default.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := createBook(t, c, "Sandworm Studies")
	c.mustDo("DELETE", "/books/"+itoa(bookID), nil, http.StatusOK)

	e := onlyTrashEntry(t, srv)
	row := e.Payload["books"][0]
	rows, err := srv.Store.DB.Query(`SELECT name FROM pragma_table_info('books')`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	missing := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		if _, ok := row[name]; !ok {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		t.Fatalf("the snapshot dropped %v — it must read its columns from the table", missing)
	}
}

func TestBinningSomebodyElsesItemIsNotFound(t *testing.T) {
	// The house rule: a foreign id answers 404, never 403, and the ownership
	// filter is in the same statement as the read rather than a check beside it.
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	bookID := createBook(t, admin, "The Dispossessed")
	annID := idOf(t, admin.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": "not yours"}, 201).Body.Bytes())

	bob.mustDo("DELETE", "/books/"+itoa(bookID), nil, http.StatusNotFound)
	bob.mustDo("DELETE", "/annotations/"+itoa(annID), nil, http.StatusNotFound)

	var binned int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM trash`).Scan(&binned); err != nil {
		t.Fatal(err)
	}
	if binned != 0 {
		t.Fatalf("a refused delete wrote %d bin entries", binned)
	}
	// And nothing was removed, which is the half a 404 does not prove on its own.
	var live int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM annotations WHERE id = ?`, annID).Scan(&live); err != nil {
		t.Fatal(err)
	}
	if live != 1 {
		t.Fatal("somebody else's quote was deleted")
	}
}

func TestDeleteReportsTheBinEntryItWrote(t *testing.T) {
	// The Undo in the toast posts this id back, so it rides on the delete response
	// rather than being looked up afterwards — two deletes in the same second
	// would otherwise be indistinguishable by time.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := createBook(t, c, "Sandworm Studies")

	var got struct {
		OK      bool  `json:"ok"`
		TrashID int64 `json:"trash_id"`
	}
	if err := json.Unmarshal(c.mustDo("DELETE", "/books/"+itoa(bookID), nil, http.StatusOK).Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if !got.OK || got.TrashID == 0 {
		t.Fatalf("delete response = %+v", got)
	}
	if want := onlyTrashEntry(t, srv).ID; got.TrashID != want {
		t.Fatalf("trash_id = %d, want %d", got.TrashID, want)
	}
}
