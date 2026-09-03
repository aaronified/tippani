package store

import (
	"database/sql"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// 3.1.0: a quote's speaker became something a card DRAWS, so every existing line
// needs the cast row it names.
//
// RETIRING THIS FILE. Delete it. Nothing else mentions it — onetime.go iterates
// what registered, and the row it wrote in one_time_passes stays behind as the
// record that it ran. Delete it once no supported instance can still be upgrading
// from before 3.1.0.
//
// WHY IT EXISTS AT ALL, given the column has been written since 0056. It is
// written on every quote WRITE (SyncQuoteCast) and filled in for a whole work when
// that work's cast list is READ (LinkWorkQuotesToCast, from GET /{books,movies}/
// {id}/cast). Both were sufficient while the link fed only the character page's own
// list of lines: a reader looking at a character had, by definition, been through
// the machinery that fills it.
//
// 3.1.0 draws the speaker on the quote card itself, and that inverts the problem.
// A reader who has never opened a work's People panel would see no chip on any line
// of that work — and nothing on the card would tell them that opening an unrelated
// panel is what makes chips appear. A feature that switches itself on only after
// you visit somewhere else is indistinguishable from a broken one.
//
// NOT A MIGRATION AND NOT A BOOT REPAIR. No schema changes: 0056 added the columns
// and the indexes. It must not run on every start either — the steady state is one
// SELECT per work and no write (LinkWorkQuotesToCast leaves a correct link alone),
// but paying that on every boot for ever to catch a case that can only exist once
// is what the one-time registry is for.
//
// IT RUNS AFTER 3.1.0-person-identity, by its name. onetime.go sorts by version
// then name, so "3.1.0-person-identity" < "3.1.0-quote-cast", and that order is
// load-bearing here rather than merely tidy: the earlier pass is what gives every
// cast row its `character_id`, and a link resolved before then points at a row with
// no record behind it — an id with no destination, which is a chip the client
// declines to draw. Sorting also puts this after "3.1.0-quote-person", which is
// harmless: the two touch different columns.
//
// WHAT IT DOES NOT DO, stated here because the gap is invisible from the log line.
// It LINKS quotes to cast rows; it does not create them. A work whose cast has
// never been listed has no rows to link to, so its quotes stay unlinked — and that
// is not rare: a provider-fetched film has rows from the fetch, but a book, or a
// film typed in by hand, has none until its People panel is opened once. For those
// works the chip still arrives only after that visit, which is the very shape this
// pass exists to avoid, half-solved.
//
// Fixing it means moving adoption — `adoptQuoteCharacters`, today an httpapi method
// on the cast list endpoint — down into this package so the pass can call the LIVE
// one. Reimplementing it here is what 3.1.0-quote-person's header forbids in as
// many words. onetime_quote_cast_test.go pins the gap so it cannot be mistaken for
// a bug, and says what to delete when it is closed.
//
// A FAILURE IS LOGGED AND SKIPPED, like every pass, and the library then runs in
// exactly the state 0056 left it in — every quote still prints the character it
// always did, and only the chip is missing until the next start retries.

func init() {
	RegisterOneTimePass(OneTimePass{
		Version: "3.1.0",
		Name:    "3.1.0-quote-cast",
		Why:     "a quote's speaker became visible on its card, so every existing line needs the cast row it names",
		Run:     runQuoteCastBackfill,
	})
}

func runQuoteCastBackfill(tx *sql.Tx, env OneTimeEnv) error {
	if env.FreshInstall {
		return nil
	}
	users, err := backfillUsers(tx)
	if err != nil {
		return err
	}
	linked := 0
	for _, uid := range users {
		// EACH ACCOUNT'S OWN SEPARATORS. Whether a comma on a line means two
		// characters is the reader's setting, and the linker refuses to guess on a
		// line naming two — so reading the wrong separators here would not merely
		// mislink, it would change how many lines get linked at all.
		seps := metadata.ParseCreditSeps(creditSepPref(tx, uid))
		before, err := countQuoteCastLinks(tx, uid)
		if err != nil {
			return err
		}
		// THE LIVE LINKER, NOT A SECOND COPY OF IT — 3.1.0-quote-person's rule, and
		// it matters more here. The match folds punctuation, case and whitespace
		// through store.CastKey, and a pass that reimplemented that fold would
		// produce a library subtly different from one built by typing.
		if err := LinkAllQuotesToCast(tx, uid, seps); err != nil {
			return err
		}
		after, err := countQuoteCastLinks(tx, uid)
		if err != nil {
			return err
		}
		linked += after - before
	}
	if linked > 0 {
		olog.Printf("[store] quote cast: %d quote(s) linked to a cast row", linked)
	}
	return nil
}

// countQuoteCastLinks counts the linked quotes in one account, so the log line
// says what the pass did rather than how many rows it read.
//
// BOTH TABLES AND ONLY BOTH. `utterances` never received speaker_cast_id — 0056
// altered `annotations` and `dialogues` — because a standalone quote has no work
// and therefore no cast to point into. Its speaker is a person, by name, which is
// 3.1.0-quote-person's business and not this pass's.
func countQuoteCastLinks(tx *sql.Tx, uid int64) (int, error) {
	var n int
	err := tx.QueryRow(`
		SELECT (SELECT COUNT(*) FROM annotations a JOIN books b ON b.id = a.book_id
		         WHERE b.user_id = ? AND a.speaker_cast_id IS NOT NULL)
		     + (SELECT COUNT(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		         WHERE m.user_id = ? AND d.speaker_cast_id IS NOT NULL)`,
		uid, uid).Scan(&n)
	return n, err
}
