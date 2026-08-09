package store

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing"
)

// The guard that stops an older binary opening a newer database.
//
// Migrations are forward-only, which means the failure this protects against is
// not an error — it is a SUCCESS. An old build finds every one of its own files
// already applied, skips them all, returns nil, and serves an app in which the
// tables added since its release simply do not exist. No log line, no warning,
// nothing to search for. The operator sees a screen that used to have their
// quotes on it and now does not, and has no way to tell "this build cannot see
// them" apart from "these are gone".
//
// That is not hypothetical: a stray v1.3.0 tag raced v1.7.2 through the image
// workflow, finished later, took `:latest`, and a 1.3.0 container came up on a
// schema-0029 database showing no quotes at all. The data was fine. Proving it
// was fine took an audit of four migrations, and every minute of that audit was
// spent on a question the binary itself could have answered on startup.
//
// So the test is about the message as much as the refusal. A guard that stops
// but does not say what to run is a guard that gets removed by whoever hits it
// at two in the morning.

func TestMigrateRefusesADatabaseFromTheFuture(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.DB.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}

	// Stand in for a newer build having been here first. A version number with
	// no file behind it is exactly what 1.3.0 saw: four recorded migrations it
	// had never heard of and could not undo.
	if _, err := st.DB.Exec(`INSERT INTO schema_version (version) VALUES (9999)`); err != nil {
		t.Fatal(err)
	}

	err = st.Migrate()
	if err == nil {
		t.Fatal("Migrate() accepted a database newer than this build: an older binary would start, " +
			"find nothing to apply, and serve empty screens for every table added since")
	}
	// Both numbers and a next action. Without the recorded version the operator
	// cannot tell which build wrote it; without the advice they cannot tell that
	// the data is intact and the fix is simply to run the newer image again.
	for _, want := range []string{"9999", "newer Tippani", "restore a backup"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %q", err, want)
		}
	}
}

func TestMigrateAcceptsItsOwnSchemaOnEveryRestart(t *testing.T) {
	// The guard compares against the HIGHEST embedded version, so an off-by-one
	// here would refuse to start on a database the binary wrote itself — every
	// restart, for everybody. This is the assertion that makes the one above
	// safe to keep.
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.DB.Close()
	for i := range 3 {
		if err := st.Migrate(); err != nil {
			t.Fatalf("Migrate() run %d on its own schema: %v", i+1, err)
		}
	}
}

func TestMigrateRunsForwardToTheHighestEmbeddedVersion(t *testing.T) {
	// The other direction, which is the whole point of the runner and which the
	// guard now depends on agreeing with. `highest` is computed by parsing the
	// filenames; the recorded MAX(version) is written by applying them. If those
	// two ever disagree — a file numbered out of lexical order, a gap, a rename —
	// the guard either fires on a database the binary wrote itself, or stops
	// firing at all. Asserting they land on the same number ties them together.
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.DB.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}

	names, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		t.Fatal(err)
	}
	highest := 0
	for _, e := range names {
		var v int
		if _, err := fmt.Sscanf(e.Name(), "%d_", &v); err == nil && v > highest {
			highest = v
		}
	}
	if highest == 0 {
		t.Fatal("no migrations found, so this test proves nothing")
	}

	var recorded int
	if err := st.DB.QueryRow(`SELECT COALESCE(MAX(version), 0) FROM schema_version`).Scan(&recorded); err != nil {
		t.Fatal(err)
	}
	if recorded != highest {
		t.Fatalf("recorded schema version %d but the newest embedded migration is %d: "+
			"the downgrade guard compares these two and would misfire", recorded, highest)
	}
}
