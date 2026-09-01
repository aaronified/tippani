package store

import (
	"database/sql"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// 3.1.0: the name printed on a film line or a standalone quote gets a record.
//
// RETIRING THIS FILE. Delete it. Nothing else mentions it — onetime.go iterates
// what registered, and the row it wrote in one_time_passes stays behind as the
// record that it ran. Delete it once no supported instance can still be
// upgrading from before 3.1.0.
//
// WHY IT IS A SECOND PASS AND NOT A CLAUSE IN THE FIRST. 3.1.0-person-identity
// backfills work CREDITS and CAST; this backfills the two per-quote columns
// 0059 added, which are neither. Keeping them apart means one can fail and be
// retried on the next start without re-running the other — and a pass that
// covered both would have to succeed at both to record itself.
//
// IT RUNS SECOND BY ITS NAME. onetime.go sorts by version and then by name, so
// "3.1.0-person-identity" precedes "3.1.0-quote-person", and by the time this
// runs the library's authors and directors are already records. That matters:
// an actor who also directed is then ONE person rather than two, because this
// pass resolves by name into the table the first pass populated. Nothing breaks
// if the order ever changes — it would just create the record here instead —
// but the order it has is the better one.
//
// NOTHING IS SPLIT HERE, unlike a credit. A credit column is a joined list and
// "Pevear, Volokhonsky" is two translators; the actor on ONE line is one person,
// and running SplitCredits over it would turn a performer billed as "Smith,
// Jr." into two people the moment an account had the comma separator on. The
// per-quote column is the per-quote spelling — that is 0059's whole argument for
// keeping it — so it is resolved whole.
//
// A FAILURE IS LOGGED AND SKIPPED, like every pass. The library then runs with
// the two id columns NULL, which is exactly the state 0059 left them in:
// every quote still prints the name it always did, and only the person panel is
// missing those lines until the next start retries.

func init() {
	RegisterOneTimePass(OneTimePass{
		Version: "3.1.0",
		Name:    "3.1.0-quote-person",
		Why:     "a film line's actor and a quote's speaker were strings; give each one a record to point at",
		Run:     runQuotePersonBackfill,
	})
}

func runQuotePersonBackfill(tx *sql.Tx, env OneTimeEnv) error {
	if env.FreshInstall {
		return nil
	}
	users, err := backfillUsers(tx)
	if err != nil {
		return err
	}
	linked := 0
	for _, uid := range users {
		// EACH ACCOUNT'S OWN SEPARATORS, read the same way 3.1.0-person-identity
		// reads them and for the same reason: whether a comma in an actor's
		// billing means two people is a setting the reader owns.
		seps := metadata.ParseCreditSeps(creditSepPref(tx, uid))
		before, err := countQuoteLinks(tx, uid)
		if err != nil {
			return err
		}
		// THE LIVE LINKER, NOT A SECOND COPY OF IT. SyncAllQuotePeople reads each
		// column and points the row at whoever it names, which is the same thing
		// every write site now does — so the library a fresh account builds by
		// typing and the library an upgrade produces are the same library. A pass
		// with its own resolution rules is a pass that can disagree with the app.
		if err := SyncAllQuotePeople(tx, uid, seps); err != nil {
			return err
		}
		after, err := countQuoteLinks(tx, uid)
		if err != nil {
			return err
		}
		linked += after - before
	}
	if linked > 0 {
		olog.Printf("[store] quote people: %d quote(s) linked to a person", linked)
	}
	return nil
}

// countQuoteLinks counts the linked quotes in one account, so the log line
// reports what this pass actually did rather than how many rows it looked at.
func countQuoteLinks(tx *sql.Tx, uid int64) (int, error) {
	var n int
	err := tx.QueryRow(`
		SELECT (SELECT COUNT(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		         WHERE m.user_id = ? AND d.actor_id IS NOT NULL)
		     + (SELECT COUNT(*) FROM utterances WHERE user_id = ? AND speaker_id IS NOT NULL)`,
		uid, uid).Scan(&n)
	return n, err
}
