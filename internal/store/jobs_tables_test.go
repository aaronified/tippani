package store

import (
	"database/sql"
	"path/filepath"
	"testing"
)

// 0079'S TABLES, ARRIVING ON A LIBRARY THAT ALREADY EXISTS, AND ITS ONE TRIGGER.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the three
// tables' names and columns, and migrateThrough, this package's way of standing a
// database at an old version. Nothing observable could serve yet: no endpoint reads
// or writes a job until the jobs package and its API exist, so the database is the
// only place the rule can be seen, and the rule is the database's.
//
// THE TRIGGER IS ASKED WHETHER IT FIRES, not whether it exists (recall_log_test.go
// says why a name in a schema list proves nothing). users.id is reused — 0001 has no
// AUTOINCREMENT — so a history left pointing at a deleted id is inherited by the
// next account given that id. The two real delete paths are driven end to end in
// httpapi (the admin's delete) and cmd/tippani (`tippani user del`); this is the
// statement both of them come down to.

func TestTheJobTablesArriveOnALibraryThatAlreadyExists(t *testing.T) {
	s := openAt78(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x'), (2, 'bob', 'x')`)
	mustExecT(t, s, `INSERT INTO books (id, user_id, title, author) VALUES (1, 1, 'Invisible Cities', 'Italo Calvino')`)

	// The whole boot path, not just the .sql file: the one-time passes run too.
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate an existing library to head: %v", err)
	}

	var title string
	if err := s.DB.QueryRow(`SELECT title FROM books WHERE id = 1`).Scan(&title); err != nil || title != "Invisible Cities" {
		t.Fatalf("the library did not survive the migration: %q %v", title, err)
	}

	// A job and its log, written the way the app will write them: the columns the
	// migration defaults are left out.
	res, err := s.DB.Exec(`INSERT INTO jobs (user_id, username, kind, state, created_at) VALUES (2, 'bob', 'fill', 'queued', 1)`)
	if err != nil {
		t.Fatalf("insert a job with only the columns a job must name: %v", err)
	}
	jobID, _ := res.LastInsertId()
	mustExecT(t, s, `INSERT INTO job_logs (job_id, at, level, line) VALUES (?, 2, 'info', 'looked up Invisible Cities')`, jobID)
	mustExecT(t, s, `INSERT INTO system_logs (at, level, line) VALUES (3, 'request', 'GET /api/books 200')`)

	var params, result, code string
	var queued, total int
	if err := s.DB.QueryRow(`SELECT params, result, queued, total FROM jobs WHERE id = ?`, jobID).
		Scan(&params, &result, &queued, &total); err != nil {
		t.Fatal(err)
	}
	if params != "{}" || result != "" || queued != 1 || total != 0 {
		t.Fatalf("defaults: params=%q result=%q queued=%d total=%d", params, result, queued, total)
	}
	if err := s.DB.QueryRow(`SELECT code FROM system_logs`).Scan(&code); err != nil || code != "" {
		t.Fatalf("a system line with no code: %q %v", code, err)
	}

	// A job's log goes with the job (the prune deletes jobs, and its lines must
	// not be left behind in a table nothing reads by job any more).
	mustExecT(t, s, `DELETE FROM jobs WHERE id = ?`, jobID)
	if n := countT(t, s.DB, `SELECT count(*) FROM job_logs`); n != 0 {
		t.Fatalf("a deleted job left %d log line(s) behind", n)
	}

	// And its id is never handed out again, even though it was the newest.
	res, err = s.DB.Exec(`INSERT INTO jobs (kind, state, created_at) VALUES ('fill', 'queued', 4)`)
	if err != nil {
		t.Fatal(err)
	}
	if next, _ := res.LastInsertId(); next == jobID {
		t.Fatalf("job id %d was reused after its job was deleted", jobID)
	}
}

func TestDeletingAnAccountLeavesItsJobsToTheAdmin(t *testing.T) {
	s := openHead(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x'), (2, 'bob', 'x')`)
	mustExecT(t, s, `INSERT INTO jobs (id, user_id, username, kind, state, created_at) VALUES
		(10, 1, 'alice', 'fill', 'succeeded', 1),
		(11, 2, 'bob',   'fill', 'succeeded', 2),
		(12, 2, 'bob',   'covers', 'failed', 3)`)
	mustExecT(t, s, `INSERT INTO job_logs (job_id, at, level, line) VALUES (11, 1, 'info', 'kept')`)

	mustExecT(t, s, `DELETE FROM users WHERE id = 2`)

	// The next account created may be given id 2; it must find no history.
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (2, 'carol', 'x')`)
	if n := countT(t, s.DB, `SELECT count(*) FROM jobs WHERE user_id = 2`); n != 0 {
		t.Fatalf("carol, given bob's old id, inherited %d of his jobs", n)
	}
	// Bob's jobs are still there, with his name, for the admin to read.
	if n := countT(t, s.DB, `SELECT count(*) FROM jobs WHERE user_id IS NULL AND username = 'bob'`); n != 2 {
		t.Fatalf("bob's jobs after his account went: %d kept with no owner, want 2", n)
	}
	if n := countT(t, s.DB, `SELECT count(*) FROM job_logs WHERE job_id = 11`); n != 1 {
		t.Fatalf("bob's job lost its log when his account went: %d lines", n)
	}
	// Nobody else's history moved.
	if n := countT(t, s.DB, `SELECT count(*) FROM jobs WHERE id = 10 AND user_id = 1`); n != 1 {
		t.Fatal("deleting bob touched alice's job")
	}
}

// openAt78 stands a database at the last version before the job tables.
func openAt78(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 78)
	return s
}

func countT(t *testing.T, db *sql.DB, q string, args ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(q, args...).Scan(&n); err != nil {
		t.Fatalf("%s: %v", q, err)
	}
	return n
}
