package store

import (
	"fmt"
	"sort"
	"strings"
)

// Backup & restore support (§ backup): the snapshot primitive. The restore's swap
// is Swap (swap.go). The tar/file plumbing lives in httpapi (it owns the data dir);
// this package owns the database lifecycle.

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
