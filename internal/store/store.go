// Package store owns the SQLite database: connection, pragmas, migrations.
package store

import (
	"database/sql"
	"fmt"
	"sync"

	_ "modernc.org/sqlite" // pure-Go driver; FTS5 built in, CGO_ENABLED=0
)

type Store struct {
	DB   *sql.DB
	path string // the file DB was opened from, so Reset can delete + reopen it
	// repairMu serializes the index-repair / whole-DB-swap operations
	// (RepairIndex, RepairFTS, ReindexFTS, Recover). Two concurrent searches can
	// each hit a corrupt index and try to rebuild it at once; without this they'd
	// race on DROP/recreate. Held only on the (rare) repair path — healthy queries
	// never touch it. See repair.go.
	repairMu sync.Mutex
}

// Open opens (or creates) the database at path with the pragmas from PLAN §8:
// WAL, synchronous=NORMAL, busy_timeout, foreign keys on.
func Open(path string) (*Store, error) {
	db, err := openDB(path)
	if err != nil {
		return nil, err
	}
	return &Store{DB: db, path: path}, nil
}

// openDB builds the connection with the standard DSN + pool, verifying it opens.
// Shared by Open and Reset so a re-initialised database is configured identically.
func openDB(path string) (*sql.DB, error) {
	// synchronous=FULL (not NORMAL): in WAL, NORMAL only fsyncs at checkpoint, so
	// an unclean stop (docker stop → SIGKILL, or a volume that doesn't guarantee
	// fsync ordering) can leave a torn WAL that surfaces later as "database disk
	// image is malformed". FULL fsyncs the WAL on every commit, closing that
	// corruption window. Write volume here is low (imports, edits — never a hot
	// path), so the extra fsync is negligible.
	dsn := fmt.Sprintf(
		"file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=synchronous(FULL)",
		path,
	)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	// Modest pool: WAL allows concurrent readers alongside a single writer.
	db.SetMaxOpenConns(4)
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	return db, nil
}

// Path is the on-disk database file this store was opened from.
func (s *Store) Path() string { return s.path }

func (s *Store) Close() error { return s.DB.Close() }

// Checkpoint folds the write-ahead log back into the main database file and
// truncates it (PRAGMA wal_checkpoint(TRUNCATE)). Called on graceful shutdown so
// the on-disk file is complete and self-consistent before the process exits —
// an unclean kill afterwards then has no un-checkpointed WAL to tear. Best-effort:
// a busy checkpoint is not fatal (the WAL is still valid and replays on reopen).
func (s *Store) Checkpoint() error {
	_, err := s.DB.Exec(`PRAGMA wal_checkpoint(TRUNCATE)`)
	return err
}
