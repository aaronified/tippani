package store

import (
	"embed"
	"fmt"
	"sort"
	"strings"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Migrate applies embedded migrations newer than the recorded schema version.
// Files are named NNNN_description.sql and applied in lexical order, each in
// its own transaction.
func (s *Store) Migrate() error {
	if _, err := s.DB.Exec(
		`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`,
	); err != nil {
		return err
	}
	var current int
	if err := s.DB.QueryRow(
		`SELECT COALESCE(MAX(version), 0) FROM schema_version`,
	).Scan(&current); err != nil {
		return err
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	// Parse every version up front, so the newest one this binary carries is
	// known before anything is applied. The guard below needs it, and a misnamed
	// file is better caught before a transaction is open than halfway through.
	versions := make([]int, len(names))
	highest := 0
	for i, name := range names {
		if _, err := fmt.Sscanf(name, "%d_", &versions[i]); err != nil {
			return fmt.Errorf("migration %q: bad name (want NNNN_description.sql)", name)
		}
		if versions[i] > highest {
			highest = versions[i]
		}
	}

	// REFUSE TO OPEN A DATABASE FROM THE FUTURE.
	//
	// Migrations are forward-only, so an older binary finds nothing to apply and
	// would otherwise start perfectly happily against a schema it cannot read —
	// silently, which is the whole problem. The tables added since its release do
	// not exist in its world, so it renders an empty screen where a feature used
	// to be, and that is indistinguishable from having lost the data.
	//
	// This has happened. A stray v1.3.0 tag went up alongside v1.7.2, both fired
	// the image workflow, and the older build finished ~2 minutes later and so
	// claimed `:latest`. A 1.3.0 container came up against a schema-0029
	// database and reported no quotes at all. Nothing was damaged — 1.3.0 has no
	// code that touches anything added after 0025 — but nothing said so either,
	// and establishing that took an audit of four migrations. A binary that stops
	// with both version numbers in the message answers it in one line.
	//
	// Stopping is the safe direction: refusing to start leaves the data exactly
	// as the newer build wrote it, and the remedy is simply to run that build.
	// Starting is the direction with no way back.
	if current > highest {
		return fmt.Errorf(
			"database is at schema version %d but this build only knows %d — it was written by a newer Tippani. "+
				"Downgrades are not supported: run the newer version again, or restore a backup taken before the upgrade",
			current, highest)
	}

	for i, name := range names {
		version := versions[i]
		if version <= current {
			continue
		}
		body, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		tx, err := s.DB.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(string(body)); err != nil {
			tx.Rollback()
			return fmt.Errorf("apply %s: %w", name, err)
		}
		if _, err := tx.Exec(`INSERT INTO schema_version (version) VALUES (?)`, version); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}

	// Two repairs that cannot be expressed as SQL, both for the same reason —
	// SQLite has neither a sha256 nor a Unicode-aware lower() — and both
	// deliberately unguarded and re-run every time. See BackfillDialogueHashes
	// and BackfillCastKeys for why neither is flag-guarded.
	//
	// Re-hash the dialogues that 1.3.0 wrote with a text-only dedupe hash while
	// already carrying an episode; then re-fold the cast lookup keys that 0048's
	// backfill could only approximate in ASCII.
	if err := s.BackfillDialogueHashes(); err != nil {
		return err
	}
	return s.BackfillCastKeys()
}
