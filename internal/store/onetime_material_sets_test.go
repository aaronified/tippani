package store

import (
	"path/filepath"
	"strings"
	"testing"
)

// The 3.0.0 pass that carries a reader's aesthetic across to a material set.
//
// WHAT IS AT RISK IS NOT AN ERROR, AND THAT IS THE WHOLE REASON FOR THESE TESTS.
// Dropping "paper" and "film" from the allowed values retires them with no pass at
// all — loadPrefs heals an unrecognised value and every reader lands on the default.
// So a pass that silently does nothing produces no failure, no log line and no
// complaint except from the people who had chosen film, whose app looks different one
// morning and who have nothing to point at. The three failures worth testing are the
// three nobody would notice: a choice not carried, a choice carried to the wrong set,
// and every OTHER preference wiped by json_set meeting an empty blob.

// upgradeWithPrefs seeds a database that already existed, so the pass sees an upgrade
// rather than a fresh install — the one case it declines.
func upgradeWithPrefs(t *testing.T, prefs string) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "prefs.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	// A DATABASE THAT ALREADY EXISTED is the precondition, and the only thing that
	// makes it one is a recorded schema version before Migrate() runs. So the schema
	// is brought fully up first, the row is seeded through it, and Migrate() is then
	// called on a database it has nothing left to migrate — which is exactly the
	// shape of an upgrade that only has one-time passes to do.
	migrateThrough(t, s, 1<<30)
	if _, err := s.DB.Exec(
		`INSERT INTO users (id, username, password_hash, preferences) VALUES (1, 'a', 'x', ?)`,
		prefs); err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	return s
}

func storedPrefs(t *testing.T, s *Store) string {
	t.Helper()
	var raw string
	if err := s.DB.QueryRow(`SELECT preferences FROM users WHERE id = 1`).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	return raw
}

func setOf(t *testing.T, s *Store) string {
	t.Helper()
	var v *string
	if err := s.DB.QueryRow(
		`SELECT json_extract(preferences, '$.materialSet') FROM users WHERE id = 1`).Scan(&v); err != nil {
		t.Fatal(err)
	}
	if v == nil {
		return ""
	}
	return *v
}

func TestFilmBecomesTheFilmAssemblySet(t *testing.T) {
	// The one that matters. Film was the deliberate choice of the readers who made
	// it, and Film assembly is the same room: a steel bench, brushed alloy, matte
	// stock, glass on the poster.
	s := upgradeWithPrefs(t, `{"aesthetic":"film","theme":"dark","accent":"ochre"}`)
	if got := setOf(t, s); got != "film-assembly" {
		t.Fatalf("film carried to %q, want film-assembly", got)
	}
}

func TestPaperBecomesTheManuscriptSet(t *testing.T) {
	s := upgradeWithPrefs(t, `{"aesthetic":"paper","theme":"light"}`)
	if got := setOf(t, s); got != "manuscript" {
		t.Fatalf("paper carried to %q, want manuscript", got)
	}
}

func TestCarryingTheSetKeepsEveryOtherPreference(t *testing.T) {
	// json_set on a NULL or empty blob yields NULL, which would replace the whole
	// preference object with nothing. The pass COALESCEs for that reason, and this is
	// the test that would notice if somebody simplified it away: an upgrade that
	// silently forgets a reader's accent, theme and separators is far worse than one
	// that forgets which aesthetic they had.
	s := upgradeWithPrefs(t,
		`{"aesthetic":"film","theme":"dark","accent":"olive","creditSeparators":"&"}`)
	raw := storedPrefs(t, s)
	for _, want := range []string{`"theme":"dark"`, `"accent":"olive"`, `"creditSeparators":"&"`} {
		if !strings.Contains(raw, want) {
			t.Fatalf("preferences lost %s: %s", want, raw)
		}
	}
}

func TestAReaderWhoNeverChoseIsLeftAlone(t *testing.T) {
	// No aesthetic stored means nothing was chosen, so there is nothing to carry and
	// writing a set would invent a decision. loadPrefs supplies the default on read.
	s := upgradeWithPrefs(t, `{"theme":"dark","accent":"slate"}`)
	if got := setOf(t, s); got != "" {
		t.Fatalf("invented a material set %q for a reader who never chose one", got)
	}
}

func TestAnEmptyPreferenceBlobSurvives(t *testing.T) {
	// The COALESCE/NULLIF case, directly: a user row whose preferences column is the
	// empty string rather than '{}'. Nothing to carry, and nothing to corrupt.
	s := upgradeWithPrefs(t, ``)
	if raw := storedPrefs(t, s); raw != "" {
		t.Fatalf("empty preference blob rewritten to %q", raw)
	}
}

func TestAFreshInstallIsNotToldAnythingWasCarried(t *testing.T) {
	// A database created after 3.0.0 has never stored an aesthetic. The pass records
	// itself and writes nothing, so it never runs again.
	s, err := Open(filepath.Join(t.TempDir(), "fresh.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(
		`INSERT INTO users (id, username, password_hash, preferences) VALUES (1, 'a', 'x', '{"aesthetic":"film"}')`); err != nil {
		t.Fatal(err)
	}
	// Seeded AFTER the pass ran, which is the point: on a fresh install the pass has
	// already declined, so even a blob carrying the retired key is left as it is.
	if got := setOf(t, s); got != "" {
		t.Fatalf("fresh install carries a material set %q", got)
	}
	var n int
	if err := s.DB.QueryRow(
		`SELECT COUNT(*) FROM one_time_passes WHERE name = ?`, "3.0.0-material-sets").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("pass recorded %d times on a fresh install, want 1", n)
	}
}
