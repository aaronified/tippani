package httpapi

import (
	"bytes"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"tippani/internal/store"
)

// A RESTORE THAT CANNOT MOVE THE CURRENT DATA OUT OF THE WAY LEAVES IT WHERE IT IS.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the data
// dir's layout, and that the restore moves its top-level entries aside in name
// order — so a directory named before the database that cannot be renamed stops
// the move partway, with some entries aside and the database still in place. It
// makes that directory unrenamable with its mode (a directory whose '..' cannot
// be updated cannot change parents), because nothing a person does over HTTP can
// make one rename fail; on a real server the same thing is a mount point in the
// data dir, or a directory another user owns. Everything else is the API an admin
// uses: a backup, the safety copy, the restore, and the library afterwards.

func TestARestoreThatCannotMoveTheDataAsideLeavesTheLibraryWhereItIs(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("a directory's mode does not stop a rename on Windows")
	}
	if os.Geteuid() == 0 {
		t.Skip("root renames a directory whatever its mode")
	}
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("POST", "/books", map[string]any{"title": "Original", "author": "Keeper"}, 201)
	backupNow(admin)
	// Written after the backup, so it is in the live library and not the archive.
	admin.mustDo("POST", "/books", map[string]any{"title": "Written After The Backup", "author": "Keeper"}, 201)

	// A translation the operator added: named before MediaCover, so the move takes
	// it aside before it stops, and the rollback has to bring it back.
	translation := filepath.Join(srv.DataDir, "Locales", "fr.txt")
	if err := os.MkdirAll(filepath.Dir(translation), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(translation, []byte("# fr\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	cover := "aabbccdd00112233.png"
	if err := os.WriteFile(filepath.Join(srv.coversDir(), cover), pngHeader, 0o600); err != nil {
		t.Fatal(err)
	}
	// Named before the database (test.db), and not movable.
	if err := os.Chmod(srv.coversDir(), 0o500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.Chmod(srv.coversDir(), 0o700) })

	safetyBackup(t, admin)
	rec := admin.do("POST", "/admin/restore", map[string]any{"password": testPw})
	if rec.Code != http.StatusInternalServerError || !bytes.Contains(rec.Body.Bytes(), []byte("previous data is intact")) {
		t.Fatalf("a restore that could not move the data aside: %d %s", rec.Code, rec.Body)
	}
	if err := os.Chmod(srv.coversDir(), 0o700); err != nil {
		t.Fatal(err)
	}

	// The same session still works, on the same library: not the archive's, and
	// not an empty database made where the library was.
	books := admin.mustDo("GET", "/books", nil, http.StatusOK).Body.Bytes()
	if !bytes.Contains(books, []byte("Written After The Backup")) || !bytes.Contains(books, []byte("Original")) {
		t.Fatalf("the library after the failed restore: %s", books)
	}
	admin.mustDo("GET", "/covers/"+cover, nil, http.StatusOK)
	if _, err := os.Stat(translation); err != nil {
		t.Fatalf("what the move had taken aside is not back: %v", err)
	}
}

// A SWEEP OF THE UPLOAD SPOOL MADE WHILE THE FILES ARE BEING SWAPPED TAKES NOTHING.
// Every upload sweeps the spool before it spools its own file, and an upload
// can come in while a restore is swapping the files. Between the move and the
// carry-over the pool is open on the restored file, whose journal is empty (every
// archive is stripped), so a sweep that read the jobs then found no import naming
// any upload and removed every one. A restore that then failed put the old file
// back, whose stopped import was still offered Run again and whose waiting
// imports would run, with their uploads gone.
//
// WHAT IT KNOWS, declared: the store's own Swap and StripJournal, because nothing
// over HTTP makes a restore fail after its move; the swap here brings in this
// library with its journal stripped, as a restore brings in an archive, and its
// after step (the carry-over's place) runs the sweep an upload runs and then
// fails, so the old file comes back. And the spool's place (spooled), as
// import_jobs_test.go declares it.
//
// Mutation: sweepSpool reading the jobs on the store's pool outside
// Store.TrySteady, as it did: red, the upload is gone.
func TestASweepMadeWhileTheFilesAreSwappedRemovesNoUpload(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	admin := signupAdmin(t, srv.Handler())

	// An import stopped while it waited, its upload kept for Run again.
	ahead := admin.mustStart("test.hold", map[string]any{"tag": "ahead"})
	admin.waitJob(ahead.ID, "running")
	imp := queuedJob(t, admin.uploadOnly("/import/markdown", "sandworm.md", []byte(stagedBookMD)))
	admin.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", imp.ID), nil, http.StatusOK)
	q.let()
	admin.waitJob(ahead.ID, "succeeded")
	if left := spooled(t, srv); len(left) != 1 {
		t.Fatalf("the spool before the swap: %v, want the stopped import's upload", left)
	}

	live := srv.Store.Path()
	work := t.TempDir()
	restored := filepath.Join(work, "restored.db")
	if _, err := srv.Store.DB.Exec(`VACUUM INTO ?`, restored); err != nil {
		t.Fatal(err)
	}
	if err := store.StripJournal(restored); err != nil {
		t.Fatal(err)
	}
	aside := filepath.Join(work, "aside.db")
	suffixes := []string{"", "-wal", "-shm"}
	failed := errors.New("the restored library would not come up")
	err := srv.Jobs.Exclusive(func() error {
		return srv.Store.Swap(
			func() error {
				for _, suf := range suffixes {
					if err := os.Rename(live+suf, aside+suf); err != nil && !os.IsNotExist(err) {
						return err
					}
				}
				return os.Rename(restored, live)
			},
			func(error) error {
				for _, suf := range suffixes {
					if err := os.Remove(live + suf); err != nil && !os.IsNotExist(err) {
						return err
					}
					if err := os.Rename(aside+suf, live+suf); err != nil && !os.IsNotExist(err) {
						return err
					}
				}
				return nil
			},
			func(*sql.DB) error {
				srv.sweepSpool()
				return failed
			},
		)
	})
	srv.rebindDB()
	if !errors.Is(err, failed) {
		t.Fatalf("the swap answered %v, want the after step's failure, rolled back", err)
	}
	if left := spooled(t, srv); len(left) != 1 {
		t.Fatalf("the spool after a sweep made mid-swap and the rollback: %v, want the stopped import's upload", left)
	}
	if j := admin.job(imp.ID); j.State != "stopped" || !j.Rerunnable {
		t.Fatalf("the stopped import after the rollback: %+v, want it still offered Run again", j)
	}
}
