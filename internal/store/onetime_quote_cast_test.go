package store

import "testing"

// The 3.1.0 quote-cast backfill.
//
// WHY IT NEEDS A TEST OF ITS OWN, when the linker underneath it is already
// covered. The linker has been correct and reachable since 0056 — from
// `GET /{books,movies}/{id}/cast`, which the People panel and the capture form
// both call. What did not exist was any path that reached EVERY work without the
// reader visiting each one, and until 3.1.0 that was fine, because the link fed
// only the character page's own list of lines.
//
// Drawing the speaker on the quote card inverts that. A reader who has never
// opened a work's People panel would see no chip on any line of that work, and
// nothing on the card would tell them that opening an unrelated panel elsewhere is
// what makes chips appear — a feature that switches itself on only after you visit
// somewhere else is indistinguishable from a broken one.
//
// So what is pinned here is not "the linker works". It is that the pass reaches a
// library the reader has not toured, and that it stays inside the account.

// seedUnlinkedQuotes writes the shape a real pre-3.1.0 database has: a work, a
// cast row for a character, and a quote naming that character with no link.
//
// Seeded at 55 by openForBackfill, so `speaker_cast_id` does not exist yet — the
// migrations add it on the way to head and the pass then fills it, which is
// exactly the sequence a real upgrade runs.
func seedUnlinkedQuotes(t *testing.T, s *Store) {
	t.Helper()
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO books (id, user_id, title) VALUES (1, 1, 'The Master and Margarita')`)
	mustExecT(t, s, `INSERT INTO annotations (id, book_id, quote, character, dedupe_hash, source)
	                 VALUES (1, 1, 'Manuscripts do not burn.', 'Woland', 'h1', 'manual')`)
	castRow(t, s, 1, "book", 1, "Woland")
	mustExecT(t, s, `INSERT INTO movies (id, user_id, title) VALUES (2, 1, 'Stalker')`)
	mustExecT(t, s, `INSERT INTO dialogues (id, movie_id, quote, character, dedupe_hash)
	                 VALUES (2, 2, 'Let everything come true.', 'the Stalker', 'h2')`)
	castRow(t, s, 1, "movie", 2, "the Stalker")
}

// castRow writes one cast row the way a provider fetch or the cast panel would.
//
// THE SEED NEEDS THESE, and that is a fact about the pass rather than about the
// fixture: it LINKS quotes to cast rows and does not create them. Adoption — "every
// character this work's quotes name is one of its people" — lives in the httpapi
// layer, on the cast list endpoint, and a store-level pass cannot reach it. See the
// case at the foot of this file, which pins that limit rather than hiding it.
func castRow(t *testing.T, s *Store, uid int64, kind string, workID int64, character string) {
	t.Helper()
	mustExecT(t, s, `INSERT INTO work_cast (user_id, kind, work_id, character, character_key, origin)
	                 VALUES (?, ?, ?, ?, ?, 'reader')`, uid, kind, workID, character, CastKey(character))
}

func TestTheBackfillLinksQuotesOnWorksNobodyHasOpened(t *testing.T) {
	s := openForBackfill(t)
	seedUnlinkedQuotes(t, s)
	migrateThroughAndUpgrade(t, s)

	// BOTH TABLES. `annotations` and `dialogues` carry the column and `utterances`
	// does not — a standalone quote has no work and so no cast to point into — so a
	// pass that walked only the film side would leave every book highlight blank.
	for _, q := range []struct {
		what  string
		query string
	}{
		{"a book highlight", `SELECT COALESCE(a.speaker_cast_id, 0) FROM annotations a WHERE a.id = 1`},
		{"a film line", `SELECT COALESCE(d.speaker_cast_id, 0) FROM dialogues d WHERE d.id = 2`},
	} {
		var castID int64
		if err := s.DB.QueryRow(q.query).Scan(&castID); err != nil {
			t.Fatalf("%s: %v", q.what, err)
		}
		if castID == 0 {
			t.Errorf("%s was not linked, so its card would draw no speaker", q.what)
		}
	}
}

// THE ROW IT POINTS AT IS THE RIGHT ONE, which "not zero" above does not prove.
// The link is only worth drawing if it names the character the line actually says.
func TestTheBackfillLinksToTheCastRowTheLineNames(t *testing.T) {
	s := openForBackfill(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'The Master and Margarita')`)
	for i, pair := range [][2]string{
		{"Never talk to strangers.", "Woland"},
		{"I am part of that power.", "Behemoth"},
	} {
		mustExecT(t, s, `INSERT INTO dialogues (id, movie_id, quote, character, dedupe_hash) VALUES (?, 1, ?, ?, ?)`,
			i+1, pair[0], pair[1], pair[1])
	}
	castRow(t, s, 1, "movie", 1, "Woland")
	castRow(t, s, 1, "movie", 1, "Behemoth")
	migrateThroughAndUpgrade(t, s)

	for _, want := range []struct {
		quoteID   int64
		character string
	}{{1, "Woland"}, {2, "Behemoth"}} {
		var got string
		err := s.DB.QueryRow(
			`SELECT COALESCE(wc.character, '') FROM dialogues d
			   JOIN work_cast wc ON wc.id = d.speaker_cast_id
			  WHERE d.id = ?`, want.quoteID).Scan(&got)
		if err != nil {
			t.Fatalf("quote %d has no linked cast row: %v", want.quoteID, err)
		}
		if got != want.character {
			t.Errorf("quote %d linked to %q, want %q", want.quoteID, got, want.character)
		}
	}
}

// A LINE NAMING TWO CHARACTERS IS LEFT ALONE, which is the linker's own rule and
// the reason the chip can be trusted: attributing an ensemble line to whichever
// name sorts first would put a confident wrong answer on the card.
func TestTheBackfillRefusesToGuessOnATwoCharacterLine(t *testing.T) {
	s := openForBackfill(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'Casablanca')`)
	mustExecT(t, s, `INSERT INTO dialogues (id, movie_id, quote, character, dedupe_hash)
	                 VALUES (1, 1, 'We will always have Paris.', 'Rick, Ilsa', 'h3')`)
	castRow(t, s, 1, "movie", 1, "Rick")
	castRow(t, s, 1, "movie", 1, "Ilsa")
	migrateThroughAndUpgrade(t, s)

	var castID int64
	if err := s.DB.QueryRow(`SELECT COALESCE(speaker_cast_id, 0) FROM dialogues WHERE id = 1`).Scan(&castID); err != nil {
		t.Fatal(err)
	}
	if castID != 0 {
		t.Errorf("an ensemble line was attributed to cast row %d", castID)
	}
}

// IT STAYS INSIDE THE ACCOUNT. The pass walks users one at a time and hands each
// account's own id to the linker; a query that dropped the scope would link one
// reader's quote to another reader's cast row, which is the silent kind of leak
// this project's invariant exists to prevent.
func TestTheBackfillNeverLinksAcrossAccounts(t *testing.T) {
	s := openForBackfill(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x'), (2, 'bob', 'x')`)
	// One title, one character name, two readers. Only the coincidence makes a
	// cross-account link possible at all, which is why it is the fixture.
	mustExecT(t, s, `INSERT INTO books (id, user_id, title) VALUES (1, 1, 'Moby-Dick'), (2, 2, 'Moby-Dick')`)
	mustExecT(t, s, `INSERT INTO annotations (id, book_id, quote, character, dedupe_hash, source)
	                 VALUES (1, 1, 'Call me Ishmael.', 'Ishmael', 'h4', 'manual'),
	                        (2, 2, 'Call me Ishmael.', 'Ishmael', 'h5', 'manual')`)
	castRow(t, s, 1, "book", 1, "Ishmael")
	castRow(t, s, 2, "book", 2, "Ishmael")
	migrateThroughAndUpgrade(t, s)

	for _, want := range []struct{ quoteID, uid int64 }{{1, 1}, {2, 2}} {
		var owner int64
		err := s.DB.QueryRow(
			`SELECT wc.user_id FROM annotations a
			   JOIN work_cast wc ON wc.id = a.speaker_cast_id
			  WHERE a.id = ?`, want.quoteID).Scan(&owner)
		if err != nil {
			t.Fatalf("quote %d has no linked cast row: %v", want.quoteID, err)
		}
		if owner != want.uid {
			t.Errorf("quote %d linked to user %d's cast row, want user %d", want.quoteID, owner, want.uid)
		}
	}
}

// THE LIMIT, PINNED ON PURPOSE. A work whose cast has never been listed has no
// cast rows, and the pass links to rows rather than creating them — so its quotes
// stay unlinked and its cards go on printing the character text they always did.
//
// This is a real gap and not a rounding error: a provider-fetched film has cast
// rows from the fetch, but a book, or a film somebody typed in by hand, has none
// until its People panel is opened once. For those works the chip still arrives
// only after that visit, which is the very shape the pass was written to avoid.
//
// It is pinned rather than fixed because fixing it means moving adoption —
// `adoptQuoteCharacters`, today an httpapi method on the cast list endpoint — down
// into this package so the pass can call the live one. Reimplementing it here
// instead is the thing 3.1.0-quote-person's header forbids in as many words: "a
// pass with its own resolution rules is a pass that can disagree with the app."
//
// If somebody later moves adoption and this case starts failing, that is the fix
// landing, not a regression. Delete the case and say so.
func TestTheBackfillLeavesAWorkWithNoCastAlone(t *testing.T) {
	s := openForBackfill(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO books (id, user_id, title) VALUES (1, 1, 'Moby-Dick')`)
	mustExecT(t, s, `INSERT INTO annotations (id, book_id, quote, character, dedupe_hash, source)
	                 VALUES (1, 1, 'Call me Ishmael.', 'Ishmael', 'h1', 'manual')`)
	// Deliberately no castRow: this is a library nobody has toured.
	migrateThroughAndUpgrade(t, s)

	var castID int64
	if err := s.DB.QueryRow(`SELECT COALESCE(speaker_cast_id, 0) FROM annotations WHERE id = 1`).Scan(&castID); err != nil {
		t.Fatal(err)
	}
	if castID != 0 {
		t.Errorf("the pass invented a cast row (%d) — if adoption moved into store, "+
			"delete this case and update the pass's header", castID)
	}
	// AND THE TEXT IS UNTOUCHED, which is what makes the gap survivable: the card
	// says who said it in words, exactly as it did before any of this.
	var character string
	if err := s.DB.QueryRow(`SELECT character FROM annotations WHERE id = 1`).Scan(&character); err != nil {
		t.Fatal(err)
	}
	if character != "Ishmael" {
		t.Errorf("character text = %q, want it left alone", character)
	}
}
