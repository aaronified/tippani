package httpapi

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/outbound"
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
//
// And for the waiting job a Stop reached before its row could say so: the
// journey tier's seam TIPPANI_JOBS_HOLD (with TIPPANI_OFFLINE, which it needs),
// so the job is still waiting when the restore comes, since offline it would have
// run in milliseconds; and a write of the test's own on srv.Store.DB holding
// SQLite's lock while Stop is pressed, as a running import's transaction holds it,
// which is what leaves the Stop in the queue's memory with its row still owed.

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
	safety := takeSafetyCopy(t, admin, map[string]string{"passphrase": "safety-copy-1"})
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

// A WAITING JOB A STOP STOPPED READS STOPPED AFTER A RESTORE, NOT INTERRUPTED, when
// the Stop answered before its row could say so. The reader was told stopped —
// the press's own answer, and every read of the queue after it — and a restore
// that carried the row on as it was, still waiting, turned it into a job the
// restore interrupted.
//
// Mutation: the swap's write of the held rows (internal/jobs writeHeldBeforeSwap)
// made to do nothing: red, the job reads interrupted.
func TestAWaitingJobAStopStoppedReadsStoppedAfterARestore(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	backupNow(admin)
	safetyBackup(t, admin)

	t.Setenv(outbound.EnvVar, "1")
	t.Setenv(jobs.HoldEnv, "1")
	w := admin.mustStart("test.hold", map[string]any{"tag": "waiting"})
	tx, err := srv.Store.DB.Begin() // _txlock=immediate: the lock is taken here
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'info', 'somebody else')`, time.Now().UnixMilli()); err != nil {
		t.Fatal(err)
	}
	pressed := time.Now().UnixMilli()
	stopped := decode[struct {
		Job wireJob `json:"job"`
	}](t, admin.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", w.ID), nil, http.StatusOK)).Job
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}
	if stopped.State != "stopped" {
		t.Fatalf("the Stop's own answer reads the job %s", stopped.State)
	}
	var row string
	if err := srv.Store.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, w.ID).Scan(&row); err != nil || row != "queued" {
		t.Fatalf("the stopped job's row reads %q (%v) before the restore; the test needs it still owed", row, err)
	}
	// Its line written before the restore: a line still in the buffer when the
	// files are swapped is not this test's subject.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Logbook.Flush(ctx); err != nil {
		t.Fatal(err)
	}

	admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)
	again := &testClient{t: t, h: h}
	again.cookie = cookieOf(t, again.mustDo("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw}, http.StatusOK))

	got := again.job(w.ID)
	if got.State != "stopped" {
		t.Fatalf("after the restore the job its Stop stopped reads %s", got.State)
	}
	if got.FinishedAt == nil || *got.FinishedAt < pressed || *got.FinishedAt > pressed+5000 {
		t.Fatalf("it reads stopped at %v, want the moment of the press (%d)", got.FinishedAt, pressed)
	}
	if got.StartedAt != nil {
		t.Fatalf("the stopped job was started: %+v", got)
	}
	saying(t, jobLines(again, w.ID), "alice stopped it before it started")
}

// A JOB A RESTORE CARRIED OVER IS HISTORY: IT IS READ, AND NOTHING ACTS ON IT AGAIN.
// Its params name the replaced library's rows by id — the works a fill was
// given, the records a people fetch, the fields an apply writes, the staged
// quotes and batch bound an approval took — and in the restored library the same
// ids can be other rows. So after the restore none of the jobs from before it is
// offered Run again, or run again when asked, whatever its kind; a check's
// findings are not reviewed against the restored rows, nor applied in its name;
// an import stopped before the restore lets go of its upload, which nothing can
// run again; and a job made after the restore is its own, offered Run again as
// any is. Before the restore every one of them was offered Run again, which is
// what makes the after half mean something.
//
// Beyond the header: a finished job of each of the other kinds is written into
// the journal as its run leaves it (interrupted, or succeeded for the check,
// with the findings its run stores), since a real run of each goes to the
// suppliers; the import is a real upload, stopped while it waited behind the
// test's own job (queueing).
//
// Mutation: the carry's mark (store.CarriedThroughKey) not written: red, every
// job from before the restore is offered Run again.
func TestAJobARestoreCarriedOverIsNotRunAgainOrReviewed(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	book := decode[struct {
		ID int64 `json:"id"`
	}](t, admin.mustDo("POST", "/books", map[string]any{"title": "Dune", "author": "Frank Herbert"}, http.StatusCreated)).ID
	backupNow(admin)
	safetyBackup(t, admin)
	uid := accountID(t, admin, "alice")

	now := time.Now().UnixMilli()
	write := func(kind, state, params, result, counts string) int64 {
		t.Helper()
		var id int64
		if err := srv.Store.DB.QueryRow(`INSERT INTO jobs (user_id, username, kind, state, params, result, counts, created_at, started_at, finished_at)
			VALUES (?, 'alice', ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`, uid, kind, state, params, result, counts, now, now, now).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	item := fmt.Sprintf(`{"type":"book","id":%d,"set":{"description":"A desert planet."}}`, book)
	before := map[string]int64{
		"fill":           write("fill", "interrupted", fmt.Sprintf(`{"book_ids":[%d],"movie_ids":[]}`, book), "", "{}"),
		"covers":         write("covers", "interrupted", `{"missing_only":false}`, "", "{}"),
		"people":         write("people", "interrupted", `{"ids":[1]}`, "", "{}"),
		"reverify-apply": write("reverify-apply", "interrupted", `{"items":[`+item+`]}`, "", "{}"),
		"backup":         write("backup", "interrupted", `{}`, "", "{}"),
		"import.approve": write("import.approve", "interrupted", `{"all":true,"through":1}`, "", "{}"),
		"reverify": write("reverify", "succeeded", fmt.Sprintf(`{"book_ids":[%d],"movie_ids":[],"people":[],"fills_only":false}`, book),
			fmt.Sprintf(`[{"type":"book","id":%d,"title":"Dune","status":"ok","diffs":[{"field":"description","stored":"","fresh":"A desert planet."}]}]`, book),
			`{"items":1,"changes":1}`),
	}
	// The import: waiting behind the test's own job, stopped there, its upload kept.
	ahead := admin.mustStart("test.hold", map[string]any{"tag": "ahead"})
	admin.waitJob(ahead.ID, "running")
	imp := queuedJob(t, admin.uploadOnly("/import/markdown", "sandworm.md", []byte(stagedBookMD)))
	admin.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", imp.ID), nil, http.StatusOK)
	q.let()
	admin.waitJob(ahead.ID, "succeeded")
	before["import"] = imp.ID

	for kind, id := range before {
		if j := admin.job(id); !j.Rerunnable || j.Carried {
			t.Fatalf("before the restore, the %s job is %+v; the test needs it offered Run again", kind, j)
		}
	}
	admin.mustDo("GET", fmt.Sprintf("/jobs/%d/result", before["reverify"]), nil, http.StatusOK)
	if left := spooled(t, srv); len(left) != 1 {
		t.Fatalf("the spool before the restore: %v, want the stopped import's upload", left)
	}

	admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)
	again := &testClient{t: t, h: h}
	again.cookie = cookieOf(t, again.mustDo("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw}, http.StatusOK))

	for kind, id := range before {
		j := again.job(id)
		if !j.Own || !j.Carried || j.Rerunnable {
			t.Errorf("after the restore, the %s job from before it is %+v; want still alice's, carried, and not offered Run again", kind, j)
		}
		// A backup's rerun asks for the password again; the answer is the same.
		if rec := again.do("POST", fmt.Sprintf("/jobs/%d/rerun", id), map[string]any{"password": testPw}); rec.Code != http.StatusConflict {
			t.Errorf("Run again on the %s job from before the restore: %d %s, want 409", kind, rec.Code, rec.Body)
		}
	}
	if rec := again.do("GET", fmt.Sprintf("/jobs/%d/result", before["reverify"]), nil); rec.Code != http.StatusConflict ||
		!bytes.Contains(rec.Body.Bytes(), []byte("before the library was restored")) {
		t.Fatalf("the review of a check from before the restore: %d %s, want it refused", rec.Code, rec.Body)
	}
	if rec := again.startJob("reverify-apply", map[string]any{"items": []json.RawMessage{json.RawMessage(item)}, "from_job": before["reverify"]}); rec.Code != http.StatusBadRequest {
		t.Fatalf("an apply in the name of a check from before the restore: %d %s, want 400", rec.Code, rec.Body)
	}
	if left := spooled(t, srv); len(left) != 0 {
		t.Fatalf("the spool after the restore: %v, want the carried import's upload gone", left)
	}

	// A job made after the restore is offered Run again as any is.
	after := again.jobEnded(again.mustStart("test.fail", map[string]any{"tag": "after"}).ID)
	if after.Carried || !after.Rerunnable {
		t.Fatalf("a job made after the restore: %+v, want its own and offered Run again", after)
	}
	again.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", after.ID), nil, http.StatusAccepted)
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
