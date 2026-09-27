package httpapi

import (
	"fmt"
	"net/http"
	"testing"
)

// AN ADMIN DELETES A READER, AND THE READER'S JOBS STAY — AS THE ADMIN'S.
//
// Driven the way a reader and an admin drive it: each starts a job through the
// jobs API, and the account is made, deleted and restored from the bin through
// the API.
//
// WHAT IT KNOWS, declared because a test here may not know the code: what
// jobs_api_test.go's header declares (the queue set up as serve() sets it, the
// test's own kinds, the wire field names), and the `jobs` table's name and its
// user_id and username columns, which it reads through srv.Store.DB. The claim is
// that the job belongs to nobody, and the wire cannot say that: an admin sees a
// job owned by nobody and one owned by another reader alike, as not hers, under
// the name it was started as. That it is not handed back when the account is is
// said on the wire too, and read there.
//
// The other delete path, `tippani user del`, has its own test in cmd/tippani; the
// trigger both rely on is 0079's, tested at the statement in internal/store.

func TestAnAdminDeletingAReaderLeavesTheirJobsToTheAdmin(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	bobsJob := bob.waitJob(bob.mustStart("test.lines", map[string]any{"tag": "bob's"}).ID, "succeeded")
	alicesJob := admin.waitJob(admin.mustStart("test.lines", map[string]any{"tag": "alice's"}).ID, "succeeded")
	aliceID := accountID(t, admin, "alice")

	admin.mustDo("DELETE", "/admin/users/"+itoa(accountID(t, admin, "bob")), nil, http.StatusOK)

	owner := func(id int64) (uid *int64, name string) {
		t.Helper()
		if err := srv.Store.DB.QueryRow(`SELECT user_id, username FROM jobs WHERE id = ?`, id).Scan(&uid, &name); err != nil {
			t.Fatalf("job %d after the delete: %v", id, err)
		}
		return uid, name
	}
	if uid, name := owner(bobsJob.ID); uid != nil || name != "bob" {
		t.Fatalf("bob's job after his account went: owned=%v username=%q, want no owner and his name kept", uid != nil, name)
	}
	if uid, _ := owner(alicesJob.ID); uid == nil || *uid != aliceID {
		t.Fatal("deleting bob changed the owner of alice's job")
	}
	// The admin still has it, with its log, under his name.
	if j := admin.job(bobsJob.ID); j.Username != "bob" || j.Own || j.State != "succeeded" {
		t.Fatalf("bob's job as the admin sees it after the delete: %+v", j)
	}

	// Putting the account back from the bin brings bob back under his old id, and
	// must not fail over the history it never took with it (the job table is not
	// in the account's snapshot, so there is no row to collide with) — nor hand the
	// job back: once let go, a job's owner is the admin.
	bin := binOf(t, admin).Trash
	if len(bin) != 1 || bin[0].Kind != "account" {
		t.Fatalf("admin's bin: %+v", bin)
	}
	restore(t, admin, bin[0].ID, http.StatusOK)
	if uid, _ := owner(bobsJob.ID); uid != nil {
		t.Fatalf("restoring bob's account re-attached his old job to id %d", *uid)
	}
	back := &testClient{t: t, h: h}
	back.cookie = cookieOf(t, back.mustDo("POST", "/auth/login", map[string]string{"username": "bob", "password": testPw}, http.StatusOK))
	back.mustDo("GET", fmt.Sprintf("/jobs/%d", bobsJob.ID), nil, http.StatusNotFound)
	if past := back.jobs("view=past"); len(past.Jobs) != 0 {
		t.Fatalf("bob, back from the bin, has jobs: %+v", past.Jobs)
	}
}
