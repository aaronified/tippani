package httpapi

import (
	"net/http"
	"testing"
)

// AN ADMIN DELETES A READER, AND THE READER'S JOBS STAY — AS THE ADMIN'S.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the `jobs`
// table's name and three of its columns (user_id, username, id). It writes a job
// row and reads it back through srv.Store.DB because nothing else can yet: no
// endpoint creates or lists a job until the jobs API exists. Everything else is
// driven the way an admin drives it — the account is made, deleted and restored
// from the bin through the API.
//
// The other delete path, `tippani user del`, has its own test in cmd/tippani; the
// trigger both rely on is 0079's, tested at the statement in internal/store.

func TestAnAdminDeletingAReaderLeavesTheirJobsToTheAdmin(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	addUser(t, h, admin, "bob")

	var bobID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'bob'`).Scan(&bobID); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`INSERT INTO jobs (id, user_id, username, kind, state, created_at)
		VALUES (41, ?, 'bob', 'fill', 'succeeded', 1), (42, 1, 'alice', 'fill', 'succeeded', 2)`, bobID); err != nil {
		t.Fatal(err)
	}

	admin.mustDo("DELETE", "/admin/users/"+itoa(bobID), nil, http.StatusOK)

	owner := func(id int64) (uid *int64, name string) {
		t.Helper()
		if err := srv.Store.DB.QueryRow(`SELECT user_id, username FROM jobs WHERE id = ?`, id).Scan(&uid, &name); err != nil {
			t.Fatalf("job %d after the delete: %v", id, err)
		}
		return uid, name
	}
	if uid, name := owner(41); uid != nil || name != "bob" {
		t.Fatalf("bob's job after his account went: owned=%v username=%q, want no owner and his name kept", uid != nil, name)
	}
	if uid, _ := owner(42); uid == nil || *uid != 1 {
		t.Fatal("deleting bob changed the owner of alice's job")
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
	if uid, _ := owner(41); uid != nil {
		t.Fatalf("restoring bob's account re-attached his old job to id %d", *uid)
	}
}
