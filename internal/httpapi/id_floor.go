package httpapi

import (
	"database/sql"
	"fmt"
)

// The id floor: ids that are never reused, so a restore never has to renumber.
//
// `id INTEGER PRIMARY KEY` is a rowid alias on every table here, so SQLite hands
// out max(rowid) + 1 — which means it DOES reuse a freed id, whenever the deleted
// row held the table's highest. That is the common case rather than an edge one:
// you delete the thing you just added.
//
// With a bin in the app, a reused id is a restore that collides. The two ways to
// avoid that inside the row itself are AUTOINCREMENT (a rebuild of five foreign-key
// parents with cascading children — the migration class 0018 refused to attempt)
// or renumbering on restore (an id remap across every child row and join table,
// running on the one path whose whole job is putting things back exactly as they
// were). So instead the create paths allocate explicitly, above a high-water mark
// that only ever climbs. See migration 0031.
//
// It also closes an older bug. `item_reviews` is keyed (kind, item_id) with no
// foreign key, so a reused annotation id used to inherit the deleted quote's
// memory half-life, review count and lapse count. Ids that never repeat make that
// impossible rather than unlikely.

// idFloorTables is the allowlist, and the reason a table name can be
// concatenated into SQL below: the value never comes from a request. These are
// exactly the five kinds the bin can hold — a table with no bin entry has no
// reason to reserve anything, and every extra table here is a create path paying
// for a guarantee nobody needs.
var idFloorTables = map[string]bool{
	"books":       true,
	"movies":      true,
	"annotations": true,
	"dialogues":   true,
	"utterances":  true,
}

// nextID reserves one id for `table` inside the caller's transaction.
//
// The floor is raised to the table's own high-water mark first, which is what
// makes this correct on a database that predates it (the row is absent, so the
// floor seeds itself from max(id)) and safe against any insert that somehow
// bypasses it (the floor catches up rather than handing out a live id).
func nextID(tx *sql.Tx, table string) (int64, error) {
	ids, err := nextIDs(tx, table, 1)
	return ids, err
}

// nextIDs reserves a CONTIGUOUS BLOCK of n ids and returns the first.
//
// Import loops take a block rather than an id per row: a thousand-quote import
// should not pay a thousand extra round trips for a guarantee about ids. Unused
// ids in a block are simply skipped — an id is not a scarce resource, and a gap
// costs nothing, whereas a reused one costs a restore.
func nextIDs(tx *sql.Tx, table string, n int) (int64, error) {
	if !idFloorTables[table] {
		return 0, fmt.Errorf("id floor: %q is not a floored table", table)
	}
	if n < 1 {
		return 0, fmt.Errorf("id floor: block of %d", n)
	}
	if _, err := tx.Exec(
		`INSERT INTO id_floor (table_name, next_id) VALUES (?, 1)
		 ON CONFLICT(table_name) DO NOTHING`, table); err != nil {
		return 0, err
	}
	if _, err := tx.Exec(
		`UPDATE id_floor SET next_id = MAX(next_id, (SELECT COALESCE(MAX(id), 0) + 1 FROM `+table+`))
		 WHERE table_name = ?`, table); err != nil {
		return 0, err
	}
	var first int64
	if err := tx.QueryRow(
		`SELECT next_id FROM id_floor WHERE table_name = ?`, table).Scan(&first); err != nil {
		return 0, err
	}
	if _, err := tx.Exec(
		`UPDATE id_floor SET next_id = next_id + ? WHERE table_name = ?`, n, table); err != nil {
		return 0, err
	}
	return first, nil
}

// reserveAbove raises the floor past an id that has just been put back, so a
// restore cannot be followed by a create that lands on top of it. Called by the
// restore path for every row it re-inserts; a no-op when the floor is already
// higher, which it usually is.
func reserveAbove(tx *sql.Tx, table string, id int64) error {
	if !idFloorTables[table] {
		return fmt.Errorf("id floor: %q is not a floored table", table)
	}
	if _, err := tx.Exec(
		`INSERT INTO id_floor (table_name, next_id) VALUES (?, ?)
		 ON CONFLICT(table_name) DO UPDATE SET next_id = MAX(next_id, excluded.next_id)`,
		table, id+1); err != nil {
		return err
	}
	return nil
}

// idBlock hands out reserved ids inside one transaction, in batches.
//
// The import paths insert in loops — a Kindle clippings file is thousands of
// annotations — and three extra statements per row to reserve one id is a real
// cost on the machine this app is built for. A block is one reservation for the
// whole batch, and an id that goes unused (a duplicate the INSERT OR IGNORE
// dropped) is simply skipped: a gap in the sequence costs nothing, whereas a
// reused id costs a restore.
type idBlock struct {
	tx    *sql.Tx
	table string
	next  int64
	left  int
	size  int
}

// newIDBlock prepares an allocator for about `expect` rows. Nothing is reserved
// until the first take, so a batch that turns out to be empty writes nothing.
func newIDBlock(tx *sql.Tx, table string, expect int) *idBlock {
	if expect < 1 {
		expect = 1
	}
	return &idBlock{tx: tx, table: table, size: expect}
}

// take returns the next reserved id, refilling from the floor when the block is
// spent (which happens only if the caller under-estimated).
func (b *idBlock) take() (int64, error) {
	if b.left == 0 {
		first, err := nextIDs(b.tx, b.table, b.size)
		if err != nil {
			return 0, err
		}
		b.next, b.left = first, b.size
	}
	id := b.next
	b.next++
	b.left--
	return id, nil
}
