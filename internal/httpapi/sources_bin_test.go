package httpapi

// THE BIN COVERS EVERYTHING, through the API only: delete a work that has a file attached,
// and Undo returns the work with its file, its stored context and its state.
//
// WHAT THIS KNOWS: the delete and restore routes, the bin list, PUT /sources and the
// context read. It looks at the Sources folder for the claims a response cannot make:
// that the bytes are parked while the entry is in the bin, back after Undo, and gone for
// good after a purge.

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func parkedSourceFiles(t *testing.T, srv *Server) int {
	t.Helper()
	ents, err := os.ReadDir(srv.sourceTrashDir())
	if err != nil {
		return 0
	}
	n := 0
	for _, e := range ents {
		if !e.IsDir() {
			n++
		}
	}
	return n
}

func liveSourceFiles(t *testing.T, srv *Server) int {
	t.Helper()
	n := 0
	for _, f := range sourceFilesOnDisk(t, srv) {
		if f != ".trash" {
			n++
		}
	}
	return n
}

func TestUndoBringsBackTheFileAndTheContextWithTheWork(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("Nineteen Eighty-Four")
	hl := c.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	c.putSource(sourceFields("book", book), "1984.txt", []byte(prose))
	if liveSourceFiles(t, srv) != 1 {
		t.Fatal("setup: one live file")
	}

	c.mustDo("DELETE", "/books/"+strconv.FormatInt(book, 10), nil, 200)
	if liveSourceFiles(t, srv) != 0 || parkedSourceFiles(t, srv) != 1 {
		t.Fatalf("in the bin the bytes are parked, not gone: live %d parked %d", liveSourceFiles(t, srv), parkedSourceFiles(t, srv))
	}
	entries := binOf(t, c).Trash
	if len(entries) != 1 {
		t.Fatalf("%+v", entries)
	}
	restore(t, c, entries[0].ID, 200)

	if liveSourceFiles(t, srv) != 1 || parkedSourceFiles(t, srv) != 0 {
		t.Fatalf("Undo must put the file back: live %d parked %d", liveSourceFiles(t, srv), parkedSourceFiles(t, srv))
	}
	got := decode[sourceAnswer](t, c.mustDo("GET", "/sources?subject=book&subject_id="+strconv.FormatInt(book, 10), nil, 200))
	if got.State != "file" || len(got.Sources) != 1 || got.Sources[0].Name != "1984.txt" {
		t.Fatalf("the source row comes back: %+v", got)
	}
	// What was read from the file comes back too, and opens.
	if ctx := c.contextOf("annotation", hl); !strings.Contains(ctx.Body, "clocks were striking thirteen") {
		t.Fatalf("the stored context comes back with the quote: %+v", ctx)
	}
	// And a rescan against the restored file still works, which proves the BYTES are the file.
	c.mustDo("POST", "/sources/"+strconv.FormatInt(got.Sources[0].ID, 10)+"/rescan", nil, 200)
}

func TestPurgingAnEntryRemovesItsParkedFileForGood(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))
	c.mustDo("DELETE", "/books/"+strconv.FormatInt(book, 10), nil, 200)
	entry := binOf(t, c).Trash[0]
	if parkedSourceFiles(t, srv) != 1 {
		t.Fatal("setup")
	}
	backdate(t, srv, entry.ID, 400)
	srv.PurgeTrash()
	if parkedSourceFiles(t, srv) != 0 || liveSourceFiles(t, srv) != 0 {
		t.Fatalf("an expired entry takes its file with it: parked %d live %d", parkedSourceFiles(t, srv), liveSourceFiles(t, srv))
	}
}

func TestEmptyingTheBinRemovesParkedFilesToo(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))
	c.mustDo("DELETE", "/books/"+strconv.FormatInt(book, 10), nil, 200)
	c.mustDo("DELETE", "/trash", nil, 200)
	if parkedSourceFiles(t, srv) != 0 {
		t.Fatal("emptying the bin must remove what it parked")
	}
}

func TestAParkedFileNoEntryNamesIsSweptAndOneAnEntryNamesIsKept(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))
	c.mustDo("DELETE", "/books/"+strconv.FormatInt(book, 10), nil, 200)
	stray := filepath.Join(srv.sourceTrashDir(), "0123456789abcdef")
	if err := os.WriteFile(stray, []byte("orphan"), 0o600); err != nil {
		t.Fatal(err)
	}
	srv.sweepOrphanParked()
	if _, err := os.Stat(stray); !os.IsNotExist(err) {
		t.Fatal("a parked file no entry names should be swept")
	}
	if parkedSourceFiles(t, srv) != 1 {
		t.Fatalf("the file an entry names must be kept: %d", parkedSourceFiles(t, srv))
	}
}

func TestABulkDeleteIsRestoredWithItsFilesAsOneEntry(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	a, b := c.newBook("One"), c.newBook("Two")
	c.putSource(sourceFields("book", a), "a.txt", []byte(prose))
	c.putSource(sourceFields("book", b), "b.txt", []byte(prose+"\nanother"))
	c.mustDo("POST", "/books/bulk/delete", map[string]any{"ids": []int64{a, b}, "confirm": bulkDeletePhrase("book", 2)}, 200)
	if parkedSourceFiles(t, srv) != 2 {
		t.Fatalf("parked %d", parkedSourceFiles(t, srv))
	}
	restore(t, c, binOf(t, c).Trash[0].ID, 200)
	if liveSourceFiles(t, srv) != 2 || parkedSourceFiles(t, srv) != 0 {
		t.Fatalf("both files come back with their works: live %d parked %d", liveSourceFiles(t, srv), parkedSourceFiles(t, srv))
	}
}

func TestAMountedSourceComesBackWithItsWorkAsARowAndTheMountIsUntouched(t *testing.T) {
	srv, c, root, film, _, _ := mountFixture(t)
	line := c.newLine(film, "Governments should be afraid of their people.", nil)
	for _, cand := range c.scan("").Candidates {
		if cand.WorkID == film && cand.Subject == "screen" {
			c.mustDo("POST", "/sources/attach-found", map[string]any{"bucket": cand.Bucket, "tokens": []string{cand.Token}}, 200)
		}
	}
	c.mustDo("DELETE", "/movies/"+strconv.FormatInt(film, 10), nil, 200)
	if parkedSourceFiles(t, srv) != 0 {
		t.Fatal("a mounted file has no bytes of ours to park")
	}
	restore(t, c, binOf(t, c).Trash[0].ID, 200)
	got := decode[sourceAnswer](t, c.mustDo("GET", "/sources?subject=screen&subject_id="+strconv.FormatInt(film, 10), nil, 200))
	if got.State != "mounted" || got.Sources[0].Origin != "mount" {
		t.Fatalf("%+v", got)
	}
	if ctx := c.contextOf("dialogue", line); ctx.Body == "" {
		t.Fatalf("%+v", ctx)
	}
	if _, err := os.Stat(filepath.Join(root, "movies")); err != nil {
		t.Fatalf("nothing under the mount may be touched: %v", err)
	}
}

func TestADeletedAccountIsRestoredWithItsFiles(t *testing.T) {
	srv := newTestServer(t)
	admin := signupAdmin(t, srv.Handler())
	cara := addUser(t, srv.Handler(), admin, "cara")
	book := cara.newBook("Hers")
	cara.putSource(sourceFields("book", book), "h.txt", []byte(prose))
	var id int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'cara'`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	admin.mustDo("DELETE", "/admin/users/"+strconv.FormatInt(id, 10), nil, http.StatusOK)
	if parkedSourceFiles(t, srv) != 1 || liveSourceFiles(t, srv) != 0 {
		t.Fatalf("an account's files are parked with its entry: parked %d live %d", parkedSourceFiles(t, srv), liveSourceFiles(t, srv))
	}
	var entry trashRow
	for _, e := range binOf(t, admin).Trash {
		if e.Kind == "account" {
			entry = e
		}
	}
	if entry.ID == 0 {
		t.Fatal("no account entry in the bin")
	}
	restore(t, admin, entry.ID, 200)
	if liveSourceFiles(t, srv) != 1 || parkedSourceFiles(t, srv) != 0 {
		t.Fatalf("restoring the account returns its files: live %d parked %d", liveSourceFiles(t, srv), parkedSourceFiles(t, srv))
	}
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM work_sources`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("rows = %d (%v)", n, err)
	}
}
