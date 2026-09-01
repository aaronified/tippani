package store

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"tippani/internal/metadata"
)

// Identity: the reads and writes that treat a person or a character as a RECORD
// rather than as a name.
//
// 0056 gave both tables an id, aliases, a sort name and a note, and gave the
// credits and the cast somewhere to point. This file is what the panels ask.
// credits.go stays what it is — the one owner of a credit WRITE and of the column
// derived from it — and nothing here writes a credit column directly; where a
// change re-points a link, RecomposeCredit is called for the works affected.
//
// WHY PEOPLE AND CHARACTERS ARE WRITTEN OUT TWICE HERE, as they are in credits.go.
// Two tables, two id spaces, two column sets, and the only genuinely common part
// is the shape of the SQL. 0056's header took that cost openly and this is where
// it is paid; keeping the two literally parallel is what makes a divergence show
// up in a diff, which sharing them through an interface would hide behind a
// parameter.

// ---- aliases --------------------------------------------------------------

// AddPersonAlias files another spelling under a person.
//
// THE KEY IS CastKey, NOT lower(). SQLite's lower() is ASCII-only, so "МИХАИЛ"
// and "михаил" are two different keys to it — which is the whole reason 0048
// folded in Go, and the reason person_alias stores the folded key rather than
// computing it in a query.
//
// AN ALIAS A RECORD ALREADY HOLDS AS ITS NAME IS REFUSED. The alias table is how
// a credit string FINDS a record; letting one point away from a person actually
// called that would make ResolvePerson's "name first, then alias" rule decide
// something the reader thought they had settled. Callers get an error they can
// show rather than a silent no-op.
func AddPersonAlias(tx *sql.Tx, uid, personID int64, alias string) error {
	alias = strings.TrimSpace(alias)
	if alias == "" {
		return refuse("alias: empty")
	}
	key := CastKey(alias)
	var ownerName string
	err := tx.QueryRow(`SELECT name FROM people WHERE user_id = ? AND id = ?`, uid, personID).Scan(&ownerName)
	if err == sql.ErrNoRows {
		return refuse("alias: no such person")
	}
	if err != nil {
		return err
	}
	// The record's own name is not an alias of itself, and saying so is friendlier
	// than a UNIQUE violation from three statements away.
	if CastKey(ownerName) == key {
		return refuse("alias: that is already their name")
	}
	if holder, err := personNameHolder(tx, uid, key); err != nil {
		return err
	} else if holder != 0 && holder != personID {
		return refuse("alias: somebody is already called that")
	}
	_, err = tx.Exec(
		`INSERT INTO person_alias (user_id, alias_key, alias, person_id) VALUES (?, ?, ?, ?)
		 ON CONFLICT (user_id, alias_key) DO UPDATE SET alias = excluded.alias, person_id = excluded.person_id`,
		uid, key, alias, personID)
	return err
}

// personNameHolder returns the id of the person whose CANONICAL name folds to this
// key, or 0. Lowest id, the same tie-break ResolvePerson uses.
//
// IT SCANS, AND IT HAS TO. CastKey folds in Go because SQLite's lower() is
// ASCII-only (0048's argument), and `people` stores no folded column — so there is
// no index that can answer "who is called this, case-folded". The cost is bounded
// by the thing it is bounded by: this runs when a reader files an alias by hand,
// against a table with as many rows as the library has credited names.
func personNameHolder(tx *sql.Tx, uid int64, key string) (int64, error) {
	rows, err := tx.Query(`SELECT id, name FROM people WHERE user_id = ? ORDER BY id`, uid)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return 0, err
		}
		if CastKey(name) == key {
			return id, nil
		}
	}
	return 0, rows.Err()
}

// RemovePersonAlias drops one spelling. Scoped by person as well as by account so
// a stale id in a client cannot unfile somebody else's alias.
func RemovePersonAlias(tx *sql.Tx, uid, personID int64, alias string) error {
	_, err := tx.Exec(
		`DELETE FROM person_alias WHERE user_id = ? AND person_id = ? AND alias_key = ?`,
		uid, personID, CastKey(alias))
	return err
}

// AddCharacterAlias is AddPersonAlias for the other table. See the header.
func AddCharacterAlias(tx *sql.Tx, uid, characterID int64, alias string) error {
	alias = strings.TrimSpace(alias)
	if alias == "" {
		return refuse("alias: empty")
	}
	key := CastKey(alias)
	var ownerName string
	err := tx.QueryRow(`SELECT name FROM characters WHERE user_id = ? AND id = ?`, uid, characterID).Scan(&ownerName)
	if err == sql.ErrNoRows {
		return refuse("alias: no such character")
	}
	if err != nil {
		return err
	}
	if CastKey(ownerName) == key {
		return refuse("alias: that is already their name")
	}
	if holder, err := characterNameHolder(tx, uid, key); err != nil {
		return err
	} else if holder != 0 && holder != characterID {
		return refuse("alias: a character is already called that")
	}
	_, err = tx.Exec(
		`INSERT INTO character_alias (user_id, alias_key, alias, character_id) VALUES (?, ?, ?, ?)
		 ON CONFLICT (user_id, alias_key) DO UPDATE SET alias = excluded.alias, character_id = excluded.character_id`,
		uid, key, alias, characterID)
	return err
}

func characterNameHolder(tx *sql.Tx, uid int64, key string) (int64, error) {
	rows, err := tx.Query(`SELECT id, name FROM characters WHERE user_id = ? ORDER BY id`, uid)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return 0, err
		}
		if CastKey(name) == key {
			return id, nil
		}
	}
	return 0, rows.Err()
}

// RemoveCharacterAlias drops one spelling from a character.
func RemoveCharacterAlias(tx *sql.Tx, uid, characterID int64, alias string) error {
	_, err := tx.Exec(
		`DELETE FROM character_alias WHERE user_id = ? AND character_id = ? AND alias_key = ?`,
		uid, characterID, CastKey(alias))
	return err
}

// PersonAliases lists a record's other spellings, alphabetically.
//
// NOT "IN THE ORDER THEY WERE ADDED", which is what a list of chips would ideally
// show and what this asked for first: 0056 declared both alias tables WITHOUT
// ROWID, so there is no insertion order to sort by. Alphabetical is the honest
// second choice — stable, and it makes a long list findable, which insertion order
// does not.
func PersonAliases(db Queryer, uid, personID int64) ([]string, error) {
	return aliasList(db, `SELECT alias FROM person_alias WHERE user_id = ? AND person_id = ? ORDER BY alias_key`, uid, personID)
}

// CharacterAliases is PersonAliases for the other table.
func CharacterAliases(db Queryer, uid, characterID int64) ([]string, error) {
	return aliasList(db, `SELECT alias FROM character_alias WHERE user_id = ? AND character_id = ? ORDER BY alias_key`, uid, characterID)
}

// Queryer is the half of *sql.DB and *sql.Tx these reads need, so a handler can
// call them inside its transaction or outside one without two copies.
type Queryer interface {
	Query(string, ...any) (*sql.Rows, error)
	QueryRow(string, ...any) *sql.Row
}

func aliasList(db Queryer, q string, args ...any) ([]string, error) {
	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var a string
		if err := rows.Scan(&a); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// ---- what a record is in ---------------------------------------------------

// CreditOf is one work a person is credited on, in the shape a panel draws.
type CreditOf struct {
	Kind     string `json:"kind"` // book | movie
	WorkID   int64  `json:"work_id"`
	Title    string `json:"title"`
	Role     string `json:"role"`
	CreditAs string `json:"credit_as,omitempty"` // the spelling THIS work prints
	Cover    string `json:"cover,omitempty"`
}

// PersonCredits lists every work crediting a person, both kinds, ordered by role
// then title so a panel can group without a second query.
//
// TWO SELECTS AND A UNION rather than one join: books and movies are two tables
// with two cover columns, and a UNION is where that stops being the caller's
// problem. The kind literal is what tells them apart afterwards.
func PersonCredits(db Queryer, uid, personID int64) ([]CreditOf, error) {
	rows, err := db.Query(`
		SELECT 'book', b.id, b.title, wp.role, wp.credit_as, COALESCE(b.cover_path, '')
		  FROM work_person wp JOIN books b ON b.id = wp.work_id
		 WHERE wp.user_id = ? AND wp.kind = 'book' AND wp.person_id = ?
		UNION ALL
		SELECT 'movie', m.id, m.title, wp.role, wp.credit_as, COALESCE(m.poster_path, '')
		  FROM work_person wp JOIN movies m ON m.id = wp.work_id
		 WHERE wp.user_id = ? AND wp.kind = 'movie' AND wp.person_id = ?
		 ORDER BY 4, 3`, uid, personID, uid, personID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CreditOf{}
	for rows.Next() {
		var c CreditOf
		if err := rows.Scan(&c.Kind, &c.WorkID, &c.Title, &c.Role, &c.CreditAs, &c.Cover); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// CastOf is one work-level cast row: a character in a work, and who played them.
type CastOf struct {
	CastID int64 `json:"cast_id"`
	// Kind is 'book' or 'movie'. A BOOK HAS A CAST TOO — 0048 keyed this table on
	// (kind, work_id) rather than on a movie, because a novel's characters are the
	// same kind of fact as a film's and a quote's speaker has to point at one
	// either way. A query here that joined `movies` alone would answer "which works
	// is this character in" by silently leaving out every book.
	Kind        string `json:"kind"`
	WorkID      int64  `json:"work_id"`
	WorkTitle   string `json:"work_title"`
	CharacterID int64  `json:"character_id,omitempty"`
	Character   string `json:"character"`
	ActorID     int64  `json:"actor_id,omitempty"`
	Actor       string `json:"actor,omitempty"`
	// Image is THIS work's picture of the character, empty when the work has none
	// and the global record's is what should be drawn instead. The fallback is the
	// caller's to apply, deliberately: a panel that shows the global picture where
	// the work has none must be able to SAY so, and a value already substituted
	// here cannot be told apart from one the work actually holds.
	Image string `json:"image,omitempty"`
	// Cover is the WORK's own picture — a book's cover, a film's poster. It is here
	// because a list of appearances that prints only titles is a list a reader has
	// to read; the shelf they know is a shelf of spines, and the row they are
	// looking for is recognised before it is read.
	Cover string `json:"cover,omitempty"`
	// MediaType tells a film from a show from a game on the movie side, so a row
	// can be labelled with the right noun. Books leave it empty: the Kind already
	// says everything there is to say about one.
	MediaType string `json:"media_type,omitempty"`
}

// castWhere is the shared tail of the two cast reads: both halves of the union,
// with one predicate spliced in. The predicate is a constant from this file and
// never input — the ids it compares against are bound.
//
// work_cast CARRIES ITS OWN user_id (0048), so this scopes on the row rather than
// through a parent. That is not only tidier: it is what lets the union cover books
// and movies with the same predicate on both sides.
// A TOMBSTONE IS NOT AN APPEARANCE. 0048 keeps a deleted pair as a row so that a
// provider refetch cannot bring it back, which means `origin = 'removed'` is the
// table's word for "this is not on the list any more". Reading it as one was the
// bug under "I removed this work and it is still there": both directions of this
// query answered from the tombstone, so untagging a character from a work changed
// nothing a reader could see. handlePeopleRecords already excluded them on its
// side of the same table; these two did not, and the two halves of one screen
// disagreed about how many works a record was in.
func castWhere(pred string) string {
	return `
		SELECT wc.id, 'book', b.id, b.title, wc.character_id, wc.character,
		       COALESCE(wc.actor_id, 0), COALESCE(p.name, wc.actor), COALESCE(wc.character_image_path, ''),
		       COALESCE(b.cover_path, ''), ''
		  FROM work_cast wc
		  JOIN books b ON b.id = wc.work_id
		  LEFT JOIN people p ON p.id = wc.actor_id
		 WHERE wc.user_id = ? AND wc.kind = 'book' AND wc.origin <> 'removed' AND ` + pred + `
		UNION ALL
		SELECT wc.id, 'movie', m.id, m.title, wc.character_id, wc.character,
		       COALESCE(wc.actor_id, 0), COALESCE(p.name, wc.actor), COALESCE(wc.character_image_path, ''),
		       COALESCE(m.poster_path, ''), COALESCE(m.media_type, 'movie')
		  FROM work_cast wc
		  JOIN movies m ON m.id = wc.work_id
		  LEFT JOIN people p ON p.id = wc.actor_id
		 WHERE wc.user_id = ? AND wc.kind = 'movie' AND wc.origin <> 'removed' AND ` + pred + `
		 ORDER BY 4`
}

// CharacterAppearances lists every work a character appears in, with the performer
// linked on each. This is the character page's own list.
func CharacterAppearances(db Queryer, uid, characterID int64) ([]CastOf, error) {
	return castRows(db, castWhere(`wc.character_id = ?`), uid, characterID, uid, characterID)
}

// PersonRoles lists every character a person has been linked to as the performer,
// with the work each pairing belongs to.
//
// THE OTHER DIRECTION OF THE SAME TABLE, and it is a separate function rather than
// a flag because the two answer different questions: this one is "who has this
// actor played", and the reader is looking at a person.
func PersonRoles(db Queryer, uid, personID int64) ([]CastOf, error) {
	return castRows(db, castWhere(`wc.actor_id = ?`), uid, personID, uid, personID)
}

func castRows(db Queryer, q string, args ...any) ([]CastOf, error) {
	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CastOf{}
	for rows.Next() {
		var c CastOf
		var charID, actorID sql.NullInt64
		if err := rows.Scan(&c.CastID, &c.Kind, &c.WorkID, &c.WorkTitle, &charID, &c.Character,
			&actorID, &c.Actor, &c.Image, &c.Cover, &c.MediaType); err != nil {
			return nil, err
		}
		c.CharacterID, c.ActorID = charID.Int64, actorID.Int64
		out = append(out, c)
	}
	return out, rows.Err()
}

// ---- how a name prints on ONE work ------------------------------------------

// SetCreditAs changes the spelling a single work prints for one person, and
// re-derives that work's cached column.
//
// THIS IS THE PANEL'S FIRST SCOPE, and the narrowest write in the whole identity
// model: "on this work only". The design pack is emphatic about why the sentence
// under the field matters — without it a reader will believe they have just
// renamed the author on thirty-one other books — and this function is what makes
// the sentence true. Changing the RECORD's name is a different call in a different
// section, and it propagates.
//
// AN EMPTY STRING IS THE CLEAR, meaning "print the person's own name", which is
// what credit_as has meant since 0056. It is not a missing value.
//
// THE LINK IS ADDRESSED BY ITS NATURAL KEY, because work_person is WITHOUT ROWID
// and has no surrogate id: (kind, work_id, role) plus the person is what one
// credit IS. Where somebody is credited twice on one work in one role — which the
// ordering column allows and a reissue occasionally produces — both rows take the
// spelling, because the reader picked a person on a work and meant all of them.
func SetCreditAs(tx *sql.Tx, uid int64, kind string, workID int64, role CreditRole, personID int64, creditAs string, seps metadata.CreditSeps) error {
	creditAs = strings.TrimSpace(creditAs)
	// A credit_as identical to the record's own name is stored as empty, so the row
	// does not claim a deliberate re-crediting that says nothing. Same rule
	// SetCredits applies when it writes the link in the first place; stating it in
	// both places is cheaper than one of them drifting.
	var canonical string
	switch err := tx.QueryRow(`SELECT name FROM people WHERE user_id = ? AND id = ?`, uid, personID).Scan(&canonical); {
	case err == sql.ErrNoRows:
		return fmt.Errorf("credit: no such person")
	case err != nil:
		return err
	}
	if creditAs == canonical {
		creditAs = ""
	}
	res, err := tx.Exec(
		`UPDATE work_person SET credit_as = ?
		  WHERE user_id = ? AND kind = ? AND work_id = ? AND role = ? AND person_id = ?`,
		creditAs, uid, kind, workID, string(role), personID)
	if err != nil {
		return fmt.Errorf("set credit_as: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("credit: not found on this work")
	}
	return RecomposeCredit(tx, uid, kind, workID, role, seps)
}

// AliasWas is one spelling as it stood before a merge overwrote it: who held it
// and how it was written.
type AliasWas struct {
	PersonID int64  `json:"person_id"`
	Alias    string `json:"alias"`
}

// Refusal is a store answer the reader caused and can act on — "nobody is spelled
// that way", "somebody is already called that" — as distinct from a FAULT, where
// the database failed and no message helps them.
//
// WHY THE DISTINCTION IS A TYPE AND NOT A CONVENTION. The handlers over these
// functions turned every error into a 409 carrying err.Error(), which reports a
// broken database as a disagreement about identity and puts the SQL in a toast.
// The two need different status codes and different bodies, so the store has to
// say which kind it is returning rather than leave the handler guessing.
type Refusal struct{ msg string }

func (e *Refusal) Error() string { return e.msg }

func refuse(format string, a ...any) error { return &Refusal{fmt.Sprintf(format, a...)} }

// ---- linking a performer to a role -----------------------------------------

// LinkCastActor points one cast row at a person, or clears it when personID is 0.
//
// NEVER AUTOMATIC, which is 0056's rule for characters and is the same rule here
// for the other half of the pairing: the reader picks the performer, because a
// cast row's `actor` string arrived from a provider or from a form and matching it
// to a record by name is the welding this whole model exists to avoid.
func LinkCastActor(tx *sql.Tx, uid, castID, personID int64) error {
	var owns int
	if err := tx.QueryRow(
		`SELECT count(*) FROM work_cast WHERE id = ? AND user_id = ?`, castID, uid).Scan(&owns); err != nil {
		return err
	}
	if owns == 0 {
		return fmt.Errorf("cast row not found")
	}
	if personID == 0 {
		_, err := tx.Exec(`UPDATE work_cast SET actor_id = NULL WHERE id = ?`, castID)
		return err
	}
	var exists int
	if err := tx.QueryRow(`SELECT count(*) FROM people WHERE user_id = ? AND id = ?`, uid, personID).Scan(&exists); err != nil {
		return err
	}
	if exists == 0 {
		return fmt.Errorf("person not found")
	}
	_, err := tx.Exec(`UPDATE work_cast SET actor_id = ? WHERE id = ?`, personID, castID)
	return err
}

// LinkCastCharacter points one cast row at a character record, or clears it.
func LinkCastCharacter(tx *sql.Tx, uid, castID, characterID int64) error {
	var owns int
	if err := tx.QueryRow(
		`SELECT count(*) FROM work_cast WHERE id = ? AND user_id = ?`, castID, uid).Scan(&owns); err != nil {
		return err
	}
	if owns == 0 {
		return fmt.Errorf("cast row not found")
	}
	if characterID == 0 {
		_, err := tx.Exec(`UPDATE work_cast SET character_id = NULL WHERE id = ?`, castID)
		return err
	}
	var exists int
	if err := tx.QueryRow(`SELECT count(*) FROM characters WHERE user_id = ? AND id = ?`, uid, characterID).Scan(&exists); err != nil {
		return err
	}
	if exists == 0 {
		return fmt.Errorf("character not found")
	}
	_, err := tx.Exec(`UPDATE work_cast SET character_id = ? WHERE id = ?`, characterID, castID)
	return err
}

// LinkCastRow gives a cast row the two records it should have had from birth, and
// is the live twin of the 3.1.0 backfill: every path that writes a work_cast row
// calls it, or the identity model is something only the upgrade ever populates
// and the character list stays empty for everything typed after it.
//
// IT FILLS A NULL LINK AND NEVER RE-POINTS ONE. A link already on the row was put
// there by a reader in the picker, or carried across a delete and back — both
// deliberate. Correcting the name printed on the row is a change to what THIS
// work prints, which is exactly what work_cast.character is for, so it leaves the
// record alone.
//
// THE CHARACTER IS PER WORK, NOT PER LIBRARY. The backfill's argument, restated at
// the site where it now matters most: resolving by name would weld every
// "Narrator", "Mother" and "The Doctor" into one record spanning forty unrelated
// works and no screen would say so. A fortieth Narrator is visible and mergeable;
// the welded one hides thirty-nine people. Within ONE work the folded name does
// collapse, so a child and an adult casting of one character share a record and
// differ by actor_id — which is what actor_id being per row is for.
//
// THE ACTOR IS RESOLVED BY NAME, and the asymmetry is 0027's inheritance rather
// than an inconsistency: `people` has been the library's one row per human being
// since long before this, every credit already resolves into it by name, and an
// actor typed onto a cast row is the same act as an author typed onto a book.
func LinkCastRow(tx *sql.Tx, uid, castID int64) error {
	var kind string
	var workID int64
	var character, charKey, actor string
	var cid, aid sql.NullInt64
	err := tx.QueryRow(
		`SELECT kind, work_id, COALESCE(character, ''), COALESCE(character_key, ''),
		        COALESCE(actor, ''), character_id, actor_id
		   FROM work_cast WHERE id = ? AND user_id = ?`, castID, uid).
		Scan(&kind, &workID, &character, &charKey, &actor, &cid, &aid)
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("cast row not found")
	}
	if err != nil {
		return fmt.Errorf("read cast row: %w", err)
	}

	if !cid.Valid && character != "" {
		if charKey == "" {
			charKey = CastKey(character)
		}
		// Its own work first. LIMIT 1 over the lowest id so two rows racing to name
		// one character settle on the same record rather than on whichever ran last.
		var id int64
		err := tx.QueryRow(
			`SELECT character_id FROM work_cast
			  WHERE user_id = ? AND kind = ? AND work_id = ? AND character_key = ?
			    AND character_id IS NOT NULL
			  ORDER BY character_id LIMIT 1`, uid, kind, workID, charKey).Scan(&id)
		switch {
		case errors.Is(err, sql.ErrNoRows):
			res, err := tx.Exec(`INSERT INTO characters (user_id, name) VALUES (?, ?)`, uid, character)
			if err != nil {
				return fmt.Errorf("create character: %w", err)
			}
			if id, err = res.LastInsertId(); err != nil {
				return err
			}
		case err != nil:
			return fmt.Errorf("find character on work: %w", err)
		}
		cid = sql.NullInt64{Int64: id, Valid: true}
	}

	if !aid.Valid && actor != "" {
		id, err := ResolvePerson(tx, uid, actor)
		if err != nil {
			return err
		}
		aid = sql.NullInt64{Int64: id, Valid: true}
	}

	if !cid.Valid && !aid.Valid {
		return nil
	}
	if _, err := tx.Exec(
		`UPDATE work_cast SET character_id = ?, actor_id = ? WHERE id = ? AND user_id = ?`,
		cid, aid, castID, uid); err != nil {
		return fmt.Errorf("link cast row: %w", err)
	}
	return nil
}

// ---- merge ------------------------------------------------------------------

// MergeUndo is everything needed to put a merge back exactly as it was.
//
// IT IS A REVERSAL, NOT A SNAPSHOT. The bin's generic restore re-INSERTS rows,
// and a merge does not delete the rows it changes — it re-points them, so the keys
// are still occupied and an insert would collide. Every field here therefore names
// a row and the value to put back, and undo is a list of targeted updates.
type MergeUndo struct {
	KeepID int64          `json:"keep_id"`
	DropID int64          `json:"drop_id"`
	Person map[string]any `json:"person"` // the whole dropped row, id included
	// Kinds is what the DROPPED record was filed under, and AddedKinds is what that
	// gave the survivor. Undo puts the first back and takes the second away — a
	// merge that made an author into an author-and-a-speaker must not leave the
	// survivor filed as a speaker afterwards.
	Kinds      []string `json:"kinds"`
	AddedKinds []string `json:"added_kinds"`
	// Credits are the link rows that changed hands, by natural key. `CreditAs` is
	// what each held BEFORE, which is not always what it holds after — see the note
	// on printing in MergePeople.
	Credits []MergedCredit `json:"credits"`
	// Collapsed are link rows that were DELETED because the merge made a work
	// credit one person twice in one role. Whole, because undo re-inserts them.
	Collapsed []MergedCredit `json:"collapsed"`
	Cast      []int64        `json:"cast"`
	// Screen and Utterance are the QUOTES that named the dropped record — 0059's
	// dialogues.actor_id and utterances.speaker_id. Collected before the delete
	// rather than after, because the foreign key is ON DELETE SET NULL: the delete
	// at the end of MergePeople would otherwise null them all with nothing raised
	// and nothing recorded, and an undo that never knew about them could not put
	// a single line back.
	Screen    []int64 `json:"screen"`
	Utterance []int64 `json:"utterance"`
	// Aliases moved from the dropped record to the survivor; NameAlias is the one
	// the merge CREATED out of the dropped record's own name, which undo removes
	// rather than re-points.
	Aliases   []string `json:"aliases"`
	NameAlias string   `json:"name_alias"`
	// WHAT THAT KEY HELD BEFORE, when the dropped name was already somebody's
	// spelling. Without it the undo's DELETE takes a third record's alias with it —
	// the merge upserts, so it can steal a key it did not create, and a reversal
	// that only knows how to delete cannot put back what it overwrote.
	NameAliasWas *AliasWas `json:"name_alias_was,omitempty"`
	// Filled is the survivor's own columns as they stood before the merge borrowed
	// values from the dropped record, so undo can put the blanks back.
	Filled map[string]any `json:"filled"`
}

// MergedCredit is one credit link by its natural key.
type MergedCredit struct {
	Kind     string `json:"kind"`
	WorkID   int64  `json:"work_id"`
	Role     string `json:"role"`
	Ordering int    `json:"ordering"`
	CreditAs string `json:"credit_as"`
	PersonID int64  `json:"person_id"`
}

// mergeFillable are the survivor's columns a merge may borrow from the record it
// folds in — only where the survivor's own is empty. Never overwritten: the
// reader picked which record survives, and that pick includes its values.
var mergeFillable = []string{"bio", "image_path", "born", "died", "links", "source", "source_id", "sort_name", "note"}

// MergePeople folds `dropID` into `keepID` and returns how to put it back.
//
// MERGING TWO RECORDS MUST NOT CHANGE WHAT ANY COVER PRINTS. That is the one rule
// that makes this safe to offer at all. A work crediting the dropped record with
// no credit_as was printing the dropped record's NAME; after the merge it points
// at a record with a different name, so the work would silently start printing
// something else — the reader merged two spellings and their shelf rewrote itself.
// So every such row is given the dropped name as its credit_as on the way through.
// The library ends up with one person and the same words on every cover, which is
// exactly the claim the whole identity model makes.
//
// THE DROPPED NAME BECOMES AN ALIAS OF THE SURVIVOR, and that is what stops the
// next import undoing the merge: a credit typed the old way resolves through the
// alias instead of creating the record again.
//
// A WORK MAY END UP CREDITING ONE PERSON TWICE in one role — "X Alpha, X. Alpha"
// merged is one person listed twice — so the duplicate is collapsed to the lowest
// ordering and recorded whole for undo. Recomposing without collapsing would print
// the name twice on the shelf.
func MergePeople(tx *sql.Tx, uid, keepID, dropID int64, seps metadata.CreditSeps) (*MergeUndo, error) {
	if keepID == dropID {
		return nil, refuse("merge: a record cannot be merged into itself")
	}
	keepName, err := personName(tx, uid, keepID)
	if err != nil {
		return nil, err
	}
	dropName, err := personName(tx, uid, dropID)
	if err != nil {
		return nil, err
	}
	undo := &MergeUndo{KeepID: keepID, DropID: dropID, Filled: map[string]any{}}

	if undo.Person, err = rowAsMap(tx, "people", uid, dropID); err != nil {
		return nil, err
	}

	// ---- the credits ---------------------------------------------------------
	rows, err := tx.Query(
		`SELECT kind, work_id, role, ordering, credit_as FROM work_person
		  WHERE user_id = ? AND person_id = ? ORDER BY kind, work_id, role, ordering`, uid, dropID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var c MergedCredit
		if err := rows.Scan(&c.Kind, &c.WorkID, &c.Role, &c.Ordering, &c.CreditAs); err != nil {
			rows.Close()
			return nil, err
		}
		c.PersonID = dropID
		undo.Credits = append(undo.Credits, c)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}

	for _, c := range undo.Credits {
		as := c.CreditAs
		// The rule above: a row that was printing the dropped name keeps printing it.
		if as == "" && dropName != keepName {
			as = dropName
		}
		if _, err := tx.Exec(
			`UPDATE work_person SET person_id = ?, credit_as = ?
			  WHERE user_id = ? AND kind = ? AND work_id = ? AND role = ? AND ordering = ?`,
			keepID, as, uid, c.Kind, c.WorkID, c.Role, c.Ordering); err != nil {
			return nil, fmt.Errorf("merge credits: %w", err)
		}
	}

	// ---- collapse a work that now credits one person twice in one role -------
	for _, c := range undo.Credits {
		dupes, err := tx.Query(
			`SELECT ordering, credit_as FROM work_person
			  WHERE user_id = ? AND kind = ? AND work_id = ? AND role = ? AND person_id = ?
			  ORDER BY ordering`, uid, c.Kind, c.WorkID, c.Role, keepID)
		if err != nil {
			return nil, err
		}
		var seen []MergedCredit
		for dupes.Next() {
			var d MergedCredit
			if err := dupes.Scan(&d.Ordering, &d.CreditAs); err != nil {
				dupes.Close()
				return nil, err
			}
			d.Kind, d.WorkID, d.Role, d.PersonID = c.Kind, c.WorkID, c.Role, keepID
			seen = append(seen, d)
		}
		err = dupes.Err()
		dupes.Close()
		if err != nil {
			return nil, err
		}
		// The first survives; the rest go, recorded whole.
		for i, d := range seen {
			if i == 0 || alreadyCollapsed(undo.Collapsed, d) {
				continue
			}
			if _, err := tx.Exec(
				`DELETE FROM work_person WHERE user_id = ? AND kind = ? AND work_id = ? AND role = ? AND ordering = ?`,
				uid, d.Kind, d.WorkID, d.Role, d.Ordering); err != nil {
				return nil, fmt.Errorf("merge collapse: %w", err)
			}
			undo.Collapsed = append(undo.Collapsed, d)
		}
	}

	// ---- the cast ------------------------------------------------------------
	crows, err := tx.Query(`SELECT id FROM work_cast WHERE user_id = ? AND actor_id = ?`, uid, dropID)
	if err != nil {
		return nil, err
	}
	for crows.Next() {
		var id int64
		if err := crows.Scan(&id); err != nil {
			crows.Close()
			return nil, err
		}
		undo.Cast = append(undo.Cast, id)
	}
	err = crows.Err()
	crows.Close()
	if err != nil {
		return nil, err
	}
	for _, id := range undo.Cast {
		if _, err := tx.Exec(`UPDATE work_cast SET actor_id = ? WHERE id = ?`, keepID, id); err != nil {
			return nil, fmt.Errorf("merge cast: %w", err)
		}
	}

	// ---- the quotes ----------------------------------------------------------
	//
	// The same three steps the cast gets — collect, re-point, record — and for the
	// stronger reason: work_cast.actor_id is SET NULL too, but a cast row without a
	// performer is still a cast row, whereas a quote that stops pointing at anybody
	// vanishes from the person panel that is the merge's whole purpose.
	//
	// THE PRINTED NAME IS NOT TOUCHED, which is deliberate and is the faithful
	// spelling promise 0059 states: a line credited to "Bob Peck" goes on saying
	// so after Bob Peck is merged into Robert Peck. The alias the merge records
	// out of the dropped record's own name is what keeps the link stable
	// afterwards — see personAnswersTo in quote_person.go, which is the function
	// that would otherwise re-resolve that spelling into a fresh record on the
	// next edit and undo this one quote at a time.
	if undo.Screen, err = idsPointingAtPerson(tx, uid, KindScreen, dropID); err != nil {
		return nil, err
	}
	if undo.Utterance, err = idsPointingAtPerson(tx, uid, KindUtterance, dropID); err != nil {
		return nil, err
	}
	for _, id := range undo.Screen {
		if _, err := tx.Exec(`UPDATE dialogues SET actor_id = ? WHERE id = ?`, keepID, id); err != nil {
			return nil, fmt.Errorf("merge screen quotes: %w", err)
		}
	}
	for _, id := range undo.Utterance {
		if _, err := tx.Exec(`UPDATE utterances SET speaker_id = ? WHERE id = ? AND user_id = ?`, keepID, id, uid); err != nil {
			return nil, fmt.Errorf("merge quotes: %w", err)
		}
	}

	// ---- roles ---------------------------------------------------------------
	if undo.Kinds, err = personKindList(tx, dropID); err != nil {
		return nil, err
	}
	had, err := personKindList(tx, keepID)
	if err != nil {
		return nil, err
	}
	hadSet := map[string]bool{}
	for _, k := range had {
		hadSet[k] = true
	}
	for _, k := range undo.Kinds {
		if hadSet[k] {
			continue
		}
		undo.AddedKinds = append(undo.AddedKinds, k)
		if _, err := tx.Exec(`INSERT OR IGNORE INTO person_kinds (person_id, kind) VALUES (?, ?)`, keepID, k); err != nil {
			return nil, fmt.Errorf("merge roles: %w", err)
		}
	}

	// ---- aliases -------------------------------------------------------------
	//
	// THE KEY'S OWNER IS READ BEFORE ANY ALIAS MOVES, and the order is load-bearing.
	// If the dropped record already held an alias equal to its OWN name — reachable
	// by renaming a record onto one of its own spellings — then the loop below moves
	// that row to the survivor, and a read taken afterwards would record the SURVIVOR
	// as what the key held before. Undo would then re-park the spelling on the
	// survivor it had just taken it off, leaving the reader with a restored record
	// that its own name no longer finds.
	nameKey := CastKey(dropName)
	var nameAliasWas *AliasWas
	if dropName != "" && CastKey(keepName) != nameKey {
		var was AliasWas
		switch err := tx.QueryRow(
			`SELECT person_id, alias FROM person_alias WHERE user_id = ? AND alias_key = ?`, uid, nameKey).
			Scan(&was.PersonID, &was.Alias); {
		case err == nil:
			nameAliasWas = &was
		case errors.Is(err, sql.ErrNoRows):
		default:
			return nil, fmt.Errorf("merge name alias: read: %w", err)
		}
	}
	arows, err := tx.Query(`SELECT alias_key FROM person_alias WHERE user_id = ? AND person_id = ?`, uid, dropID)
	if err != nil {
		return nil, err
	}
	for arows.Next() {
		var k string
		if err := arows.Scan(&k); err != nil {
			arows.Close()
			return nil, err
		}
		undo.Aliases = append(undo.Aliases, k)
	}
	err = arows.Err()
	arows.Close()
	if err != nil {
		return nil, err
	}
	for _, k := range undo.Aliases {
		if _, err := tx.Exec(
			`UPDATE person_alias SET person_id = ? WHERE user_id = ? AND alias_key = ?`, keepID, uid, k); err != nil {
			return nil, fmt.Errorf("merge aliases: %w", err)
		}
	}
	// The dropped name itself, so the next import resolves rather than re-creating.
	// The upsert can take a spelling a THIRD record already holds, which is why the
	// reversal carries what the key held — read above, before the loop moved any.
	if dropName != "" && CastKey(keepName) != nameKey {
		undo.NameAliasWas = nameAliasWas
		if _, err := tx.Exec(
			`INSERT INTO person_alias (user_id, alias_key, alias, person_id) VALUES (?, ?, ?, ?)
			 ON CONFLICT (user_id, alias_key) DO UPDATE SET alias = excluded.alias, person_id = excluded.person_id`,
			uid, nameKey, dropName, keepID); err != nil {
			return nil, fmt.Errorf("merge name alias: %w", err)
		}
		undo.NameAlias = nameKey
	}

	// ---- the survivor's blanks ----------------------------------------------
	for _, col := range mergeFillable {
		var mine, theirs string
		// The column names come from mergeFillable, never from input.
		if err := tx.QueryRow(
			`SELECT COALESCE((SELECT `+col+` FROM people WHERE id = ?), ''),
			        COALESCE((SELECT `+col+` FROM people WHERE id = ?), '')`, keepID, dropID).
			Scan(&mine, &theirs); err != nil {
			return nil, err
		}
		if mine != "" || theirs == "" {
			continue
		}
		undo.Filled[col] = mine
		if _, err := tx.Exec(`UPDATE people SET `+col+` = ? WHERE id = ? AND user_id = ?`, theirs, keepID, uid); err != nil {
			return nil, fmt.Errorf("merge fill %s: %w", col, err)
		}
	}

	if _, err := tx.Exec(`DELETE FROM people WHERE id = ? AND user_id = ?`, dropID, uid); err != nil {
		return nil, fmt.Errorf("merge delete: %w", err)
	}
	return undo, recomposeCredits(tx, uid, undo.Credits, seps)
}

// UndoPersonMerge puts a merge back, from the reversal MergePeople returned.
//
// UPDATES BY KEY, NOT AN INSERT OF A SNAPSHOT. Nothing here re-inserts a row whose
// key is still occupied, which is exactly why the bin's generic restore cannot do
// this and this function exists.
func UndoPersonMerge(tx *sql.Tx, uid int64, u *MergeUndo, seps metadata.CreditSeps) error {
	if err := insertRow(tx, "people", u.Person); err != nil {
		return fmt.Errorf("undo merge: person: %w", err)
	}
	for _, c := range u.Collapsed {
		if _, err := tx.Exec(
			`INSERT INTO work_person (user_id, kind, work_id, person_id, role, credit_as, ordering)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			uid, c.Kind, c.WorkID, c.PersonID, c.Role, c.CreditAs, c.Ordering); err != nil {
			return fmt.Errorf("undo merge: collapsed: %w", err)
		}
	}
	for _, c := range u.Credits {
		if _, err := tx.Exec(
			`UPDATE work_person SET person_id = ?, credit_as = ?
			  WHERE user_id = ? AND kind = ? AND work_id = ? AND role = ? AND ordering = ?`,
			u.DropID, c.CreditAs, uid, c.Kind, c.WorkID, c.Role, c.Ordering); err != nil {
			return fmt.Errorf("undo merge: credits: %w", err)
		}
	}
	for _, id := range u.Cast {
		if _, err := tx.Exec(`UPDATE work_cast SET actor_id = ? WHERE id = ? AND user_id = ?`, u.DropID, id, uid); err != nil {
			return fmt.Errorf("undo merge: cast: %w", err)
		}
	}
	for _, id := range u.Screen {
		if _, err := tx.Exec(`UPDATE dialogues SET actor_id = ? WHERE id = ?`, u.DropID, id); err != nil {
			return fmt.Errorf("undo merge: screen quotes: %w", err)
		}
	}
	for _, id := range u.Utterance {
		if _, err := tx.Exec(`UPDATE utterances SET speaker_id = ? WHERE id = ? AND user_id = ?`, u.DropID, id, uid); err != nil {
			return fmt.Errorf("undo merge: quotes: %w", err)
		}
	}
	for _, k := range u.Kinds {
		if _, err := tx.Exec(`INSERT OR IGNORE INTO person_kinds (person_id, kind) VALUES (?, ?)`, u.DropID, k); err != nil {
			return fmt.Errorf("undo merge: roles: %w", err)
		}
	}
	for _, k := range u.AddedKinds {
		if _, err := tx.Exec(`DELETE FROM person_kinds WHERE person_id = ? AND kind = ?`, u.KeepID, k); err != nil {
			return fmt.Errorf("undo merge: added roles: %w", err)
		}
	}
	for _, k := range u.Aliases {
		if _, err := tx.Exec(
			`UPDATE person_alias SET person_id = ? WHERE user_id = ? AND alias_key = ?`, u.DropID, uid, k); err != nil {
			return fmt.Errorf("undo merge: aliases: %w", err)
		}
	}
	if u.NameAlias != "" {
		// PUT BACK WHAT WAS THERE, if anything was. The alias loop above has already
		// run, so a key that was the dropped record's own spelling is pointing at it
		// again by now and this restates the same thing harmlessly; a key that
		// belonged to a THIRD record is only restored here, and deleting it — which
		// is what this did before — would have been the merge quietly destroying an
		// alias it never made.
		if w := u.NameAliasWas; w != nil {
			if _, err := tx.Exec(
				`UPDATE person_alias SET person_id = ?, alias = ? WHERE user_id = ? AND alias_key = ?`,
				w.PersonID, w.Alias, uid, u.NameAlias); err != nil {
				return fmt.Errorf("undo merge: name alias: %w", err)
			}
		} else if _, err := tx.Exec(
			`DELETE FROM person_alias WHERE user_id = ? AND alias_key = ?`, uid, u.NameAlias); err != nil {
			return fmt.Errorf("undo merge: name alias: %w", err)
		}
	}
	for col, was := range u.Filled {
		if !fillableColumn(col) {
			// A payload naming a column this code does not fill is either corrupt or
			// from a future version; skipping is the only safe reading, and it must
			// never reach the UPDATE below, which interpolates the name.
			continue
		}
		if _, err := tx.Exec(`UPDATE people SET `+col+` = ? WHERE id = ? AND user_id = ?`, was, u.KeepID, uid); err != nil {
			return fmt.Errorf("undo merge: fill %s: %w", col, err)
		}
	}
	return recomposeCredits(tx, uid, u.Credits, seps)
}

// ---- merge: the character half ----------------------------------------------
//
// WRITTEN IN PARALLEL WITH THE PERSON HALF ABOVE rather than shared through an
// interface — the call 0056 already made for ResolvePerson/ResolveCharacter, for
// the same reason. Two functions meant to behave alike are auditable side by side
// in a diff; an interface hides the moment one of them stops.
//
// IT IS SHORTER THAN ITS TWIN, AND EVERY DIFFERENCE IS A FACT ABOUT THE SCHEMA
// rather than a shortcut. Read them as a list of things a character does not have:
//
//   - A CHARACTER HAS NO CREDITS. Nothing composes a derived column out of
//     characters; work_cast.character holds the printed name in its own row. So
//     there is no credit_as to carry through, no recompose afterwards, and no
//     cache that can drift from the links.
//   - A WORK MAY LEGITIMATELY BILL ONE CHARACTER TWICE once they are merged.
//     Woland billed once as "Woland" and once as "the professor" is two cast rows
//     and both are true. The person half collapses its duplicate because a work
//     crediting one person twice would print the name twice on the shelf; there
//     is no such printing here, so THERE IS NO COLLAPSE STEP and its absence is
//     deliberate rather than missing.
//   - NO QUOTE POINTS AT A CHARACTER. 0056 added speaker_cast_id and nothing has
//     ever written it; 0059 linked quotes to `people` instead. So there is nothing
//     here answering to MergeUndo's Screen and Utterance.
//
// WHAT IT KEEPS is the rule that makes a merge safe to offer at all: MERGING TWO
// RECORDS MUST NOT CHANGE WHAT ANY WORK PRINTS. work_cast.character is never
// touched, so a film that billed "the professor" goes on billing it. The dropped
// record's own name becomes an alias of the survivor, which is what stops the next
// cast import manufacturing the record again — the same guard, for the same
// reason, as the person half's.

// characterMergeFillable are the survivor's columns a merge may borrow from the
// record it folds in, and only where the survivor's own is empty. Its person twin
// is mergeFillable; the lists differ because the tables do — a character has a
// description and no bio, no born/died, and no provider source.
var characterMergeFillable = []string{"sort_name", "description", "image_path", "image_url", "note"}

// CharacterAliasWas is AliasWas for the other table. See it, and MergeUndo's note
// on why a reversal has to know what a key held before the merge took it.
type CharacterAliasWas struct {
	CharacterID int64  `json:"character_id"`
	Alias       string `json:"alias"`
}

// CharacterMergeUndo is MergeUndo for the other table: the same reversal shape,
// carrying the fields a character has and none of the ones it does not.
type CharacterMergeUndo struct {
	KeepID    int64          `json:"keep_id"`
	DropID    int64          `json:"drop_id"`
	Character map[string]any `json:"character"` // the whole dropped row, id included
	// Cast are the work_cast rows that changed hands, by id. COLLECTED BEFORE THE
	// DELETE, exactly as MergeUndo.Screen is and for the identical reason:
	// work_cast.character_id is ON DELETE SET NULL, so the delete at the end of
	// MergeCharacters would otherwise null every one of them with nothing raised,
	// and an undo that never knew about them could not put a single row back.
	Cast []int64 `json:"cast"`
	// Aliases moved from the dropped record to the survivor; NameAlias is the one
	// the merge CREATED out of the dropped record's own name.
	Aliases      []string           `json:"aliases"`
	NameAlias    string             `json:"name_alias"`
	NameAliasWas *CharacterAliasWas `json:"name_alias_was,omitempty"`
	// Filled is the survivor's own columns as they stood before the merge borrowed
	// values from the dropped record, so undo can put the blanks back.
	Filled map[string]any `json:"filled"`
}

// MergeCharacters folds `dropID` into `keepID` and returns how to put it back.
func MergeCharacters(tx *sql.Tx, uid, keepID, dropID int64) (*CharacterMergeUndo, error) {
	if keepID == dropID {
		return nil, refuse("merge: a record cannot be merged into itself")
	}
	keepName, err := characterName(tx, uid, keepID)
	if err != nil {
		return nil, err
	}
	dropName, err := characterName(tx, uid, dropID)
	if err != nil {
		return nil, err
	}
	undo := &CharacterMergeUndo{KeepID: keepID, DropID: dropID, Filled: map[string]any{}}

	if undo.Character, err = rowAsMap(tx, "characters", uid, dropID); err != nil {
		return nil, err
	}

	// ---- the cast ------------------------------------------------------------
	crows, err := tx.Query(`SELECT id FROM work_cast WHERE user_id = ? AND character_id = ?`, uid, dropID)
	if err != nil {
		return nil, err
	}
	for crows.Next() {
		var id int64
		if err := crows.Scan(&id); err != nil {
			crows.Close()
			return nil, err
		}
		undo.Cast = append(undo.Cast, id)
	}
	err = crows.Err()
	crows.Close()
	if err != nil {
		return nil, err
	}
	for _, id := range undo.Cast {
		if _, err := tx.Exec(`UPDATE work_cast SET character_id = ? WHERE id = ? AND user_id = ?`, keepID, id, uid); err != nil {
			return nil, fmt.Errorf("merge cast: %w", err)
		}
	}

	// ---- aliases -------------------------------------------------------------
	//
	// THE KEY'S OWNER IS READ BEFORE ANY ALIAS MOVES — MergePeople's note, and the
	// same ordering. A dropped record holding an alias equal to its own name would
	// otherwise have that row moved to the survivor first, and undo would re-park the
	// spelling on the survivor rather than giving it back.
	nameKey := CastKey(dropName)
	var nameAliasWas *CharacterAliasWas
	if dropName != "" && CastKey(keepName) != nameKey {
		var was CharacterAliasWas
		switch err := tx.QueryRow(
			`SELECT character_id, alias FROM character_alias WHERE user_id = ? AND alias_key = ?`, uid, nameKey).
			Scan(&was.CharacterID, &was.Alias); {
		case err == nil:
			nameAliasWas = &was
		case errors.Is(err, sql.ErrNoRows):
		default:
			return nil, fmt.Errorf("merge name alias: read: %w", err)
		}
	}
	arows, err := tx.Query(`SELECT alias_key FROM character_alias WHERE user_id = ? AND character_id = ?`, uid, dropID)
	if err != nil {
		return nil, err
	}
	for arows.Next() {
		var k string
		if err := arows.Scan(&k); err != nil {
			arows.Close()
			return nil, err
		}
		undo.Aliases = append(undo.Aliases, k)
	}
	err = arows.Err()
	arows.Close()
	if err != nil {
		return nil, err
	}
	for _, k := range undo.Aliases {
		if _, err := tx.Exec(
			`UPDATE character_alias SET character_id = ? WHERE user_id = ? AND alias_key = ?`, keepID, uid, k); err != nil {
			return nil, fmt.Errorf("merge aliases: %w", err)
		}
	}
	// The dropped name itself, so the next cast import resolves rather than
	// re-creating the record this merge just removed. The upsert can take a spelling
	// a THIRD record already holds, which is why the reversal carries what the key
	// held — read above, before the loop moved any.
	if dropName != "" && CastKey(keepName) != nameKey {
		undo.NameAliasWas = nameAliasWas
		if _, err := tx.Exec(
			`INSERT INTO character_alias (user_id, alias_key, alias, character_id) VALUES (?, ?, ?, ?)
			 ON CONFLICT (user_id, alias_key) DO UPDATE SET alias = excluded.alias, character_id = excluded.character_id`,
			uid, nameKey, dropName, keepID); err != nil {
			return nil, fmt.Errorf("merge name alias: %w", err)
		}
		undo.NameAlias = nameKey
	}

	// ---- the survivor's blanks ----------------------------------------------
	for _, col := range characterMergeFillable {
		var mine, theirs string
		// The column names come from characterMergeFillable, never from input.
		if err := tx.QueryRow(
			`SELECT COALESCE((SELECT `+col+` FROM characters WHERE id = ?), ''),
			        COALESCE((SELECT `+col+` FROM characters WHERE id = ?), '')`, keepID, dropID).
			Scan(&mine, &theirs); err != nil {
			return nil, err
		}
		if mine != "" || theirs == "" {
			continue
		}
		undo.Filled[col] = mine
		if _, err := tx.Exec(`UPDATE characters SET `+col+` = ? WHERE id = ? AND user_id = ?`, theirs, keepID, uid); err != nil {
			return nil, fmt.Errorf("merge fill %s: %w", col, err)
		}
	}

	if _, err := tx.Exec(`DELETE FROM characters WHERE id = ? AND user_id = ?`, dropID, uid); err != nil {
		return nil, fmt.Errorf("merge delete: %w", err)
	}
	return undo, nil
}

// UndoCharacterMerge puts a character merge back, from the reversal
// MergeCharacters returned. Updates by key, never an insert of a snapshot — the
// argument is UndoPersonMerge's and it is the reason both exist.
func UndoCharacterMerge(tx *sql.Tx, uid int64, u *CharacterMergeUndo) error {
	if err := insertRow(tx, "characters", u.Character); err != nil {
		return fmt.Errorf("undo merge: character: %w", err)
	}
	for _, id := range u.Cast {
		if _, err := tx.Exec(`UPDATE work_cast SET character_id = ? WHERE id = ? AND user_id = ?`, u.DropID, id, uid); err != nil {
			return fmt.Errorf("undo merge: cast: %w", err)
		}
	}
	for _, k := range u.Aliases {
		if _, err := tx.Exec(
			`UPDATE character_alias SET character_id = ? WHERE user_id = ? AND alias_key = ?`, u.DropID, uid, k); err != nil {
			return fmt.Errorf("undo merge: aliases: %w", err)
		}
	}
	if u.NameAlias != "" {
		// PUT BACK WHAT WAS THERE, if anything was — UndoPersonMerge's note, word
		// for word: the alias loop above has already run, so a key that was the
		// dropped record's own spelling points at it again by now and this restates
		// it harmlessly; a key that belonged to a THIRD record is only restored
		// here, and deleting it would be the merge quietly destroying an alias it
		// never made.
		if w := u.NameAliasWas; w != nil {
			if _, err := tx.Exec(
				`UPDATE character_alias SET character_id = ?, alias = ? WHERE user_id = ? AND alias_key = ?`,
				w.CharacterID, w.Alias, uid, u.NameAlias); err != nil {
				return fmt.Errorf("undo merge: name alias: %w", err)
			}
		} else if _, err := tx.Exec(
			`DELETE FROM character_alias WHERE user_id = ? AND alias_key = ?`, uid, u.NameAlias); err != nil {
			return fmt.Errorf("undo merge: name alias: %w", err)
		}
	}
	for col, was := range u.Filled {
		if !characterFillableColumn(col) {
			// A payload naming a column this code does not fill is either corrupt or
			// from a future version; skipping is the only safe reading, and it must
			// never reach the UPDATE below, which interpolates the name.
			continue
		}
		if _, err := tx.Exec(`UPDATE characters SET `+col+` = ? WHERE id = ? AND user_id = ?`, was, u.KeepID, uid); err != nil {
			return fmt.Errorf("undo merge: fill %s: %w", col, err)
		}
	}
	return nil
}

// ---- small shared parts ----------------------------------------------------

func fillableColumn(col string) bool {
	for _, c := range mergeFillable {
		if c == col {
			return true
		}
	}
	return false
}

// characterFillableColumn is fillableColumn over the other table's list. Kept as
// its own function rather than one taking the list, so that the two guards read
// as the two lists do: a column added to either is one edit in one place.
func characterFillableColumn(col string) bool {
	for _, c := range characterMergeFillable {
		if c == col {
			return true
		}
	}
	return false
}

func alreadyCollapsed(seen []MergedCredit, d MergedCredit) bool {
	for _, s := range seen {
		if s.Kind == d.Kind && s.WorkID == d.WorkID && s.Role == d.Role && s.Ordering == d.Ordering {
			return true
		}
	}
	return false
}

func personName(tx *sql.Tx, uid, id int64) (string, error) {
	var n string
	switch err := tx.QueryRow(`SELECT name FROM people WHERE user_id = ? AND id = ?`, uid, id).Scan(&n); {
	case err == sql.ErrNoRows:
		return "", fmt.Errorf("merge: no such person")
	case err != nil:
		return "", err
	}
	return n, nil
}

// characterName is personName for the other table.
func characterName(tx *sql.Tx, uid, id int64) (string, error) {
	var n string
	switch err := tx.QueryRow(`SELECT name FROM characters WHERE user_id = ? AND id = ?`, uid, id).Scan(&n); {
	case err == sql.ErrNoRows:
		return "", fmt.Errorf("merge: no such character")
	case err != nil:
		return "", err
	}
	return n, nil
}

func personKindList(tx *sql.Tx, id int64) ([]string, error) {
	rows, err := tx.Query(`SELECT kind FROM person_kinds WHERE person_id = ? ORDER BY kind`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// personRowAsMap reads one people row whole, so undo can put it back with its id.
// Column-driven, so a future migration's new column travels without being named
// here — a hand-listed set is the shape that silently drops a value.
// identityTables are the only two tables rowAsMap and insertRow will name, and
// the guard exists because both interpolate the name into a statement.
//
// THE NAME IS A LITERAL AT EVERY CALL SITE — "people" or "characters", four of
// them — so this can only ever fire on a programming mistake. It is here because
// the alternative reading is the one that goes wrong later: a helper that
// interpolates whatever it is handed is one refactor away from being handed
// something a caller derived, and the check costs a map lookup on a path that
// runs once per merge.
var identityTables = map[string]bool{"people": true, "characters": true}

// rowAsMap reads one whole row of `table` as a map, for a merge's reversal
// payload. Its person and character callers want the same thing over two tables
// with different columns, and SELECT * is what makes the payload survive a column
// being added later without this function learning about it.
//
// Parameterised by table rather than written twice, unlike MergeCharacters beside
// it: the parallel-copy rule exists so that two MEANINGS cannot drift apart, and
// there is no meaning here to drift — this is a row copy, and one copy of a row
// copier is the version that cannot disagree with itself.
func rowAsMap(tx *sql.Tx, table string, uid, id int64) (map[string]any, error) {
	if !identityTables[table] {
		return nil, fmt.Errorf("rowAsMap: %q is not an identity table", table)
	}
	rows, err := tx.Query(`SELECT * FROM `+table+` WHERE user_id = ? AND id = ?`, uid, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	if !rows.Next() {
		return nil, fmt.Errorf("merge: no such row in %s", table)
	}
	vals := make([]any, len(cols))
	ptrs := make([]any, len(cols))
	for i := range vals {
		ptrs[i] = &vals[i]
	}
	if err := rows.Scan(ptrs...); err != nil {
		return nil, err
	}
	out := map[string]any{}
	for i, c := range cols {
		// []byte comes back for TEXT and does not survive a JSON round trip as a
		// string, so it is converted here rather than at every read of the payload.
		if b, ok := vals[i].([]byte); ok {
			out[c] = string(b)
			continue
		}
		out[c] = vals[i]
	}
	return out, rows.Err()
}

// insertRow puts a whole row back into `table`, whatever columns it carries.
//
// THE COLUMN LIST COMES FROM THE TABLE, not from the payload, so a payload naming
// something that is not a column cannot reach the statement — the keys are
// interpolated, and a bin entry is data the app wrote but a restore is a read of
// something that has been sitting on disk.
//
// Parameterised by table for rowAsMap's reason: this is a row writer, and there is
// no meaning in it that two copies could keep honest.
func insertRow(tx *sql.Tx, table string, row map[string]any) error {
	if !identityTables[table] {
		return fmt.Errorf("insertRow: %q is not an identity table", table)
	}
	cols, err := tx.Query(`SELECT name FROM pragma_table_info(?)`, table)
	if err != nil {
		return err
	}
	var names []string
	var marks []string
	var args []any
	var known []string
	for cols.Next() {
		var n string
		if err := cols.Scan(&n); err != nil {
			cols.Close()
			return err
		}
		known = append(known, n)
	}
	err = cols.Err()
	cols.Close()
	if err != nil {
		return err
	}
	for _, n := range known {
		v, ok := row[n]
		if !ok {
			continue
		}
		names = append(names, n)
		marks = append(marks, "?")
		args = append(args, v)
	}
	if len(names) == 0 {
		return fmt.Errorf("undo merge: the payload names no columns of %s", table)
	}
	_, err = tx.Exec(
		`INSERT INTO `+table+` (`+strings.Join(names, ", ")+`) VALUES (`+strings.Join(marks, ", ")+`)`, args...)
	return err
}

// recomposeCredits re-derives the cached column of every work a set of links
// touched, once per (kind, work, role) however many links named it.
func recomposeCredits(tx *sql.Tx, uid int64, cs []MergedCredit, seps metadata.CreditSeps) error {
	seen := map[string]bool{}
	for _, c := range cs {
		key := fmt.Sprintf("%s\x1f%d\x1f%s", c.Kind, c.WorkID, c.Role)
		if seen[key] {
			continue
		}
		seen[key] = true
		if err := RecomposeCredit(tx, uid, c.Kind, c.WorkID, CreditRole(c.Role), seps); err != nil {
			return err
		}
	}
	return nil
}

// ---- split out --------------------------------------------------------------

// SplitPersonAlias turns one alias back into a record of its own.
//
// THE PACK CALLS THIS THE PARTIAL REVERSE OF A MERGE, and is straight about why it
// is partial: it "cannot restore which works came from where". Nothing in the
// schema remembers that a particular book was credited to the record that got
// folded in — after a merge every link points at the survivor, and the alias is
// only a spelling. So this hands back a record with the name, and the works stay
// where they are.
//
// WHAT IT IS ACTUALLY FOR is the case that has nothing to do with merging: two
// people who genuinely share a spelling, where one of them arrived as an alias by
// mistake. Splitting gives the second one a record to be, and the reader re-points
// the works themselves — which they have to do anyway, because only they know
// which is which.
//
// UNDO IS THE SAME ACT IN REVERSE, which is why this one has no reversal payload:
// filing the alias again is exactly the state it was in.
func SplitPersonAlias(tx *sql.Tx, uid, personID int64, alias string) (int64, error) {
	alias = strings.TrimSpace(alias)
	if alias == "" {
		return 0, refuse("split: no spelling given")
	}
	key := CastKey(alias)
	var owner int64
	var stored string
	switch err := tx.QueryRow(
		`SELECT person_id, alias FROM person_alias WHERE user_id = ? AND alias_key = ?`, uid, key).
		Scan(&owner, &stored); {
	case err == sql.ErrNoRows:
		return 0, refuse("split: nobody is spelled that way")
	case err != nil:
		return 0, err
	}
	if owner != personID {
		// Scoped like every other write here: a stale id in a client must not split
		// a spelling off somebody else's record.
		return 0, refuse("split: that spelling belongs to another record")
	}
	if holder, err := personNameHolder(tx, uid, key); err != nil {
		return 0, err
	} else if holder != 0 {
		return 0, refuse("split: somebody is already called that")
	}
	if _, err := tx.Exec(`DELETE FROM person_alias WHERE user_id = ? AND alias_key = ?`, uid, key); err != nil {
		return 0, err
	}
	res, err := tx.Exec(`INSERT INTO people (user_id, name) VALUES (?, ?)`, uid, stored)
	if err != nil {
		return 0, fmt.Errorf("split: create: %w", err)
	}
	newID, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	// 0059: THE QUOTES PRINTING THAT SPELLING COME WITH IT — see
	// RepointQuotesSpelled for why a quote can be moved without asking where a
	// work cannot, and for why leaving them behind is not the conservative choice.
	if _, err := RepointQuotesSpelled(tx, uid, personID, newID, key); err != nil {
		return 0, err
	}
	return newID, nil
}

// SplitCharacterAlias is SplitPersonAlias for the other table.
//
// SAME PARTIALNESS, SAME REASON, and it is worth restating rather than pointing
// at: nothing in the schema remembers which cast rows came from the record that
// got folded in, so this hands back a record with the name and the appearances
// stay where they are. A reader who splits "the professor" back out of Woland
// gets an empty character and re-points the cast rows themselves — which only
// they can do, because only they know which billing was which.
//
// WHAT IT DOES NOT DO, and its twin does: re-point the quotes printing that
// spelling. RepointQuotesSpelled exists because 0059 linked quotes to `people`;
// no quote has ever pointed at a character, so there is nothing here to move.
// The absence is the schema's, not an omission.
//
// UNDO IS THE SAME ACT IN REVERSE — filing the alias again is exactly the state
// it was in — which is why this one carries no reversal payload either.
func SplitCharacterAlias(tx *sql.Tx, uid, characterID int64, alias string) (int64, error) {
	alias = strings.TrimSpace(alias)
	if alias == "" {
		return 0, refuse("split: no spelling given")
	}
	key := CastKey(alias)
	var owner int64
	var stored string
	switch err := tx.QueryRow(
		`SELECT character_id, alias FROM character_alias WHERE user_id = ? AND alias_key = ?`, uid, key).
		Scan(&owner, &stored); {
	case err == sql.ErrNoRows:
		return 0, refuse("split: nothing is spelled that way")
	case err != nil:
		return 0, err
	}
	if owner != characterID {
		// Scoped like every other write here: a stale id in a client must not split
		// a spelling off somebody else's record.
		return 0, refuse("split: that spelling belongs to another record")
	}
	if holder, err := characterNameHolder(tx, uid, key); err != nil {
		return 0, err
	} else if holder != 0 {
		return 0, refuse("split: a character is already called that")
	}
	if _, err := tx.Exec(`DELETE FROM character_alias WHERE user_id = ? AND alias_key = ?`, uid, key); err != nil {
		return 0, err
	}
	res, err := tx.Exec(`INSERT INTO characters (user_id, name) VALUES (?, ?)`, uid, stored)
	if err != nil {
		return 0, fmt.Errorf("split: create: %w", err)
	}
	return res.LastInsertId()
}

// ---- a work's people --------------------------------------------------------

// WorkCredit is one person credited on one work, in one role.
//
// The inverse of CreditOf: that answers "which works is this person in", this
// answers "who is on this work", and they are two questions because the panels
// that ask them are two panels.
type WorkCredit struct {
	Role     string `json:"role"`
	Ordering int    `json:"ordering"`
	PersonID int64  `json:"person_id"`
	Name     string `json:"name"` // the record's own name
	// CreditAs is what THIS work prints, where it differs. The scope-1 field: a
	// reader editing it is saying "this cover spells it this way", not "this person
	// is called this", and the panel has to be able to show the difference.
	CreditAs string `json:"credit_as,omitempty"`
}

// WorkCastRow is a cast row as the People panel needs it: the pairing, plus every
// other spelling the character answers to.
//
// ITS OWN TYPE RATHER THAN A FIELD ON CastOf, which two other readers already
// return. An alias list is a fact this surface needs and the other two do not, and
// a field that is populated by one of three producers is a field every caller has
// to know the provenance of.
//
// THE ALIASES ARE THE RECORD'S, WHEREVER THEY WERE FILED. A character record is
// library-wide, so one Woland brings every spelling it has ever answered to and not
// only the ones recorded against this book — which is the answer given when this
// was asked, and the reason the highlight can find "Messire" in a novel that never
// bills that name.
type WorkCastRow struct {
	CastOf
	CharacterAliases []string `json:"character_aliases,omitempty"`
}

// WorkPeople is everything a work's People panel draws.
type WorkPeople struct {
	Credits []WorkCredit  `json:"credits"`
	Cast    []WorkCastRow `json:"cast"`
	// Speakers are the people this work's own QUOTES point at, with how many lines
	// each. Distinct from Cast: being billed on a film and having said one of the
	// lines a reader kept are different facts, and a reader looking for "who says
	// the things I saved" is asking the second one.
	//
	// EMPTY FOR A BOOK, and not by omission. 0059 linked dialogues.actor_id and
	// utterances.speaker_id; `annotations` has no person column at all — a book
	// highlight's speaker was to be work_cast.speaker_cast_id, which 0056 declared
	// and nothing has ever written.
	Speakers []WorkSpeaker `json:"speakers"`
}

// WorkSpeaker is one person the work's quotes name, and how many of them do.
type WorkSpeaker struct {
	PersonID int64  `json:"person_id"`
	Name     string `json:"name"`
	Lines    int    `json:"lines"`
}

// PeopleOfWork reads every person and character attached to one work.
//
// THREE READS AND NOT A JOIN, because they are three different attachments and a
// join would have to invent a shape that flattens them: a credit is a role on the
// work, a cast row is a character with a performer beside them, and a speaker is a
// person some quote points at. A panel draws three lists; this returns three.
func PeopleOfWork(db Queryer, uid int64, kind string, workID int64) (*WorkPeople, error) {
	out := &WorkPeople{Credits: []WorkCredit{}, Cast: []WorkCastRow{}, Speakers: []WorkSpeaker{}}

	rows, err := db.Query(
		`SELECT wp.role, wp.ordering, wp.person_id, p.name, wp.credit_as
		   FROM work_person wp JOIN people p ON p.id = wp.person_id
		  WHERE wp.user_id = ? AND wp.kind = ? AND wp.work_id = ?
		  ORDER BY wp.role, wp.ordering`, uid, kind, workID)
	if err != nil {
		return nil, fmt.Errorf("work people: credits: %w", err)
	}
	for rows.Next() {
		var c WorkCredit
		if err := rows.Scan(&c.Role, &c.Ordering, &c.PersonID, &c.Name, &c.CreditAs); err != nil {
			rows.Close()
			return nil, err
		}
		out.Credits = append(out.Credits, c)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}

	// The cast, in billing order — the order the work itself puts them in, which is
	// the one a reader recognises.
	crows, err := db.Query(
		`SELECT wc.id, wc.character, wc.character_id, wc.actor, wc.actor_id
		   FROM work_cast wc
		  WHERE wc.user_id = ? AND wc.kind = ? AND wc.work_id = ? AND wc.origin <> 'removed'
		  ORDER BY wc.billing, wc.id`, uid, kind, workID)
	if err != nil {
		return nil, fmt.Errorf("work people: cast: %w", err)
	}
	for crows.Next() {
		var c WorkCastRow
		var cid, aid sql.NullInt64
		if err := crows.Scan(&c.CastID, &c.Character, &cid, &c.Actor, &aid); err != nil {
			crows.Close()
			return nil, err
		}
		c.Kind, c.WorkID = kind, workID
		c.CharacterID, c.ActorID = cid.Int64, aid.Int64
		out.Cast = append(out.Cast, c)
	}
	err = crows.Err()
	crows.Close()
	if err != nil {
		return nil, err
	}

	// ONE QUERY FOR EVERY CHARACTER'S ALIASES, not one per row. A cast can be forty
	// names, and a per-row read is forty round trips for a list that is drawn in
	// one go. Joined through the work's own cast so the scan is bounded by this
	// work rather than by the library's alias table.
	if len(out.Cast) > 0 {
		byID := map[int64][]string{}
		arows, err := db.Query(
			`SELECT ca.character_id, ca.alias
			   FROM character_alias ca
			  WHERE ca.user_id = ? AND ca.character_id IN (
			        SELECT character_id FROM work_cast
			         WHERE user_id = ? AND kind = ? AND work_id = ? AND character_id IS NOT NULL)
			  ORDER BY ca.alias_key`, uid, uid, kind, workID)
		if err != nil {
			return nil, fmt.Errorf("work people: character aliases: %w", err)
		}
		for arows.Next() {
			var id int64
			var alias string
			if err := arows.Scan(&id, &alias); err != nil {
				arows.Close()
				return nil, err
			}
			byID[id] = append(byID[id], alias)
		}
		err = arows.Err()
		arows.Close()
		if err != nil {
			return nil, err
		}
		for i := range out.Cast {
			out.Cast[i].CharacterAliases = byID[out.Cast[i].CharacterID]
		}
	}

	// A film's own lines. A book takes this arm and finds nothing, which is the
	// schema being honest rather than a branch that skips the query.
	if kind == "movie" {
		srows, err := db.Query(
			`SELECT d.actor_id, p.name, count(*)
			   FROM dialogues d JOIN movies m ON m.id = d.movie_id
			   JOIN people p ON p.id = d.actor_id
			  WHERE m.user_id = ? AND d.movie_id = ? AND d.actor_id IS NOT NULL
			  GROUP BY d.actor_id, p.name ORDER BY count(*) DESC, p.name COLLATE NOCASE`, uid, workID)
		if err != nil {
			return nil, fmt.Errorf("work people: speakers: %w", err)
		}
		for srows.Next() {
			var sp WorkSpeaker
			if err := srows.Scan(&sp.PersonID, &sp.Name, &sp.Lines); err != nil {
				srows.Close()
				return nil, err
			}
			out.Speakers = append(out.Speakers, sp)
		}
		err = srows.Err()
		srows.Close()
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}

// ---- delete, and its undo ---------------------------------------------------
//
// A GLOBAL RECORD IS NOT ATTRIBUTION, which is the owner's own sentence and the
// reason these exist. A `work_cast` row says how one work bills somebody, and
// deleting it is a correction to that work — it stays permanent. A `people` or
// `characters` row is something a reader AUTHORS: a sort name they judged, a
// description they wrote, a portrait they picked, every alias they filed and every
// merge those aliases record. Losing that to a misclick is the thing the bin is
// for.
//
// IT IS A REVERSAL AND NOT A SNAPSHOT, for the reason 0058 gives: two of the three
// things a delete disturbs are `ON DELETE SET NULL` columns on rows that still
// exist, so putting them back is an UPDATE by id and not an INSERT. The bin's
// generic restore would re-insert the record and leave every cast row and every
// quote still pointing at nothing.

// AliasRow is one filed spelling, whole, because undo re-inserts it.
type AliasRow struct {
	Key   string `json:"key"`
	Alias string `json:"alias"`
}

// RecordDeleteUndo is everything needed to put a deleted person or character back.
//
// ONE TYPE OVER BOTH TABLES, unlike the two merges. A merge has to reason about
// what each table MEANS — credits, collapsing, which columns may be borrowed — and
// that is why its two halves are written out separately. A delete captures the row
// and the things that pointed at it, which is the same list either side of the
// fence with some fields empty; two copies of it would differ only in which fields
// stayed nil, and that is not a divergence worth being able to see in a diff.
type RecordDeleteUndo struct {
	ID  int64          `json:"id"`
	Row map[string]any `json:"row"`
	// Kinds is person_kinds, which a character does not have.
	Kinds   []string   `json:"kinds,omitempty"`
	Aliases []AliasRow `json:"aliases,omitempty"`
	// Cast are the work_cast rows whose actor_id (person) or character_id
	// (character) the delete nulled. COLLECTED BEFORE THE DELETE, because the
	// foreign key nulls them with nothing raised and nothing recorded.
	Cast []int64 `json:"cast,omitempty"`
	// Screen and Utterance are 0059's quote links, person only — no quote has ever
	// pointed at a character.
	Screen    []int64 `json:"screen,omitempty"`
	Utterance []int64 `json:"utterance,omitempty"`
}

// DeletePersonRecord bins a person, and refuses while any work still credits them.
//
// THE REFUSAL IS THE POINT, and it protects an invariant rather than the reader's
// feelings. `work_person.person_id` is `ON DELETE CASCADE`, so deleting a credited
// person takes their credit link rows with them — while `books.author` goes on
// printing the name, because the faithful-column promise means nothing recomposes
// it. The library is then in exactly the state CreditsAgree calls drift, for as
// long as the entry sits in the bin, and a support check against that function
// would report a fault that is really somebody's delete.
//
// So the delete says what it would cost instead: "still credited on 6 works". The
// reader removes the credits or merges the record, both of which are acts that say
// what happened to those books. This also matches what a person row already is
// everywhere else in this app — gcOrphanPeople sweeps exactly the UNATTACHED ones,
// and trash.go calls a person "a reference row".
//
// THE CAST AND THE QUOTES ARE NOT REFUSED, because they are `SET NULL`: nothing
// cascades, nothing is recomposed, and every id is recorded here and put back on
// undo. A performer with lines but no credits is deletable and restorable.
func DeletePersonRecord(tx *sql.Tx, uid, id int64) (*RecordDeleteUndo, string, error) {
	// COUNTED IN WORKS, NOT IN LINK ROWS. One person who is both the author and the
	// translator of one book holds two rows, and "still credited on 2 works" would
	// be the refusal naming a number the reader cannot find on their shelf.
	var credits int
	if err := tx.QueryRow(
		`SELECT count(*) FROM (SELECT DISTINCT kind, work_id FROM work_person
		                        WHERE user_id = ? AND person_id = ?)`, uid, id).Scan(&credits); err != nil {
		return nil, "", err
	}
	if credits > 0 {
		return nil, "", refuse("delete: still credited on %d work(s)", credits)
	}
	row, err := rowAsMap(tx, "people", uid, id)
	if err != nil {
		return nil, "", err
	}
	u := &RecordDeleteUndo{ID: id, Row: row}
	image, _ := row["image_path"].(string)

	if u.Kinds, err = personKindList(tx, id); err != nil {
		return nil, "", err
	}
	if u.Aliases, err = aliasRows(tx,
		`SELECT alias_key, alias FROM person_alias WHERE user_id = ? AND person_id = ?`, uid, id); err != nil {
		return nil, "", err
	}
	if u.Cast, err = idList(tx, `SELECT id FROM work_cast WHERE user_id = ? AND actor_id = ?`, uid, id); err != nil {
		return nil, "", err
	}
	if u.Screen, err = idsPointingAtPerson(tx, uid, KindScreen, id); err != nil {
		return nil, "", err
	}
	if u.Utterance, err = idsPointingAtPerson(tx, uid, KindUtterance, id); err != nil {
		return nil, "", err
	}
	if _, err := tx.Exec(`DELETE FROM people WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		return nil, "", fmt.Errorf("delete person: %w", err)
	}
	return u, image, nil
}

// UndoPersonDelete puts a binned person back, with everything that pointed at them.
func UndoPersonDelete(tx *sql.Tx, uid int64, u *RecordDeleteUndo) error {
	if err := insertRow(tx, "people", u.Row); err != nil {
		return fmt.Errorf("undo delete: person: %w", err)
	}
	for _, k := range u.Kinds {
		if _, err := tx.Exec(`INSERT OR IGNORE INTO person_kinds (person_id, kind) VALUES (?, ?)`, u.ID, k); err != nil {
			return fmt.Errorf("undo delete: roles: %w", err)
		}
	}
	for _, a := range u.Aliases {
		// OR IGNORE, NOT A PLAIN INSERT. A spelling this record held may have been
		// filed under somebody else during the thirty days it was in the bin, and the
		// alias table's primary key is the key alone. Taking it back would be this
		// restore silently unfiling a decision the reader made after the delete; the
		// record comes back without that one spelling instead.
		if _, err := tx.Exec(
			`INSERT OR IGNORE INTO person_alias (user_id, alias_key, alias, person_id) VALUES (?, ?, ?, ?)`,
			uid, a.Key, a.Alias, u.ID); err != nil {
			return fmt.Errorf("undo delete: aliases: %w", err)
		}
	}
	for _, id := range u.Cast {
		if _, err := tx.Exec(`UPDATE work_cast SET actor_id = ? WHERE id = ? AND user_id = ?`, u.ID, id, uid); err != nil {
			return fmt.Errorf("undo delete: cast: %w", err)
		}
	}
	for _, id := range u.Screen {
		if _, err := tx.Exec(`UPDATE dialogues SET actor_id = ? WHERE id = ?`, u.ID, id); err != nil {
			return fmt.Errorf("undo delete: screen quotes: %w", err)
		}
	}
	for _, id := range u.Utterance {
		if _, err := tx.Exec(`UPDATE utterances SET speaker_id = ? WHERE id = ? AND user_id = ?`, u.ID, id, uid); err != nil {
			return fmt.Errorf("undo delete: quotes: %w", err)
		}
	}
	return nil
}

// DeleteCharacterRecord bins a character.
//
// NO REFUSAL, and the difference from the person half is the schema's: nothing
// composes a derived column out of characters, so there is no cache a delete can
// put out of step. `work_cast.character_id` is SET NULL and every id is recorded
// here; the work goes on billing the name in its own column either way.
func DeleteCharacterRecord(tx *sql.Tx, uid, id int64) (*RecordDeleteUndo, string, error) {
	row, err := rowAsMap(tx, "characters", uid, id)
	if err != nil {
		return nil, "", err
	}
	u := &RecordDeleteUndo{ID: id, Row: row}
	image, _ := row["image_path"].(string)

	if u.Aliases, err = aliasRows(tx,
		`SELECT alias_key, alias FROM character_alias WHERE user_id = ? AND character_id = ?`, uid, id); err != nil {
		return nil, "", err
	}
	if u.Cast, err = idList(tx, `SELECT id FROM work_cast WHERE user_id = ? AND character_id = ?`, uid, id); err != nil {
		return nil, "", err
	}
	if _, err := tx.Exec(`DELETE FROM characters WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		return nil, "", fmt.Errorf("delete character: %w", err)
	}
	return u, image, nil
}

// UndoCharacterDelete puts a binned character back, with the cast rows it was on.
func UndoCharacterDelete(tx *sql.Tx, uid int64, u *RecordDeleteUndo) error {
	if err := insertRow(tx, "characters", u.Row); err != nil {
		return fmt.Errorf("undo delete: character: %w", err)
	}
	for _, a := range u.Aliases {
		// OR IGNORE — UndoPersonDelete's note, and the same alias table rule.
		if _, err := tx.Exec(
			`INSERT OR IGNORE INTO character_alias (user_id, alias_key, alias, character_id) VALUES (?, ?, ?, ?)`,
			uid, a.Key, a.Alias, u.ID); err != nil {
			return fmt.Errorf("undo delete: aliases: %w", err)
		}
	}
	for _, id := range u.Cast {
		if _, err := tx.Exec(`UPDATE work_cast SET character_id = ? WHERE id = ? AND user_id = ?`, u.ID, id, uid); err != nil {
			return fmt.Errorf("undo delete: cast: %w", err)
		}
	}
	return nil
}

func aliasRows(tx *sql.Tx, q string, args ...any) ([]AliasRow, error) {
	rows, err := tx.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AliasRow
	for rows.Next() {
		var a AliasRow
		if err := rows.Scan(&a.Key, &a.Alias); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func idList(tx *sql.Tx, q string, args ...any) ([]int64, error) {
	rows, err := tx.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}
