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
// A TOMBSTONE ANSWERS THE PROVIDER, NOT THE READER. Deleting a character from
// the People panel leaves an `origin = 'removed'` row precisely so a refetch
// cannot bring it back, and that still holds — a refetch reaches these rows in
// mergeProviderCast and writes nothing onto one. What used to hold here as well
// was stronger, and wrong: the existing-keys query read every origin, so a
// character the reader had deleted could never be adopted from their own lines
// again.
//
// THE RULE THAT PRODUCED WAS NOT THE ONE IT CLAIMED. It was not "a tombstone
// stays dead" — it was "a tombstone stays dead unless you spell the name
// differently", because a quote naming the same character with any other
// spelling folds to another key and is adopted freely. The owner's library holds
// both halves of that on one film: a provider row deleted as
// "Dr. Bhaskar K. Bannerjee / Babu Moshai" came straight back when a line named
// "Dr. Bhaskar K. Bannerjee", while "Anand", deleted and then typed exactly,
// stayed gone. So the card printed a speaker the app then refused to show
// anywhere: the chip opened nothing, and Rajesh Khanna's own page said the film
// was not one of his works, with that film's quote crediting him three lines
// above it.
//
// SO A DELETED ROW COMES BACK WHEN, AND ONLY WHEN, THIS WORK'S OWN QUOTES NAME
// IT AND NO LIVE ROW ALREADY CARRIES THAT NAME. Both halves matter. The reader's
// line is a fresh claim made by hand, which is more than the provider ever had;
// and the second half is what keeps a deletion that was a DEDUPE deleted —
// deleting one of two rows for one character leaves the survivor holding the key,
// and reviving the other would put the duplicate back on the list.
//
// The cost is stated rather than hidden: a character you have quoted cannot be
// taken off the work's list while the line still names them. That is the smaller
// wrong. The alternative is the state above — a name on a card that opens
// nothing — and between a row you can see and delete again and a pill that does
// nothing, only one of them can be diagnosed by the person looking at it.
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
		// NOT NOTHING TO DO EITHER: a work whose last speaker was just cleared still
		// has quotes carrying a link to the row they used to name. See linkQuotes.
		s.linkQuotes(uid, kind, workID)
		return
	}

	have, err := s.castKeysOnWork(uid, kind, workID)
	if err != nil {
		olog.Warnf(olog.CodeCastRowScan, "[cast] existing cast keys for %s %d: %v", kind, workID, err)
		return
	}
	room := maxWorkCast - len(have)
	var add []quoteCharacter
	var revive []int64
	for _, c := range named {
		h := have[c.key]
		if h.live {
			continue
		}
		if len(add)+len(revive) >= room {
			// SAID OUT LOUD RATHER THAN TRUNCATED IN SILENCE. A reader whose work has
			// more distinct quoted characters than the list can hold gets the first
			// two hundred and a line in the log saying so, which is the only place
			// that fact can be found later.
			olog.Printf("[cast] %s %d: %d quoted character(s) past the %d-row cast cap, not added",
				kind, workID, len(named)-len(add)-len(revive), maxWorkCast)
			break
		}
		h.live = true // a name repeated on two lines is one row
		have[c.key] = h
		if h.tombstone != 0 {
			revive = append(revive, h.tombstone)
			continue
		}
		add = append(add, c)
	}
	if len(add) == 0 && len(revive) == 0 {
		// NOTHING NEW TO ADOPT IS NOT NOTHING TO DO. The link from a quote to its
		// cast row still has to be reconciled — a library that was in use before
		// that column was written has thousands of quotes no save path will touch
		// again — and this is the read where the two tables meet. See linkQuotes.
		s.linkQuotes(uid, kind, workID)
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
		// A CHARACTER RECORD FOR THE ROW, like every other writer of this table.
		// A row without one is a chip that draws and does not open — see cast.go's
		// insert for the whole argument. A failure here skips the one row rather
		// than abandoning the adoption: this whole function is best-effort, and a
		// name on a quote is a weaker claim than a provider's cast list.
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
	for _, id := range revive {
		// THE ROW COMES BACK AS THE READER'S, not as the provider's. `reader` is the
		// origin a refetch cannot overwrite the names on, which is what this row now
		// is: the provider's spelling of it was deleted, and what brought it back is
		// a line the reader typed. It keeps its provider key, so a later fetch
		// re-matches this row instead of billing a second one beside it.
		//
		// NOTHING ELSE ON THE ROW IS TOUCHED — not the character, not the actor, not
		// the billing, not the pictures. The reader deleted this exact row and named
		// this exact character again; respelling either half here would hand them
		// back something they did not put down.
		if _, err := tx.Exec(
			`UPDATE work_cast SET origin = ? WHERE id = ? AND user_id = ? AND origin = ?`,
			castReader, id, uid, castRemoved); err != nil {
			olog.Warnf(olog.CodeCastRowScan, "[cast] revive %d on %s %d: %v", id, kind, workID, err)
			return
		}
		// A tombstone from before characters had records has no `character_id`, and a
		// row without one is a chip that draws and does not open — the very thing the
		// revival is for.
		if lerr := store.LinkCastRow(tx, uid, id); lerr != nil {
			olog.Warnf(olog.CodeCastRowScan, "[cast] link revived %d on %s %d: %v", id, kind, workID, lerr)
		}
	}
	if err := tx.Commit(); err != nil {
		olog.Warnf(olog.CodeCastRowScan, "[cast] adopt commit for %s %d: %v", kind, workID, err)
		return
	}
	if len(add) > 0 {
		olog.Printf("[cast] %s %d: %d character(s) adopted from its own quotes", kind, workID, len(add))
	}
	if len(revive) > 0 {
		olog.Printf("[cast] %s %d: %d deleted character(s) named again on its own quotes, back on the list",
			kind, workID, len(revive))
	}
	s.linkQuotes(uid, kind, workID)
}

// linkQuotes points every quote on one work at the cast row it names.
//
// IT RUNS HERE BECAUSE THIS IS WHERE THE TWO TABLES ALREADY MEET. `speaker_cast_id`
// has existed on the two WORK-BOUND quote tables since characters got records —
// `annotations` and `dialogues`, and not `utterances`, which has no work and so no
// cast to point into — and nothing ever wrote one, so the app had been re-deriving
// "which cast row is this line's speaker" by folding a text column, in three
// places, on every read that needed it, and could not answer the reverse question
// at all. The write path now sets
// the link as it sets the name (store.SyncQuoteCast); this is the same act over a
// work's whole history, on the read that was already reconciling it.
//
// SEPARATE TRANSACTION FROM THE ADOPTION ABOVE, and after it: the rows have to
// exist before a quote can point at one, and a failure to link must not roll back
// an adoption that succeeded. Best-effort in the same direction as everything else
// in this file — a missing link costs a join, and the fold that predates it still
// answers every question it answered before.
func (s *Server) linkQuotes(uid int64, kind string, workID int64) {
	tx, err := s.Store.DB.Begin()
	if err != nil {
		olog.Warnf(olog.CodeCastRowScan, "[cast] link quotes begin for %s %d: %v", kind, workID, err)
		return
	}
	defer tx.Rollback()
	if err := store.LinkWorkQuotesToCast(tx, uid, kind, workID, s.creditSeps(uid)); err != nil {
		olog.Warnf(olog.CodeCastRowScan, "[cast] link quotes for %s %d: %v", kind, workID, err)
		return
	}
	if err := tx.Commit(); err != nil {
		olog.Warnf(olog.CodeCastRowScan, "[cast] link quotes commit for %s %d: %v", kind, workID, err)
	}
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

// castKeyHolder is what a work's list already has under one folded character
// key: a row anybody can see, a tombstone, or both.
//
// THE TWO ARE SEPARATE BECAUSE THE ANSWER IS. A live row means the character is
// on the list and there is nothing to adopt. A tombstone ALONE means the reader
// deleted this character and has since typed the same name onto one of this
// work's own lines — which is not the same question, and the header above says
// what is done about it.
type castKeyHolder struct {
	live      bool
	tombstone int64 // the deleted row's id, 0 when none
}

// castKeysOnWork returns every folded character key already on a work's list,
// TOMBSTONES INCLUDED — see the header for why the deleted ones have to be in
// here.
func (s *Server) castKeysOnWork(uid int64, kind string, workID int64) (map[string]castKeyHolder, error) {
	rows, err := s.Store.DB.Query(
		`SELECT id, character_key, origin FROM work_cast WHERE user_id = ? AND kind = ? AND work_id = ?`,
		uid, kind, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]castKeyHolder{}
	for rows.Next() {
		var id int64
		var k, origin string
		if err := rows.Scan(&id, &k, &origin); err != nil {
			return nil, err
		}
		h := out[k]
		if origin == castRemoved {
			// The LOWEST id, so two deletions of one name settle on the row the
			// reader made first — the same tie-break LinkCastRow uses on characters,
			// and for the same reason: whichever ran last is not a decision anybody
			// made.
			if h.tombstone == 0 || id < h.tombstone {
				h.tombstone = id
			}
		} else {
			h.live = true
		}
		out[k] = h
	}
	return out, rows.Err()
}
