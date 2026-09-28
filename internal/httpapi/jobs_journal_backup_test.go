package httpapi

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"database/sql"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"
)

// AN ADMIN BACKS UP AND RESTORES, AND THE SERVER'S JOB HISTORY STAYS THE SERVER'S:
// the archive they download carries none of it, and the restore keeps what the
// server had, including what happened after the archive was made.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the journal
// tables' names and columns (jobs, job_logs, system_logs). It writes its rows
// through srv.Store.DB because no request can make them: one is a job reading
// running when the restore comes, which a server with a queue never lets happen
// (the restore waits for a running job to end), so this server stops its queue
// once the two archives are made — each is a queued job, as every backup is — and
// the row is written as a crash would leave it; and the marker it looks for has
// to sit in a job's subject, one of that job's lines and a request line, which
// keeps no value a request carries. It
// reads the tables inside each archive, opened with plaintextOf (this package's
// way of opening a sealed archive the way a person with the password would),
// because the claim is about the file the admin downloaded and nothing but
// opening it can show what its tables hold. What the server kept is read back
// through the API, as the reader and the admin see it once signed in again. The
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
	// Written at today's time, so the thirty days the API shows still hold them.
	now := time.Now().UnixMilli()
	exec(`INSERT INTO jobs (id, user_id, username, kind, subject, state, created_at, finished_at)
		VALUES (31, 1, 'alice', 'fill', ?, 'succeeded', ?, ?)`, archiveMarker+" subject", now, now)
	exec(`INSERT INTO job_logs (id, job_id, at, level, line) VALUES (501, 31, ?, 'info', ?)`, now, archiveMarker+" job line")
	exec(`INSERT INTO system_logs (id, at, level, line) VALUES (601, ?, 'request', ?)`, now, archiveMarker+" request line")

	// The kept archive, as the Server card's Download hands it over.
	backupNow(admin)
	kept := admin.mustDo("GET", "/admin/backup/download", nil, http.StatusOK).Body.Bytes()
	assertNoJournal(t, "the kept backup", plaintextOf(t, kept, testPw))

	// The safety copy the restore insists on first is an archive too.
	safety := admin.mustDo("POST", "/admin/backup/safety", map[string]string{"passphrase": "safety-copy-1"}, http.StatusOK).Body.Bytes()
	assertNoJournal(t, "the safety copy", plaintextOf(t, safety, "safety-copy-1"))

	// After the archives: bob starts a job that is still running when the restore
	// comes (the header's "this server stops its queue").
	unqueued(t, srv)
	const running = 132
	exec(`INSERT INTO jobs (id, user_id, username, kind, state, created_at, started_at)
		VALUES (?, ?, 'bob', 'covers', 'running', ?, ?)`, running, bobID, now, now)

	admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)

	// The restore signed everybody out; both are in the archive.
	signIn := func(name string) *testClient {
		c := &testClient{t: t, h: h}
		c.cookie = cookieOf(t, c.mustDo("POST", "/auth/login", map[string]string{"username": name, "password": testPw}, http.StatusOK))
		return c
	}
	alice, bob := signIn("alice"), signIn("bob")

	// The restore kept the server's history, not the archive's empty one — both
	// jobs, the one made after the archive included, under their own ids.
	type poll struct {
		Job   wireJob `json:"job"`
		Lines []struct {
			ID   int64  `json:"id"`
			Line string `json:"line"`
		} `json:"lines"`
	}
	// Four: the two written above, and the backup and the safety copy that made
	// the archives.
	if all := alice.jobs("view=past"); len(all.Jobs) != 4 || !slices.Contains(jobIDs(all.Jobs), 31) || !slices.Contains(jobIDs(all.Jobs), running) {
		t.Fatalf("past jobs after the restore: %v, want the server's four", jobIDs(all.Jobs))
	}
	finished := decode[poll](t, alice.mustDo("GET", "/jobs/31", nil, http.StatusOK))
	if j := finished.Job; j.State != "succeeded" || !j.Own {
		t.Fatalf("alice's finished job after the restore: %+v", j)
	}
	if l := finished.Lines; len(l) != 1 || l[0].ID != 501 || l[0].Line != archiveMarker+" job line" {
		t.Fatalf("alice's job's log after the restore: %+v, want its one line under its id", l)
	}
	// Bob is in the archive under the same id and name, so the job stays his; it
	// was running, and nothing resumes on its own.
	if j := bob.job(running); j.State != "interrupted" || !j.Own {
		t.Fatalf("bob's running job after the restore: %+v, want interrupted and still his", j)
	}
	carried := false
	for _, l := range alice.logs(url.Values{"all": {"1"}}).Lines {
		carried = carried || (l.ID == 601 && l.Line == archiveMarker+" request line")
	}
	if !carried {
		t.Fatal("the system log's line did not come through the restore under its id")
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
