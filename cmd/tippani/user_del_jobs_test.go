package main

// THE OPERATOR DELETES A READER FROM THE COMMAND LINE, AND THE READER'S JOBS STAY
// — AS THE ADMIN'S. Run as the operator runs it: this test binary is started again
// as `tippani user del bob` against a data directory, and the database is read
// afterwards.
//
// WHAT IT KNOWS, declared because a test here may not know the code: that the test
// binary runs main() when TIPPANI_TEST_AS_BINARY=1 (TestMain, in
// healthcheck_test.go), and the `jobs` table's name and its user_id and username
// columns. It writes and reads job rows directly because no command or endpoint
// creates or lists a job yet. The admin's delete in the app is the other path; its
// test is in internal/httpapi.

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"tippani/internal/store"
)

func TestTheCommandLineDeleteLeavesAReadersJobsToTheAdmin(t *testing.T) {
	dir := t.TempDir()
	db := filepath.Join(dir, "tippani.db")
	st, err := store.Open(db)
	if err != nil {
		t.Fatal(err)
	}
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	for _, q := range []string{
		`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'alice', 'x', 1), (2, 'bob', 'x', 0)`,
		`INSERT INTO jobs (id, user_id, username, kind, state, created_at) VALUES
			(7, 2, 'bob', 'fill', 'succeeded', 1), (8, 1, 'alice', 'covers', 'succeeded', 2)`,
	} {
		if _, err := st.DB.Exec(q); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	st.Close()

	cmd := exec.Command(os.Args[0], "user", "del", "bob")
	cmd.Env = append(os.Environ(), "TIPPANI_TEST_AS_BINARY=1", "TIPPANI_DATA="+dir)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("tippani user del bob: %v\n%s", err, out)
	}

	st, err = store.Open(db)
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	var users int
	if err := st.DB.QueryRow(`SELECT count(*) FROM users WHERE username = 'bob'`).Scan(&users); err != nil || users != 0 {
		t.Fatalf("the command did not delete bob: %d left, %v", users, err)
	}
	var owner *int64
	var name string
	if err := st.DB.QueryRow(`SELECT user_id, username FROM jobs WHERE id = 7`).Scan(&owner, &name); err != nil {
		t.Fatalf("bob's job after the command: %v", err)
	}
	if owner != nil || name != "bob" {
		t.Fatalf("bob's job after the command: owned=%v username=%q, want no owner and his name kept", owner != nil, name)
	}
	if err := st.DB.QueryRow(`SELECT user_id FROM jobs WHERE id = 8`).Scan(&owner); err != nil || owner == nil || *owner != 1 {
		t.Fatalf("the command changed the owner of alice's job: %v", err)
	}
}
