package httpapi

import (
	"fmt"
	"net/http"
	"slices"
	"testing"
	"time"
)

// WHAT AN ADMIN DOES TO THE WHOLE SERVER IS KEPT AS A JOB, THOUGH IT RUNS IN ITS
// REQUEST: a backup through the API, a safety copy, an update, a restore (the
// first-run one too) and a factory reset, each found afterwards in Past jobs.
//
// Driven through the API as the Server and Updates cards drive them, and read
// back through GET /jobs as Settings › Jobs reads it.
//
// WHAT IT KNOWS, declared: what jobs_api_test.go's header declares (the queue and
// its logbook set up as serve() sets them, the wire field names), and the
// update's Docker client stubbed as update_test.go stubs it (srv.newDocker).
//
// What each one guards, in a sentence a person would say: each of those is in
// Past jobs afterwards, as having run in its request, named after what it was
// about; a restore's and a reset's belong to nobody, since the account that
// pressed them belonged to the database they replaced, and an admin still sees
// them; a restore keeps the jobs from before it, and a reset keeps nothing but
// its own.

// pastJob waits for a job of kind to be in c's past jobs, as the list is read
// again until it shows, and returns the newest.
func pastJob(c *testClient, kind string) wireJob {
	c.t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for {
		if list := c.jobs("view=past&kind=" + kind).Jobs; len(list) > 0 {
			return list[0]
		}
		if time.Now().After(deadline) {
			c.t.Fatalf("no %s in past jobs", kind)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func jobKindsOf(list []wireJob) []string {
	var out []string
	for _, j := range list {
		out = append(out, j.Kind)
	}
	slices.Sort(out)
	return out
}

func TestWhatAnAdminDoesToTheWholeServerIsKeptAsAJob(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	fake := &fakeDocker{avail: true, name: "tippani", image: "ghcr.io/aaronified/tippani:latest"}
	srv.newDocker = func() UpdateDocker { return fake }
	h := srv.Handler()
	admin := signupAdmin(t, h)

	backupNow(admin)
	kept := decode[struct {
		Backup struct {
			Name string `json:"name"`
		} `json:"backup"`
	}](t, admin.mustDo("GET", "/admin/backup", nil, http.StatusOK)).Backup.Name
	safetyBackup(t, admin)

	for _, kind := range []string{"backup", "backup.safety"} {
		j := pastJob(admin, kind)
		if j.Queued || !j.Own || j.State != "succeeded" || j.Subject != "" || j.Username != "alice" {
			t.Fatalf("the %s in past jobs: %+v", kind, j)
		}
	}

	admin.mustDo("POST", "/admin/restore", map[string]string{"password": testPw}, http.StatusOK)
	again := &testClient{t: t, h: h}
	again.cookie = cookieOf(t, again.mustDo("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw}, http.StatusOK))
	restore := pastJob(again, "restore")
	if restore.Queued || restore.Own || restore.Username != "alice" || restore.Subject != kept || restore.State != "succeeded" {
		t.Fatalf("the restore in past jobs: %+v, want alice's, belonging to nobody now, from %s", restore, kept)
	}
	// The history from before it is still there, and still hers: she is in the
	// archive under the same id and name.
	if j := pastJob(again, "backup"); !j.Own {
		t.Fatalf("the backup from before the restore: %+v", j)
	}

	safetyBackup(t, again)
	again.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusOK)
	fresh := signupAdmin(t, h)
	reset := pastJob(fresh, "reset")
	if reset.Own || reset.Username != "alice" || reset.State != "succeeded" {
		t.Fatalf("the reset in past jobs: %+v", reset)
	}
	if got := jobKindsOf(fresh.jobs("view=past").Jobs); !slices.Equal(got, []string{"reset"}) {
		t.Fatalf("past jobs after a factory reset: %v, want the reset alone", got)
	}

	// The update last, since a launched one shuts the queue until the server is
	// replaced, and a restore or a reset after it would be refused.
	fresh.mustDo("POST", "/admin/update/apply", map[string]string{"confirm": "UPDATE"}, http.StatusOK)
	if j := pastJob(fresh, "update.apply"); j.Queued || !j.Own || j.State != "succeeded" || j.Subject != fake.image || j.Username != "alice" {
		t.Fatalf("the update in past jobs: %+v", j)
	}
}

func TestTheFirstRunRestoreIsKeptAsAJob(t *testing.T) {
	old := newTestServer(t)
	oh := old.Handler()
	oldAdmin := signupAdmin(t, oh)
	backupNow(oldAdmin)
	archive := oldAdmin.mustDo("GET", "/admin/backup/download", nil, http.StatusOK).Body.Bytes()

	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	anon := &testClient{t: t, h: h}
	if rec := anon.restoreUpload("/auth/restore/upload", pwUpload(), archive); rec.Code != http.StatusOK {
		t.Fatalf("the first-run restore: %d %s", rec.Code, rec.Body)
	}
	admin := &testClient{t: t, h: h}
	admin.cookie = cookieOf(t, admin.mustDo("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw}, http.StatusOK))
	j := pastJob(admin, "restore")
	if j.Queued || j.Own || j.Username != "" || j.Subject != "backup"+backupExt || j.State != "succeeded" {
		t.Fatalf("the first-run restore in past jobs: %+v", j)
	}
	if n := len(admin.jobs(fmt.Sprintf("view=past&kind=%s", "restore")).Jobs); n != 1 {
		t.Fatalf("%d restores kept, want 1", n)
	}
}
