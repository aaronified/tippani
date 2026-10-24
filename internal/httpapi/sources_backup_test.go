package httpapi

// The backup half of a work's source file: what the archive carries, who may
// change that, and what a restore says it did not get. Through the API only.
// It shares sources_test.go's helpers.

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func sourceEntries(names []string) int {
	n := 0
	for _, name := range names {
		if strings.HasPrefix(name, "Sources/") && !strings.HasSuffix(name, "/") {
			n++
		}
	}
	return n
}

func archiveOf(t *testing.T, srv *Server, ka keptArchive) []string {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(srv.backupsDir(), ka.Name))
	if err != nil {
		t.Fatal(err)
	}
	return tarNames(t, plaintextOf(t, raw, testPw))
}

func TestABackupCarriesSourceFilesOnlyWhenAsked(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("Star Wars", "movie")
	c.putSource(sourceFields("screen", film), "a.srt", []byte(srtSample))

	if got := decode[map[string]bool](t, c.mustDo("GET", "/admin/backup/sources", nil, 200)); got["include"] {
		t.Fatal("the default is off")
	}
	if n := sourceEntries(archiveOf(t, srv, backupNow(c))); n != 0 {
		t.Fatalf("default archive carried %d source files", n)
	}
	c.mustDo("PUT", "/admin/backup/sources", map[string]any{"include": true}, 200)
	if n := sourceEntries(archiveOf(t, srv, backupNow(c))); n != 1 {
		t.Fatalf("with the setting on the archive should carry the file, got %d", n)
	}
	c.mustDo("PUT", "/admin/backup/sources", map[string]any{"include": false}, 200)
	if n := sourceEntries(archiveOf(t, srv, backupNow(c))); n != 0 {
		t.Fatalf("switched back off, got %d", n)
	}
	c.mustDo("PUT", "/admin/backup/sources", map[string]any{}, http.StatusBadRequest)
}

func TestTheBackupSettingIsTheAdminsAlone(t *testing.T) {
	srv := newTestServer(t)
	admin := signupAdmin(t, srv.Handler())
	cara := addUser(t, srv.Handler(), admin, "cara")
	cara.mustDo("GET", "/admin/backup/sources", nil, http.StatusForbidden)
	cara.mustDo("PUT", "/admin/backup/sources", map[string]any{"include": true}, http.StatusForbidden)
}

func TestARestoreSaysWhichSourcesTheArchiveDidNotCarry(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("Star Wars", "movie")
	book := c.newBook("Dust of Dreams")
	c.putSource(sourceFields("screen", film), "a.srt", []byte(srtSample))
	c.putSource(sourceFields("book", book), "d.txt", []byte("prose"))
	backupNow(c) // default: the rows travel, the files do not
	safetyBackup(t, c)

	rec := c.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, 200)
	var got struct {
		Missing int             `json:"sources_missing"`
		List    []missingSource `json:"sources_missing_list"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Missing != 2 || len(got.List) != 2 {
		t.Fatalf("the restore should name both works whose file it lacks: %s", rec.Body)
	}
	titles := got.List[0].Title + "|" + got.List[1].Title
	if !strings.Contains(titles, "Star Wars") || !strings.Contains(titles, "Dust of Dreams") {
		t.Fatalf("missing sources are named by work: %s", titles)
	}
}

