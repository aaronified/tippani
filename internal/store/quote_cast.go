package store

import (
	"database/sql"
	"fmt"
	"strings"

	"tippani/internal/metadata"
)

// A QUOTE'S SPEAKER AND A CAST ROW ARE THE SAME THING, and until this file they
// were two things that happened to agree.
//
// The owner's ruling, in their words: "both of those should be the same thing
// anyway in the backend". PLAN.md decided it when characters got their own table
// — "a quote's speaker points at the CAST ROW rather than at the character" —
// and 0056 added `speaker_cast_id` to all three quote tables to hold it. Nothing
// ever wrote one. The column has been NULL on every row of every library since.
//
// WHAT THE APP DID INSTEAD, and why it is not the same. A quote names its speaker
// as TEXT and everything downstream re-derives the link on demand by FOLDING that
// text and matching `work_cast.character_key`: the picture on a chip, the
// adoption that puts a quoted character onto a work's cast, the guard that refuses
// to take a character off a work. Three readers, three folds, and the fold is
// where they can disagree — CastKey is not SQLite's `lower()`, so every one of
// them has to be Go, and every one of them is a chance to write the join slightly
// differently. Worse, none of them can answer the reverse question at all: given a
// cast row, which quotes are its? A LIKE over a text column is not an answer.
//
// SO THE LINK IS WRITTEN WHERE THE NAME IS WRITTEN, beside SyncQuotePerson, on
// exactly the same call sites and with exactly the same rules. The fold stays —
// it is still what a chip uses to draw several faces on one line — but there is
// now one column that says, per quote, which cast row this is.
//
// ------------------------------------------------------------ the three rules
//
// They are SyncQuotePerson's, deliberately, because a reader cannot be expected
// to hold two models of what a speaker link does:
//
//   A LINK THAT STILL ANSWERS TO THE NAME IS LEFT ALONE. A work may bill two
//   characters whose names fold together — a recast part, young and old — and a
//   reader who picked one deliberately must not have that undone by an edit to
//   the note.
//
//   AN EMPTY NAME CLEARS IT. "Nobody said this" is a real answer, and a stale id
//   would make a cast row claim a line that no longer names it.
//
//   SO DOES A NAME THAT MEANS SEVERAL. A line credited to two characters has no
//   honest single cast row, and taking the first would file a two-hander under one
//   of them and hide it from the other. SyncQuotePerson's own header already says
//   "which is exactly what speaker_cast_id does with the same line" — it says so
//   about behaviour that did not exist yet, and this is that sentence coming true.
//
// AND ONE THAT IS THIS FILE'S OWN: A MISSING CAST ROW IS NOT AN ERROR AND NOT A
// REASON TO CREATE ONE. Adoption (cast_from_quotes.go) is what turns a quoted
// character into a cast row, it runs on the work's own list read, and it is
// deliberately the only place that writes one — a second creator would be a second
// set of rules about origin, billing and tombstones. So a quote naming somebody
// the work's cast has never heard of simply stays unlinked until that list is next
// read, which is the moment the app has always chosen to reconcile the two.

// castQuoteTable maps a work kind to the quote table that hangs off it, its
// speaker column, and how ownership is proved.
//
// A DIALOGUE HAS NO user_id — it is owned through its movie — which is why the
// screen row carries a join and the book row does not. Every statement is
// parameterised by uid rather than trusting the caller: per-user isolation is not
// something a helper gets to assume.
var castQuoteTable = map[string]struct {
	table string
	read  string
	write string
}{
	"book": {
		table: "annotations",
		read: `SELECT a.book_id, a.character, a.speaker_cast_id FROM annotations a
		         JOIN books b ON b.id = a.book_id
		        WHERE a.id = ? AND b.user_id = ?`,
		write: `UPDATE annotations SET speaker_cast_id = ?
		         WHERE id = ? AND book_id IN (SELECT id FROM books WHERE user_id = ?)`,
	},
	"movie": {
		table: "dialogues",
		read: `SELECT d.movie_id, d.character, d.speaker_cast_id FROM dialogues d
		         JOIN movies m ON m.id = d.movie_id
		        WHERE d.id = ? AND m.user_id = ?`,
		write: `UPDATE dialogues SET speaker_cast_id = ?
		         WHERE id = ? AND movie_id IN (SELECT id FROM movies WHERE user_id = ?)`,
	},
}

// SyncQuoteCast points one quote at the cast row its character names, or clears
// the link when nothing on the work answers to it.
//
// IT READS RATHER THAN BEING TOLD, for SyncQuotePerson's reason: most callers have
// already written the column by the time they are done, and a caller that restates
// what it just wrote is a caller that can restate it wrong.
func SyncQuoteCast(tx *sql.Tx, uid int64, kind string, quoteID int64, seps metadata.CreditSeps) error {
	t, ok := castQuoteTable[kind]
	if !ok {
		return fmt.Errorf("sync quote cast: unknown kind %q", kind)
	}
	var workID int64
	var character sql.NullString
	var have sql.NullInt64
	err := tx.QueryRow(t.read, quoteID, uid).Scan(&workID, &character, &have)
	if err == sql.ErrNoRows {
		// Not this reader's quote, or gone. Not an error, for the same reason
		// SyncQuotePerson says so: a caller that deleted the row and then synced is
		// asking about nothing, and another account's row is invisible rather than
		// refused.
		return nil
	}
	if err != nil {
		return fmt.Errorf("read quote character: %w", err)
	}

	named := strings.TrimSpace(character.String)
	if parts := metadata.SplitCredits(named, seps); len(parts) == 1 {
		named = strings.TrimSpace(parts[0])
	} else {
		named = ""
	}
	key := CastKey(named)
	if key == "" {
		if !have.Valid {
			return nil
		}
		if _, err := tx.Exec(t.write, nil, quoteID, uid); err != nil {
			return fmt.Errorf("clear quote speaker_cast_id: %w", err)
		}
		return nil
	}

	if have.Valid {
		answers, err := castRowAnswersTo(tx, uid, have.Int64, kind, workID, key)
		if err != nil {
			return err
		}
		if answers {
			return nil
		}
	}

	// THE LIVE ROW WITH THE LOWEST BILLING, which is the same first-match-wins the
	// autofill has always used on this table: a provider legitimately bills one
	// character twice, and the billed one is the one a reader means.
	var castID int64
	err = tx.QueryRow(
		`SELECT id FROM work_cast
		  WHERE user_id = ? AND kind = ? AND work_id = ? AND character_key = ? AND origin <> 'removed'
		  ORDER BY billing, id LIMIT 1`, uid, kind, workID, key).Scan(&castID)
	if err == sql.ErrNoRows {
		// Nothing on the list answers to this name yet. See the header: adoption
		// creates the row on the work's next list read, and this runs again then.
		if !have.Valid {
			return nil
		}
		if _, err := tx.Exec(t.write, nil, quoteID, uid); err != nil {
			return fmt.Errorf("clear quote speaker_cast_id: %w", err)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("find cast row for quote: %w", err)
	}
	if have.Valid && have.Int64 == castID {
		return nil
	}
	if _, err := tx.Exec(t.write, castID, quoteID, uid); err != nil {
		return fmt.Errorf("set quote speaker_cast_id: %w", err)
	}
	return nil
}

// castRowAnswersTo asks whether the row a quote is already pointed at is still on
// this work and still spelled this way.
//
// BOTH HALVES MATTER. The row may have been tombstoned since — a removal the
// reader made from the work's cast — in which case the link has to go even though
// the name still matches. And the row may have been renamed, which is the case
// where the reader changed who said the line.
func castRowAnswersTo(tx *sql.Tx, uid, castID int64, kind string, workID int64, key string) (bool, error) {
	var storedKey, origin string
	var rowKind string
	var rowWork int64
	err := tx.QueryRow(
		`SELECT character_key, origin, kind, work_id FROM work_cast WHERE id = ? AND user_id = ?`,
		castID, uid).Scan(&storedKey, &origin, &rowKind, &rowWork)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("read cast row %d: %w", castID, err)
	}
	return storedKey == key && origin != "removed" && rowKind == kind && rowWork == workID, nil
}

// LinkWorkQuotesToCast points every quote on one work at the cast row it names,
// in one pass.
//
// THIS IS THE HISTORY, AND IT IS WHY THE FEATURE IS NOT ONLY FOR NEW QUOTES. The
// per-quote sync above runs on the six paths that write a quote; a library that
// has been in use for a year has thousands of quotes none of those paths will
// touch again. Adoption already walks a work's quotes on every cast-list read and
// is already the place the two tables are reconciled, so this runs beside it: the
// rows exist by the time it runs, and the whole of a work's history is linked the
// first time anybody opens it.
//
// IT WRITES ONLY WHAT CHANGES. The steady state is one SELECT per work and no
// UPDATE at all, which is what makes it cheap enough to sit on a read — the same
// argument cast_from_quotes.go makes for adoption itself.
func LinkWorkQuotesToCast(tx *sql.Tx, uid int64, kind string, workID int64, seps metadata.CreditSeps) error {
	t, ok := castQuoteTable[kind]
	if !ok {
		return fmt.Errorf("link work quotes: unknown kind %q", kind)
	}
	rows, err := tx.Query(
		`SELECT id, character_key FROM work_cast
		  WHERE user_id = ? AND kind = ? AND work_id = ? AND origin <> 'removed'
		  ORDER BY billing, id`, uid, kind, workID)
	if err != nil {
		return fmt.Errorf("read work cast: %w", err)
	}
	byKey := map[string]int64{}
	for rows.Next() {
		var id int64
		var key string
		if err := rows.Scan(&id, &key); err != nil {
			rows.Close()
			return err
		}
		// First wins, which is billing order — see SyncQuoteCast.
		if key != "" && byKey[key] == 0 {
			byKey[key] = id
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	col := "book_id"
	if kind != "book" {
		col = "movie_id"
	}
	qs, err := tx.Query(
		`SELECT id, character, speaker_cast_id FROM `+t.table+` WHERE `+col+` = ? ORDER BY id`, workID)
	if err != nil {
		return fmt.Errorf("read work quotes: %w", err)
	}
	type change struct {
		id   int64
		cast sql.NullInt64
	}
	var changes []change
	for qs.Next() {
		var id int64
		var character sql.NullString
		var have sql.NullInt64
		if err := qs.Scan(&id, &character, &have); err != nil {
			qs.Close()
			return err
		}
		var want sql.NullInt64
		named := strings.TrimSpace(character.String)
		if parts := metadata.SplitCredits(named, seps); len(parts) == 1 {
			if id := byKey[CastKey(strings.TrimSpace(parts[0]))]; id != 0 {
				want = sql.NullInt64{Int64: id, Valid: true}
			}
		}
		if want.Valid != have.Valid || want.Int64 != have.Int64 {
			changes = append(changes, change{id: id, cast: want})
		}
	}
	qs.Close()
	if err := qs.Err(); err != nil {
		return err
	}

	for _, c := range changes {
		var v any
		if c.cast.Valid {
			v = c.cast.Int64
		}
		if _, err := tx.Exec(t.write, v, c.id, uid); err != nil {
			return fmt.Errorf("link quote %d: %w", c.id, err)
		}
	}
	return nil
}

// CharacterLines returns the quotes LINKED to a character, and a count of the
// further quotes that name them alongside somebody else.
//
// THIS IS THE QUESTION THE FOLD COULD NOT ANSWER, and the reason the link is worth
// a column at all. "Which quotes is this cast row's" has no honest answer over a
// text field: CastKey folds punctuation, case and whitespace that SQLite's lower()
// leaves alone, so a LIKE would match some libraries and miss others, and a scan
// of every quote in the account to fold in Go is what a join is for.
//
// IT MIRRORS PersonLines EXACTLY, including the second number, and for the same
// reason: the linker refuses to guess on a line that names two characters, so a
// link-only list silently omits the lines a reader is most likely to look for. The
// count is computed the way the linker computes its answer — SplitCredits with the
// account's own separators, folded against this character's name and every alias —
// because a looser rule here would report a number the linker disagrees with.
//
// THE ORDER IS BOOK LINES THEN SCREEN ONES, each newest first, and it is not one
// merged recency order — the same call PersonLines makes and for the same reason.
// The two live in two tables with two id spaces, so interleaving them would mean
// sorting on created_at in Go over the whole set before the cap could be applied,
// and a character is in practice in a novel or in its adaptations rather than
// equally in both. Said out loud because the cap therefore takes book lines first,
// which is a thing a caller can see.
//
// `limit` caps the listed lines and not the count: a reader with four hundred
// linked lines wants a screenful and the total.
func CharacterLines(db Queryer, uid, characterID int64, seps metadata.CreditSeps, limit int) ([]QuoteLine, int, error) {
	keys, err := characterSpellings(db, uid, characterID)
	if err != nil {
		return nil, 0, err
	}
	out := []QuoteLine{}

	// ---- the linked ones, both shelves ---------------------------------------
	//
	// A BOOK HIGHLIGHT IS HERE AND IS NOT IN PersonLines, which is the asymmetry
	// the two links are FOR: a novel has speakers and no performers, so the person
	// link has nothing to say about it and this one has everything.
	for _, q := range []struct {
		sql  string
		kind QuoteKind
	}{
		{`SELECT a.id, a.quote, a.character, b.id, b.title
		    FROM annotations a JOIN books b ON b.id = a.book_id
		    JOIN work_cast wc ON wc.id = a.speaker_cast_id
		   WHERE b.user_id = ? AND wc.character_id = ? AND wc.origin <> 'removed'
		   ORDER BY a.id DESC`, KindHighlight},
		{`SELECT d.id, d.quote, d.character, m.id, m.title
		    FROM dialogues d JOIN movies m ON m.id = d.movie_id
		    JOIN work_cast wc ON wc.id = d.speaker_cast_id
		   WHERE m.user_id = ? AND wc.character_id = ? AND wc.origin <> 'removed'
		   ORDER BY d.id DESC`, KindScreen},
	} {
		rows, err := db.Query(q.sql, uid, characterID)
		if err != nil {
			return nil, 0, fmt.Errorf("character lines: %s: %w", q.kind, err)
		}
		for rows.Next() {
			l := QuoteLine{Kind: q.kind}
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
	}

	// ---- the ones that name somebody else too --------------------------------
	shared := 0
	for _, q := range []string{
		`SELECT a.character FROM annotations a JOIN books b ON b.id = a.book_id
		  WHERE b.user_id = ? AND a.speaker_cast_id IS NULL AND TRIM(a.character) <> ''`,
		`SELECT d.character FROM dialogues d JOIN movies m ON m.id = d.movie_id
		  WHERE m.user_id = ? AND d.speaker_cast_id IS NULL AND TRIM(d.character) <> ''`,
	} {
		rows, err := db.Query(q, uid)
		if err != nil {
			return nil, 0, fmt.Errorf("character lines: shared: %w", err)
		}
		for rows.Next() {
			var printed string
			if err := rows.Scan(&printed); err != nil {
				rows.Close()
				return nil, 0, err
			}
			parts := metadata.SplitCredits(printed, seps)
			if len(parts) < 2 {
				// One name that is simply not on any cast list yet. Not a shared line
				// — counting it would report lines this character does not have.
				continue
			}
			for _, part := range parts {
				if keys[CastKey(part)] {
					shared++
					break
				}
			}
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, 0, err
		}
	}

	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out, shared, nil
}

// characterSpellings is every folded name this record answers to: its own, and
// every alias it has collected. The alias arm is what makes a merge stick — a
// merge re-points ids and never edits a spelling, so the folded name a quote still
// prints has to keep finding the surviving record.
func characterSpellings(db Queryer, uid, characterID int64) (map[string]bool, error) {
	keys := map[string]bool{}
	var name string
	err := db.QueryRow(`SELECT name FROM characters WHERE id = ? AND user_id = ?`, characterID, uid).Scan(&name)
	if err == sql.ErrNoRows {
		return keys, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read character %d: %w", characterID, err)
	}
	keys[CastKey(name)] = true
	rows, err := db.Query(
		`SELECT alias FROM character_alias WHERE user_id = ? AND character_id = ?`, uid, characterID)
	if err != nil {
		return nil, fmt.Errorf("character aliases: %w", err)
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
