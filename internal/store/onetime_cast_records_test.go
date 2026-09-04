package store

import "testing"

// The 3.1.0 cast-records pass.
//
// WHAT IT IS FOR, in the words of the report that found it: a film's cast pills
// "open nothing". `work_cast.character_id` is what makes a cast row a door —
// characterImagesFor passes it to the client, chipRows gates a chip's press on it
// — and three of the four writers of that table never set it. So a row fetched
// from a provider had a name, a face and a performer under it, and no
// destination.
//
// THE WRITE PATHS ARE FIXED, and this pass is the other half: a library whose
// cast was fetched before the fix keeps its dead rows for ever otherwise, and
// that is every film anybody has looked up.
//
// WHAT IS PINNED HERE. That the pass reaches a row nobody has touched; that two
// rows of ONE work billing one name share a record while two WORKS never do; that
// it never reaches across accounts; and that it leaves a removed row alone,
// because a reader who deleted a cast row has said they do not want that person.
//
// THE PER-WORK KEY IS THE POINT OF THE MIDDLE ONE, and the first version of this
// test asserted the opposite — that two works billing one name share a record. It
// failed, which is how the policy was found: `backfillCast` keys on (kind, work,
// folded name) and says why in as many words, and ResolveCharacter's header
// refuses account-wide matching for automatic names because it "would silently
// weld forty books together". The assertion below is now the rule rather than my
// guess at it.

// seedDeadCastRows writes the shape a real pre-fix database has: cast rows with
// a character, a performer and no record behind them.
func seedDeadCastRows(t *testing.T, s *Store) {
	t.Helper()
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (2, 'bob', 'x')`)
	mustExecT(t, s, `INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'V for Vendetta')`)
	mustExecT(t, s, `INSERT INTO movies (id, user_id, title) VALUES (2, 1, 'The Matrix')`)
	mustExecT(t, s, `INSERT INTO movies (id, user_id, title) VALUES (3, 2, 'V for Vendetta')`)
	// The reported row: a joined billing with a performer, straight off a provider.
	deadCast(t, s, 1, "movie", 1, "V / William Rookwood", "Hugo Weaving", "provider")
	// The same billing on a SECOND work of the same account: a different character
	// until a reader says otherwise.
	deadCast(t, s, 1, "movie", 2, "V / William Rookwood", "Hugo Weaving", "provider")
	// And the same work billing one character twice — a second performer on the
	// same part, which 0063 permits. Those two rows ARE one character.
	deadCast(t, s, 1, "movie", 1, "V / William Rookwood", "Natalie Portman", "provider")
	// Another account's identical billing, which must never join the first.
	deadCast(t, s, 2, "movie", 3, "V / William Rookwood", "Hugo Weaving", "provider")
	// A row the reader deleted. `origin = 'removed'` is the tombstone that stops a
	// refetch resurrecting it, so giving it a record would manufacture a character
	// for somebody who has been thrown away.
	deadCast(t, s, 1, "movie", 1, "Creedy", "Tim Pigott-Smith", "removed")
	// And a row with no character at all — a performer credited with nobody named
	// yet, which 0063 permits on purpose. There is no name to resolve.
	deadCast(t, s, 1, "movie", 2, "", "Carrie-Anne Moss", "provider")
}

func deadCast(t *testing.T, s *Store, uid int64, kind string, workID int64, character, actor, origin string) {
	t.Helper()
	mustExecT(t, s, `INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key, origin)
	                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		uid, kind, workID, character, CastKey(character), actor, CastKey(actor), origin)
}

func castRecordOf(t *testing.T, s *Store, uid int64, workID int64, character string) int64 {
	t.Helper()
	var id int64
	if err := s.DB.QueryRow(
		`SELECT COALESCE(character_id, 0) FROM work_cast
		  WHERE user_id = ? AND work_id = ? AND character = ? AND origin <> 'removed'
		  ORDER BY id LIMIT 1`,
		uid, workID, character).Scan(&id); err != nil {
		t.Fatalf("read cast row for %q on %d: %v", character, workID, err)
	}
	return id
}

func TestThePassGivesEveryCastRowARecord(t *testing.T) {
	s := openForBackfill(t)
	seedDeadCastRows(t, s)
	migrateThroughAndUpgrade(t, s)

	// THE REPORTED ROW OPENS NOW, which is the whole point: a non-zero id is what
	// the chip's press is gated on.
	got := castRecordOf(t, s, 1, 1, "V / William Rookwood")
	if got == 0 {
		t.Fatal("the cast row still has no character record — its chip opens nothing")
	}

	// ONE WORK, ONE RECORD: the second row on this work joins the first rather
	// than making a twin. A work billing one character twice is two rows about one
	// character — which is what a per-row performer is for.
	var ids []int64
	rows, err := s.DB.Query(
		`SELECT character_id FROM work_cast
		  WHERE user_id = 1 AND work_id = 1 AND character = 'V / William Rookwood'
		    AND origin <> 'removed' ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, id)
	}
	rows.Close()
	if len(ids) != 2 {
		t.Fatalf("expected the work's two rows, got %d", len(ids))
	}
	if ids[0] != ids[1] {
		t.Errorf("one work's two rows for one character got two records: %v", ids)
	}

	// TWO WORKS ARE TWO CHARACTERS. "Narrator", "Mother" and "The Doctor" recur
	// across unrelated works and are not one person; merge is the reader's verb.
	second := castRecordOf(t, s, 1, 2, "V / William Rookwood")
	if second == 0 {
		t.Fatal("the second work's row got no record")
	}
	if second == got {
		t.Errorf("two works billing one name were welded into record %d", got)
	}

	// AND NEVER ACROSS ACCOUNTS. Every query in this app is scoped by user_id and
	// a backfill is not the place that stops being true.
	other := castRecordOf(t, s, 2, 3, "V / William Rookwood")
	if other == 0 {
		t.Error("the other account's row got no record of its own")
	}
	if other == got {
		t.Errorf("two accounts share character record %d", got)
	}
	var owner int64
	if err := s.DB.QueryRow(`SELECT user_id FROM characters WHERE id = ?`, other).Scan(&owner); err != nil {
		t.Fatal(err)
	}
	if owner != 2 {
		t.Errorf("bob's cast row points at a character owned by user %d", owner)
	}
}

func TestThePassLeavesARemovedRowAlone(t *testing.T) {
	s := openForBackfill(t)
	seedDeadCastRows(t, s)
	migrateThroughAndUpgrade(t, s)

	var id int64
	if err := s.DB.QueryRow(
		`SELECT COALESCE(character_id, 0) FROM work_cast WHERE character = 'Creedy'`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if id != 0 {
		t.Errorf("a removed cast row was given character record %d — the reader deleted that row", id)
	}
	// And no record was manufactured for the name either.
	var n int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM characters WHERE name = 'Creedy'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("a character record was created for a removed row (%d found)", n)
	}
}

func TestThePassSkipsARowWithNobodyNamed(t *testing.T) {
	s := openForBackfill(t)
	seedDeadCastRows(t, s)
	migrateThroughAndUpgrade(t, s)

	// 0063 permits a cast row with a performer and no character — "not named yet"
	// is a state the cast list draws on purpose. There is no name to resolve, and
	// inventing one would put an empty character in the reader's list.
	var id int64
	if err := s.DB.QueryRow(
		`SELECT COALESCE(character_id, 0) FROM work_cast WHERE actor = 'Carrie-Anne Moss'`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if id != 0 {
		t.Errorf("a row naming nobody got character record %d", id)
	}
	var n int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM characters WHERE TRIM(name) = ''`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("%d nameless character records were created", n)
	}
}

// AND THE TWO PASSES MUST NOT FIGHT, which is the failure this test was written
// from rather than imagined for. 3.1.0-cast-records sorts ahead of
// 3.1.0-person-identity, so on a library upgrading today MINE links the cast
// rows first and `backfillCast` runs second — and it read every non-removed row
// regardless of whether one was already linked, INSERTing a fresh `characters`
// row per (kind, work, name) it had not seen in its own run and then pointing the
// cast at the twin. Two works billing one name came out of a single boot as FOUR
// characters, and the pre-existing TestPersonIdentityBackfillLinksTheCast said so
// in as many words: "expected one character per work, got 4".
//
// The count is the assertion because the damage is invisible in the column: every
// row still had a character_id, and it pointed at a record no other row shared.
func TestTheTwoPassesAgreeOnOneCharacterPerWork(t *testing.T) {
	s := openForBackfill(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'V for Vendetta')`)
	mustExecT(t, s, `INSERT INTO books (id, user_id, title) VALUES (1, 1, 'V for Vendetta')`)
	deadCast(t, s, 1, "movie", 1, "V", "Hugo Weaving", "provider")
	deadCast(t, s, 1, "movie", 1, "V", "Natalie Portman", "provider")
	deadCast(t, s, 1, "book", 1, "V", "", "provider")
	migrateThroughAndUpgrade(t, s)

	var n int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM characters WHERE user_id = 1`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("two works billing one name should be two characters, got %d — the passes made twins", n)
	}
	// And every cast row points at one of those two, not at an orphan.
	var orphans int
	if err := s.DB.QueryRow(
		`SELECT COUNT(*) FROM work_cast wc
		  WHERE wc.user_id = 1
		    AND (wc.character_id IS NULL OR wc.character_id NOT IN
		         (SELECT id FROM characters WHERE user_id = 1))`).Scan(&orphans); err != nil {
		t.Fatal(err)
	}
	if orphans != 0 {
		t.Errorf("%d cast rows point at no character record", orphans)
	}
	// The film's two rows are one character; the book's is the other.
	var filmA, filmB, book int64
	if err := s.DB.QueryRow(
		`SELECT character_id FROM work_cast WHERE kind = 'movie' ORDER BY id LIMIT 1`).Scan(&filmA); err != nil {
		t.Fatal(err)
	}
	if err := s.DB.QueryRow(
		`SELECT character_id FROM work_cast WHERE kind = 'movie' ORDER BY id DESC LIMIT 1`).Scan(&filmB); err != nil {
		t.Fatal(err)
	}
	if err := s.DB.QueryRow(`SELECT character_id FROM work_cast WHERE kind = 'book'`).Scan(&book); err != nil {
		t.Fatal(err)
	}
	if filmA != filmB {
		t.Errorf("the film's two billings of one character got records %d and %d", filmA, filmB)
	}
	if book == filmA {
		t.Errorf("the book and the film were welded into character %d", book)
	}
	// The performer survived the second pass: backfillCast is the only writer of
	// actor_id here, and a row it skipped for its character must still get one.
	var actor int64
	if err := s.DB.QueryRow(
		`SELECT COALESCE(actor_id, 0) FROM work_cast WHERE actor = 'Hugo Weaving'`).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	if actor == 0 {
		t.Error("the performer was never linked — respecting the character link dropped the actor")
	}
}
