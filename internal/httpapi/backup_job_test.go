package httpapi

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// THE SERVER CARD'S BACKUP, AS A JOB: started as the card starts it
// (POST /jobs {kind: "backup", password}), watched as Settings › Jobs watches it,
// and the kept archive read back as the card reads it (GET /admin/backup) and
// downloaded as the card downloads it.
//
// WHAT IT KNOWS, declared because a test here may not know the code:
//   - the queue is given to the server as serve() gives it (queueing,
//     jobs_api_test.go), and a job of the test's own (test.hold) holds the queue
//     so that a backup waits behind it while its owner changes their password or
//     loses their admin rights, as they could behind somebody's long fill;
//   - one test holds the backup lock itself (srv.backupMu), because a restore
//     holding it is an upload of seconds to minutes that no test can keep in
//     flight on demand, and the job's answer to it is what is under test;
//   - Pushover is a stub of its API (newFakePushover), and the archive is opened
//     with the test's own reader of the format (openSealed, backup_test.go), as
//     a person with the password would open it;
//   - the job's wire fields, and that a backup has no counts: the contract says
//     so, and the SPA's jobs.js reads none for it.
//
// What each one guards, in a sentence a person would say: the API's backup
// (POST /admin/backup) is that same job, waiting its turn, refusing a wrong
// password at once, one job whichever address it was asked for at, and nothing
// run in its request; a backup job makes the
// kept archive, sealed so my password opens it and labelled with the name I have
// when it runs, says so in its log and on my phone, and counts nothing; a backup whose password changed while it waited
// fails with the reason and makes no archive, and runs again with the new one;
// one whose owner stopped being an admin while it waited fails; and one that
// finds a backup or restore under way fails rather than waiting on it.

func TestABackupJobMakesTheKeptArchiveAndTellsThePhone(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	srv.PushoverToken = "azGDORePK8gMaC0QOYAMyEEuzJnyUi"
	push := newFakePushover(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	alice.mustDo("PUT", "/auth/notifications", map[string]any{"pushover_user": testPushoverUser}, http.StatusOK)

	// Queued behind another job, while alice renames herself: the archive is
	// labelled with the name her password now goes with.
	ahead := alice.mustStart("test.hold", map[string]any{"tag": "ahead"})
	alice.waitJob(ahead.ID, "running")
	started := alice.mustStart("backup", map[string]any{"password": testPw})
	alice.mustDo("PUT", "/auth/me", map[string]string{"username": "arani"}, http.StatusOK)
	q.let()
	job := alice.waitJob(started.ID, "succeeded")
	countsAre(t, job, map[string]any{})

	type archive struct {
		Name    string `json:"name"`
		Size    int64  `json:"size"`
		Key     string `json:"key"`
		Account string `json:"account"`
	}
	result := decode[struct {
		Result archive `json:"result"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/jobs/%d/result", job.ID), nil, http.StatusOK)).Result
	kept := decode[struct {
		Backup archive `json:"backup"`
	}](t, alice.mustDo("GET", "/admin/backup", nil, http.StatusOK)).Backup
	if result.Name == "" || result != kept || kept.Key != "password" || kept.Account != "arani" {
		t.Fatalf("the job's result %+v, the card's archive %+v; want the same archive, sealed with arani's password", result, kept)
	}
	file := alice.mustDo("GET", "/admin/backup/download", nil, http.StatusOK).Body.Bytes()
	if _, err := openSealed(t, file, testPw); err != nil {
		t.Fatalf("the kept archive does not open with her password: %v", err)
	}

	if log := strings.Join(logOf(t, alice, job.ID), "\n"); !strings.Contains(log, "info "+kept.Name+" — sealed with arani's password") {
		t.Errorf("the backup's log:\n%s", log)
	}
	msgs := push.sent()
	if len(msgs) != 1 || msgs[0]["title"] != "Backup ready" || !strings.Contains(msgs[0]["message"], kept.Name) {
		t.Fatalf("the phone heard %+v, want one message naming %s", msgs, kept.Name)
	}
}

func TestABackupJobWhosePasswordChangedWhileItWaitedFailsAndRunsAgain(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)

	ahead := alice.mustStart("test.hold", map[string]any{"tag": "ahead"})
	alice.waitJob(ahead.ID, "running")
	backup := alice.mustStart("backup", map[string]any{"password": testPw})
	rec := alice.mustDo("POST", "/auth/password", map[string]string{"current": testPw, "new": "another-password-9"}, http.StatusOK)
	alice.cookie = cookieOf(t, rec)
	q.let()

	failed := alice.waitJob(backup.ID, "failed")
	if failed.Error != "your password changed since this backup was started — run it again" || !failed.Rerunnable {
		t.Fatalf("the backup after the password changed: %+v", failed)
	}
	if got := alice.mustDo("GET", "/admin/backup", nil, http.StatusOK).Body.String(); !strings.Contains(got, `"backup":null`) {
		t.Fatalf("an archive was made under the old password: %s", got)
	}

	again := decode[struct {
		Job wireJob `json:"job"`
	}](t, alice.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", backup.ID), map[string]string{"password": "another-password-9"}, http.StatusAccepted)).Job
	alice.waitJob(again.ID, "succeeded")
	file := alice.mustDo("GET", "/admin/backup/download", nil, http.StatusOK).Body.Bytes()
	if _, err := openSealed(t, file, "another-password-9"); err != nil {
		t.Fatalf("the rerun's archive does not open with the new password: %v", err)
	}
}

func TestABackupJobWhoseOwnerIsNoLongerAnAdminFails(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	bobID := accountID(t, alice, "bob")
	alice.mustDo("PATCH", fmt.Sprintf("/admin/users/%d", bobID), map[string]any{"is_admin": true}, http.StatusOK)

	ahead := alice.mustStart("test.hold", map[string]any{"tag": "ahead"})
	alice.waitJob(ahead.ID, "running")
	backup := bob.mustStart("backup", map[string]any{"password": testPw})
	// Bob steps down while his backup waits.
	bob.mustDo("PATCH", fmt.Sprintf("/admin/users/%d", bobID), map[string]any{"is_admin": false}, http.StatusOK)
	q.let()

	if failed := bob.waitJob(backup.ID, "failed"); !strings.Contains(failed.Error, "no longer an admin") {
		t.Fatalf("a former admin's backup: %+v", failed)
	}
	if got := alice.mustDo("GET", "/admin/backup", nil, http.StatusOK).Body.String(); !strings.Contains(got, `"backup":null`) {
		t.Fatalf("a former admin's waiting backup made an archive: %s", got)
	}
}

func TestABackupJobThatFindsABackupUnderWayFailsRatherThanWaiting(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)

	srv.backupMu.Lock() // a restore, mid-upload
	failed := alice.waitJob(alice.mustStart("backup", map[string]any{"password": testPw}).ID, "failed")
	srv.backupMu.Unlock()
	if failed.Error != "a backup or restore is already running" || !failed.Rerunnable {
		t.Fatalf("a backup that found the lock held: %+v", failed)
	}
	again := decode[struct {
		Job wireJob `json:"job"`
	}](t, alice.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", failed.ID), map[string]string{"password": testPw}, http.StatusAccepted)).Job
	alice.waitJob(again.ID, "succeeded")
}

func TestTheAPIsBackupIsTheJobTheServerCardStarts(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)

	ahead := alice.mustStart("test.hold", map[string]any{"tag": "ahead"})
	alice.waitJob(ahead.ID, "running")

	// A password that is not hers is told at once, however long the queue.
	alice.mustDo("POST", "/admin/backup", map[string]any{"password": "not-it-at-all"}, http.StatusUnauthorized)

	started := decode[struct {
		Job wireJob `json:"job"`
	}](t, alice.mustDo("POST", "/admin/backup", map[string]any{"password": testPw}, http.StatusAccepted)).Job
	if started.Kind != "backup" || !started.Queued || started.State != "queued" || started.Ahead != 1 {
		t.Fatalf("POST /admin/backup answered %+v, want a backup waiting behind the one job running", started)
	}
	// The card's press while it waits is the same job, and so is the API's again.
	for what, press := range map[string]func() *httptest.ResponseRecorder{
		"the card's": func() *httptest.ResponseRecorder { return alice.startJob("backup", map[string]any{"password": testPw}) },
		"the API's own": func() *httptest.ResponseRecorder {
			return alice.do("POST", "/admin/backup", map[string]any{"password": testPw})
		},
	} {
		rec := press()
		if rec.Code != http.StatusConflict || decode[struct {
			JobID int64 `json:"job_id"`
		}](t, rec).JobID != started.ID {
			t.Fatalf("%s backup while the API's waits: %d %s, want 409 naming #%d", what, rec.Code, rec.Body, started.ID)
		}
	}
	if got := alice.mustDo("GET", "/admin/backup", nil, http.StatusOK).Body.String(); !strings.Contains(got, `"backup":null`) {
		t.Fatalf("an archive was made while the backup waited: %s", got)
	}

	q.let()
	alice.waitJob(started.ID, "succeeded")
	result := decode[struct {
		Result keptArchive `json:"result"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/jobs/%d/result", started.ID), nil, http.StatusOK)).Result
	kept := decode[backupMetaResp](t, alice.mustDo("GET", "/admin/backup", nil, http.StatusOK)).Backup
	if kept == nil || result.Name == "" || result != *kept || kept.Account != "alice" {
		t.Fatalf("the job's result %+v, the card's archive %+v; want the same archive, sealed with alice's password", result, kept)
	}
	// And that job is the only backup kept: the request itself ran nothing.
	if list := alice.jobs("view=past&kind=backup").Jobs; len(list) != 1 || list[0].ID != started.ID {
		t.Fatalf("past backups: %v, want #%d alone", jobIDs(list), started.ID)
	}
}
