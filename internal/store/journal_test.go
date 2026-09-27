package store

import (
	"bytes"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// A BACKUP LEAVES THE JOURNAL BEHIND; A RESTORE KEEPS THE SERVER'S OWN.
//
// WHAT IT KNOWS, declared because a test here may not know the code: StripJournal,
// CarryJournal and Swap by name, and the journal tables' names and columns. The
// restore round trip over HTTP is tested in httpapi; these pin what that test can
// only sample — every rule the carry-over applies to an owner, and that a stripped
// snapshot holds nothing a hex dump could read back — and no endpoint lists jobs yet.

// A marker nothing else in a database would contain, so finding its bytes anywhere
// in the file means a row survived somewhere, live or freed.
const journalMarker = "Zqx-journal-marker-7731"

func TestAStrippedSnapshotHoldsNoJournalNotEvenInItsFreePages(t *testing.T) {
	s := openHead(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO books (user_id, title) VALUES (1, 'The Kept Book')`)
	// Enough rows to fill whole pages, so the deletes free pages rather than cells.
	for i := 0; i < 300; i++ {
		mustExecT(t, s, `INSERT INTO jobs (user_id, username, kind, subject, state, created_at)
			VALUES (1, 'alice', 'fill', ?, 'succeeded', ?)`, journalMarker+" subject", i)
		mustExecT(t, s, `INSERT INTO job_logs (job_id, at, level, line) VALUES (last_insert_rowid(), ?, 'info', ?)`,
			i, journalMarker+" job line")
		mustExecT(t, s, `INSERT INTO system_logs (at, level, line) VALUES (?, 'request', ?)`, i, journalMarker+" system line")
	}

	snap := filepath.Join(t.TempDir(), "tippani.db")
	if err := s.VacuumInto(snap); err != nil {
		t.Fatal(err)
	}
	if raw, _ := os.ReadFile(snap); !bytes.Contains(raw, []byte(journalMarker)) {
		t.Fatal("control: the unstripped snapshot does not contain the marker, so this test could not fail")
	}

	if err := StripJournal(snap); err != nil {
		t.Fatalf("strip: %v", err)
	}

	raw, err := os.ReadFile(snap)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(raw, []byte(journalMarker)) {
		t.Fatal("the stripped snapshot still holds journal text in its bytes")
	}
	for _, sidecar := range []string{"-wal", "-journal", ".stripped"} {
		if _, err := os.Stat(snap + sidecar); err == nil {
			t.Fatalf("stripping left a %s beside the snapshot, and the archive takes only the file", sidecar)
		}
	}
	db, err := sql.Open("sqlite", "file:"+snap+"?mode=ro")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, table := range []string{"jobs", "job_logs", "system_logs"} {
		if n := countT(t, db, `SELECT count(*) FROM `+table); n != 0 {
			t.Fatalf("the stripped snapshot has %d row(s) in %s", n, table)
		}
	}
	if n := countT(t, db, `SELECT count(*) FROM books WHERE title = 'The Kept Book'`); n != 1 {
		t.Fatal("stripping the journal took the library with it")
	}
}

func TestARestoreKeepsTheServersJournalAndOnlyTheOwnersThatStillMatch(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "tippani.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	// The generation being replaced: six accounts and their history. Two of them
	// renamed themselves after starting a job: greta is gina now, and hana is
	// hanako.
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES
		(1, 'alice', 'x'), (2, 'bob', 'x'), (3, 'carol', 'x'), (5, 'erin', 'x'), (6, 'gina', 'x'), (7, 'hanako', 'x')`)
	mustExecT(t, s, `INSERT INTO jobs (id, user_id, username, kind, state, created_at, started_at, finished_at) VALUES
		(101, 1,    'alice', 'fill',   'succeeded', 1, 2, 3),
		(102, 2,    'bob',   'fill',   'succeeded', 1, 2, 3),
		(103, 3,    'carol', 'covers', 'failed',    1, 2, 3),
		(104, NULL, 'dave',  'people', 'succeeded', 1, 2, 3),
		(105, 1,    'alice', 'backup', 'running',   1, 2, NULL),
		(106, 5,    'erin',  'fill',   'queued',    1, NULL, NULL),
		(107, 6,    'greta', 'fill',   'succeeded', 1, 2, 3),
		(108, 7,    'hana',  'fill',   'succeeded', 1, 2, 3)`)
	// What a finished job found, and its counts, which its screen reads back.
	mustExecT(t, s, `UPDATE jobs SET counts = '{"fields":4}', result = '{"fields":4,"failed":0}' WHERE id = 101`)
	mustExecT(t, s, `INSERT INTO job_logs (id, job_id, at, level, line) VALUES
		(900, 101, 5, 'info', 'filled Invisible Cities'), (901, 105, 6, 'info', 'sealing')`)
	mustExecT(t, s, `INSERT INTO system_logs (id, at, level, code, line) VALUES
		(700, 7, 'warn', 'TIP-META-002', 'a provider key could not be read')`)
	// The highest id ever handed out was 110; its job has since been pruned.
	mustExecT(t, s, `INSERT INTO jobs (id, kind, state, created_at) VALUES (110, 'fill', 'succeeded', 1)`)
	mustExecT(t, s, `DELETE FROM jobs WHERE id = 110`)

	// The archive's accounts: alice as she was; bob and carol swapped ids; id 5 a
	// different person; a dave, whose old job was the admin's before this; gina,
	// backed up after her rename; and hana, backed up before hers.
	archive := filepath.Join(t.TempDir(), "archive.db")
	a, err := Open(archive)
	if err != nil {
		t.Fatal(err)
	}
	if err := a.Migrate(); err != nil {
		t.Fatal(err)
	}
	mustExecT(t, a, `INSERT INTO users (id, username, password_hash) VALUES
		(1, 'alice', 'x'), (2, 'carol', 'x'), (3, 'bob', 'x'), (4, 'dave', 'x'), (5, 'frank', 'x'),
		(6, 'gina', 'x'), (7, 'hana', 'x')`)
	// And a journal of its own, which a stripped archive never has and a
	// hand-made one could: ids that collide with the server's (101, 900, 700) and
	// ids that do not (50, 950, 750). The server's rows win and nothing of the
	// archive's is left.
	mustExecT(t, a, `INSERT INTO jobs (id, user_id, username, kind, state, created_at) VALUES
		(50, 1, 'alice', 'fill', 'succeeded', 1), (101, 1, 'alice', 'covers', 'failed', 1)`)
	mustExecT(t, a, `INSERT INTO job_logs (id, job_id, at, level, line) VALUES
		(900, 101, 1, 'info', 'from the archive'), (950, 50, 1, 'info', 'from the archive')`)
	mustExecT(t, a, `INSERT INTO system_logs (id, at, level, line) VALUES
		(700, 1, 'info', 'from the archive'), (750, 1, 'info', 'from the archive')`)
	a.Close()

	pre := filepath.Join(dir, ".pre-restore-test")
	if err := os.Mkdir(pre, 0o700); err != nil {
		t.Fatal(err)
	}
	replaced := filepath.Join(pre, "tippani.db")
	before := time.Now().UnixMilli()
	var carryErr error
	if err := s.Swap(
		func() error {
			if err := moveDB(s.Path(), replaced); err != nil {
				return err
			}
			return moveDB(archive, s.Path())
		},
		nil,
		func(db *sql.DB) error { carryErr = CarryJournal(db, replaced); return nil },
	); err != nil {
		t.Fatalf("swap: %v", err)
	}
	if carryErr != nil {
		t.Fatalf("carry-over: %v", carryErr)
	}

	type job struct {
		owner    sql.NullInt64
		kind     string
		state    string
		finished sql.NullInt64
	}
	jobs := map[int64]job{}
	rows, err := s.DB.Query(`SELECT id, user_id, kind, state, finished_at FROM jobs`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var id int64
		var j job
		if err := rows.Scan(&id, &j.owner, &j.kind, &j.state, &j.finished); err != nil {
			t.Fatal(err)
		}
		jobs[id] = j
	}
	rows.Close()

	if len(jobs) != 8 {
		t.Fatalf("carried %d jobs, want the 8 the replaced server had and none of the archive's: %+v", len(jobs), jobs)
	}
	if j := jobs[101]; j.kind != "fill" {
		t.Fatalf("job 101 is the archive's %s, want the server's fill", j.kind)
	}
	for id, want := range map[int64]sql.NullInt64{
		101: {Int64: 1, Valid: true}, // same id, same name: still alice's
		102: {},                      // id 2 is carol now
		103: {},                      // id 3 is bob now
		104: {},                      // already the admin's; a dave exists, but it stays so
		105: {Int64: 1, Valid: true},
		106: {},                      // id 5 is frank now
		107: {Int64: 6, Valid: true}, // started as greta, gina now, and gina in the archive
		108: {Int64: 7, Valid: true}, // started as hana, hanako now, and hana in the archive
	} {
		if got := jobs[id].owner; got != want {
			t.Errorf("job %d: owner %v, want %v", id, got, want)
		}
	}
	for _, id := range []int64{105, 106} {
		if j := jobs[id]; j.state != "interrupted" || j.finished.Int64 < before {
			t.Errorf("job %d was %s when the restore ran: now %q finished=%v, want interrupted and finished at the restore (>= %d)",
				id, map[int64]string{105: "running", 106: "queued"}[id], j.state, j.finished, before)
		}
	}
	if j := jobs[103]; j.state != "failed" || j.finished.Int64 != 3 {
		t.Errorf("a finished job changed in the carry-over: %+v", j)
	}
	if n := countT(t, s.DB, `SELECT count(*) FROM jobs WHERE id = 101
		AND counts = '{"fields":4}' AND result = '{"fields":4,"failed":0}'`); n != 1 {
		t.Error("job 101's result and counts were not carried")
	}

	if n := countT(t, s.DB, `SELECT count(*) FROM job_logs WHERE (id = 900 AND job_id = 101 AND line = 'filled Invisible Cities') OR (id = 901 AND job_id = 105)`); n != 2 {
		t.Fatalf("job log lines carried with their ids: %d of 2", n)
	}
	if n := countT(t, s.DB, `SELECT count(*) FROM system_logs WHERE id = 700 AND code = 'TIP-META-002'`); n != 1 {
		t.Fatal("the system log was not carried with its ids")
	}
	if n := countT(t, s.DB, `SELECT (SELECT count(*) FROM job_logs) + (SELECT count(*) FROM system_logs)`); n != 3 {
		t.Fatalf("%d log lines after the restore, want the server's 3 and none of the archive's", n)
	}

	// The next job made on the restored server takes an id above every id the
	// replaced one ever gave out, the pruned 110 included.
	res, err := s.DB.Exec(`INSERT INTO jobs (kind, state, created_at) VALUES ('fill', 'queued', 9)`)
	if err != nil {
		t.Fatal(err)
	}
	if next, _ := res.LastInsertId(); next <= 110 {
		t.Fatalf("the first job after the restore got id %d, reusing one the replaced server gave out", next)
	}
}

func TestACarryOverFromAMissingGenerationFailsWithoutTouchingAnything(t *testing.T) {
	s := openHead(t)
	missing := filepath.Join(t.TempDir(), "not-here", "tippani.db")
	err := CarryJournal(s.DB, missing)
	if err == nil || !strings.Contains(err.Error(), "replaced database") {
		t.Fatalf("carry-over from a missing file: %v", err)
	}
	if _, statErr := os.Stat(missing); !os.IsNotExist(statErr) {
		t.Fatal("the carry-over created a database file where the replaced one should have been")
	}
	// The pool still works; the connection it pinned went back unharmed.
	if countT(t, s.DB, `SELECT count(*) FROM jobs`) != 0 {
		t.Fatal("the restored database gained jobs from nowhere")
	}
}
