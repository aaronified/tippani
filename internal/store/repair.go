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
		olog.Errorf(olog.CodeStoreIntegrityRun, "[integrity] quick_check could not run (database may be unreadable): %v", err)
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
		olog.Errorf(olog.CodeStoreIntegrityRun, "[integrity] quick_check read error (database may be corrupt): %v", err)
		return false
	}
	if len(problems) == 0 {
		olog.Printf("[integrity] OK — database passed quick_check")
		return true
	}
	olog.Errorf(olog.CodeStoreCorruption, "[integrity] DATABASE CORRUPTION DETECTED — %d problem(s):", len(problems))
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
// come back broken. First it tries the cheap in-place path (DROP + recreate +
// rebuild — rebuildFTSTable). If that fails, the index is so corrupt that even
// DROP TABLE reads a bad page and errors ("database disk image is malformed"),
// so it escalates ONCE to Recover — a whole-database rebuild that copies the
// intact base tables into a fresh file and lets the triggers repopulate every
// index, never touching the corrupt pages. Data is preserved throughout (the FTS
// indexes are derived). A failure at both levels is logged loudly and the server
// still starts (search on that scope errors until Profile → Reset all data).
func (s *Store) RepairFTS() {
	s.repairMu.Lock()
	defer s.repairMu.Unlock()
	olog.Printf("[fts] checking %d full-text index(es) for corruption", len(ftsTables))
	needRecover := false
	for _, t := range ftsTables {
		if _, err := s.DB.Exec(fmt.Sprintf(`INSERT INTO %s(%s) VALUES('integrity-check')`, t, t)); err == nil {
			olog.Printf("[fts] %s OK", t)
			continue
		} else {
			olog.Alertf("[fts] %s failed integrity-check (%v) — reconstructing from content", t, err)
		}
		if err := s.rebuildFTSTable(t); err != nil {
			olog.Errorf(olog.CodeStoreFTSRebuild, "[fts] %s in-place reconstruction failed: %v", t, err)
			needRecover = true
		} else {
			olog.Printf("[fts] %s reconstructed successfully", t)
		}
	}
	if needRecover {
		olog.Alertf("[fts] an index is too corrupt to rebuild in place — recovering the whole database by rebuilding it from intact content (no data lost)")
		if err := s.Recover(); err != nil {
			olog.Errorf(olog.CodeStoreRecoverFailed, "[fts] database recovery FAILED: %v — search will error until Profile → Reset all data", err)
		} else {
			olog.Printf("[fts] database recovered — all indexes rebuilt from content, no data lost")
		}
	}
}

// ReindexFTS force-rebuilds every FTS index from its content table, whether or
// not it currently reports corrupt — the non-destructive fix behind Profile →
// "Rebuild search index". If an index is too corrupt to rebuild in place it
// escalates to Recover (whole-database rebuild from content). Returns the tables
// that could NOT be rebuilt (empty on full success, including after a recovery).
func (s *Store) ReindexFTS() []string {
	s.repairMu.Lock()
	defer s.repairMu.Unlock()
	olog.Printf("[fts] reindex requested — reconstructing all %d index(es)", len(ftsTables))
	var failed []string
	for _, t := range ftsTables {
		if err := s.rebuildFTSTable(t); err != nil {
			olog.Errorf(olog.CodeStoreFTSRebuild, "[fts] reindex: %s in-place rebuild failed: %v", t, err)
			failed = append(failed, t)
		} else {
			olog.Printf("[fts] reindex: %s done", t)
		}
	}
	if len(failed) == 0 {
		olog.Printf("[fts] reindex complete — all indexes rebuilt")
		return nil
	}
	olog.Alertf("[fts] reindex: %d index(es) too corrupt for in-place rebuild (%s) — recovering the whole database from content",
		len(failed), strings.Join(failed, ", "))
	if err := s.Recover(); err != nil {
		olog.Errorf(olog.CodeStoreRecoverFailed, "[fts] reindex: database recovery FAILED: %v", err)
		return failed
	}
	olog.Printf("[fts] reindex: database recovered — all indexes rebuilt from content, no data lost")
	return nil
}

// RepairIndex reconstructs a single FTS index in place (DROP + recreate + rebuild
// via rebuildFTSTable) under the repair lock. It is the runtime counterpart to the
// startup RepairFTS: the search path calls it when a live query hits
// "database disk image is malformed", because a bare 'rebuild' re-reads the same
// corrupt pages and can't fix page-level damage — dropping and recreating the
// shadow tables discards them instead. Deliberately does NOT escalate to the
// whole-database Recover(): Recover swaps s.DB, which would race in-flight request
// goroutines on the hot path. If the index is too corrupt for even DROP to
// succeed, this returns the error and the caller surfaces it; that rare case is
// fully healed by RepairFTS→Recover on the next (now-clean) restart or by the
// admin "Rebuild search index" action. table must be one of ftsTables.
func (s *Store) RepairIndex(table string) error {
	s.repairMu.Lock()
	defer s.repairMu.Unlock()
	olog.Tracef("[fts] RepairIndex(%s) — runtime in-place reconstruction", table)
	return s.rebuildFTSTable(table)
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

// Recover rebuilds the database into a fresh file, data intact, when an FTS
// index is so corrupt that even DROP TABLE fails on it. It copies every base
// table — but NONE of the FTS index/shadow tables — into a freshly-migrated
// file, and the sync triggers repopulate the indexes from that copied content as
// it lands. Crucially it NEVER reads the corrupt index pages (only the intact
// base tables), so it succeeds where an in-place DROP/rebuild can't. The fresh
// file then atomically replaces the old one and the DB handle is swapped in
// place (callers holding their own *sql.DB must re-read it).
func (s *Store) Recover() error {
	old := s.path
	tmp := old + ".recover"
	olog.Alertf("[recover] rebuilding database from intact content into %s", tmp)

	// Which tables to copy: real tables only — skip the fts virtual tables and
	// their %_fts_* shadow tables (rebuilt by triggers), sqlite internals, and
	// schema_version (the fresh migrate writes its own).
	rows, err := s.DB.Query(`SELECT name FROM sqlite_master WHERE type='table'
		AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%\_fts' ESCAPE '\'
		AND name NOT LIKE '%\_fts\_%' ESCAPE '\' AND name != 'schema_version'
		ORDER BY name`)
	if err != nil {
		return fmt.Errorf("list tables: %w", err)
	}
	var tables []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			rows.Close()
			return err
		}
		tables = append(tables, n)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	olog.Printf("[recover] copying %d base table(s): %s", len(tables), strings.Join(tables, ", "))

	// Fresh, fully-migrated schema in the temp file (empty tables + empty fts +
	// the sync triggers).
	_, _ = removeWithRetry(tmp)
	_, _ = removeWithRetry(tmp + "-wal")
	_, _ = removeWithRetry(tmp + "-shm")
	fresh, err := openDB(tmp)
	if err != nil {
		return fmt.Errorf("open temp db: %w", err)
	}
	freshStore := &Store{DB: fresh, path: tmp}
	if err := freshStore.Migrate(); err != nil {
		fresh.Close()
		_, _ = removeWithRetry(tmp)
		return fmt.Errorf("migrate temp db: %w", err)
	}

	// Copy content in. FK off (the source was already consistent; this avoids
	// insertion-order constraints); triggers stay ON so the fts indexes fill as
	// rows land. ATTACH reads only the base tables we name — never the corrupt
	// index pages.
	copyErr := func() error {
		if _, err := fresh.Exec(`PRAGMA foreign_keys=OFF`); err != nil {
			return err
		}
		if _, err := fresh.Exec(`ATTACH DATABASE ? AS old`, old); err != nil {
			return fmt.Errorf("attach old db: %w", err)
		}
		defer fresh.Exec(`DETACH DATABASE old`)
		for _, t := range tables {
			q := `INSERT INTO main."` + t + `" SELECT * FROM old."` + t + `"`
			if _, err := fresh.Exec(q); err != nil {
				return fmt.Errorf("copy %s: %w", t, err)
			}
		}
		return nil
	}()
	if copyErr != nil {
		fresh.Close()
		_, _ = removeWithRetry(tmp)
		_, _ = removeWithRetry(tmp + "-wal")
		_, _ = removeWithRetry(tmp + "-shm")
		return copyErr
	}
	if err := fresh.Close(); err != nil {
		return fmt.Errorf("close temp db: %w", err)
	}

	// Swap the fresh file in for the old one, then reopen the live handle on it.
	if err := s.DB.Close(); err != nil {
		olog.Alertf("[recover] closing old db returned: %v (continuing)", err)
	}
	for _, suffix := range []string{"-wal", "-shm", ""} {
		if _, err := removeWithRetry(old + suffix); err != nil {
			// Can't clear the old file — reopen it so the server isn't db-less.
			if db, oerr := openDB(old); oerr == nil {
				s.DB = db
			}
			return fmt.Errorf("remove old %s: %w", old+suffix, err)
		}
	}
	_, _ = removeWithRetry(tmp + "-wal")
	_, _ = removeWithRetry(tmp + "-shm")
	if err := os.Rename(tmp, old); err != nil {
		return fmt.Errorf("promote recovered db: %w", err)
	}
	db, err := openDB(old)
	if err != nil {
		return fmt.Errorf("reopen recovered db: %w", err)
	}
	s.DB = db
	olog.Alertf("[recover] done — database rebuilt, all rows preserved")
	return nil
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
			olog.Errorf(olog.CodeStoreResetDelete, "[reset] could not delete %s: %v — reopening the existing database", f, err)
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
