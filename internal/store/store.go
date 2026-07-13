// Package store owns the SQLite database: connection, pragmas, migrations.
package store

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite" // pure-Go driver; FTS5 built in, CGO_ENABLED=0
)

type Store struct {
	DB   *sql.DB
	path string // the file DB was opened from, so Reset can delete + reopen it
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
	dsn := fmt.Sprintf(
		"file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=synchronous(NORMAL)",
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
