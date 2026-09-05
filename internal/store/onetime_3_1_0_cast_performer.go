package store

import (
	"database/sql"

	"tippani/internal/olog"
)

// 3.1.0: the performers a cast row names, given the records the row should have
// been born with.
//
// RETIRING THIS FILE. Delete it. Nothing else mentions it — onetime.go iterates
// what registered — and the row it wrote in one_time_passes stays behind as the
// record that it ran. Delete it once no supported instance can still be upgrading
// from before 3.1.0.
//
// WHY IT EXISTS, GIVEN THAT 3.1.0-person-identity ALREADY DID THIS. That pass
// linked every cast row a library HELD WHEN IT RAN. It cannot cover the rows
// written after it by a build that had not yet learned to link — and every writer
// of work_cast learned that at a different moment during 3.1.0's development, the
// provider merge last of all. So a library that fetched a film's cast in the
// window between the two came out of it with rows naming a performer and
// pointing at nobody, and no pass had a reason to look at them again.
//
// WHAT THAT COSTS THE READER, which is the only reason this is worth a file. The
// row draws the performer's name and their face, and the face is a button: it
// opens their record. A row with no actor_id opens nothing — and the person's own
// page, which lists their work from THIS column, says they are in no films at all
// while the film's own cast list prints their name. The owner's library had 41
// such rows across four titles, including both surviving performers on the film
// they reported.
//
// IT IS NOT A BOOT REPAIR, on the same line the registry's header draws:
// BackfillCastKeys re-folds a column SQLite cannot fold and must re-run for ever
// because a later rename can restale it. Nothing restales this — every live
// writer of the table links its row now — so paying a scan on every start for a
// state that can only have been reached once is exactly what the one-time
// registry is for.
//
// IT DOES NOT TOUCH A ROW THAT ALREADY POINTS SOMEWHERE, tombstones included. A
// reader who re-pointed a credit at a different person must not be dragged back
// by the name still printed on it — 3.1.0-person-identity's rule, restated here
// because this pass is the one that would break it. Tombstones are skipped for a
// plainer reason: a row nobody can see has nothing to open.
//
// A FAILURE IS LOGGED AND SKIPPED, like every pass. The library then runs exactly
// as it did before — the names still print, the faces still draw, and only the
// door is missing until the next start retries.

func init() {
	RegisterOneTimePass(OneTimePass{
		Version: "3.1.0",
		Name:    "3.1.0-cast-performers",
		Why:     "a cast row naming a performer with no record opens nothing, and leaves that performer's page claiming no works",
		Run:     runCastPerformers,
	})
}

func runCastPerformers(tx *sql.Tx, env OneTimeEnv) error {
	if env.FreshInstall {
		return nil
	}
	rows, err := tx.Query(`
		SELECT id, user_id FROM work_cast
		 WHERE TRIM(COALESCE(actor, '')) <> '' AND actor_id IS NULL AND origin <> 'removed'
		 ORDER BY id`)
	if err != nil {
		return err
	}
	// COLLECTED BEFORE WRITING. LinkCastRow writes to the table this cursor is
	// walking, and what SQLite does to a live cursor whose rows are being updated
	// is not something to rely on in an upgrade nobody watches — the same rule
	// backfillCredits states, for the same reason.
	type row struct{ id, uid int64 }
	var all []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.uid); err != nil {
			rows.Close()
			return err
		}
		all = append(all, r)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}

	for _, r := range all {
		// THE LIVE LINKER, NOT A SECOND COPY OF IT. ResolvePerson matches this
		// account's records by name and alias and creates one where neither answers,
		// and a pass that reimplemented that match would produce a library subtly
		// different from one built by typing. It fills the character half too, where
		// a row is missing that as well — the two are one function on purpose.
		if err := LinkCastRow(tx, r.uid, r.id); err != nil {
			return err
		}
	}
	if len(all) > 0 {
		olog.Printf("[store] cast performers: %d row(s) given the person record they name", len(all))
	}
	return nil
}
