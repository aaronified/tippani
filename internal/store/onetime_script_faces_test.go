package store

import (
	"database/sql"
	"path/filepath"
	"testing"
)

// The 3.1.0 script-face pass: a preference whose control has been removed is let
// go of, and everything else about that account's type is left alone.
//
// WHAT MAKES THIS WORTH A TEST rather than a reading of the SQL: the failure mode
// is silent and permanent. A reader who chose a Bengali face before this release
// goes on seeing every Bengali glyph in it for ever, with no row on any screen to
// say where it came from and nothing anywhere to change it — the app remembering
// a decision the reader can no longer make.
func TestTheScriptFacePassLetsGoOfWhatNobodyCanReach(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed %q: %v", q, err)
		}
	}
	// One reader who set both scripts and a modifier, one who set a script inside
	// a per-language overlay and keeps a real face in the same locale, one who
	// set only faces that still have controls, one who never chose — and one
	// whose document does not parse, which must not take the others down with it.
	exec(`INSERT INTO users (id, username, password_hash, is_admin, preferences) VALUES
	      (1, 'alice', 'x', 1, '{"fontBengali":"kalpurush","fontDevanagari":"hind","fontBengaliStyle":"bold","fontDisplay":"literata"}'),
	      (2, 'bob',   'x', 0, '{"fontsByLocale":"{\"bn\":{\"bengali\":\"kalpurush\",\"display\":\"literata\"},\"hi\":{\"devanagari\":\"hind\"}}"}'),
	      (3, 'carol', 'x', 0, '{"fontDisplay":"newsreader","fontMono":"jetbrains-mono"}'),
	      (4, 'dave',  'x', 0, '{}'),
	      (5, 'erin',  'x', 0, 'not json at all')`)

	tx, err := s.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	if err := clearScriptFaces(tx, OneTimeEnv{FreshInstall: false}); err != nil {
		tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	field := func(uid int64, key string) (string, bool) {
		t.Helper()
		var v sql.NullString
		if err := s.DB.QueryRow(
			`SELECT json_extract(preferences, '$.'||?) FROM users WHERE id = ?`, key, uid).Scan(&v); err != nil {
			t.Fatalf("read %s for %d: %v", key, uid, err)
		}
		return v.String, v.Valid
	}

	// THE POINT OF THE PASS: gone, not emptied. A field set to "" is a stored
	// answer meaning "the built-in", which is a decision; absence is the state a
	// fresh install is in.
	for _, key := range []string{"fontBengali", "fontDevanagari", "fontBengaliStyle"} {
		if _, ok := field(1, key); ok {
			t.Errorf("%s survived the pass", key)
		}
	}
	// AND NOTHING ELSE ABOUT THEIR TYPE MOVED, which is the half that makes this
	// a removal rather than a reset.
	if got, _ := field(1, "fontDisplay"); got != "literata" {
		t.Errorf("the display face was touched: %q", got)
	}
	if got, _ := field(3, "fontDisplay"); got != "newsreader" {
		t.Errorf("an account with no script face was rewritten: %q", got)
	}
	if got, _ := field(3, "fontMono"); got != "jetbrains-mono" {
		t.Errorf("an account with no script face was rewritten: %q", got)
	}

	// THE PER-LANGUAGE OVERLAY IS THE CASE A SINGLE json_remove CANNOT REACH: its
	// keys are locales, so the path is not writable in advance.
	blob, ok := field(2, "fontsByLocale")
	if !ok {
		t.Fatal("the overlay was removed whole")
	}
	if want := `{"bn":{"display":"literata"}}`; blob != want {
		t.Errorf("overlay = %q, want %q", blob, want)
	}

	// A DOCUMENT THAT DOES NOT PARSE IS SKIPPED, NOT FAILED. One unreadable row
	// must not stop every other account being upgraded.
	var raw string
	if err := s.DB.QueryRow(`SELECT preferences FROM users WHERE id = 5`).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	if raw != "not json at all" {
		t.Errorf("the unreadable document was rewritten: %q", raw)
	}
}

// A FRESH INSTALL HAS NOTHING TO LET GO OF, and says so by doing nothing — the
// same contract every other pass in this directory keeps.
func TestTheScriptFacePassSkipsAFreshInstall(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(`INSERT INTO users (id, username, password_hash, is_admin, preferences)
	                        VALUES (1, 'alice', 'x', 1, '{"fontBengali":"kalpurush"}')`); err != nil {
		t.Fatal(err)
	}
	tx, err := s.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	if err := clearScriptFaces(tx, OneTimeEnv{FreshInstall: true}); err != nil {
		tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	var v sql.NullString
	if err := s.DB.QueryRow(`SELECT json_extract(preferences, '$.fontBengali') FROM users WHERE id = 1`).Scan(&v); err != nil {
		t.Fatal(err)
	}
	if !v.Valid {
		t.Error("a fresh install was upgraded anyway")
	}
}
