package store

import (
	"database/sql"
	"fmt"

	"tippani/internal/olog"
)

// 3.1.0: every cast row gets the character record it should always have had.
//
// WHAT WAS WRONG. `work_cast.character_id` is what makes a cast row a door.
// `characterImagesFor` passes it to the client, `chipRows` gates a chip's press
// on it, and the work-level character screen is reached with it — so a row
// without one draws a pill with a name, a face and a performer under it, and
// does nothing at all when pressed. The report that found it was exactly that:
// a film's cast pills opening nothing.
//
// THREE OF THE FOUR WRITERS NEVER SET IT. The provider fetch (cast.go), the
// adoption of a name typed on a quote line (cast_from_quotes.go) and the
// hand-added row (cast_handlers.go) all inserted without it; only "add a work to
// this character" (character_works.go) had an id to hand and used it. All three
// resolve one now — but a fix on the write path does nothing for a library that
// already has the rows, and a film whose cast was fetched before this release is
// the overwhelming majority of them.
//
// SO THIS IS A ONE-TIME PASS AND NOT A BOOT REPAIR. The distinction onetime.go
// draws is the meaning: BackfillCastKeys re-runs every start because a rename can
// re-stale a key at any time, where this is a defect of three insert statements
// that are now fixed. Once run, nothing can undo it, so nothing needs to keep
// asking.
//
// IT NEVER MERGES ANYTHING, and the resolver it uses is the reason. CharacterForCast
// keys on (kind, work, folded name) — the same key `backfillCast` uses, and for the
// same argument stated there: "one work's two rows for one character share a record
// and two works' rows never do." A work billing one character twice is two rows
// about one character; two works billing the same name are two characters until a
// reader merges them, because "Narrator", "Mother" and "The Doctor" recur across
// unrelated works and are not one person.
//
// The obvious-looking alternative is ResolveCharacter, which matches by name across
// the whole account. Its own header refuses this use in as many words — automatic
// name matching "would silently weld forty books together" — and it is right: a
// name on a cast row arrives from a provider or off a quote line, not from a reader
// choosing an existing character. Using it here would have merged a library.
func init() {
	RegisterOneTimePass(OneTimePass{
		Version: "3.1.0",
		Name:    "3.1.0-cast-records",
		Why:     "a cast row without a character record is a chip that opens nothing; give every row one",
		Run:     runCastRecords,
	})
}

func runCastRecords(tx *sql.Tx, env OneTimeEnv) error {
	// A fresh install has no rows and nothing to reconcile. It still records
	// itself — doing nothing is done — so it never runs again.
	if env.FreshInstall {
		return nil
	}
	// REMOVED ROWS ARE LEFT ALONE. `origin = 'removed'` is the tombstone a reader
	// deleting a cast row leaves so a refetch cannot resurrect it, and giving one
	// a record would create a `characters` row for somebody the reader has said
	// they do not want.
	rows, err := tx.Query(
		`SELECT id, user_id, kind, work_id, COALESCE(character, '')
		   FROM work_cast
		  WHERE (character_id IS NULL OR character_id = 0)
		    AND origin <> 'removed'
		    AND TRIM(COALESCE(character, '')) <> ''
		  ORDER BY id`)
	if err != nil {
		return fmt.Errorf("list cast rows without a record: %w", err)
	}
	type row struct {
		id     int64
		uid    int64
		kind   string
		workID int64
		name   string
	}
	var todo []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.uid, &r.kind, &r.workID, &r.name); err != nil {
			rows.Close()
			return fmt.Errorf("scan cast row: %w", err)
		}
		todo = append(todo, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	var linked int
	for _, r := range todo {
		id, err := CharacterForCast(tx, r.uid, r.kind, r.workID, r.name)
		if err != nil {
			// ONE ROW'S FAILURE IS NOT THE PASS'S. A name that cannot resolve is
			// one chip still shut, where returning would roll back every row that
			// did resolve and leave the pass unrecorded to try the whole set again
			// on the next boot.
			olog.Warnf(olog.CodeCastRowScan, "[cast] one-time: %q on cast %d: %v", r.name, r.id, err)
			continue
		}
		if _, err := tx.Exec(`UPDATE work_cast SET character_id = ? WHERE id = ?`, id, r.id); err != nil {
			return fmt.Errorf("link cast %d: %w", r.id, err)
		}
		linked++
	}
	if linked > 0 {
		olog.Printf("[store] cast records: gave %d of %d cast rows a character record", linked, len(todo))
	}
	return nil
}
