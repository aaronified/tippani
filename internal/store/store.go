// Package store owns the SQLite database: connection, pragmas, migrations.
package store

import (
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	_ "modernc.org/sqlite" // pure-Go driver; FTS5 built in, CGO_ENABLED=0
)

type Store struct {
	DB *sql.DB
	// LogDB is a second pool on the same file, for the logs alone: one connection,
	// at synchronous=NORMAL. The owner's ruling: "system logs written on their own
	// database connection at synchronous=NORMAL, so logging every request doesn't
	// cost a disk sync each time". Synchronous is a per-connection setting, so DB
	// stays at FULL and nothing a reader saves is any less durable: a FULL commit's
	// fsync of the WAL covers every frame before it, the log's NORMAL ones
	// included. What a crash can lose is the last few log batches, and only those.
	//
	// Only the logbook's drainer writes through it, and only inside LogWrite, which
	// is what keeps it pointed at the right file across a swap. Reads of the log
	// tables go through DB like any other read.
	LogDB *sql.DB
	path  string // the file DB was opened from, so Reset can delete + reopen it
	// repairMu serializes the index-repair / whole-DB-swap operations
	// (RepairIndex, RepairFTS, ReindexFTS, Recover). Two concurrent searches can
	// each hit a corrupt index and try to rebuild it at once; without this they'd
	// race on DROP/recreate. Held only on the (rare) repair path — healthy queries
	// never touch it. See repair.go.
	repairMu sync.Mutex
	// logMu is the swap lock. LogWrite holds it for reading around every write
	// through LogDB, and every swap of the database files holds it for writing
	// from the checkpoint before the files move to the reopen after (swap.go), so
	// the drainer waits out the whole swap with its lines in memory and never
	// writes into a file that is moving.
	//
	// LOCK ORDER: logMu, then repairMu, never the other way round. A swap holds
	// both; the one path that holds repairMu alone (an index rebuild) lets go of
	// it before it escalates to a swap. See ReindexFTS.
	logMu sync.RWMutex
	// gen counts swaps. A consumer that noted a user id under one generation and
	// finds another has no right to trust it any more: the file under it may be a
	// restored one, where that id is somebody else.
	gen atomic.Uint64
}

// Open opens (or creates) the database at path: the library pool and the log
// pool, both on the same file (see openDB for the pragmas and why).
func Open(path string) (*Store, error) {
	s := &Store{path: path}
	if err := s.openPools(true); err != nil {
		return nil, err
	}
	return s, nil
}

// openPools opens both pools on whatever file sits at s.path and swaps them in.
// create says whether a missing file may be made: at Open, yes, because a first
// boot starts from nothing; after a swap, never (swapLocked says why). On failure
// neither is swapped in, so the store keeps the handles it had (closed ones, after
// a swap) rather than nil ones every caller would have to test for.
func (s *Store) openPools(create bool) error {
	db, err := openDB(s.path, create)
	if err != nil {
		return err
	}
	logDB, err := openLogDB(s.path, create)
	if err != nil {
		db.Close()
		return err
	}
	s.DB, s.LogDB = db, logDB
	return nil
}

// busyTimeout is how long a statement waits for SQLite's write lock before it
// fails with SQLITE_BUSY. It is a constant rather than a literal in the DSN because
// ConnWait (health.go) is derived from it, and the two must not drift apart.
const busyTimeout = 5 * time.Second

// openDB builds the library pool (Store.DB) with the standard DSN + pool, verifying
// it opens. Opened by openPools, at Open and after every swap, and by Recover for
// its temp file, so every database is configured identically.
func openDB(path string, create bool) (*sql.DB, error) {
	// synchronous=FULL (not NORMAL): in WAL, NORMAL only fsyncs at checkpoint, so
	// an unclean stop (docker stop → SIGKILL, or a volume that doesn't guarantee
	// fsync ordering) can leave a torn WAL that surfaces later as "database disk
	// image is malformed". FULL fsyncs the WAL on every commit, closing that
	// corruption window. Write volume here is low (imports, edits — never a hot
	// path), so the extra fsync is negligible. The log pool is the one exception,
	// by the owner's ruling, because logging every request IS a hot path; see
	// Store.LogDB for why that costs this pool nothing.
	//
	// _txlock=immediate is what makes busy_timeout actually apply to writes, and it
	// is the fix for the concurrent-write 500 the roadmap carried for two releases.
	// Almost every write transaction here reads before it writes — the duplicate
	// check, the ownership check, the FTS row it is about to update. Under the
	// default DEFERRED locking that means BEGIN takes only a read lock, and the
	// first INSERT has to UPGRADE it. SQLite will not run the busy handler for that
	// upgrade: two transactions that both hold read locks and both want to write
	// would deadlock, so it fails the second one instantly with SQLITE_BUSY instead
	// of waiting. That is why eight concurrent POSTs produced a 500 in 17ms with a
	// 5000ms timeout — the timeout was never consulted.
	//
	// IMMEDIATE takes the write lock at BEGIN, before any reading. There is nothing
	// to upgrade, so a second writer simply waits its turn on the busy handler for
	// up to busy_timeout, which is the behaviour the 5000 was written for. Readers
	// are unaffected: the driver only applies this to read-write transactions, and
	// WAL still lets readers run alongside the writer.
	//
	// This supersedes PLAN §7's single-writer-connection idea, which was aimed at
	// the same symptom via the wrong mechanism: an in-process mutex would have
	// serialised these writers, but it could not have stopped a second Tippani
	// process, a `sqlite3` shell or a restore from doing exactly the same upgrade
	// and failing exactly as fast. The lock order is the bug; the pool size never
	// was. Reads are deliberately left on the 4-connection pool.
	//
	// Modest pool: WAL allows concurrent readers alongside a single writer.
	return openPool(path, "FULL", 4, create)
}

// openLogDB opens the log pool (Store.LogDB): the same file and the same DSN as
// openDB but for synchronous, and one connection. One, because the logbook has one
// writer whose batches run one after another anyway; a second connection would
// only be a second claimant on SQLite's write lock, ahead of somebody's save.
func openLogDB(path string, create bool) (*sql.DB, error) {
	return openPool(path, "NORMAL", 1, create)
}

// openPool is the DSN both pools share (openDB says why each part of it is
// there), differing only in synchronous, in the pool's size, and in whether a
// missing file is created. Without create it asks SQLite for mode=rw, which
// fails on a missing file instead of making an empty one.
func openPool(path, synchronous string, conns int, create bool) (*sql.DB, error) {
	dsn := fmt.Sprintf(
		"file:%s?_txlock=immediate"+
			"&_pragma=busy_timeout(%d)&_pragma=journal_mode(WAL)"+
			"&_pragma=foreign_keys(1)&_pragma=synchronous(%s)",
		path, busyTimeout.Milliseconds(), synchronous,
	)
	if !create {
		dsn += "&mode=rw"
	}
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(conns)
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	return db, nil
}

// Path is the on-disk database file this store was opened from.
func (s *Store) Path() string { return s.path }

// Close closes both pools. It takes the swap lock, so a log batch in flight
// finishes rather than having its connection closed under it.
func (s *Store) Close() error {
	s.logMu.Lock()
	defer s.logMu.Unlock()
	return errors.Join(s.LogDB.Close(), s.DB.Close())
}

// LogWrite runs fn with the log pool, holding the swap lock for reading. It is the
// only way anything writes through LogDB — the logbook's drainer — and the lock is
// the point: a swap holds it for writing from before the files move until both
// pools are open again, so a batch either lands before the swap or waits it out
// and lands in the file the server is on afterwards. fn must not log through
// anything that waits on the logbook, and must not swap.
func (s *Store) LogWrite(fn func(db *sql.DB) error) error {
	s.logMu.RLock()
	defer s.logMu.RUnlock()
	return fn(s.LogDB)
}

// Generation counts the swaps of the database files so far: restores, recoveries
// and factory resets. Anything that noted a user id must note this with it, and
// drop the id when the number has moved (see Store.gen).
func (s *Store) Generation() uint64 { return s.gen.Load() }

// Checkpoint folds the write-ahead log back into the main database file and
// truncates it (PRAGMA wal_checkpoint(TRUNCATE)). Called on graceful shutdown so
// the on-disk file is complete and self-consistent before the process exits —
// an unclean kill afterwards then has no un-checkpointed WAL to tear. Best-effort:
// a busy checkpoint is not fatal (the WAL is still valid and replays on reopen).
func (s *Store) Checkpoint() error {
	_, err := s.DB.Exec(`PRAGMA wal_checkpoint(TRUNCATE)`)
	return err
}
