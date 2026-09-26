package store

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"os"
	"time"
)

// THE JOURNAL — the job history and the system log (0079's three tables) — BELONGS
// TO THE SERVER, NOT TO THE LIBRARY. A backup leaves it behind and a restore keeps
// the server's own, so the history on a server runs on unbroken through a restore
// and is never replaced by the older copy an archive would carry.
//
// Why not let it ride in the archive, as everything else does: the system log is
// up to a million request lines, which would be most of a small library's archive;
// and a restore would then bring back an older history whose job ids overlap the
// live one's — ids the queue, the logbook and the screens a reader has open are
// still using. Pre-3.1.0 archives have no journal at all, so a restore already had
// to cope with arriving empty.

// journalTables are emptied out of every snapshot, children first.
var journalTables = []string{"job_logs", "jobs", "system_logs"}

// StripJournal empties the journal out of a database snapshot before it is sealed
// into an archive (every archive: the backup job, the API's backup, the safety
// copy taken before a restore or a reset). The snapshot is a VACUUM INTO copy the
// caller just made and nothing else has open, so it gets a private handle rather
// than the store's pools.
//
// Deleting is not enough on its own: deleted rows stay readable in the file's free
// pages until they are overwritten, and an archive is a file somebody downloads.
// The VACUUM after the DELETEs rebuilds the file without its free pages at all.
//
// The snapshot is in rollback-journal mode (VACUUM INTO writes it so) and this
// handle sets no journal mode, so nothing is left in a -wal beside the file, which
// the archive would not take.
func StripJournal(snapPath string) error {
	db, err := sql.Open("sqlite", "file:"+snapPath)
	if err != nil {
		return fmt.Errorf("open snapshot: %w", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	for _, t := range journalTables {
		if _, err := db.Exec(`DELETE FROM ` + t); err != nil {
			return fmt.Errorf("empty %s: %w", t, err)
		}
	}
	if _, err := db.Exec(`VACUUM`); err != nil {
		return fmt.Errorf("vacuum the stripped snapshot: %w", err)
	}
	return db.Close()
}

// CarryJournal copies the journal out of the database at from — the generation a
// restore just replaced — into db, the restored one. The restore calls it inside
// Swap's after step, with the logbook's drainer still parked, so nothing is logged
// into the restored file between the swap and the copy.
//
// IDS ARE KEPT, because the queue's maps, the logbook's in-flight lines and the
// screens a reader has open all name a job by its id, and every one of them should
// still find its row after the restore.
//
// AN OWNER IS KEPT ONLY WHERE THE RESTORED DATABASE HAS THAT ID AND THAT USERNAME.
// The restored users table is a different generation of accounts: id 2 may be the
// same person, somebody else (an id reused after a delete), or the same name moved
// to another id. A job whose owner does not match on both goes to the admin (NULL),
// and a job that was already the admin's stays the admin's even if an account of
// its old name exists: whatever made it the admin's (the account deleted, an
// earlier restore) knew something this does not.
//
// A job that was queued or running is interrupted: the restore stopped the world
// under it, and nothing resumes on its own. The ids AUTOINCREMENT will hand out
// next are carried too, so a job pruned before the restore does not lend its id to
// one made after it.
//
// It runs on one pinned connection because ATTACH is per connection: on a pool the
// copies could run on a connection that never attached.
func CarryJournal(db *sql.DB, from string) (err error) {
	// ATTACH would create an empty file at a path that is not there, and then fail
	// on the first copy with a message that names a table rather than the problem.
	if _, err := os.Stat(from); err != nil {
		return fmt.Errorf("the replaced database: %w", err)
	}
	ctx := context.Background()
	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()
	if _, err := conn.ExecContext(ctx, `ATTACH DATABASE ? AS old`, from); err != nil {
		return fmt.Errorf("attach %s: %w", from, err)
	}
	defer func() {
		if _, derr := conn.ExecContext(ctx, `DETACH DATABASE old`); derr != nil {
			// Still attached, so this connection must not go back to the pool
			// holding the old file open: ErrBadConn from Raw has it discarded.
			_ = conn.Raw(func(any) error { return driver.ErrBadConn })
			err = errors.Join(err, fmt.Errorf("detach: %w", derr))
		}
	}()

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := time.Now().UnixMilli()
	for _, step := range []struct {
		what string
		sql  string
		args []any
	}{
		// Empty already — archives are stripped, and one from before 3.1.0 never
		// had a journal — but a hand-made archive could carry one, and the rows
		// below keep their ids.
		{"clear the restored journal", `DELETE FROM main.job_logs`, nil},
		{"clear the restored journal", `DELETE FROM main.jobs`, nil},
		{"clear the restored journal", `DELETE FROM main.system_logs`, nil},
		{"carry the jobs", `
			INSERT INTO main.jobs (id, user_id, username, kind, queued, subject, state, params, result,
			                       error, total, done, stop_requested, rerun_of, from_job,
			                       created_at, started_at, finished_at)
			SELECT o.id,
			       CASE WHEN EXISTS (SELECT 1 FROM main.users u WHERE u.id = o.user_id AND u.username = o.username)
			            THEN o.user_id END,
			       o.username, o.kind, o.queued, o.subject,
			       CASE WHEN o.state IN ('queued', 'running') THEN 'interrupted' ELSE o.state END,
			       o.params, o.result, o.error, o.total, o.done, o.stop_requested, o.rerun_of, o.from_job,
			       o.created_at, o.started_at,
			       CASE WHEN o.state IN ('queued', 'running') THEN ? ELSE o.finished_at END
			  FROM old.jobs o`, []any{now}},
		{"carry the job logs", `
			INSERT INTO main.job_logs (id, job_id, at, level, line)
			SELECT id, job_id, at, level, line FROM old.job_logs
			 WHERE job_id IN (SELECT id FROM main.jobs)`, nil},
		{"carry the system log", `
			INSERT INTO main.system_logs (id, at, level, code, line)
			SELECT id, at, level, code, line FROM old.system_logs`, nil},
		// The inserts above already lifted the counter to the highest id carried;
		// this lifts it to the old one's, which is higher when its newest jobs had
		// been pruned.
		{"carry the next job id", `
			UPDATE main.sqlite_sequence
			   SET seq = MAX(seq, (SELECT seq FROM old.sqlite_sequence WHERE name = 'jobs'))
			 WHERE name = 'jobs' AND EXISTS (SELECT 1 FROM old.sqlite_sequence WHERE name = 'jobs')`, nil},
		{"carry the next job id", `
			INSERT INTO main.sqlite_sequence (name, seq)
			SELECT name, seq FROM old.sqlite_sequence
			 WHERE name = 'jobs' AND NOT EXISTS (SELECT 1 FROM main.sqlite_sequence WHERE name = 'jobs')`, nil},
	} {
		if _, err := tx.ExecContext(ctx, step.sql, step.args...); err != nil {
			return fmt.Errorf("%s: %w", step.what, err)
		}
	}
	return tx.Commit()
}
