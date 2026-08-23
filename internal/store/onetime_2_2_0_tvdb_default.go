package store

import (
	"database/sql"
)

// 2.2.0: TheTVDB became the default metadata source, and the instances that
// already existed have to be told once.
//
// RETIRING THIS FILE. Delete it. Nothing else mentions it — onetime.go iterates
// what registered, and the row this pass wrote in one_time_passes stays behind as
// the record that it ran. Delete it once no supported instance can still be
// upgrading from before 2.2.0.
//
// WHAT CHANGED AND WHY IT NEEDS A PASS AT ALL. Film and show lookups now consult
// TheTVDB first and fall back to TMDB, because TheTVDB's character records carry
// an image PER ROLE — the character in costume — and TMDB has no equivalent at any
// endpoint. Nothing about that change touches a title that is already in a
// library: a pinned record keeps its pin for ever, which is the whole point of
// pinning, so an upgraded instance goes on fetching from TMDB for every title it
// already has and never sees the new art.
//
// THIS PASS DOES NOT RE-PIN ANYTHING, and that was the decision rather than the
// oversight. Re-pinning would mean a search-and-match against TheTVDB for every
// title in the library — a network call each, from inside Migrate(), where a
// failure has to be swallowed and a wrong match cannot be reviewed. It would also
// overwrite provider facts on rows the reader never asked about. Against that,
// the cost of doing nothing is that character art arrives one title at a time, on
// re-verify, which the reader can see and choose.
//
// So the pass writes ONE marker and touches no title. The marker is what lets the
// interface say the thing once, to the people it is true for.
//
// THE FRESH-INSTALL CHECK IS THE POINT OF THE MARKER. A database created after
// 2.2.0 has never had a different default, so telling its owner that the default
// moved is a false statement rendered in their interface. Same for an upgraded
// instance with nothing pinned to TMDB: there is no title the notice would be
// about. Both record the pass and write nothing, so neither is asked again.

// SettingFilmSourceNotice is the settings key this pass writes, and it is
// EXPORTED so that the one place that reads it — httpapi's metadata status — uses
// this constant rather than its own copy of the string. A key spelled twice
// across a package boundary is a key that can be renamed on one side, and the
// symptom would be a notice that silently never appears again: nothing errors,
// nothing logs, the read just finds no row. There is no test that would catch
// that which is cheaper than not allowing it.
//
// The value stored under it is the release that moved the default, not a bare
// flag: an interface wording the notice needs to know WHICH change it is about,
// and a later default move writes its own version here rather than colliding with
// a boolean that is already true.
//
// It outlives this file on purpose. When the pass is retired the databases that
// ran it still hold the row, and the reader still needs the notice until they
// have re-verified the last TMDB-pinned title — so this constant and its reader
// move to a permanent home rather than being deleted with the pass. That is the
// one thing to check before deleting this file.
const SettingFilmSourceNotice = "metadata.default_moved_notice"

func init() {
	RegisterOneTimePass(OneTimePass{
		Version: "2.2.0",
		// Chosen once and never changed, even if this file is renamed: it is the
		// primary key in one_time_passes, so a new name re-runs the pass on every
		// database that already ran it.
		Name: "2.2.0-tvdb-default-notice",
		Why:  "TheTVDB is now the default film/show source; flag the titles still pinned to TMDB",
		Run:  runTVDBDefaultNotice,
	})
}

func runTVDBDefaultNotice(tx *sql.Tx, env OneTimeEnv) error {
	if env.FreshInstall {
		return nil // never had another default; nothing true to say
	}

	// Pinned to TMDB and not to TheTVDB. A title carrying both ids already has a
	// TheTVDB record to re-verify against and needs no prompting; a game is
	// neither provider's and is excluded by having no tmdb_id at all.
	var pinned int
	if err := tx.QueryRow(
		`SELECT COUNT(*) FROM movies WHERE tmdb_id IS NOT NULL AND tvdb_id IS NULL`,
	).Scan(&pinned); err != nil {
		return err
	}
	if pinned == 0 {
		return nil
	}

	// Upsert rather than a plain insert: a database whose notice row was removed
	// by hand and then reached this pass again would otherwise fail on the primary
	// key, and a pass failing is a warning on every boot until somebody looks.
	_, err := tx.Exec(
		`INSERT INTO settings (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		SettingFilmSourceNotice, "2.2.0")
	return err
}
