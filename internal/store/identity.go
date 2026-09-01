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
}

// castWhere is the shared tail of the two cast reads: both halves of the union,
// with one predicate spliced in. The predicate is a constant from this file and
// never input — the ids it compares against are bound.
//
// work_cast CARRIES ITS OWN user_id (0048), so this scopes on the row rather than
// through a parent. That is not only tidier: it is what lets the union cover books
// and movies with the same predicate on both sides.
func castWhere(pred string) string {
	return `
		SELECT wc.id, 'book', b.id, b.title, wc.character_id, wc.character,
		       COALESCE(wc.actor_id, 0), COALESCE(p.name, wc.actor), COALESCE(wc.character_image_path, '')
		  FROM work_cast wc
		  JOIN books b ON b.id = wc.work_id
		  LEFT JOIN people p ON p.id = wc.actor_id
		 WHERE wc.user_id = ? AND wc.kind = 'book' AND ` + pred + `
		UNION ALL
		SELECT wc.id, 'movie', m.id, m.title, wc.character_id, wc.character,
		       COALESCE(wc.actor_id, 0), COALESCE(p.name, wc.actor), COALESCE(wc.character_image_path, '')
		  FROM work_cast wc
		  JOIN movies m ON m.id = wc.work_id
		  LEFT JOIN people p ON p.id = wc.actor_id
		 WHERE wc.user_id = ? AND wc.kind = 'movie' AND ` + pred + `
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
			&actorID, &c.Actor, &c.Image); err != nil {
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

	if undo.Person, err = personRowAsMap(tx, uid, dropID); err != nil {
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
	if key := CastKey(dropName); dropName != "" && CastKey(keepName) != key {
		// READ THE KEY'S CURRENT OWNER FIRST. The write below is an upsert, so it can
		// take a spelling somebody else already holds; an undo that only deletes
		// would then destroy an alias this merge never made.
		var was AliasWas
		switch err := tx.QueryRow(
			`SELECT person_id, alias FROM person_alias WHERE user_id = ? AND alias_key = ?`, uid, key).
			Scan(&was.PersonID, &was.Alias); {
		case err == nil:
			undo.NameAliasWas = &was
		case errors.Is(err, sql.ErrNoRows):
		default:
			return nil, fmt.Errorf("merge name alias: read: %w", err)
		}
		if _, err := tx.Exec(
			`INSERT INTO person_alias (user_id, alias_key, alias, person_id) VALUES (?, ?, ?, ?)
			 ON CONFLICT (user_id, alias_key) DO UPDATE SET alias = excluded.alias, person_id = excluded.person_id`,
			uid, key, dropName, keepID); err != nil {
			return nil, fmt.Errorf("merge name alias: %w", err)
		}
		undo.NameAlias = key
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
	if err := insertPersonRow(tx, u.Person); err != nil {
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

// ---- small shared parts ----------------------------------------------------

func fillableColumn(col string) bool {
	for _, c := range mergeFillable {
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
func personRowAsMap(tx *sql.Tx, uid, id int64) (map[string]any, error) {
	rows, err := tx.Query(`SELECT * FROM people WHERE user_id = ? AND id = ?`, uid, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	if !rows.Next() {
		return nil, fmt.Errorf("merge: no such person")
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

// insertPersonRow puts a whole people row back, whatever columns it carries.
//
// THE COLUMN LIST COMES FROM THE TABLE, not from the payload, so a payload naming
// something that is not a column cannot reach the statement — the keys are
// interpolated, and a bin entry is data the app wrote but a restore is a read of
// something that has been sitting on disk.
func insertPersonRow(tx *sql.Tx, row map[string]any) error {
	cols, err := tx.Query(`SELECT name FROM pragma_table_info('people')`)
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
		return fmt.Errorf("undo merge: the payload names no columns of people")
	}
	_, err = tx.Exec(
		`INSERT INTO people (`+strings.Join(names, ", ")+`) VALUES (`+strings.Join(marks, ", ")+`)`, args...)
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
