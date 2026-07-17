package store

import (
	"fmt"
	"sort"
	"strings"

	"tippani/internal/olog"
)

// Backup & restore support (§ backup): the snapshot primitive and the
// close/reopen pair the restore swap needs. The tar/file plumbing lives in
// httpapi (it owns the data dir); this file owns the database lifecycle.

// VacuumInto writes a compact, transactionally consistent snapshot of the live
// database to path (SQLite VACUUM INTO): one read transaction, concurrent
// writers unaffected, and no -wal/-shm sidecars in the output. The target must
// not already exist.
func (s *Store) VacuumInto(path string) error {
	if _, err := s.DB.Exec(`VACUUM INTO ?`, path); err != nil {
		return fmt.Errorf("vacuum into %s: %w", path, err)
	}
	return nil
}

// CloseForSwap checkpoints and closes the live handle so the database files can
// be replaced on disk (restore). sql.DB.Close waits for in-flight queries; new
// queries error until ReopenAfterSwap — the same accepted window as a factory
// reset.
func (s *Store) CloseForSwap() error {
	if err := s.Checkpoint(); err != nil {
		olog.Alertf("[backup] pre-swap checkpoint returned: %v (continuing)", err)
	}
	return s.DB.Close()
}

// ReopenAfterSwap opens whatever file now sits at the store's path and brings
// it up exactly like boot: migrate forward, integrity-check, FTS self-heal.
// The live handle is swapped in place; callers holding their own *sql.DB
// (the session store) must re-read it.
func (s *Store) ReopenAfterSwap() error {
	db, err := openDB(s.path)
	if err != nil {
		return fmt.Errorf("reopen after swap: %w", err)
	}
	s.DB = db
	if err := s.Migrate(); err != nil {
		return fmt.Errorf("migrate restored database: %w", err)
	}
	s.CheckIntegrity()
	s.RepairFTS()
	return nil
}

// MaxMigrationVersion is the highest embedded migration number this binary can
// apply — a restore rejects databases whose schema_version is newer (made by a
// newer Tippani; forward-only migrations can't downgrade them).
func MaxMigrationVersion() (int, error) {
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return 0, err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	if len(names) == 0 {
		return 0, fmt.Errorf("no embedded migrations")
	}
	sort.Strings(names)
	var version int
	if _, err := fmt.Sscanf(names[len(names)-1], "%d_", &version); err != nil {
		return 0, fmt.Errorf("migration %q: bad name: %w", names[len(names)-1], err)
	}
	return version, nil
}
