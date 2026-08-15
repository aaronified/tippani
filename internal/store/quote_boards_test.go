package store

import (
	"path/filepath"
	"testing"
)

// Migration 0036 turns 0035's three fixed categories into rows the reader owns.
//
// THE BACKFILL IS THE WHOLE RISK. Everything else in the file is a CREATE TABLE
// that either runs or does not; the UPDATE that maps every existing quote onto a
// board is the step that can succeed and be wrong, and the failure looks like a
// working app whose filing has been rearranged. A reader whose proverbs land in
// Others cannot tell that from having filed them there.
//
// So these assertions are about WHICH board each quote landed on, per user, not
// about how many boards exist.

// openAt35 returns a store at the pre-0036 schema: categories, no boards.
func openAt35(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 35)
	return s
}

// Two readers, so the per-user scoping is exercised rather than assumed: one
// with all three categories, one with only proverbs. The second is the
// interesting case — they must NOT be given a Speeches board they never used,
// but they must still get an Others to be the default.
func seedForBoards(t *testing.T, s *Store) {
	t.Helper()
	ex := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	ex(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'reader', 'x', 1)`)
	ex(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (2, 'other', 'x', 0)`)

	q := func(id, uid int, text, cat string) {
		ex(`INSERT INTO utterances (id, user_id, quote, category, dedupe_hash) VALUES (?, ?, ?, ?, ?)`,
			id, uid, text, cat, "h-utt-"+text[:3])
	}
	q(11, 1, "A stitch in time saves nine", "proverb")
	q(12, 1, "Ask not what your country can do", "speech")
	q(13, 1, "Something a friend said", "other")
	q(14, 1, "Many hands make light work", "proverb")
	q(21, 2, "Barking dogs seldom bite", "proverb")
}

func boardOf(t *testing.T, s *Store, utteranceID int) string {
	t.Helper()
	var name string
	err := s.DB.QueryRow(`SELECT b.name FROM utterances u JOIN boards b ON b.id = u.board_id
	                      WHERE u.id = ?`, utteranceID).Scan(&name)
	if err != nil {
		t.Fatalf("utterance %d has no board: %v", utteranceID, err)
	}
	return name
}

func TestBoardsBackfillFilesEveryQuoteWhereItWas(t *testing.T) {
	s := openAt35(t)
	seedForBoards(t, s)
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	for _, c := range []struct {
		id   int
		want string
	}{
		{11, "Proverbs"},
		{12, "Speeches"},
		{13, "Others"},
		{14, "Proverbs"},
		{21, "Proverbs"},
	} {
		if got := boardOf(t, s, c.id); got != c.want {
			t.Errorf("utterance %d landed on %q, want %q", c.id, got, c.want)
		}
	}

	// Not one quote may be left unfiled. This is the assertion the ON DELETE
	// RESTRICT and every count downstream depend on.
	var unfiled int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM utterances WHERE board_id IS NULL`).Scan(&unfiled); err != nil {
		t.Fatal(err)
	}
	if unfiled != 0 {
		t.Errorf("%d quotes have no board", unfiled)
	}
}

func TestBoardsAreScopedToTheirReader(t *testing.T) {
	s := openAt35(t)
	seedForBoards(t, s)
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	names := func(uid int) []string {
		rows, err := s.DB.Query(`SELECT name FROM boards WHERE user_id = ? ORDER BY pos, name`, uid)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		var out []string
		for rows.Next() {
			var n string
			if err := rows.Scan(&n); err != nil {
				t.Fatal(err)
			}
			out = append(out, n)
		}
		return out
	}

	got1 := names(1)
	want1 := []string{"Proverbs", "Speeches", "Others"} // pos order: 0, 1, 2
	if len(got1) != len(want1) {
		t.Fatalf("reader 1 has boards %v, want %v", got1, want1)
	}
	for i := range want1 {
		if got1[i] != want1[i] {
			t.Errorf("reader 1 board %d is %q, want %q", i, got1[i], want1[i])
		}
	}

	// Reader 2 only ever had proverbs, so they get Proverbs — and an Others,
	// because the default board has to point somewhere and the ＋ pressed
	// outside a board has to have somewhere to write. They must NOT get a
	// Speeches board they never used.
	got2 := names(2)
	if len(got2) != 2 || got2[0] != "Proverbs" || got2[1] != "Others" {
		t.Errorf("reader 2 has boards %v, want [Proverbs Others]", got2)
	}
}

func TestEveryReaderGetsADefaultBoardPreference(t *testing.T) {
	s := openAt35(t)
	seedForBoards(t, s)
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	for _, uid := range []int{1, 2} {
		var boardID, othersID int64
		err := s.DB.QueryRow(
			`SELECT CAST(json_extract(preferences, '$.defaultBoardId') AS INTEGER) FROM users WHERE id = ?`, uid,
		).Scan(&boardID)
		if err != nil {
			t.Fatalf("reader %d: %v", uid, err)
		}
		if err := s.DB.QueryRow(
			`SELECT id FROM boards WHERE user_id = ? AND name = 'Others'`, uid,
		).Scan(&othersID); err != nil {
			t.Fatalf("reader %d has no Others board: %v", uid, err)
		}
		// It points at a ROW, not a name — so renaming Others keeps it working
		// and nothing in the code has to know the word.
		if boardID != othersID {
			t.Errorf("reader %d defaultBoardId = %d, want the Others board %d", uid, boardID, othersID)
		}
	}
}

// The rule that lets all three seeded boards stay ordinary: no board has to be
// permanent, because the DATABASE refuses to orphan a quote. A handler that
// forgot to move the quotes first gets an error rather than a silent loss.
func TestABoardWithQuotesOnItCannotBeDeleted(t *testing.T) {
	s := openAt35(t)
	seedForBoards(t, s)
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	var proverbs int64
	if err := s.DB.QueryRow(`SELECT id FROM boards WHERE user_id = 1 AND name = 'Proverbs'`).Scan(&proverbs); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(`DELETE FROM boards WHERE id = ?`, proverbs); err == nil {
		t.Fatal("deleted a board that still had quotes on it")
	}

	// Move them off and the same delete succeeds — the refusal is about the
	// quotes, not about the board.
	var others int64
	if err := s.DB.QueryRow(`SELECT id FROM boards WHERE user_id = 1 AND name = 'Others'`).Scan(&others); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(`UPDATE utterances SET board_id = ? WHERE board_id = ?`, others, proverbs); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(`DELETE FROM boards WHERE id = ?`, proverbs); err != nil {
		t.Fatalf("empty board refused deletion: %v", err)
	}
}

// A library with no standalone quotes at all gets no boards and no default,
// which is correct: boards are seeded from what the reader actually filed, and
// somebody who has never saved a standalone quote should not open the app to
// three empty shelves.
func TestAReaderWithNoQuotesGetsNoBoards(t *testing.T) {
	s := openAt35(t)
	if _, err := s.DB.Exec(
		`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'reader', 'x', 1)`,
	); err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM boards`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("seeded %d boards for a reader with no quotes", n)
	}
}
