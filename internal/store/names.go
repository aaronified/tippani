package store

// A NAME AND EVERY OTHER NAME, AS ONE FIELD.
//
// The design pack edits a record's name and its spellings as a single multi-line
// box whose FIRST LINE IS THE ONE THAT PRINTS, and the reason is worth keeping
// where the write is. "Called here" and "Also called here" were two rows editing
// one fact — what this record is called — and splitting them made the canonical
// name look like a different KIND of thing from its aliases, when it is only the
// first of them. Promoting an alias then became a two-field dance: clear one box,
// retype it in the other, and hope nothing was lost between the two saves.
//
// One field makes promotion a LINE MOVE, and a line move is only meaningful if
// the lines have an order — which is what 0063's `seq` is for, and why the owner
// was asked before it was added: 0056 says of these tables "display never uses
// one", and that rule stands. What prints is still the record's own `name`
// column; this verb is what keeps that column and the alias list in step.
//
// ONE TRANSACTION, WHOLE-LIST. A field that saves as several requests can fail
// halfway and leave a record whose printing name is gone from both places — the
// state the two-box version could reach and this one cannot.

import (
	"database/sql"
	"strings"
)

// nameTable is the pair of tables one record's names live in.
type nameTable struct {
	record string // characters | people
	alias  string // character_alias | person_alias
	fk     string // character_id  | person_id
}

var characterNames = nameTable{"characters", "character_alias", "character_id"}
var personNames = nameTable{"people", "person_alias", "person_id"}

// SetCharacterNames writes a character's name and ordered spellings from one
// field's lines. SetPersonNames is the same verb on the other table.
func SetCharacterNames(tx *sql.Tx, uid, id int64, lines []string) error {
	return setNames(tx, characterNames, uid, id, lines)
}

func SetPersonNames(tx *sql.Tx, uid, id int64, lines []string) error {
	return setNames(tx, personNames, uid, id, lines)
}

// setNames is the whole field in one write.
//
// WHAT IT REFUSES, and each refusal is a sentence rather than a 500 (see
// aliasWrite): an empty field, because a record with no name is a record nobody
// can find again; and a spelling another record already claims, because the
// uniqueness of (user_id, alias_key) is what makes a credit string resolve to
// exactly one record across a merge. That check is the one AddCharacterAlias
// already makes, reused rather than re-derived.
//
// DUPLICATE LINES ARE FOLDED, NOT REFUSED. A reader who typed the same spelling
// twice made a typing mistake, not a request, and refusing the save would leave
// them hunting for which of thirty lines repeated. First occurrence wins, so the
// order they chose survives the fold.
func setNames(tx *sql.Tx, t nameTable, uid, id int64, lines []string) error {
	// The name is the first NON-EMPTY line, not literally the first: a reader who
	// pressed Enter before typing has an empty line 1, and taking it would erase
	// the name they can still see on the screen behind the field.
	var kept []string
	seen := map[string]bool{}
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if l == "" {
			continue
		}
		k := CastKey(l)
		if k == "" || seen[k] {
			continue
		}
		seen[k] = true
		kept = append(kept, l)
	}
	if len(kept) == 0 {
		return refuse("names: a record needs a name")
	}
	name, rest := kept[0], kept[1:]

	var exists int
	err := tx.QueryRow(`SELECT 1 FROM `+t.record+` WHERE user_id = ? AND id = ?`, uid, id).Scan(&exists)
	if err == sql.ErrNoRows {
		return refuse("names: no such record")
	}
	if err != nil {
		return err
	}

	// THE SPELLING ANOTHER RECORD HOLDS IS CHECKED BEFORE ANYTHING IS WRITTEN, so
	// a field with one bad line changes nothing at all rather than applying the
	// good lines and reporting a failure the reader then has to reconstruct.
	for _, a := range append([]string{name}, rest...) {
		var holder int64
		err := tx.QueryRow(
			`SELECT `+t.fk+` FROM `+t.alias+` WHERE user_id = ? AND alias_key = ?`,
			uid, CastKey(a)).Scan(&holder)
		if err != nil && err != sql.ErrNoRows {
			return err
		}
		if holder != 0 && holder != id {
			return refuse("names: another record is already called %s", a)
		}
	}

	if _, err := tx.Exec(
		`UPDATE `+t.record+` SET name = ? WHERE user_id = ? AND id = ?`, name, uid, id); err != nil {
		return err
	}
	// REPLACED WHOLE RATHER THAN DIFFED. A diff has to decide what a re-ordered,
	// re-spelled line IS — a rename or a delete plus an add — and gets it wrong
	// either way; the field's own answer is "these are the spellings now".
	if _, err := tx.Exec(
		`DELETE FROM `+t.alias+` WHERE user_id = ? AND `+t.fk+` = ?`, uid, id); err != nil {
		return err
	}
	// seq is 1-BASED BELOW THE NAME, which leaves 0 meaning "nobody chose this
	// position" — every row that predates 0063, and every row a merge writes.
	for i, a := range rest {
		if _, err := tx.Exec(
			`INSERT INTO `+t.alias+` (user_id, alias_key, alias, `+t.fk+`, seq) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT (user_id, alias_key) DO UPDATE
			   SET alias = excluded.alias, `+t.fk+` = excluded.`+t.fk+`, seq = excluded.seq`,
			uid, CastKey(a), a, id, i+1); err != nil {
			return err
		}
	}
	return nil
}

// NameLines is the field's value: the printing name, then the spellings in the
// order the reader put them.
//
// UNPOSITIONED ROWS COME LAST, alphabetically among themselves. `(seq = 0)` sorts
// 0 before 1 in SQLite, so a row nobody placed lands after every row somebody
// did — which is where a merge's contribution belongs. Before the field has ever
// been saved every row is unpositioned, so the order is exactly the alphabetical
// one CharacterAliases has always returned.
func NameLines(db Queryer, uid, id int64, t nameTable) ([]string, error) {
	var name string
	if err := db.QueryRow(
		`SELECT name FROM `+t.record+` WHERE user_id = ? AND id = ?`, uid, id).Scan(&name); err != nil {
		return nil, err
	}
	rest, err := aliasList(db,
		`SELECT alias FROM `+t.alias+` WHERE user_id = ? AND `+t.fk+` = ?
		 ORDER BY (seq = 0), seq, alias_key`, uid, id)
	if err != nil {
		return nil, err
	}
	return append([]string{name}, rest...), nil
}

// CharacterNameLines and PersonNameLines name the table so a handler does not
// have to know the column layout.
func CharacterNameLines(db Queryer, uid, id int64) ([]string, error) {
	return NameLines(db, uid, id, characterNames)
}

func PersonNameLines(db Queryer, uid, id int64) ([]string, error) {
	return NameLines(db, uid, id, personNames)
}
