package httpapi

import (
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// A CHARACTER YOU HAVE ALREADY QUOTED IS ALREADY ONE OF THIS WORK'S PEOPLE.
//
// THE COMPLAINT, IN THE OWNER'S WORDS: "book / game characters still needs to be
// separately set in details before they appear. the characters i already entered
// in quotes in the work are not populating that list. that makes it really
// confusing for long term use."
//
// And it was exactly right. 0048 gave every work a cast table, and the only two
// things that ever wrote a row were a provider fetch and the Add button in the
// People panel. A book has no provider fetch for its cast at all and most games
// have none worth the name (TIP-META-018), so for both the list started empty and
// stayed empty — while the reader typed character names onto highlight after
// highlight, into a column 0047 had already added for the purpose. The app knew
// who was in the book. It just would not say so anywhere the reader could use it:
// not in the People panel, not in the character combobox that is supposed to
// remind you how you spelled a name last time, and not in the cast a picture can
// be attached to.
//
// WHAT THIS DOES. Before a work's cast is listed, every character named on that
// work's own quotes and not already on the list is added to it — as a `reader`
// row, which is what it is: a name the reader typed, with no provider underneath.
//
// ---------------------------------------------------------------- on the read
//
// ADOPTION HAPPENS ON THE LIST AND NOT ON THE SAVE, and that is the decision worth
// arguing, because a GET that writes is not free of doubt.
//
// The save path was the first design and it was rejected for being SIX PLACES. A
// character reaches a quote from the capture form, the edit modal, a bulk edit,
// the staging queue's approve, a Markdown import and the demo seed — and a rule
// applied in five of six is not a rule, it is a bug that only shows up in the
// sixth. It would also have needed a one-time pass to cover every quote already
// written, which is the same code again in a second place with a different
// lifetime.
//
// The list is ONE place, it covers the whole history for free, and everything that
// wants a work's characters already goes through it: the People panel, and the
// combobox under the character box in both capture forms. Nothing else has to
// learn anything.
//
// IT WRITES NOTHING WHEN THERE IS NOTHING TO ADD, which is what makes it cheap
// enough to sit on a read. The steady state — every quoted character already on
// the list — is one SELECT of a work's distinct character strings and no
// transaction at all. The write happens once per new name, ever.
//
// A ROW IS PERMANENT ONCE MADE, so this is also why one call site is enough rather
// than merely tolerable: the film board reads its cast from `GET /movies/{id}`,
// which never calls this — and it does not need to, because by the time anything
// draws that board the panel or the capture form has already created the rows, and
// they are in the table for good.
//
// ------------------------------------------------------------- what it respects
//
// A TOMBSTONE STAYS DEAD. Deleting a character from the People panel leaves an
// `origin = 'removed'` row precisely so a refetch cannot bring it back, and this
// obeys the same rule: the existing-keys query reads EVERY origin, tombstones
// included. Without that, deleting a character the reader had also quoted would
// undelete it on the next read, forever, and the delete button would look broken
// rather than declined.
//
// THE FOLD IS store.CastKey, the table's own, so "Eowyn" typed on a line and
// "eowyn " on a cast row are one character — which is the same comparison the
// duplicate check in handleAddCast makes, and it has to be, or the reader gets a
// second row for a name they can see is already there.
//
// A LINE CAN NAME SEVERAL CHARACTERS, entered with the reader's own separators, so
// each string is split before it is folded — the same metadata.SplitCredits the
// character-picture lookup uses on the same column.
//
// A FILM LINE ALSO NAMES WHO PLAYED THEM, and the actor is carried over when — and
// only when — the two lists are the same length, because that is the only case
// where the pairing is unambiguous. "Frodo, Sam" beside "Elijah Wood, Sean Astin"
// pairs; "Frodo, Sam" beside "Elijah Wood" does not, and inventing a pairing there
// would put the wrong actor's face on a character permanently. A book's rows never
// carry one: 0047 refused `annotations.actor` and the API refuses a book's cast row
// an actor, both in as many words.
func (s *Server) adoptQuoteCharacters(uid int64, kind string, workID int64) {
	named, err := s.quoteCharacters(uid, kind, workID)
	if err != nil {
		// Best effort, and the panel still renders the rows that do exist. A cast
		// list that is missing a name is worse than one that is complete and far
		// better than an error page where a list should be.
		olog.Warnf(olog.CodeCastRowScan, "[cast] quote characters for %s %d: %v", kind, workID, err)
		return
	}
	if len(named) == 0 {
		return
	}

	have, err := s.castKeysOnWork(uid, kind, workID)
	if err != nil {
		olog.Warnf(olog.CodeCastRowScan, "[cast] existing cast keys for %s %d: %v", kind, workID, err)
		return
	}
	room := maxWorkCast - len(have)
	var add []quoteCharacter
	for _, c := range named {
		if have[c.key] {
			continue
		}
		if len(add) >= room {
			// SAID OUT LOUD RATHER THAN TRUNCATED IN SILENCE. A reader whose work has
			// more distinct quoted characters than the list can hold gets the first
			// two hundred and a line in the log saying so, which is the only place
			// that fact can be found later.
			olog.Printf("[cast] %s %d: %d quoted character(s) past the %d-row cast cap, not added",
				kind, workID, len(named)-len(add), maxWorkCast)
			break
		}
		have[c.key] = true // a name repeated on two lines is one row
		add = append(add, c)
	}
	if len(add) == 0 {
		return
	}

	// ONE TRANSACTION, because billing is read-then-write: MAX(billing)+1 for each
	// new row, which is what puts a hand-named character after the billed cast the
	// same way the Add button does.
	tx, err := s.Store.DB.Begin()
	if err != nil {
		olog.Warnf(olog.CodeCastRowScan, "[cast] adopt begin for %s %d: %v", kind, workID, err)
		return
	}
	defer tx.Rollback()
	var billing int
	if err := tx.QueryRow(
		`SELECT COALESCE(MAX(billing), -1) + 1 FROM work_cast WHERE kind = ? AND work_id = ?`,
		kind, workID).Scan(&billing); err != nil {
		olog.Warnf(olog.CodeCastRowScan, "[cast] adopt billing for %s %d: %v", kind, workID, err)
		return
	}
	for _, c := range add {
		res, err := tx.Exec(
			`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key,
			                        billing, origin)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			uid, kind, workID, c.name, c.key, c.actor, store.CastKey(c.actor), billing, castReader)
		if err != nil {
			olog.Warnf(olog.CodeCastRowScan, "[cast] adopt %q on %s %d: %v", c.name, kind, workID, err)
			return
		}
		// This path exists because the reader already named the character on a
		// quote. Giving the row its record here is what lets that quote's speaker
		// point at something, so the adoption finishes the job it started.
		if id, ierr := res.LastInsertId(); ierr == nil {
			if lerr := store.LinkCastRow(tx, uid, id); lerr != nil {
				olog.Warnf(olog.CodeCastRowScan, "[cast] link adopted %q on %s %d: %v", c.name, kind, workID, lerr)
			}
		}
		billing++
	}
	if err := tx.Commit(); err != nil {
		olog.Warnf(olog.CodeCastRowScan, "[cast] adopt commit for %s %d: %v", kind, workID, err)
		return
	}
	olog.Printf("[cast] %s %d: %d character(s) adopted from its own quotes", kind, workID, len(add))
}

// quoteCharacter is one name as it was typed on a line, folded, with the actor
// beside it where the line named one.
type quoteCharacter struct {
	name  string
	key   string
	actor string
}

// quoteCharacters reads every character named on a work's own quotes, in the
// order the rows were written, deduped on the folded key — so the spelling that
// survives is the one the reader used FIRST, which is the one the rest of their
// library already agrees with.
//
// SCOPED BY WORK AND NOT BY USER, because neither `annotations` nor `dialogues`
// carries a user_id: both are scoped through their parent work, and every caller
// here has already put the work through castWork, which is the ownership check.
// Restating it as a join would be a second answer to a question already answered.
func (s *Server) quoteCharacters(uid int64, kind string, workID int64) ([]quoteCharacter, error) {
	var q string
	if kind == "book" {
		// A book's line has no actor, so the column is a literal — one scan shape for
		// both branches beats two loops that have to be kept in step.
		q = `SELECT character, '' FROM annotations
		     WHERE book_id = ? AND TRIM(character) <> '' ORDER BY id`
	} else {
		q = `SELECT character, COALESCE(actor, '') FROM dialogues
		     WHERE movie_id = ? AND TRIM(character) <> '' ORDER BY id`
	}
	rows, err := s.Store.DB.Query(q, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	seps := s.creditSeps(uid)
	seen := map[string]bool{}
	out := []quoteCharacter{}
	for rows.Next() {
		var chars, actors string
		if err := rows.Scan(&chars, &actors); err != nil {
			return nil, err
		}
		names := metadata.SplitCredits(chars, seps)
		played := metadata.SplitCredits(actors, seps)
		for i, n := range names {
			key := store.CastKey(n)
			if key == "" || seen[key] {
				continue
			}
			seen[key] = true
			c := quoteCharacter{name: strings.TrimSpace(n), key: key}
			// Only a one-to-one line pairs. See the header.
			if len(played) == len(names) {
				c.actor = strings.TrimSpace(played[i])
			}
			out = append(out, c)
		}
	}
	return out, rows.Err()
}

// castKeysOnWork returns every folded character key already on a work's list,
// TOMBSTONES INCLUDED — see the header for why the deleted ones have to be in
// here.
func (s *Server) castKeysOnWork(uid int64, kind string, workID int64) (map[string]bool, error) {
	rows, err := s.Store.DB.Query(
		`SELECT character_key FROM work_cast WHERE user_id = ? AND kind = ? AND work_id = ?`,
		uid, kind, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		out[k] = true
	}
	return out, rows.Err()
}
