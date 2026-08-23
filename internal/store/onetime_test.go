package store

import (
	"database/sql"
	"path/filepath"
	"testing"
)

// The one-time pass mechanism (onetime.go), and the 2.2.0 pass that is its first
// user.
//
// Two behaviours carry the whole convention and both are easy to get backwards:
// a pass must run EXACTLY ONCE per database, and a pass that exists to tell an
// upgrader something must say nothing at all on a database that never had the old
// behaviour. The second is the one a from-scratch migration test cannot see,
// because every such test IS a fresh install — which is why the upgrade case here
// migrates to an older schema first and then finishes the job.

// TestAFreshInstallIsNotToldTheDefaultMoved is the false-statement case. A
// database created after 2.2.0 has never had TMDB as its default, so a notice
// saying the default moved would be a sentence the interface made up. The pass
// still records itself, so it is never reconsidered.
func TestAFreshInstallIsNotToldTheDefaultMoved(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "fresh.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	if v := settingValue(t, s, SettingFilmSourceNotice); v != "" {
		t.Errorf("a brand-new database was told the default moved: %q", v)
	}
	if !passApplied(t, s, "2.2.0-tvdb-default-notice") {
		t.Error("the pass did not record itself on a fresh install, so it will run again later " +
			"— by which time the database is no longer fresh and the notice becomes wrong")
	}
}

// TestTheFreshInstallGuardIsWhatSuppressesTheNotice, and it needs its own test
// because the one above cannot fail. A genuinely fresh database has no rows at
// the moment Migrate runs, so the pass writes nothing whether the guard is there
// or not — inverting the guard leaves that test green. This calls the pass
// directly against a database that DOES hold a TMDB pin while claiming to be a
// fresh install, which is the only arrangement where the guard is the thing doing
// the work.
func TestTheFreshInstallGuardIsWhatSuppressesTheNotice(t *testing.T) {
	s := upgradeFrom48(t, `INSERT INTO movies (user_id, title, media_type, tmdb_id)
	                       VALUES (1, 'Suicide Squad', 'movie', 297761)`)
	if _, err := s.DB.Exec(`DELETE FROM settings WHERE key = ?`, SettingFilmSourceNotice); err != nil {
		t.Fatal(err)
	}

	tx, err := s.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if err := runTVDBDefaultNotice(tx, OneTimeEnv{FreshInstall: true}); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	if v := settingValue(t, s, SettingFilmSourceNotice); v != "" {
		t.Errorf("notice = %q — the pass counted the rows instead of stopping at "+
			"FreshInstall, so a new install would be told about a change it never lived through", v)
	}
}

// TestAnUpgradedInstanceWithTMDBPinsIsFlagged is the case the pass exists for:
// titles pinned under the old default, which will go on fetching from TMDB and
// never see a character image until somebody re-verifies them.
func TestAnUpgradedInstanceWithTMDBPinsIsFlagged(t *testing.T) {
	s := upgradeFrom48(t, `INSERT INTO movies (user_id, title, media_type, tmdb_id)
	                       VALUES (1, 'Suicide Squad', 'movie', 297761)`)

	if v := settingValue(t, s, SettingFilmSourceNotice); v != "2.2.0" {
		t.Errorf("notice = %q, want %q — an upgraded instance with a TMDB pin is exactly "+
			"who this is for", v, "2.2.0")
	}
}

// TestAnUpgradedInstanceWithNothingPinnedToTMDBIsNotFlagged. There is no title
// the notice would be about, so there is nothing to say — the same reasoning as
// the fresh install, reached by a different route. The show here carries a
// TheTVDB id, which is a record that can already be re-verified.
func TestAnUpgradedInstanceWithNothingPinnedToTMDBIsNotFlagged(t *testing.T) {
	s := upgradeFrom48(t, `INSERT INTO movies (user_id, title, media_type, tvdb_id)
	                       VALUES (1, 'Game of Thrones', 'show', 121361)`)

	if v := settingValue(t, s, SettingFilmSourceNotice); v != "" {
		t.Errorf("notice = %q on an instance with nothing pinned to TMDB", v)
	}
}

// TestAPassRunsOnceAndOnlyOnce. The record is the whole guard, so a second
// Migrate() — an ordinary restart — must not repeat the work. Proved by removing
// what the pass wrote and checking it does not come back.
func TestAPassRunsOnceAndOnlyOnce(t *testing.T) {
	s := upgradeFrom48(t, `INSERT INTO movies (user_id, title, media_type, tmdb_id)
	                       VALUES (1, 'Suicide Squad', 'movie', 297761)`)
	if _, err := s.DB.Exec(`DELETE FROM settings WHERE key = ?`, SettingFilmSourceNotice); err != nil {
		t.Fatal(err)
	}

	if err := s.Migrate(); err != nil { // the next restart
		t.Fatal(err)
	}
	if v := settingValue(t, s, SettingFilmSourceNotice); v != "" {
		t.Errorf("the pass ran a second time and rewrote %q — a notice the reader "+
			"dismissed would come back on every restart", v)
	}
	var n int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM one_time_passes WHERE name = ?`,
		"2.2.0-tvdb-default-notice").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Errorf("%d records for one pass, want 1", n)
	}
}

// TestAFailingPassNeitherStopsTheBootNorRecordsItself. An error out of Migrate()
// means the application does not start, and a one-time pass is not worth that —
// BackfillCastKeys settled the same argument for a repair whose failure costs one
// row's autofill. Left unrecorded so the next start tries again.
func TestAFailingPassNeitherStopsTheBootNorRecordsItself(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "fail.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	// Run one deliberately broken pass through the same entry point Migrate uses,
	// without registering it globally — a registered probe would run in every
	// other test in this package too.
	broken := OneTimePass{
		Version: "9.9.9", Name: "probe-that-fails", Why: "a test",
		Run: func(tx *sql.Tx, _ OneTimeEnv) error {
			_, err := tx.Exec(`INSERT INTO no_such_table (x) VALUES (1)`)
			return err
		},
	}
	if err := s.runOneTimePass(broken, OneTimeEnv{}); err == nil {
		t.Fatal("a pass writing to a table that does not exist returned no error")
	}
	if passApplied(t, s, "probe-that-fails") {
		t.Error("a failed pass recorded itself, so it will never be retried")
	}
}

func TestCompareVersionsOrdersByNumberNotByString(t *testing.T) {
	// The case a string compare gets backwards, which is the only reason this
	// function exists rather than `<`.
	if compareVersions("2.10.0", "2.9.1") <= 0 {
		t.Error("2.10.0 must sort after 2.9.1")
	}
	if compareVersions("2.2.0", "2.2.0") != 0 {
		t.Error("equal versions must compare equal")
	}
	if compareVersions("2.2", "2.2.0") != 0 {
		t.Error("a missing trailing component is zero, not less")
	}
	if compareVersions("1.0.0", "2.0.0") >= 0 {
		t.Error("1.0.0 must sort before 2.0.0")
	}
}

// upgradeFrom48 is a database that existed before 2.2.0: migrated to 0048, seeded
// with the caller's rows, then fully migrated — so Migrate sees a non-zero schema
// version and the pass knows it is looking at an upgrade rather than a birth.
func upgradeFrom48(t *testing.T, seed string) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "upgrade.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 48)
	if _, err := s.DB.Exec(
		`INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x')`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(seed); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	return s
}

func settingValue(t *testing.T, s *Store, key string) string {
	t.Helper()
	var v string
	err := s.DB.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&v)
	if err != nil {
		return ""
	}
	return v
}

func passApplied(t *testing.T, s *Store, name string) bool {
	t.Helper()
	var n int
	if err := s.DB.QueryRow(
		`SELECT COUNT(*) FROM one_time_passes WHERE name = ?`, name).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n > 0
}
