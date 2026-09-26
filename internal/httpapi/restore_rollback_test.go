package httpapi

import (
	"bytes"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"testing"
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
