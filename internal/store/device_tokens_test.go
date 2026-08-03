package store

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// The rest of the suite only ever migrates a fresh, empty database. A real
// upgrade applies 0020 to a box with years of highlights in it, so these tests
// seed data at the 0019 schema first and assert it survives — the failure mode
// a from-scratch migration test cannot see.

// migrateThrough applies embedded migrations up to and including maxVersion,
// mirroring Migrate() — including its skip of already-recorded versions — but
// bounded, so a test can stand at an older schema and then step forward one
// migration at a time.
//
// Prefer this to the older "delete a schema_version row and call Migrate()
// again" trick for replaying a single migration: that only works while the
// migration under test is the head, because Migrate() resumes from
// MAX(version). Adding any newer migration silently turns such a test into a
// no-op that still passes its setup and fails its assertions.
func migrateThrough(t *testing.T, s *Store, maxVersion int) {
	t.Helper()
	if _, err := s.DB.Exec(
		`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`,
	); err != nil {
		t.Fatal(err)
	}
	var current int
	if err := s.DB.QueryRow(`SELECT COALESCE(MAX(version), 0) FROM schema_version`).Scan(&current); err != nil {
		t.Fatal(err)
	}
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		t.Fatal(err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	for _, name := range names {
		var version int
		if _, err := fmt.Sscanf(name, "%d_", &version); err != nil {
			t.Fatalf("migration %q: bad name", name)
		}
		if version <= current || version > maxVersion {
			continue
		}
		body, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := s.DB.Exec(string(body)); err != nil {
			t.Fatalf("apply %s: %v", name, err)
		}
		if _, err := s.DB.Exec(`INSERT INTO schema_version (version) VALUES (?)`, version); err != nil {
			t.Fatal(err)
		}
	}
}

// openAt19 returns a store migrated to the pre-0020 schema and seeded with one
// user, book, movie, annotation and dialogue.
func openAt19(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 19)

	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed %q: %v", q, err)
		}
	}
	exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'alice', 'x', 1)`)
	exec(`INSERT INTO books (id, user_id, title, author) VALUES (1, 1, 'Invisible Cities', 'Italo Calvino')`)
	exec(`INSERT INTO movies (id, user_id, title, director) VALUES (1, 1, 'Stalker', 'Andrei Tarkovsky')`)
	exec(`INSERT INTO annotations (id, book_id, quote, color, source, dedupe_hash)
	      VALUES (1, 1, 'Cities, like dreams, are made of desires and fears.', 'yellow', 'manual', 'h1')`)
	exec(`INSERT INTO dialogues (id, movie_id, quote, dedupe_hash)
	      VALUES (1, 1, 'Let everything that has been planned come true.', 'h2')`)
	return s
}

func TestMigration0020OnPopulatedDB(t *testing.T) {
	s := openAt19(t)

	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}

	// Every seeded row survived the upgrade.
	for _, tc := range []struct{ table, want string }{
		{"books", "Invisible Cities"},
		{"movies", "Stalker"},
	} {
		var title string
		if err := s.DB.QueryRow(`SELECT title FROM ` + tc.table + ` WHERE id = 1`).Scan(&title); err != nil {
			t.Fatalf("%s row lost: %v", tc.table, err)
		}
		if title != tc.want {
			t.Fatalf("%s title: got %q want %q", tc.table, title, tc.want)
		}
	}
	for _, table := range []string{"annotations", "dialogues"} {
		var n int
		if err := s.DB.QueryRow(`SELECT count(*) FROM ` + table).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 1 {
			t.Fatalf("%s: got %d rows want 1", table, n)
		}
	}
}

// TestMigration0020BackfillsUpdatedAt: books and movies gain updated_at, which
// must start life equal to created_at rather than NULL — a mobile client sorting
// or reconciling on it would otherwise see every pre-upgrade row as unknown.
func TestMigration0020BackfillsUpdatedAt(t *testing.T) {
	s := openAt19(t)
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}

	for _, table := range []string{"books", "movies"} {
		var created, updated string
		err := s.DB.QueryRow(
			`SELECT created_at, COALESCE(updated_at, '') FROM ` + table + ` WHERE id = 1`).
			Scan(&created, &updated)
		if err != nil {
			t.Fatalf("%s: %v", table, err)
		}
		if updated == "" {
			t.Fatalf("%s.updated_at was not backfilled", table)
		}
		if updated != created {
			t.Fatalf("%s.updated_at: got %q want it to match created_at %q", table, updated, created)
		}
	}
}

// TestMigration0020DeviceTokensSchema pins the shape the auth layer depends on,
// including the cascade that stops a deleted user's tokens outliving them.
func TestMigration0020DeviceTokensSchema(t *testing.T) {
	s := openAt19(t)
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}

	if _, err := s.DB.Exec(
		`INSERT INTO device_tokens (token_hash, user_id, name) VALUES ('abc', 1, 'Pixel')`,
	); err != nil {
		t.Fatalf("insert device token: %v", err)
	}

	// created_at defaults, last_seen_at starts NULL.
	var created, lastSeen any
	if err := s.DB.QueryRow(
		`SELECT created_at, last_seen_at FROM device_tokens WHERE token_hash = 'abc'`).
		Scan(&created, &lastSeen); err != nil {
		t.Fatal(err)
	}
	if created == nil {
		t.Fatal("created_at should default to now")
	}
	if lastSeen != nil {
		t.Fatalf("last_seen_at should start NULL, got %v", lastSeen)
	}

	// token_hash is UNIQUE even though id is the key: one row per credential.
	if _, err := s.DB.Exec(
		`INSERT INTO device_tokens (token_hash, user_id, name) VALUES ('abc', 1, 'Other')`,
	); err == nil {
		t.Fatal("duplicate token_hash should violate the unique constraint")
	}

	// Deleting the user takes their tokens with them.
	if _, err := s.DB.Exec(`DELETE FROM users WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := s.DB.QueryRow(`SELECT count(*) FROM device_tokens`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("device tokens should cascade on user delete, %d left", n)
	}
}
