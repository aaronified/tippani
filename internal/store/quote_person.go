package store

import (
	"database/sql"
	"fmt"
	"strings"

	"tippani/internal/metadata"
)

// The two person-bearing columns that are not work credits: who said THIS line.
//
// 0059 gave dialogues.actor and utterances.speaker a record to point at, and
// this file is the only place that points them. The argument is credits.go's,
// one paragraph shorter: a cache with nine writers is nine chances to disagree,
// so the writers call one function and QuoteLinksAgree walks the library
// asserting they did.
//
// WHAT IS DIFFERENT FROM A CREDIT, and it is the whole reason this is a separate
// file rather than a fifth CreditRole:
//
//   - A credit is joined. "Gaiman & Pratchett" is two people in one column, so
//     SetCredits takes a list and RecomposeCredit re-prints it. A quote points at
//     ONE speaker — 0056 already ruled that when it gave both quote tables a
//     single speaker_cast_id — so there is nothing to join and no ordering.
//   - A credit belongs to a WORK. work_person is keyed by (kind, work_id, role);
//     a dialogue's actor is a fact about one line and two lines of one film
//     routinely name two actors. So the link is a column on the quote.
//   - A credit column is a rendering that may be faithful to the reader's
//     spelling and is therefore left alone. Here the column IS the spelling —
//     one row, one name — so there is nothing to recompose and the column is
//     never written by this file at all. It only ever reads it.

// QuoteKind is which of the two tables a quote lives in, spelled with the names
// the app already uses for them in item_reviews and anthology_entries. An
// annotation is not here: a book highlight has no speaker column, and 0056 gave
// it speaker_cast_id for the case where it does have a speaker.
type QuoteKind string

const (
	KindScreen    QuoteKind = "screen"    // dialogues.actor
	KindUtterance QuoteKind = "utterance" // utterances.speaker
	// KindHighlight is a book's own line. It is NOT in quotePersonColumn below and
	// never will be — a novel has speakers and no performers, which is the whole
	// asymmetry the two links exist for — but a QuoteLine has to be able to say it
	// is one, because CharacterLines returns highlights and dialogues together.
	KindHighlight QuoteKind = "highlight" // annotations.character
)

// quotePersonColumn maps a kind to the two columns and the ownership test.
//
// A DIALOGUE HAS NO user_id. It is owned through its movie, which is why the
// screen row carries a join and the utterance row does not — and why every
// statement below is parameterised by uid rather than trusting the caller to
// have checked. Per-user isolation is not something a helper gets to assume.
var quotePersonColumn = map[QuoteKind]struct {
	name  string // the printed spelling
	link  string // the id
	read  string
	write string
}{
	KindScreen: {
		name: "actor", link: "actor_id",
		read: `SELECT d.actor, d.actor_id FROM dialogues d
		         JOIN movies m ON m.id = d.movie_id
		        WHERE d.id = ? AND m.user_id = ?`,
		write: `UPDATE dialogues SET actor_id = ?
		         WHERE id = ? AND movie_id IN (SELECT id FROM movies WHERE user_id = ?)`,
	},
	KindUtterance: {
		name: "speaker", link: "speaker_id",
		read:  `SELECT speaker, speaker_id FROM utterances WHERE id = ? AND user_id = ?`,
		write: `UPDATE utterances SET speaker_id = ? WHERE id = ? AND user_id = ?`,
	},
}

// SyncQuotePerson reads the name printed on one quote and points the row at the
// person it names, creating that person if the library has never seen them.
//
// IT READS RATHER THAN BEING TOLD, for exactly the reason SyncCreditsFromColumns
// does: most callers have already written the column by the time they are done —
// an INSERT of the reader's fields, a COALESCE backfill that may or may not have
// filled anything, a rename's UPDATE over a set of ids — and a caller that
// restates what it just wrote is a caller that can restate it wrong.
//
// A LINK THAT ALREADY ANSWERS TO THE NAME IS LEFT ALONE, which is the one-to-one
// twin of the faithful-column rule. Two people in a library may share a name; a
// reader who picked the second one deliberately must not have that pick undone
// by an unrelated edit to the note. So this only re-resolves when the current
// link no longer answers to what the column says — which is precisely when the
// reader changed who said it.
//
// AN EMPTY NAME CLEARS THE LINK. "Nobody said this" is a real answer — narration,
// an epigraph, a line the reader has not attributed yet — and leaving a stale id
// behind would make the person panel claim a quote the quote no longer names.
//
// SO DOES A NAME THAT MEANS SEVERAL PEOPLE, and that case is real rather than
// theoretical: autofillActor credits a line naming two characters to both their
// performers, joined. There is no honest single answer there — taking the first
// would put a two-hander in one person's panel and hide it from the other's — so
// the row stays unlinked, which is exactly what speaker_cast_id does with the
// same line. The name is still printed, still searched, and still rewritten by a
// rename, because the rename edits the string as well.
//
// The split is metadata.SplitCredits with the ACCOUNT'S OWN separators, so a
// performer billed "Davis, Jr." is one person for a reader who has the comma on —
// suffix re-attachment is the whole reason this does not split on punctuation
// itself.
func SyncQuotePerson(tx *sql.Tx, uid int64, kind QuoteKind, quoteID int64, seps metadata.CreditSeps) error {
	t, ok := quotePersonColumn[kind]
	if !ok {
		return fmt.Errorf("sync quote person: unknown kind %q", kind)
	}
	var name sql.NullString
	var have sql.NullInt64
	err := tx.QueryRow(t.read, quoteID, uid).Scan(&name, &have)
	if err == sql.ErrNoRows {
		// Not this reader's quote, or gone. Not an error: a caller that deleted
		// the row and then synced is asking about nothing, and per-user isolation
		// means another account's row is invisible rather than refused.
		return nil
	}
	if err != nil {
		return fmt.Errorf("read quote %s: %w", t.name, err)
	}
	printed := strings.TrimSpace(name.String)
	if parts := metadata.SplitCredits(printed, seps); len(parts) == 1 {
		printed = parts[0]
	} else {
		printed = ""
	}
	if printed == "" {
		if !have.Valid {
			return nil
		}
		if _, err := tx.Exec(t.write, nil, quoteID, uid); err != nil {
			return fmt.Errorf("clear quote %s: %w", t.link, err)
		}
		return nil
	}
	if have.Valid {
		answers, err := personAnswersTo(tx, uid, have.Int64, printed)
		if err != nil {
			return err
		}
		if answers {
			return nil
		}
	}
	pid, err := ResolvePerson(tx, uid, printed)
	if err != nil {
		return err
	}
	if have.Valid && have.Int64 == pid {
		return nil
	}
	if _, err := tx.Exec(t.write, pid, quoteID, uid); err != nil {
		return fmt.Errorf("set quote %s: %w", t.link, err)
	}
	return nil
}

// personAnswersTo asks whether a record is one of the people this spelling could
// mean — by its own name, or by an alias it has collected.
//
// THE ALIAS ARM IS WHAT MAKES A MERGE STICK. Merging "Bob Peck" into "Robert
// Peck" leaves every quote still printing "Bob Peck", because a merge re-points
// ids and never edits a spelling; the alias the merge recorded is what tells the
// next sync that the surviving record still answers to that name. Without it the
// first edit to any of those quotes would resolve the old spelling back into a
// fresh record and quietly undo the merge, one quote at a time.
func personAnswersTo(tx *sql.Tx, uid, personID int64, name string) (bool, error) {
	var stored string
	err := tx.QueryRow(`SELECT name FROM people WHERE id = ? AND user_id = ?`, personID, uid).Scan(&stored)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("read person %d: %w", personID, err)
	}
	if CastKey(stored) == CastKey(name) {
		return true, nil
	}
	var n int
	if err := tx.QueryRow(
		`SELECT COUNT(*) FROM person_alias WHERE user_id = ? AND person_id = ? AND alias_key = ?`,
		uid, personID, CastKey(name)).Scan(&n); err != nil {
		return false, fmt.Errorf("read aliases of person %d: %w", personID, err)
	}
	return n > 0, nil
}

// SyncAllQuotePeople re-derives every quote link in one account.
//
// The repair half of the pair, and the same shape SyncAllCredits has: it is what
// the rename handler calls, because that handler rewrites a name as a component
// inside strings it reaches by id without recording which table each id came
// from — and it is what a support answer runs when QuoteLinksAgree reports drift
// on a real database.
func SyncAllQuotePeople(tx *sql.Tx, uid int64, seps metadata.CreditSeps) error {
	for _, k := range []QuoteKind{KindScreen, KindUtterance} {
		ids, err := quoteIDsWithAName(tx, uid, k)
		if err != nil {
			return err
		}
		// Collected before writing: the sync writes to the table this cursor read.
		for _, id := range ids {
			if err := SyncQuotePerson(tx, uid, k, id, seps); err != nil {
				return err
			}
		}
	}
	return nil
}

// quoteIDsWithAName lists the quotes worth visiting: one that names nobody and
// links to nobody is already in agreement, and in a book-only library that is
// every row in both tables.
func quoteIDsWithAName(tx *sql.Tx, uid int64, kind QuoteKind) ([]int64, error) {
	var q string
	switch kind {
	case KindScreen:
		q = `SELECT d.id FROM dialogues d JOIN movies m ON m.id = d.movie_id
		      WHERE m.user_id = ?
		        AND (COALESCE(TRIM(d.actor), '') <> '' OR d.actor_id IS NOT NULL)`
	case KindUtterance:
		q = `SELECT id FROM utterances
		      WHERE user_id = ?
		        AND (COALESCE(TRIM(speaker), '') <> '' OR speaker_id IS NOT NULL)`
	default:
		return nil, fmt.Errorf("list quotes: unknown kind %q", kind)
	}
	rows, err := tx.Query(q, uid)
	if err != nil {
		return nil, fmt.Errorf("list %s quotes: %w", kind, err)
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// QuoteLinkDisagreement is one quote whose printed name and linked record do not
// describe the same person.
type QuoteLinkDisagreement struct {
	Kind    QuoteKind
	QuoteID int64
	Printed string // what the quote says
	Linked  string // what the record it points at is called; "" when it points at nothing
}

// QuoteLinksAgree walks both quote tables and reports where a name and its
// record have come apart. The twin of CreditsAgree, and it exists as a function
// for the same reason: an invariant that can only be checked by running the test
// suite cannot answer a question about somebody's actual library.
//
// THE SHAPE IT IS LOOKING FOR is a quote that names somebody and points at
// nothing — that is what a write which bypassed SyncQuotePerson leaves behind,
// and it is silent, because the quote still reads correctly on screen and only
// the person panel is missing a line.
//
// A LINK IS JUDGED BY WHETHER THE RECORD ANSWERS TO THE NAME, never by string
// equality with people.name. A merged-away spelling kept on the quote is correct
// and must not be reported; that is the same faithful-spelling promise the
// covers get, and a check that cried wolf on every merged person would be turned
// off within a week.
//
// ONE LEGITIMATE WAY TO REACH A REPORTED ROW, and it is worth knowing before
// reading a report: deleting a person nulls every link pointing at them
// (ON DELETE SET NULL), and their quotes then name somebody the library has no
// record of. That is a real answer to "is the cache in step" — it is not — and it
// is repaired by SyncAllQuotePeople, which re-creates the record from the name
// still printed on the row. So a report after a person delete is the check
// working, not a false alarm.
func QuoteLinksAgree(db *sql.DB, uid int64, seps metadata.CreditSeps) ([]QuoteLinkDisagreement, error) {
	var out []QuoteLinkDisagreement
	for _, k := range []QuoteKind{KindScreen, KindUtterance} {
		var q string
		switch k {
		case KindScreen:
			q = `SELECT d.id, COALESCE(d.actor, ''), COALESCE(p.name, ''), d.actor_id
			       FROM dialogues d
			       JOIN movies m ON m.id = d.movie_id
			  LEFT JOIN people p ON p.id = d.actor_id
			      WHERE m.user_id = ?`
		case KindUtterance:
			q = `SELECT u.id, COALESCE(u.speaker, ''), COALESCE(p.name, ''), u.speaker_id
			       FROM utterances u
			  LEFT JOIN people p ON p.id = u.speaker_id
			      WHERE u.user_id = ?`
		}
		rows, err := db.Query(q, uid)
		if err != nil {
			return nil, fmt.Errorf("check %s quotes: %w", k, err)
		}
		// THE ALIAS QUESTION IS ASKED AFTER THE CURSOR CLOSES, not inside the
		// loop. The pool holds four connections, so a nested read would work —
		// and would be a second statement racing the walk for one of them on a
		// database that also has to serve the reader. Collecting first turns an
		// N+1 into two statements.
		type suspect struct {
			id              int64
			printed, linked string
			linkID          int64
		}
		var maybe []suspect
		for rows.Next() {
			var id int64
			var printed, linked string
			var linkID sql.NullInt64
			if err := rows.Scan(&id, &printed, &linked, &linkID); err != nil {
				rows.Close()
				return nil, err
			}
			// The same reduction SyncQuotePerson makes, so a line credited to
			// two performers is expected to point at nobody rather than reported
			// as drift on every walk.
			printed = strings.TrimSpace(printed)
			if parts := metadata.SplitCredits(printed, seps); len(parts) == 1 {
				printed = parts[0]
			} else {
				printed = ""
			}
			if printed == "" && !linkID.Valid {
				continue
			}
			if printed == "" || !linkID.Valid {
				out = append(out, QuoteLinkDisagreement{Kind: k, QuoteID: id, Printed: printed, Linked: linked})
				continue
			}
			if CastKey(linked) == CastKey(printed) {
				continue
			}
			maybe = append(maybe, suspect{id, printed, linked, linkID.Int64})
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, err
		}
		if len(maybe) == 0 {
			continue
		}
		aliases, err := aliasKeysByPerson(db, uid)
		if err != nil {
			return nil, err
		}
		for _, m := range maybe {
			if aliases[personAlias{m.linkID, CastKey(m.printed)}] {
				continue
			}
			out = append(out, QuoteLinkDisagreement{Kind: k, QuoteID: m.id, Printed: m.printed, Linked: m.linked})
		}
	}
	return out, nil
}

type personAlias struct {
	personID int64
	key      string
}

// aliasKeysByPerson reads the whole alias table for one account. It is read only
// when a quote has already failed the cheap comparison, so a library with no
// merges in it never runs this at all.
func aliasKeysByPerson(db *sql.DB, uid int64) (map[personAlias]bool, error) {
	rows, err := db.Query(`SELECT person_id, alias_key FROM person_alias WHERE user_id = ?`, uid)
	if err != nil {
		return nil, fmt.Errorf("read aliases: %w", err)
	}
	defer rows.Close()
	out := map[personAlias]bool{}
	for rows.Next() {
		var pid int64
		var key string
		if err := rows.Scan(&pid, &key); err != nil {
			return nil, err
		}
		out[personAlias{pid, key}] = true
	}
	return out, rows.Err()
}

// idsPointingAtPerson lists the quotes of one kind whose link names a person.
//
// It is the collect half of the merge's collect-re-point-record, and it exists as
// a named function rather than as two inline queries because the two tables are
// reached differently — a dialogue is owned through its film, an utterance
// directly — and a merge that got that ownership join wrong would re-point
// another account's quotes.
func idsPointingAtPerson(tx *sql.Tx, uid int64, kind QuoteKind, personID int64) ([]int64, error) {
	var q string
	switch kind {
	case KindScreen:
		q = `SELECT d.id FROM dialogues d JOIN movies m ON m.id = d.movie_id
		      WHERE m.user_id = ? AND d.actor_id = ?`
	case KindUtterance:
		q = `SELECT id FROM utterances WHERE user_id = ? AND speaker_id = ?`
	default:
		return nil, fmt.Errorf("quotes of person: unknown kind %q", kind)
	}
	rows, err := tx.Query(q, uid, personID)
	if err != nil {
		return nil, fmt.Errorf("list %s quotes of person %d: %w", kind, personID, err)
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// RenameQuotePeople rewrites the printed name on every quote that POINTS AT one
// person, and reports how many of each kind it touched.
//
// A RENAME IS THE ONE OPERATION THAT SHOULD MOVE THE SPELLING, and that is not in
// tension with 0059's faithful-spelling promise — it is the other side of it. A
// merge says "these two records are one person", so the words on the quote are
// still what the reader wrote and are left alone. A rename says "this person's
// name is spelt this way", which is a statement ABOUT the spelling; leaving the
// old one printed would be the record and the library disagreeing on screen.
// It is the same thing RecomposeCredit does to a stale author column.
//
// LINKED ROWS ONLY, so a quote that merely happens to print the old spelling
// without pointing at the record is untouched — that quote may be a different
// person of the same name, which is the whole reason people are records now.
// Renaming by NAME rather than by record is a different endpoint and still exists.
//
// THE CALLER MUST REHASH THE UTTERANCES IT CHANGED. UtteranceDedupeHash folds the
// speaker in, so a renamed speaker leaves every one of their standalone quotes on
// a hash that no longer describes it — which is why the count comes back rather
// than being swallowed.
func RenameQuotePeople(tx *sql.Tx, uid, personID int64, name string) (screen, utterance int, err error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return 0, 0, fmt.Errorf("rename quote people: empty name")
	}
	res, err := tx.Exec(
		`UPDATE dialogues SET actor = ?, updated_at = datetime('now')
		  WHERE actor_id = ?
		    AND COALESCE(actor, '') <> ?
		    AND movie_id IN (SELECT id FROM movies WHERE user_id = ?)`,
		name, personID, name, uid)
	if err != nil {
		return 0, 0, fmt.Errorf("rename actor on quotes: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, 0, err
	}
	screen = int(n)
	res, err = tx.Exec(
		`UPDATE utterances SET speaker = ?, updated_at = datetime('now')
		  WHERE speaker_id = ? AND user_id = ? AND COALESCE(speaker, '') <> ?`,
		name, personID, uid, name)
	if err != nil {
		return 0, 0, fmt.Errorf("rename speaker on quotes: %w", err)
	}
	if n, err = res.RowsAffected(); err != nil {
		return 0, 0, err
	}
	return screen, int(n), nil
}

// RepointQuotesSpelled moves the quotes that PRINT one spelling from one record
// to another, and reports how many moved.
//
// SPLITTING AN ALIAS OUT IS WHAT THIS IS FOR, and it is the one place where the
// quotes can be re-pointed without asking. SplitPersonAlias is straight that it
// "cannot restore which works came from where" — after a merge every work link
// points at the survivor and the alias is only a spelling. A QUOTE IS DIFFERENT:
// its column holds the whole printed name of its one speaker, so a line saying
// "Bob Peck" and pointing at Robert Peck is not evidence to be weighed, it is the
// answer written on the row.
//
// AND NOT DOING IT IS NOT THE SAFE OPTION. Leaving them behind does not leave
// them alone: after the split, personAnswersTo is false for every one of those
// quotes, so the next unrelated edit to any of them re-resolves the spelling onto
// the new record anyway — the same change, arriving days later, one quote at a
// time, from a write the reader made about something else. Doing it here makes it
// one visible act they can undo by filing the alias again.
//
// THE FOLD IS DONE IN GO, never in SQL. SQLite's lower() is ASCII-only, which is
// the argument 0048 made when it introduced CastKey and the reason a Bengali or
// accented spelling cannot be matched in the query.
func RepointQuotesSpelled(tx *sql.Tx, uid, fromID, toID int64, key string) (int, error) {
	moved := 0
	for _, k := range []QuoteKind{KindScreen, KindUtterance} {
		t := quotePersonColumn[k]
		ids, err := idsPointingAtPerson(tx, uid, k, fromID)
		if err != nil {
			return moved, err
		}
		for _, id := range ids {
			var name sql.NullString
			var have sql.NullInt64
			if err := tx.QueryRow(t.read, id, uid).Scan(&name, &have); err != nil {
				if err == sql.ErrNoRows {
					continue
				}
				return moved, fmt.Errorf("read quote %s: %w", t.name, err)
			}
			if CastKey(strings.TrimSpace(name.String)) != key {
				continue
			}
			if _, err := tx.Exec(t.write, toID, id, uid); err != nil {
				return moved, fmt.Errorf("repoint quote %s: %w", t.link, err)
			}
			moved++
		}
	}
	return moved, nil
}

// ---- the read side ----------------------------------------------------------

// QuoteLine is one quote a person is linked to, as their record lists it.
type QuoteLine struct {
	ID   int64     `json:"id"`
	Kind QuoteKind `json:"kind"`
	Text string    `json:"text"`
	// The spelling THIS quote prints, which is not always the record's name — a
	// merge re-points ids and never edits a spelling, so a line credited to "Bob
	// Peck" goes on saying so after Bob Peck is merged into Robert Peck. Showing
	// it is the honest thing: the reader asked to see this person's lines, and
	// this is how the line names them.
	Name string `json:"name"`
	// The film a screen line belongs to. An utterance belongs to no work, so both
	// are zero and empty there — a standalone quote is the thing it is.
	WorkID    int64  `json:"work_id,omitempty"`
	WorkTitle string `json:"work_title,omitempty"`
}

// PersonLines returns the quotes LINKED to a person, and a count of the further
// quotes that name them alongside somebody else.
//
// THE ORDER IS SCREEN LINES THEN STANDALONE ONES, each newest first, and it is not
// one merged recency order. The two live in two tables with two id spaces, so
// interleaving them would mean sorting on created_at in Go over the whole set
// before the cap could be applied — and a person is in practice a film performer
// or a quoted speaker rather than both, so the merge would almost always be
// sorting one list against nothing. Said here because the cap below therefore
// takes screen lines first, which is a thing a caller can see.
//
// THE SECOND NUMBER IS THE POINT OF THIS FUNCTION. SyncQuotePerson deliberately
// leaves a two-hander unlinked — autofillActor credits a line naming two
// characters to both their performers, and there is no honest single answer — so a
// link-only query silently omits exactly the lines a reader is most likely to go
// looking for. Returning the count lets the panel say "and 3 more name them
// alongside somebody else" instead of quietly being wrong about how many there are.
//
// THE COUNT IS COMPUTED THE WAY THE LINKER COMPUTES ITS ANSWER — metadata.SplitCredits
// with the ACCOUNT'S OWN separators, then a fold-compare against the record's name
// and every alias it holds. A second, looser rule here (a LIKE, say) would report a
// number the linker disagrees with, and the two would drift the moment either
// changed. It scans only the rows that are unlinked AND print a name, which is the
// two-handers and nothing else.
//
// `limit` caps the listed lines, not the count: a reader with four hundred linked
// lines wants the recent ones and the total, and the panel says which it is showing.
func PersonLines(db Queryer, uid, personID int64, seps metadata.CreditSeps, limit int) ([]QuoteLine, int, error) {
	keys, err := personSpellings(db, uid, personID)
	if err != nil {
		return nil, 0, err
	}
	out := []QuoteLine{}

	// ---- the linked ones -----------------------------------------------------
	rows, err := db.Query(
		`SELECT d.id, d.quote, d.actor, m.id, m.title
		   FROM dialogues d JOIN movies m ON m.id = d.movie_id
		  WHERE m.user_id = ? AND d.actor_id = ?
		  ORDER BY d.id DESC`, uid, personID)
	if err != nil {
		return nil, 0, fmt.Errorf("person lines: screen: %w", err)
	}
	for rows.Next() {
		l := QuoteLine{Kind: KindScreen}
		if err := rows.Scan(&l.ID, &l.Text, &l.Name, &l.WorkID, &l.WorkTitle); err != nil {
			rows.Close()
			return nil, 0, err
		}
		out = append(out, l)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, 0, err
	}

	urows, err := db.Query(
		`SELECT id, quote, speaker FROM utterances
		  WHERE user_id = ? AND speaker_id = ? ORDER BY id DESC`, uid, personID)
	if err != nil {
		return nil, 0, fmt.Errorf("person lines: utterance: %w", err)
	}
	for urows.Next() {
		l := QuoteLine{Kind: KindUtterance}
		if err := urows.Scan(&l.ID, &l.Text, &l.Name); err != nil {
			urows.Close()
			return nil, 0, err
		}
		out = append(out, l)
	}
	err = urows.Err()
	urows.Close()
	if err != nil {
		return nil, 0, err
	}

	// ---- the ones that name somebody else too --------------------------------
	shared := 0
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{`SELECT d.actor FROM dialogues d JOIN movies m ON m.id = d.movie_id
		   WHERE m.user_id = ? AND d.actor_id IS NULL AND d.actor IS NOT NULL AND d.actor <> ''`, []any{uid}},
		{`SELECT speaker FROM utterances
		   WHERE user_id = ? AND speaker_id IS NULL AND speaker <> ''`, []any{uid}},
	} {
		srows, err := db.Query(q.sql, q.args...)
		if err != nil {
			return nil, 0, fmt.Errorf("person lines: shared: %w", err)
		}
		for srows.Next() {
			var printed string
			if err := srows.Scan(&printed); err != nil {
				srows.Close()
				return nil, 0, err
			}
			for _, part := range metadata.SplitCredits(printed, seps) {
				if keys[CastKey(part)] {
					shared++
					break
				}
			}
		}
		err = srows.Err()
		srows.Close()
		if err != nil {
			return nil, 0, err
		}
	}

	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out, shared, nil
}

// personSpellings is every folded spelling that resolves to one record — its own
// name and each alias. The set personAnswersTo asks one question of, read once
// here because the caller asks it of every unlinked quote in the account.
func personSpellings(db Queryer, uid, personID int64) (map[string]bool, error) {
	keys := map[string]bool{}
	var name string
	switch err := db.QueryRow(`SELECT name FROM people WHERE id = ? AND user_id = ?`, personID, uid).Scan(&name); {
	case err == sql.ErrNoRows:
		return keys, nil
	case err != nil:
		return nil, fmt.Errorf("read person %d: %w", personID, err)
	}
	keys[CastKey(name)] = true
	rows, err := db.Query(`SELECT alias FROM person_alias WHERE user_id = ? AND person_id = ?`, uid, personID)
	if err != nil {
		return nil, fmt.Errorf("read aliases of person %d: %w", personID, err)
	}
	defer rows.Close()
	for rows.Next() {
		var a string
		if err := rows.Scan(&a); err != nil {
			return nil, err
		}
		keys[CastKey(a)] = true
	}
	return keys, rows.Err()
}
