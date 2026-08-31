package store

import (
	"database/sql"
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
		return fmt.Errorf("alias: empty")
	}
	key := CastKey(alias)
	var ownerName string
	err := tx.QueryRow(`SELECT name FROM people WHERE user_id = ? AND id = ?`, uid, personID).Scan(&ownerName)
	if err == sql.ErrNoRows {
		return fmt.Errorf("alias: no such person")
	}
	if err != nil {
		return err
	}
	// The record's own name is not an alias of itself, and saying so is friendlier
	// than a UNIQUE violation from three statements away.
	if CastKey(ownerName) == key {
		return fmt.Errorf("alias: that is already their name")
	}
	if holder, err := personNameHolder(tx, uid, key); err != nil {
		return err
	} else if holder != 0 && holder != personID {
		return fmt.Errorf("alias: somebody is already called that")
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
		return fmt.Errorf("alias: empty")
	}
	key := CastKey(alias)
	var ownerName string
	err := tx.QueryRow(`SELECT name FROM characters WHERE user_id = ? AND id = ?`, uid, characterID).Scan(&ownerName)
	if err == sql.ErrNoRows {
		return fmt.Errorf("alias: no such character")
	}
	if err != nil {
		return err
	}
	if CastKey(ownerName) == key {
		return fmt.Errorf("alias: that is already their name")
	}
	if holder, err := characterNameHolder(tx, uid, key); err != nil {
		return err
	} else if holder != 0 && holder != characterID {
		return fmt.Errorf("alias: a character is already called that")
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
