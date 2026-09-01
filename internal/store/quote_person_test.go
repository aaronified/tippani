package store

import (
	"database/sql"
	"testing"

	"tippani/internal/metadata"
)

// The per-quote person link: who said THIS line, as a record rather than a string.
//
// WHAT THESE ARE GUARDING is not that a column got written — it is that the
// PERSON PANEL shows the right lines. Every assertion below therefore asks the
// question a reader asks ("which quotes does this record hold", "did my merge
// survive the next edit") rather than reading the id back out and calling it
// proved.

// seedQuotes gives account 1 a film with two lines and a standalone quote, in
// the pre-link state a write that bypassed the linker would leave: names printed,
// nothing pointing at anything.
func seedQuotes(t *testing.T, s *Store) {
	t.Helper()
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed %q: %v", q, err)
		}
	}
	exec(`INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'Jurassic Park')`)
	exec(`INSERT INTO dialogues (id, movie_id, quote, character, actor, dedupe_hash)
	      VALUES (1, 1, 'Hold on to your butts', 'Ray Arnold', 'Samuel L. Jackson', 'h1')`)
	exec(`INSERT INTO dialogues (id, movie_id, quote, character, actor, dedupe_hash)
	      VALUES (2, 1, 'Clever girl', 'Muldoon', 'Bob Peck', 'h2')`)
	exec(`INSERT INTO utterances (id, user_id, quote, speaker, dedupe_hash)
	      VALUES (1, 1, 'The die is cast', 'Julius Caesar', 'h3')`)
}

// quotesOf is the person panel's question, asked of the database: which lines
// does this record hold? Ordered so an assertion can name them.
func quotesOf(t *testing.T, s *Store, personID int64) []string {
	t.Helper()
	rows, err := s.DB.Query(`
		SELECT quote FROM dialogues WHERE actor_id = ?
		UNION ALL
		SELECT quote FROM utterances WHERE speaker_id = ?
		ORDER BY 1`, personID, personID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var q string
		if err := rows.Scan(&q); err != nil {
			t.Fatal(err)
		}
		out = append(out, q)
	}
	return out
}

func personNamed(t *testing.T, s *Store, uid int64, name string) int64 {
	t.Helper()
	var id int64
	if err := s.DB.QueryRow(
		`SELECT id FROM people WHERE user_id = ? AND name = ? ORDER BY id LIMIT 1`, uid, name).Scan(&id); err != nil {
		t.Fatalf("no person called %q: %v", name, err)
	}
	return id
}

func syncAll(t *testing.T, s *Store) {
	t.Helper()
	mustTx(t, s, func(tx *sql.Tx) error {
		return SyncAllQuotePeople(tx, 1, metadata.DefaultCreditSeps)
	})
}

// The whole point of the change, asked the way the reader meets it: open a
// performer and the lines they said are there.
func TestAPersonHoldsTheQuotesThatNameThem(t *testing.T) {
	s := openIdentity(t)
	seedQuotes(t, s)
	syncAll(t, s)

	got := quotesOf(t, s, personNamed(t, s, 1, "Bob Peck"))
	if len(got) != 1 || got[0] != "Clever girl" {
		t.Fatalf("Bob Peck holds %v, want just the one line he says", got)
	}
	got = quotesOf(t, s, personNamed(t, s, 1, "Julius Caesar"))
	if len(got) != 1 || got[0] != "The die is cast" {
		t.Fatalf("Caesar holds %v — a standalone quote's speaker is a person too", got)
	}
	if d, err := QuoteLinksAgree(s.DB, 1, metadata.DefaultCreditSeps); err != nil || len(d) != 0 {
		t.Fatalf("after a sync the library disagrees with itself: %v %v", d, err)
	}
}

// THE CHECK HAS TO BITE, or every test above it is decoration. A line whose actor
// was written straight into the column — which is what every handler did before
// this change, and what a new one will do if somebody forgets — must be reported.
func TestAQuoteWrittenBehindTheLinkerIsReported(t *testing.T) {
	s := openIdentity(t)
	seedQuotes(t, s)
	syncAll(t, s)

	if _, err := s.DB.Exec(`UPDATE dialogues SET actor = 'Jeff Goldblum' WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	d, err := QuoteLinksAgree(s.DB, 1, metadata.DefaultCreditSeps)
	if err != nil {
		t.Fatal(err)
	}
	if len(d) != 1 || d[0].QuoteID != 1 || d[0].Printed != "Jeff Goldblum" {
		t.Fatalf("a bypassing write went unreported: %+v", d)
	}
	// And the repair is the same function the upgrade runs.
	syncAll(t, s)
	if d, _ := QuoteLinksAgree(s.DB, 1, metadata.DefaultCreditSeps); len(d) != 0 {
		t.Fatalf("the repair did not repair: %+v", d)
	}
}

// A line credited to two performers has no single speaker. It stays unlinked, and
// — this is the half worth testing — it is not then reported as drift for ever.
func TestALineCreditedToTwoPerformersLinksToNeither(t *testing.T) {
	s := openIdentity(t)
	seedQuotes(t, s)
	if _, err := s.DB.Exec(
		`UPDATE dialogues SET character = 'Muldoon, Ray Arnold', actor = 'Bob Peck, Samuel L. Jackson' WHERE id = 2`); err != nil {
		t.Fatal(err)
	}
	syncAll(t, s)

	var link sql.NullInt64
	if err := s.DB.QueryRow(`SELECT actor_id FROM dialogues WHERE id = 2`).Scan(&link); err != nil {
		t.Fatal(err)
	}
	if link.Valid {
		t.Fatalf("a two-hander was attributed to one person (id %d)", link.Int64)
	}
	if d, _ := QuoteLinksAgree(s.DB, 1, metadata.DefaultCreditSeps); len(d) != 0 {
		t.Fatalf("an ensemble line is reported as drift on every walk: %+v", d)
	}
	// A suffix is NOT two people, and that is the same split doing the work.
	if _, err := s.DB.Exec(`UPDATE dialogues SET actor = 'Sammy Davis, Jr.' WHERE id = 2`); err != nil {
		t.Fatal(err)
	}
	syncAll(t, s)
	if got := quotesOf(t, s, personNamed(t, s, 1, "Sammy Davis, Jr.")); len(got) != 1 {
		t.Fatalf("a billed suffix was split into two people: %v", got)
	}
}

// Clearing the name clears the link. Narration, an epigraph, a line the reader
// has not attributed yet — all real, and a stale id would make the panel claim a
// quote the quote no longer names.
func TestUnattributingAQuoteReleasesThePerson(t *testing.T) {
	s := openIdentity(t)
	seedQuotes(t, s)
	syncAll(t, s)
	peck := personNamed(t, s, 1, "Bob Peck")

	if _, err := s.DB.Exec(`UPDATE dialogues SET actor = '' WHERE id = 2`); err != nil {
		t.Fatal(err)
	}
	syncAll(t, s)
	if got := quotesOf(t, s, peck); len(got) != 0 {
		t.Fatalf("Bob Peck still holds %v after the line stopped naming him", got)
	}
}

// TWO PEOPLE MAY SHARE A NAME — that is what 0056 was for — so a reader who
// picked the second one must not have that pick undone by an edit to the note.
func TestEditingAQuoteDoesNotUndoAPickBetweenNamesakes(t *testing.T) {
	s := openIdentity(t)
	seedQuotes(t, s)
	syncAll(t, s)

	// A second John Williams, chosen deliberately for this line.
	if _, err := s.DB.Exec(`UPDATE dialogues SET actor = 'John Williams' WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	syncAll(t, s)
	first := personNamed(t, s, 1, "John Williams")
	var second int64
	res, err := s.DB.Exec(`INSERT INTO people (user_id, name) VALUES (1, 'John Williams')`)
	if err != nil {
		t.Fatal(err)
	}
	if second, err = res.LastInsertId(); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(`UPDATE dialogues SET actor_id = ? WHERE id = 1`, second); err != nil {
		t.Fatal(err)
	}

	// An unrelated edit, and the sync that follows every write.
	if _, err := s.DB.Exec(`UPDATE dialogues SET note = 'the composer, not the guitarist' WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	syncAll(t, s)

	var now int64
	if err := s.DB.QueryRow(`SELECT actor_id FROM dialogues WHERE id = 1`).Scan(&now); err != nil {
		t.Fatal(err)
	}
	if now != second {
		t.Fatalf("the deliberate pick was reset to %d (the first record is %d)", now, first)
	}
}

// A MERGE MOVES THE QUOTES AND LEAVES THE WORDS ALONE, and then STAYS moved —
// which is the half that is easy to get wrong, because the printed spelling still
// names the record that is gone.
func TestAMergedPersonKeepsTheQuotesAndTheSpelling(t *testing.T) {
	s := openIdentity(t)
	seedQuotes(t, s)
	syncAll(t, s)
	bob := personNamed(t, s, 1, "Bob Peck")

	var robert int64
	res, err := s.DB.Exec(`INSERT INTO people (user_id, name) VALUES (1, 'Robert Peck')`)
	if err != nil {
		t.Fatal(err)
	}
	if robert, err = res.LastInsertId(); err != nil {
		t.Fatal(err)
	}
	var undo *MergeUndo
	mustTx(t, s, func(tx *sql.Tx) error {
		u, err := MergePeople(tx, 1, robert, bob, metadata.DefaultCreditSeps)
		undo = u
		return err
	})

	if got := quotesOf(t, s, robert); len(got) != 1 || got[0] != "Clever girl" {
		t.Fatalf("the merge left the line behind: %v", got)
	}
	var printed string
	if err := s.DB.QueryRow(`SELECT actor FROM dialogues WHERE id = 2`).Scan(&printed); err != nil {
		t.Fatal(err)
	}
	if printed != "Bob Peck" {
		t.Fatalf("the merge rewrote what the line says: %q", printed)
	}
	// THE NEXT ORDINARY EDIT MUST NOT UNDO IT. Without the alias the merge
	// recorded, this sync re-resolves "Bob Peck" into a brand-new record and the
	// merge comes apart one quote at a time.
	syncAll(t, s)
	if got := quotesOf(t, s, robert); len(got) != 1 {
		t.Fatalf("the merge came apart on the next write: %v", got)
	}
	if d, _ := QuoteLinksAgree(s.DB, 1, metadata.DefaultCreditSeps); len(d) != 0 {
		t.Fatalf("a merged spelling is reported as drift: %+v", d)
	}

	// And undo puts the line back on the record it came from.
	mustTx(t, s, func(tx *sql.Tx) error {
		return UndoPersonMerge(tx, 1, undo, metadata.DefaultCreditSeps)
	})
	if got := quotesOf(t, s, bob); len(got) != 1 || got[0] != "Clever girl" {
		t.Fatalf("undo did not return the line: %v", got)
	}
}

// Splitting a spelling back out takes its quotes with it — the one thing a split
// CAN move without asking, because a quote's column is the whole name of its one
// speaker rather than one component of a joined credit.
func TestSplittingASpellingTakesItsQuotes(t *testing.T) {
	s := openIdentity(t)
	seedQuotes(t, s)
	syncAll(t, s)
	bob := personNamed(t, s, 1, "Bob Peck")

	var robert int64
	res, err := s.DB.Exec(`INSERT INTO people (user_id, name) VALUES (1, 'Robert Peck')`)
	if err != nil {
		t.Fatal(err)
	}
	if robert, err = res.LastInsertId(); err != nil {
		t.Fatal(err)
	}
	mustTx(t, s, func(tx *sql.Tx) error {
		_, err := MergePeople(tx, 1, robert, bob, metadata.DefaultCreditSeps)
		return err
	})

	var split int64
	mustTx(t, s, func(tx *sql.Tx) error {
		id, err := SplitPersonAlias(tx, 1, robert, "Bob Peck")
		split = id
		return err
	})
	if got := quotesOf(t, s, split); len(got) != 1 || got[0] != "Clever girl" {
		t.Fatalf("the split record got %v, not the line that spells its name", got)
	}
	if got := quotesOf(t, s, robert); len(got) != 0 {
		t.Fatalf("Robert Peck kept %v after the spelling was split away", got)
	}
}

// Renaming the RECORD renames what its quotes print. The opposite of the merge
// rule above, and deliberately: a merge is a claim about identity, a rename is a
// claim about the spelling.
func TestRenamingARecordRenamesItsQuotes(t *testing.T) {
	s := openIdentity(t)
	seedQuotes(t, s)
	syncAll(t, s)
	caesar := personNamed(t, s, 1, "Julius Caesar")

	var screen, utter int
	mustTx(t, s, func(tx *sql.Tx) error {
		var err error
		screen, utter, err = RenameQuotePeople(tx, 1, caesar, "Gaius Julius Caesar")
		return err
	})
	if screen != 0 || utter != 1 {
		t.Fatalf("renamed %d screen and %d standalone quotes, want 0 and 1", screen, utter)
	}
	var printed string
	if err := s.DB.QueryRow(`SELECT speaker FROM utterances WHERE id = 1`).Scan(&printed); err != nil {
		t.Fatal(err)
	}
	if printed != "Gaius Julius Caesar" {
		t.Fatalf("the quote still says %q", printed)
	}
	// A quote merely SPELLED the same but pointing nowhere is not touched — it
	// may be somebody else of that name, which is why people are records now.
	if _, err := s.DB.Exec(
		`INSERT INTO utterances (id, user_id, quote, speaker, dedupe_hash)
		 VALUES (2, 1, 'Veni vidi vici', 'Julius Caesar', 'h4')`); err != nil {
		t.Fatal(err)
	}
	mustTx(t, s, func(tx *sql.Tx) error {
		_, _, err := RenameQuotePeople(tx, 1, caesar, "J. Caesar")
		return err
	})
	if err := s.DB.QueryRow(`SELECT speaker FROM utterances WHERE id = 2`).Scan(&printed); err != nil {
		t.Fatal(err)
	}
	if printed != "Julius Caesar" {
		t.Fatalf("an unlinked quote of the same spelling was rewritten to %q", printed)
	}
}

// PER-USER ISOLATION, asked of the one helper that could break it: a dialogue is
// owned through its film, so a linker that forgot the join would reach across
// accounts.
func TestTheLinkerWillNotTouchAnotherAccountsQuote(t *testing.T) {
	s := openIdentity(t)
	seedQuotes(t, s)
	syncAll(t, s)

	// Account 2 asks to sync account 1's line.
	mustTx(t, s, func(tx *sql.Tx) error {
		return SyncQuotePerson(tx, 2, KindScreen, 2, metadata.DefaultCreditSeps)
	})
	if got := quotesOf(t, s, personNamed(t, s, 1, "Bob Peck")); len(got) != 1 {
		t.Fatalf("another account's sync changed the line: %v", got)
	}
	var n int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM people WHERE user_id = 2`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("account 2 gained %d person record(s) from a quote it does not own", n)
	}
	if d, _ := QuoteLinksAgree(s.DB, 2, metadata.DefaultCreditSeps); len(d) != 0 {
		t.Fatalf("account 2's walk sees account 1's quotes: %+v", d)
	}
}
