package httpapi

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"net/url"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

// THE SAFETY COPY A RESTORE OR A RESET TAKES FIRST IS A QUEUED JOB, AND ITS FILE
// IS HANDED OVER ONCE.
//
// The owner, on restore and reset: an admin "must take a backup and download it
// before this can be done", and, of the queue, that "every backup" queues. So the
// copy waits its turn like any job, is sealed beside the backups and never among
// them, and is downloaded once, by the admin whose job sealed it, within a few
// minutes; the restore and the reset go only once that download has finished.
//
// WHAT IT KNOWS, declared because a test here may not know the code:
//   - the queue is given to the server as serve() gives it (queueing,
//     jobs_api_test.go), and a job of the test's own (test.hold) holds it, so the
//     copy waits behind a running job as it would behind somebody's long fill;
//   - the data directory (srv.DataDir) and its backups folder, walked for the
//     copy's file: that the copy is never among the backups, and that nothing of
//     it is left once it has been downloaded or let go of, are claims about the
//     disk that no answer of the API can make;
//   - how long a copy waits for its download (safetyCopyTTL), shortened in the one
//     test that waits it out, so that test takes a fraction of a second and not
//     five minutes;
//   - the start's sweep, CleanupBackupStaging, called as serve() calls it before
//     the first request, since no request restarts the server;
//   - the archive is opened with the test's own reader of the format (openSealed,
//     backup_test.go), as a person with the password would open it;
//   - the wire field names, which are the contract the prompts are built to.
//
// What each one guards, in a sentence a person would say: the copy I ask for
// waits its turn and says so, is refused at once when my password is wrong, is
// one job however often I press, and lets nothing go ahead until I have it; it is
// not a backup — the Server card does not list it and a restore does not restore
// it; only I can download it, only once, and nothing of it stays on the server
// after, nor its token in the log; one I never fetched goes when its time is up,
// or when I take another, or when the server restarts; a restore or a reset,
// or my account's deletion, takes every copy still waiting with it; and a tool
// that only asks the download's size (a HEAD) spends nothing and lets nothing go.

// dataFiles is every file under the data directory whose name begins with
// prefix, relative to it.
func dataFiles(t *testing.T, srv *Server, prefix string) []string {
	t.Helper()
	var out []string
	err := filepath.WalkDir(srv.DataDir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if strings.HasPrefix(d.Name(), prefix) {
			rel, _ := filepath.Rel(srv.DataDir, p)
			out = append(out, rel)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func TestASafetyCopyIsQueuedNeverKeptAndDownloadedOnceByItsAdmin(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	promote(t, alice, userIDNamed(t, alice, "bob"))
	carol := addUser(t, h, alice, "carol")
	anon := &testClient{t: t, h: h}

	alice.mustDo("POST", "/books", map[string]any{"title": "Kept", "author": "Someone"}, http.StatusCreated)
	kept := backupNow(alice)
	alice.mustDo("POST", "/books", map[string]any{"title": "After", "author": "Someone"}, http.StatusCreated)

	ahead := alice.mustStart("test.hold", map[string]any{"tag": "ahead"})
	alice.waitJob(ahead.ID, "running")

	// REFUSED AT ONCE, however long the queue: no credential, a password that is
	// not hers, and a reader asking at all.
	alice.mustDo("POST", "/admin/backup/safety", nil, http.StatusBadRequest)
	alice.mustDo("POST", "/admin/backup/safety", map[string]string{"password": "not-it-at-all"}, http.StatusUnauthorized)
	carol.mustDo("POST", "/admin/backup/safety", map[string]string{"password": testPw}, http.StatusForbidden)
	// And never through POST /jobs: the copy is the prompts' step, asked for at its
	// own address.
	if rec := alice.startJob("backup.safety", map[string]string{"password": testPw}); rec.Code != http.StatusBadRequest {
		t.Fatalf("a safety copy through POST /jobs: %d %s, want 400", rec.Code, rec.Body)
	}

	// IT WAITS ITS TURN, and a second press is the same copy.
	started := decode[struct {
		Job wireJob `json:"job"`
	}](t, alice.mustDo("POST", "/admin/backup/safety", map[string]string{"password": testPw}, http.StatusAccepted)).Job
	if started.Kind != "backup.safety" || !started.Queued || started.State != "queued" || started.Ahead != 1 {
		t.Fatalf("the safety copy answered %+v, want it waiting behind the one job running", started)
	}
	again := alice.do("POST", "/admin/backup/safety", map[string]string{"password": testPw})
	if again.Code != http.StatusConflict || decode[struct {
		JobID int64 `json:"job_id"`
	}](t, again).JobID != started.ID {
		t.Fatalf("the copy asked for again while it waits: %d %s, want 409 naming #%d", again.Code, again.Body, started.ID)
	}
	// Nothing destructive goes on a copy asked for.
	alice.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusPreconditionRequired)

	q.let()
	if end := alice.jobEnded(started.ID); end.State != "succeeded" || end.Rerunnable {
		t.Fatalf("the safety copy's job ended %+v, want succeeded and not offered Run again", end)
	}
	ready := decode[struct {
		Result safetyReady `json:"result"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/jobs/%d/result", started.ID), nil, http.StatusOK)).Result
	now := time.Now()
	if !strings.HasSuffix(ready.Name, "-safety-copy"+backupExt) || ready.Size == 0 || !strings.HasPrefix(ready.URL, "/admin/backup/safety/") ||
		ready.ExpiresAt <= now.UnixMilli() || ready.ExpiresAt > now.Add(safetyCopyTTL).UnixMilli() {
		t.Fatalf("the safety copy's result: %+v", ready)
	}

	// IT IS NOT A BACKUP. The Server card names the archive it named before, the
	// backups folder holds that one alone, and the copy's file waits outside it.
	if card := decode[backupMetaResp](t, alice.mustDo("GET", "/admin/backup", nil, http.StatusOK)); card.Backup == nil || *card.Backup != kept {
		t.Fatalf("the Server card after the copy: %+v, want %+v", card.Backup, kept)
	}
	if names := listBackups(t, srv); !slices.Equal(names, []string{kept.Name}) {
		t.Fatalf("the backups folder after the copy: %v, want %s alone", names, kept.Name)
	}
	if files := dataFiles(t, srv, ".safety-"); len(files) != 1 || strings.Contains(files[0], string(filepath.Separator)) {
		t.Fatalf("the copy waiting for its download: %v, want one file at the top of the data directory", files)
	}

	// ONLY ITS ADMIN. Another admin and a reader are told there is no such copy,
	// and nobody without a session is let in at all; none of them spends it.
	bob.mustDo("GET", ready.URL, nil, http.StatusNotFound)
	carol.mustDo("GET", ready.URL, nil, http.StatusNotFound)
	anon.mustDo("GET", ready.URL, nil, http.StatusUnauthorized)
	alice.mustDo("GET", "/admin/backup/safety/"+strings.Repeat("0", 32), nil, http.StatusNotFound)

	rec := alice.mustDo("GET", ready.URL, nil, http.StatusOK)
	if cd := rec.Header().Get("Content-Disposition"); !strings.Contains(cd, "attachment") || !strings.Contains(cd, ready.Name) {
		t.Fatalf("the copy's download is named %q, want an attachment called %s", cd, ready.Name)
	}
	if int64(rec.Body.Len()) != ready.Size {
		t.Fatalf("the copy downloaded %d bytes, its job said %d", rec.Body.Len(), ready.Size)
	}
	names := tarNames(t, plaintextOf(t, rec.Body.Bytes(), testPw))
	if !slices.Contains(names, "tippani.db") {
		t.Fatalf("the copy holds %v, want the library's database", names)
	}
	for _, n := range names {
		if strings.HasPrefix(n, ".safety-") || strings.HasPrefix(n, backupsDirName+"/") {
			t.Fatalf("the copy carries %s", n)
		}
	}

	// ONCE, and then nothing of it is left.
	alice.mustDo("GET", ready.URL, nil, http.StatusNotFound)
	if files := dataFiles(t, srv, ".safety-"); len(files) != 0 {
		t.Fatalf("left on the server after the download: %v", files)
	}
	// The token is not in the log an admin reads.
	flushed(t, srv.Logbook)
	token := strings.TrimPrefix(ready.URL, "/admin/backup/safety/")
	sawDownload := false
	for _, l := range alice.logs(url.Values{"level": {"request"}, "limit": {"1000"}}).Lines {
		if strings.Contains(l.Line, token) {
			t.Fatalf("a kept line holds the copy's token: %s", l.Line)
		}
		sawDownload = sawDownload || strings.HasPrefix(l.Line, "GET /api/admin/backup/safety/… 200 ")
	}
	if !sawDownload {
		t.Fatal("the system log does not show the copy's download")
	}

	// THE DOWNLOAD IS WHAT LETS THE RESTORE GO, and what it restores is the kept
	// archive, not the copy: the book added after the backup is gone.
	alice.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)
	back := &testClient{t: t, h: h}
	back.cookie = cookieOf(t, back.mustDo("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw}, http.StatusOK))
	var books struct {
		Books []struct {
			Title string `json:"title"`
		} `json:"books"`
	}
	_ = json.Unmarshal(back.mustDo("GET", "/books", nil, http.StatusOK).Body.Bytes(), &books)
	var titles []string
	for _, b := range books.Books {
		titles = append(titles, b.Title)
	}
	if !slices.Equal(titles, []string{"Kept"}) {
		t.Fatalf("the restore put back %v, want the kept archive's [Kept]", titles)
	}
}

func TestASafetyCopyNobodyFetchesGoesWhenItsTimeIsUp(t *testing.T) {
	// Before the server, so it is put back after the queue has closed: a job on
	// its way out reads it.
	was := safetyCopyTTL
	safetyCopyTTL = 300 * time.Millisecond
	t.Cleanup(func() { safetyCopyTTL = was })
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)

	ready := sealSafetyCopy(t, alice, map[string]string{"password": testPw})
	if files := dataFiles(t, srv, ".safety-"); len(files) != 1 {
		t.Fatalf("the copy waiting: %v", files)
	}
	time.Sleep(2 * safetyCopyTTL)
	// Nothing woke to take it; the Server card's read, the next time anybody
	// opens it, does.
	alice.mustDo("GET", "/admin/backup", nil, http.StatusOK)
	if files := dataFiles(t, srv, ".safety-"); len(files) != 0 {
		t.Fatalf("a copy past its time is still on the server: %v", files)
	}
	alice.mustDo("GET", ready.URL, nil, http.StatusNotFound)
	alice.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusPreconditionRequired)

	// And the download itself asks: a copy fetched past its time is not there.
	late := sealSafetyCopy(t, alice, map[string]string{"password": testPw})
	time.Sleep(2 * safetyCopyTTL)
	alice.mustDo("GET", late.URL, nil, http.StatusNotFound)
	if files := dataFiles(t, srv, ".safety-"); len(files) != 0 {
		t.Fatalf("a copy fetched past its time is still on the server: %v", files)
	}
}

func TestASafetyCopyStillWaitingGoesWithTheNextOneARestartOrTheAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	bobID := userIDNamed(t, alice, "bob")
	promote(t, alice, bobID)

	// A second copy replaces the first: one file, and the first's download gone.
	first := sealSafetyCopy(t, alice, map[string]string{"password": testPw})
	second := sealSafetyCopy(t, alice, map[string]string{"passphrase": "safety-copy-2"})
	if files := dataFiles(t, srv, ".safety-"); len(files) != 1 {
		t.Fatalf("two copies asked for, one after the other: %v on the server, want the second alone", files)
	}
	alice.mustDo("GET", first.URL, nil, http.StatusNotFound)

	// A restart takes a copy nobody fetched: the start's sweep removes the file,
	// and its download finds nothing to hand over.
	CleanupBackupStaging(srv.DataDir)
	if files := dataFiles(t, srv, ".safety-"); len(files) != 0 {
		t.Fatalf("after the start's sweep: %v", files)
	}
	alice.mustDo("GET", second.URL, nil, http.StatusNotFound)

	// An account deleted takes its copy with it; somebody else's stays. Bob steps
	// down first, as an admin must before being removed, and a copy is an admin's
	// to download, so his is not his any more.
	bobs := sealSafetyCopy(t, bob, map[string]string{"password": testPw})
	alices := sealSafetyCopy(t, alice, map[string]string{"password": testPw})
	bob.mustDo("PATCH", fmt.Sprintf("/admin/users/%d", bobID), map[string]bool{"is_admin": false}, http.StatusOK)
	bob.mustDo("GET", bobs.URL, nil, http.StatusNotFound)
	if files := dataFiles(t, srv, ".safety-"); len(files) != 2 {
		t.Fatalf("with bob's copy and alice's waiting: %v", files)
	}
	alice.mustDo("DELETE", fmt.Sprintf("/admin/users/%d", bobID), nil, http.StatusOK)
	if files := dataFiles(t, srv, ".safety-"); len(files) != 1 {
		t.Fatalf("after bob's account was deleted: %v, want alice's copy alone", files)
	}

	// A factory reset takes every copy still waiting: alice downloads hers, which
	// lets the reset go, and carol's, sealed meanwhile, goes with the rest.
	carol := addUser(t, h, alice, "carol")
	promote(t, alice, userIDNamed(t, alice, "carol"))
	sealSafetyCopy(t, carol, map[string]string{"password": testPw})
	alice.mustDo("GET", alices.URL, nil, http.StatusOK)
	alice.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusOK)
	if files := dataFiles(t, srv, ".safety-"); len(files) != 0 {
		t.Fatalf("after the factory reset: %v", files)
	}
}

// A HEAD AT THE DOWNLOAD SPENDS NOTHING. curl -I, or a download manager asking
// the size before it fetches, reaches the copy's address with a HEAD, whose body
// the server throws away: it must not use up the one download, nor note the copy
// as taken so that a reset goes ahead on a copy nobody has.
func TestAHeadAtASafetyCopysDownloadSpendsNothingAndLetsNothingGo(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	ready := sealSafetyCopy(t, alice, map[string]string{"password": testPw})

	if rec := alice.do("HEAD", ready.URL, nil); rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("a HEAD at the copy's download: %d, want 405", rec.Code)
	}
	// Nothing was let go: the reset still asks for the copy to be downloaded.
	alice.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusPreconditionRequired)
	// And nothing was spent: the copy downloads, whole, once.
	rec := alice.mustDo("GET", ready.URL, nil, http.StatusOK)
	if int64(rec.Body.Len()) != ready.Size {
		t.Fatalf("the copy downloaded %d bytes after the HEAD, its job said %d", rec.Body.Len(), ready.Size)
	}
	alice.mustDo("GET", ready.URL, nil, http.StatusNotFound)
}
