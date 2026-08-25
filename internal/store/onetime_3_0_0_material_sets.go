package store

import (
	"database/sql"

	"tippani/internal/olog"
)

// 3.0.0: two aesthetics became seven material sets, and the reader's stored choice
// means something different afterwards.
//
// RETIRING THIS FILE. Delete it. Nothing else mentions it — onetime.go iterates
// what registered, and the row this pass wrote in one_time_passes stays behind as
// the record that it ran. Delete it once no supported instance can still be
// upgrading from before 3.0.0.
//
// WHY THIS IS A PASS AND NOT NOTHING AT ALL. loadPrefs already heals a value it does
// not recognise, so dropping "paper" and "film" from the allowed set retires them on
// read with no pass whatsoever — every stored blob simply falls to the default on the
// next request. That is exactly the argument for writing the pass: doing nothing is
// not neutral, it silently lands every reader who chose film on Manuscript, and the
// only evidence would be their app looking different one morning. "The meaning of
// something changed in a particular release" is what this registry is for.
//
// THE KEY IS RENAMED, NOT JUST REVALUED. "aesthetic" described a choice between two
// whole looks — paper's palette and film's were different colours. It is now a choice
// of what the surfaces are MADE OF, on one palette per mode, and light/dark is its own
// control beside it. A key called aesthetic holding "quarry" is a name that has to be
// explained every time it is read, so it becomes materialSet in the release that
// changes what it means. The old key needs no deletion: loadPrefs drops what it does
// not know, so the stale "aesthetic" goes on the reader's next save and costs a few
// bytes until then.
//
// WHAT PAPER AND FILM MAP TO. Manuscript is paper's own materials — a cloth blotter,
// paper on it, boards on the book — and Film assembly is film's: a steel bench,
// brushed alloy, matte stock, glass on the poster. Neither is a compromise; the two
// old aesthetics were built as those rooms, and five more rooms are what the release
// adds. So the mapping is an identity in intent, and a reader who chose film keeps
// what they chose.
//
// A FRESH INSTALL IS SKIPPED, and not merely as an optimisation: a database created
// after 3.0.0 has never stored an aesthetic, so there is nothing to translate and the
// pass would be claiming to have upgraded something that never existed.

func init() {
	RegisterOneTimePass(OneTimePass{
		Version: "3.0.0",
		// Chosen once and never changed, even if this file is renamed: it is the
		// primary key in one_time_passes, so a new name re-runs the pass on every
		// database that already ran it.
		Name: "3.0.0-material-sets",
		Why:  "the aesthetic preference becomes one of seven material sets",
		Run:  runMaterialSets,
	})
}

func runMaterialSets(tx *sql.Tx, env OneTimeEnv) error {
	if env.FreshInstall {
		return nil // never stored an aesthetic; nothing to translate
	}

	// COALESCE/NULLIF because json_set on a NULL or empty blob yields NULL, which
	// would wipe every other preference the reader has — the same trap migration
	// 0036 documents. The WHERE clause means a blob with no aesthetic at all, or one
	// already carrying a set, is not rewritten.
	res, err := tx.Exec(`
		UPDATE users
		   SET preferences = json_set(
		         COALESCE(NULLIF(preferences, ''), '{}'),
		         '$.materialSet',
		         CASE json_extract(preferences, '$.aesthetic')
		              WHEN 'film' THEN 'film-assembly'
		              ELSE 'manuscript'
		         END)
		 WHERE json_extract(preferences, '$.aesthetic') IN ('paper', 'film')`)
	if err != nil {
		return err
	}
	// The registry already logs that the pass ran; the COUNT is the part that is
	// worth a second line, because this is the one pass whose effect a reader SEES.
	// It answers "did my choice survive the upgrade" without anybody opening a
	// database.
	if n, err := res.RowsAffected(); err == nil && n > 0 {
		olog.Printf("[store] carried %d reader(s) from the old aesthetic to a material set", n)
	}
	return nil
}
