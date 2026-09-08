package store

import (
	"path/filepath"
	"testing"
)

// Migrations 0067 and 0068 widen utterances.kind's CHECK to admit `poem` and then
// `song`. Neither rebuilds the table: each parks a new column beside the old one,
// COPIES THE VALUES ACROSS, drops the old and renames. See 0067's own header for
// why RENAME COLUMN is safe here and why the index has to go first.
//
// THE COPY IS THE WHOLE RISK AND IT HAD NO TEST. A `poem` accepted and a `radio`
// refused both prove the new CHECK; neither says a word about the six values
// already in the column. Delete `UPDATE utterances SET kind_wide = kind` from
// both files and the schema is still correct, the vocabulary tests still pass,
// and every standalone quote in a real library silently becomes kindless — on a
// forward-only migration, so there is nothing to roll back to. That is the loss
// this file exists to make loud, and it is why the assertion is on the values
// rather than on the column.

// openAt66 returns a store at the pre-0067 schema: kind constrained to 0053's six.
func openAt66(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 66)
	return s
}

// kindsAt66 is 0053's vocabulary — every value that can already be in the column
// when 0067 runs. The empty string is one of them and is listed deliberately: it
// is what an untyped quote stores, so it is the value most rows actually hold,
// and a copy that dropped only the non-empty ones would still pass a test that
// checked a `speech` and nothing else.
var kindsAt66 = []string{"", "speech", "letter", "essay", "proverb", "other"}

// seedKinds writes one quote per kind and returns kind -> the quote's text, so a
// later read can prove the ROW is the same row rather than merely counting six.
func seedKinds(t *testing.T, s *Store) map[string]string {
	t.Helper()
	exec(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'reader', 'x')`)
	want := map[string]string{}
	for _, k := range kindsAt66 {
		text := "line-" + k
		want[k] = text
		exec(t, s, `INSERT INTO utterances (user_id, quote, color, kind, dedupe_hash)
		            VALUES (1, ?, 'yellow', ?, ?)`, text, k, "h-"+k)
	}
	return want
}

// assertKindsSurvived reads every quote back BY ITS TEXT and checks the kind it
// carries. Keyed on the text and not on the kind on purpose: a copy that blanked
// the column would leave six rows whose kinds all read "", and a query that asked
// "what is stored under `speech`" would find nothing and have to guess whether
// the row or the value was lost.
func assertKindsSurvived(t *testing.T, s *Store, want map[string]string, after string) {
	t.Helper()
	for kind, text := range want {
		var got string
		if err := s.DB.QueryRow(
			`SELECT kind FROM utterances WHERE quote = ?`, text).Scan(&got); err != nil {
			t.Fatalf("after %s the row holding %q is gone: %v", after, text, err)
		}
		if got != kind {
			t.Errorf("after %s the quote stored as kind %q reads as %q — the widening did not carry its values across",
				after, kind, got)
		}
	}
}

func TestWideningTheKindColumnForPoemKeepsEveryKindAlreadyStored(t *testing.T) {
	s := openAt66(t)
	want := seedKinds(t, s)
	migrateThrough(t, s, 67)
	assertKindsSurvived(t, s, want, "0067")
}

// Separately from the one above, because the two migrations each do their own copy
// and a single test that ran both would report one failure for either. 0068's copy
// went in as a duplicate of 0067's; a duplicate is exactly the kind of statement
// that gets tidied out of one file and not the other.
func TestWideningTheKindColumnForSongKeepsEveryKindAlreadyStored(t *testing.T) {
	s := openAt66(t)
	want := seedKinds(t, s)
	migrateThrough(t, s, 67)
	migrateThrough(t, s, 68)
	assertKindsSurvived(t, s, want, "0068")
}

// And the same over a full Migrate(), which is what a real upgrade runs. The two
// above pin WHICH migration lost a value; this one is the guard that survives
// somebody adding 0069 on top.
func TestAStoredKindSurvivesEveryMigrationAfterIt(t *testing.T) {
	s := openAt66(t)
	want := seedKinds(t, s)
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	assertKindsSurvived(t, s, want, "Migrate()")
}
