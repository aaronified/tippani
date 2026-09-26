package jobs_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/store"
)

// openStore is the store the server runs on: a real SQLite file, migrated to
// head, closed when the test ends.
func openStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "tippani.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if err := st.Migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return st
}

// attached is a logbook on st that is closed (flushed, then stopped) before the
// store is, as shutdown does it.
func attached(t *testing.T, st *store.Store) *jobs.Logbook {
	t.Helper()
	lb := jobs.NewLogbook()
	lb.Attach(st)
	t.Cleanup(func() { closeLogbook(lb) })
	return lb
}

func closeLogbook(lb *jobs.Logbook) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	lb.Close(ctx)
}

func flush(t *testing.T, lb *jobs.Logbook) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := lb.Flush(ctx); err != nil {
		t.Fatalf("flush: %v — a logged line was never written", err)
	}
}

func count(t *testing.T, db *sql.DB, q string, args ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(q, args...).Scan(&n); err != nil {
		t.Fatalf("%s: %v", q, err)
	}
	return n
}

func strings1(t *testing.T, db *sql.DB, q string, args ...any) []string {
	t.Helper()
	rows, err := db.Query(q, args...)
	if err != nil {
		t.Fatalf("%s: %v", q, err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}

func exec(t *testing.T, db *sql.DB, q string, args ...any) sql.Result {
	t.Helper()
	res, err := db.Exec(q, args...)
	if err != nil {
		t.Fatalf("%s: %v", q, err)
	}
	return res
}

// eventually polls cond until it holds or the deadline passes. For what happens
// on the drainer's own time after a Flush has returned: a prune runs once the
// batch that triggered it has landed.
func eventually(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(30 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("never happened: %s", what)
		}
		time.Sleep(20 * time.Millisecond)
	}
}
