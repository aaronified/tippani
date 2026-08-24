package store

import (
	"database/sql"
	"strings"
)

// 2.2.3: a standalone quote's free-text `medium` became a fixed `kind` (0053),
// and the rows that already exist have to be read across once.
//
// RETIRING THIS FILE. Delete it. Nothing else mentions it — onetime.go iterates
// what registered, and the row this pass wrote in one_time_passes stays behind as
// the record that it ran. Delete it once no supported instance can still be
// upgrading from before 2.2.3. Nothing outside this file needs to survive the
// deletion, unlike 2.2.0's, which exported a settings key.
//
// WHY IT IS A PASS AND NOT PART OF THE MIGRATION. Two reasons, and the second is
// the one that decides it.
//
// The first is that the mapping is a Unicode-aware case fold and a trim over
// values a person typed. SQLite's lower() is ASCII-only, so 'SPEECH' folds and
// 'Ｓｐｅｅｃｈ' does not; doing it in Go is doing it once, correctly.
//
// The second is that this must not run on a fresh install. A database created
// after 0053 has never had a `medium` to read, and a pass that ran there would be
// a no-op that still had to be reasoned about every time somebody read the file.
// FreshInstall says so out loud.
//
// WHAT IT DOES AND WHAT IT REFUSES TO DO. It reads `medium` and, failing that,
// `category`, and writes `kind` where — and only where — the value it finds IS one
// of the five words. Anything else is left alone: `kind` stays unset, `medium`
// keeps its text, and the card goes on showing that text until the reader picks a
// kind. "Drop anything that doesn't match" is the owner's instruction and this is
// the non-destructive reading of it: the value is dropped from the new field, not
// from the database.
//
// NO GUESSING, and this is where a pass like this usually goes wrong. It is very
// tempting to map "radio" and "broadcast" and "interview" onto `speech`, and
// "poem" onto `essay`, because most of the time that is what somebody meant. A
// synonym table is a reclassification of somebody's library on upgrade, silently,
// with no record of what moved — which is the exact thing 0035's header refused to
// do when it chose a default over a guess. So: exact words only. What a reader
// wrote as "radio" they can file in one press, having read it.
//
// `category` IS THE FALLBACK AND 'other' IS NOT READ FROM IT. 0035 defaulted every
// existing row to 'other' precisely so that nothing was reclassified — so 'other'
// there means "nobody has said", not "somebody said other". Reading it as a
// deliberate 'other' would invent five thousand decisions. 'proverb' and 'speech'
// are real answers and are taken.

func init() {
	RegisterOneTimePass(OneTimePass{
		Version: "2.2.3",
		// Chosen once and never changed, even if this file is renamed: it is the
		// primary key in one_time_passes, so a new name re-runs the pass on every
		// database that already ran it.
		Name: "2.2.3-quote-kind-from-medium",
		Why:  "a standalone quote's free-text medium became a fixed kind; fold the values that match",
		Run:  runQuoteKindFromMedium,
	})
}

// quoteKinds is 0053's vocabulary, minus the empty string. Spelled here as well
// as in the migration because this is the only other place that decides what a
// legal value is, and a CHECK violation out of a one-time pass would be a warning
// on every boot until somebody looked.
var quoteKinds = map[string]string{
	"speech":  "speech",
	"letter":  "letter",
	"essay":   "essay",
	"proverb": "proverb",
	"other":   "other",
}

// quoteKindOf reads one row's old fields and answers what its kind is, or "".
//
// MEDIUM WINS OVER CATEGORY when both say something, because medium is the more
// specific statement: category has three values and was the board's filing, medium
// is what the reader typed about this line.
func quoteKindOf(medium, category string) string {
	if k, ok := quoteKinds[strings.ToLower(strings.TrimSpace(medium))]; ok {
		return k
	}
	// 'other' is not read — see the header. Only the two that were real answers.
	switch strings.ToLower(strings.TrimSpace(category)) {
	case "proverb":
		return "proverb"
	case "speech":
		return "speech"
	}
	return ""
}

func runQuoteKindFromMedium(tx *sql.Tx, env OneTimeEnv) error {
	if env.FreshInstall {
		return nil // never had a `medium` to read
	}

	// Read the whole set first and write afterwards, rather than updating inside
	// the row loop: sqlite3 will not accept a write on the same connection while a
	// SELECT's rows are still open, and a driver that appears to allow it is
	// buffering. The set is bounded by the number of standalone quotes in one
	// library, which is thousands at the very most.
	type row struct {
		id   int64
		kind string
	}
	rows, err := tx.Query(
		`SELECT id, COALESCE(medium, ''), COALESCE(category, '') FROM utterances
		 WHERE COALESCE(kind, '') = ''`)
	if err != nil {
		return err
	}
	var todo []row
	for rows.Next() {
		var id int64
		var medium, category string
		if err := rows.Scan(&id, &medium, &category); err != nil {
			rows.Close()
			return err
		}
		if k := quoteKindOf(medium, category); k != "" {
			todo = append(todo, row{id: id, kind: k})
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	if len(todo) == 0 {
		return nil
	}

	stmt, err := tx.Prepare(`UPDATE utterances SET kind = ? WHERE id = ?`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for _, r := range todo {
		if _, err := stmt.Exec(r.kind, r.id); err != nil {
			return err
		}
	}
	// The staging mirror is left alone on purpose: a staged row is an import
	// nobody has approved, its kind arrives with the file, and rewriting somebody's
	// pending queue on upgrade would change what they are about to review.
	return nil
}
