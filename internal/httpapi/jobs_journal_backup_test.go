package httpapi

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"database/sql"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

// AN ADMIN BACKS UP AND RESTORES, AND THE SERVER'S JOB HISTORY STAYS THE SERVER'S:
// the archive they download carries none of it, and the restore keeps what the
// server had, including what happened after the archive was made.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the journal
// tables' names and columns (jobs, job_logs, system_logs), which it writes and
// reads through srv.Store.DB because no endpoint creates or lists a job yet; and
// plaintextOf, this package's way of opening a sealed archive the way a person
// with the password would, so the test can look inside what was downloaded. The
// backups, the download, the safety copy and the restore are driven through the
// API as an admin drives them. The owner rules the carry-over applies are tested
// one by one in internal/store; this is the path they run on.

// A string nothing else in a library contains, so finding it in an archive's
// bytes means a journal row rode along.
const archiveMarker = "Wv-archive-journal-marker-5540"

func TestABackupLeavesTheJobHistoryBehindAndARestoreKeepsTheServersOwn(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	addUser(t, h, admin, "bob")
	var bobID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'bob'`).Scan(&bobID); err != nil {
		t.Fatal(err)
	}
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	exec(`INSERT INTO jobs (id, user_id, username, kind, subject, state, created_at, finished_at)
		VALUES (31, 1, 'alice', 'fill', ?, 'succeeded', 1, 2)`, archiveMarker+" subject")
	exec(`INSERT INTO job_logs (id, job_id, at, level, line) VALUES (501, 31, 1, 'info', ?)`, archiveMarker+" job line")
	exec(`INSERT INTO system_logs (id, at, level, line) VALUES (601, 1, 'request', ?)`, archiveMarker+" request line")

	// The kept archive, as the Server card's Download hands it over.
	backupNow(admin)
	kept := admin.mustDo("GET", "/admin/backup/download", nil, http.StatusOK).Body.Bytes()
	assertNoJournal(t, "the kept backup", plaintextOf(t, kept, testPw))

	// After the archive: bob starts a job that is still running when the restore
	// comes.
	exec(`INSERT INTO jobs (id, user_id, username, kind, state, created_at, started_at)
		VALUES (32, ?, 'bob', 'covers', 'running', 3, 4)`, bobID)

	// The safety copy the restore insists on first is an archive too.
	safety := admin.mustDo("POST", "/admin/backup/safety", map[string]string{"passphrase": "safety-copy-1"}, http.StatusOK).Body.Bytes()
	assertNoJournal(t, "the safety copy", plaintextOf(t, safety, "safety-copy-1"))

	admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)

	// The restore kept the server's history, not the archive's empty one — both
	// jobs, the one made after the archive included, under their own ids.
	type row struct {
		owner sql.NullInt64
		state string
	}
	got := map[int64]row{}
	rows, err := srv.Store.DB.Query(`SELECT id, user_id, state FROM jobs`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var id int64
		var r row
		if err := rows.Scan(&id, &r.owner, &r.state); err != nil {
			t.Fatal(err)
		}
		got[id] = r
	}
	rows.Close()
	if len(got) != 2 {
		t.Fatalf("jobs after the restore: %+v, want the server's two", got)
	}
	if r := got[31]; r.state != "succeeded" || r.owner.Int64 != 1 {
		t.Fatalf("alice's finished job after the restore: %+v", r)
	}
	// Bob is in the archive under the same id and name, so the job stays his; it
	// was running, and nothing resumes on its own.
	if r := got[32]; r.state != "interrupted" || r.owner.Int64 != bobID {
		t.Fatalf("bob's running job after the restore: %+v, want interrupted and still his", r)
	}
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT (SELECT count(*) FROM job_logs WHERE id = 501 AND job_id = 31)
		+ (SELECT count(*) FROM system_logs WHERE id = 601)`).Scan(&n); err != nil || n != 2 {
		t.Fatalf("log lines kept through the restore with their ids: %d of 2 (%v)", n, err)
	}
}

// assertNoJournal opens the database inside a plaintext archive and checks that
// no journal row, and no byte of one, came along.
func assertNoJournal(t *testing.T, what string, plain []byte) {
	t.Helper()
	gz, err := gzip.NewReader(bytes.NewReader(plain))
	if err != nil {
		t.Fatalf("%s: gunzip: %v", what, err)
	}
	tr := tar.NewReader(gz)
	var dbBytes []byte
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("%s: tar: %v", what, err)
		}
		if hdr.Name == "tippani.db" {
			if dbBytes, err = io.ReadAll(tr); err != nil {
				t.Fatal(err)
			}
		}
	}
	if dbBytes == nil {
		t.Fatalf("%s: no tippani.db in the archive", what)
	}
	if bytes.Contains(dbBytes, []byte(archiveMarker)) {
		t.Fatalf("%s: the archive's database holds journal text", what)
	}
	path := filepath.Join(t.TempDir(), "tippani.db")
	if err := os.WriteFile(path, dbBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("sqlite", "file:"+path+"?mode=ro")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, table := range []string{"jobs", "job_logs", "system_logs"} {
		var n int
		if err := db.QueryRow(`SELECT count(*) FROM ` + table).Scan(&n); err != nil || n != 0 {
			t.Fatalf("%s: %s holds %d row(s) (%v)", what, table, n, err)
		}
	}
}
