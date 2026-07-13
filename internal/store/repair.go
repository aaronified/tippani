package store

import (
	"fmt"
	"os"
	"strings"
	"time"

	"tippani/internal/olog"
)

// ftsTables are the external-content FTS5 indexes. Their rows are *derived* from
// the base tables (books, annotations, movies, dialogues), so a corrupt index
// ("database disk image is malformed") loses nothing recoverable — it can always
// be rebuilt from the content it mirrors.
var ftsTables = []string{"books_fts", "annotations_fts", "movies_fts", "dialogues_fts"}

// CheckIntegrity runs SQLite's own quick_check over the whole database file and
// logs the outcome to stdout+stderr. "ok" = structurally sound; anything else is
// real page-level corruption, alerted loudly so it can't be missed in the logs.
// FTS *logical* consistency (index vs content) is a separate check — see
// RepairFTS. Returns true when the database passed.
func (s *Store) CheckIntegrity() bool {
	olog.Printf("[integrity] running PRAGMA quick_check on %s", s.path)
	rows, err := s.DB.Query(`PRAGMA quick_check`)
	if err != nil {
		olog.Alertf("[integrity] quick_check could not run (database may be unreadable): %v", err)
		return false
	}
	defer rows.Close()
	var problems []string
	for rows.Next() {
		var line string
		if err := rows.Scan(&line); err != nil {
			continue
		}
		if strings.TrimSpace(line) != "ok" {
			problems = append(problems, line)
		}
	}
	if err := rows.Err(); err != nil {
		olog.Alertf("[integrity] quick_check read error (database may be corrupt): %v", err)
		return false
	}
	if len(problems) == 0 {
		olog.Printf("[integrity] OK — database passed quick_check")
		return true
	}
	olog.Alertf("[integrity] DATABASE CORRUPTION DETECTED — %d problem(s):", len(problems))
	for i, p := range problems {
		if i >= 20 {
			olog.Alertf("[integrity]   … and %d more", len(problems)-20)
			break
		}
		olog.Alertf("[integrity]   %s", p)
	}
	return false
}

// RepairFTS integrity-checks each FTS index at startup and reconstructs any that
// come back broken. An in-place 'rebuild' can't fix page-level corruption (it
// reads the same corrupt shadow pages), so reconstruction is DROP + recreate +
// rebuild — see rebuildFTSTable. A table that can't be reconstructed is logged
// and skipped so the server still starts (that scope's search stays down until a
// reset) rather than crash-looping on a bad index.
func (s *Store) RepairFTS() {
	olog.Printf("[fts] checking %d full-text index(es) for corruption", len(ftsTables))
	for _, t := range ftsTables {
		if _, err := s.DB.Exec(fmt.Sprintf(`INSERT INTO %s(%s) VALUES('integrity-check')`, t, t)); err == nil {
			olog.Printf("[fts] %s OK", t)
			continue
		} else {
			olog.Alertf("[fts] %s failed integrity-check (%v) — reconstructing from content", t, err)
		}
		if err := s.rebuildFTSTable(t); err != nil {
			olog.Alertf("[fts] %s reconstruction FAILED: %v — search on this scope will error until a data reset (Profile → Reset all data)", t, err)
		} else {
			olog.Printf("[fts] %s reconstructed successfully", t)
		}
	}
}

// ReindexFTS force-rebuilds every FTS index from its content table, whether or
// not it currently reports corrupt — the non-destructive fix behind Profile →
// "Rebuild search index". Returns the tables that could NOT be rebuilt (empty on
// full success).
func (s *Store) ReindexFTS() []string {
	olog.Printf("[fts] reindex requested — reconstructing all %d index(es)", len(ftsTables))
	var failed []string
	for _, t := range ftsTables {
		if err := s.rebuildFTSTable(t); err != nil {
			olog.Alertf("[fts] reindex: %s FAILED: %v", t, err)
			failed = append(failed, t)
		} else {
			olog.Printf("[fts] reindex: %s done", t)
		}
	}
	if len(failed) == 0 {
		olog.Printf("[fts] reindex complete — all indexes rebuilt")
	} else {
		olog.Alertf("[fts] reindex finished with %d failure(s): %s", len(failed), strings.Join(failed, ", "))
	}
	return failed
}

// rebuildFTSTable reconstructs one external-content FTS5 index: capture its
// CREATE + sync-trigger DDL from the schema, drop and recreate them (fresh,
// empty shadow tables), then 'rebuild' to repopulate from the base content
// table. Schema-driven — the DDL is read from sqlite_master, so it always
// matches whatever the migrations produced; nothing is hard-coded here. The
// table name comes from the fixed ftsTables list and the DDL from our own
// schema, so the string building is not user-controlled.
func (s *Store) rebuildFTSTable(t string) error {
	var createSQL string
	if err := s.DB.QueryRow(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, t).Scan(&createSQL); err != nil {
		return fmt.Errorf("read %s definition: %w", t, err)
	}
	if strings.TrimSpace(createSQL) == "" {
		return fmt.Errorf("%s: no CREATE statement in schema", t)
	}
	// The sync triggers live ON the base table but name the fts table in their
	// body — capture them so they can be dropped first and restored after.
	type trig struct{ name, sql string }
	var trigs []trig
	rows, err := s.DB.Query(`SELECT name, sql FROM sqlite_master WHERE type='trigger' AND sql LIKE ?`, "%"+t+"%")
	if err != nil {
		return fmt.Errorf("read %s triggers: %w", t, err)
	}
	for rows.Next() {
		var tr trig
		if err := rows.Scan(&tr.name, &tr.sql); err != nil {
			rows.Close()
			return err
		}
		if strings.TrimSpace(tr.sql) != "" {
			trigs = append(trigs, tr)
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	olog.Printf("[fts] %s: dropping + recreating (captured %d trigger(s))", t, len(trigs))

	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, tr := range trigs {
		if _, err := tx.Exec(`DROP TRIGGER IF EXISTS ` + tr.name); err != nil {
			return fmt.Errorf("drop trigger %s: %w", tr.name, err)
		}
	}
	if _, err := tx.Exec(`DROP TABLE IF EXISTS ` + t); err != nil {
		return fmt.Errorf("drop table %s: %w", t, err)
	}
	if _, err := tx.Exec(createSQL); err != nil {
		return fmt.Errorf("recreate %s: %w", t, err)
	}
	for _, tr := range trigs {
		if _, err := tx.Exec(tr.sql); err != nil {
			return fmt.Errorf("recreate trigger %s: %w", tr.name, err)
		}
	}
	if _, err := tx.Exec(fmt.Sprintf(`INSERT INTO %s(%s) VALUES('rebuild')`, t, t)); err != nil {
		return fmt.Errorf("rebuild %s index: %w", t, err)
	}
	return tx.Commit()
}

// Reset is a factory reset: it deletes the database files and re-initialises an
// empty schema. Deletion is by FILE, not row-by-row — a corrupt FTS index can
// block DELETE/DROP (the sync triggers touch the bad index), and the point is a
// guaranteed-clean slate. Everything is gone afterwards — users, sessions,
// settings, preferences, all library content — so the app returns to first-run
// onboarding. The Store's DB handle is swapped to the fresh connection in place;
// callers holding their own *sql.DB (e.g. the session store) must re-read it.
func (s *Store) Reset() error {
	path := s.path
	olog.Alertf("[reset] FACTORY RESET requested — wiping %s and re-initialising an empty database", path)
	if err := s.DB.Close(); err != nil {
		olog.Alertf("[reset] closing existing db before wipe returned: %v (continuing)", err)
	}
	// -wal / -shm first, then the main file. removeWithRetry tolerates Windows
	// briefly holding the handle after Close.
	for _, suffix := range []string{"-wal", "-shm", ""} {
		f := path + suffix
		removed, err := removeWithRetry(f)
		if err != nil {
			olog.Alertf("[reset] could not delete %s: %v — reopening the existing database", f, err)
			if db, oerr := openDB(path); oerr == nil {
				s.DB = db
			}
			return fmt.Errorf("delete %s: %w", f, err)
		}
		if removed {
			olog.Printf("[reset] deleted %s", f)
		}
	}
	db, err := openDB(path)
	if err != nil {
		return fmt.Errorf("reopen after wipe: %w", err)
	}
	s.DB = db
	if err := s.Migrate(); err != nil {
		return fmt.Errorf("migrate fresh database: %w", err)
	}
	olog.Alertf("[reset] database re-initialised empty — app is back at first-run onboarding")
	return nil
}

// removeWithRetry deletes a file, retrying briefly because Windows can hold the
// handle for a moment after the sqlite connection closes. Reports whether a file
// was actually removed (absent = removed:false, err:nil).
func removeWithRetry(path string) (bool, error) {
	var err error
	for i := 0; i < 10; i++ {
		err = os.Remove(path)
		if err == nil {
			return true, nil
		}
		if os.IsNotExist(err) {
			return false, nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return false, err
}
