package store

import (
	"database/sql"
	"fmt"

	"tippani/internal/olog"
)

// 3.1.0: the text-size dial stops at 175%, and anybody parked on 200% is moved
// down once rather than being silently reset.
//
// RETIRING THIS FILE. Delete it. Nothing else mentions it — onetime.go iterates
// what registered, and the row it wrote in one_time_passes stays behind as the
// record that it ran. Delete it once no supported instance can still be upgrading
// from before 3.1.0.
//
// WHY 200 WENT, in one line: the nav rail could not honour it. A rail that keeps
// its words legible at double size needs 471px of a 1180px window — two fifths of
// the screen for nine labels — and every list row carrying a title had lost the
// width to show one. A dial position the interface cannot answer is worse than an
// absent one, so 175 became the top. TYPE_FACTORS in type.js carries the same
// reasoning, and internal/httpapi's sizeFactors is checked against it by a test.
//
// WHY A PASS AND NOT A CLAMP. clampFactor sends an unknown number to 100, not to
// the nearest step, and that is deliberate and right: a preference written by a
// newer client must render at the DESIGNED size rather than at a half-understood
// approximation of a bigger one. But 200 is not an unknown number from the
// future — it is a position this app offered and then withdrew, and a reader who
// chose it wants large text, not default text. Falling to 100 would halve their
// interface without a word. So the value is rewritten, once, to the nearest step
// the dial still has.
//
// IT REWRITES RATHER THAN TRANSLATING ON READ, which is the same choice the
// stored `tippani:annview` of "list" got when the list view was dropped: a value
// that is translated on every read is a value that stays wrong in the database
// for ever, and shows up again the first time something reads it another way.
//
// FRESH INSTALLS DO NOTHING AND SAY SO. A database created after 3.1.0 has never
// been able to store a 200, so there is nothing to move; it records the pass and
// is not asked again.

// typeDialWithdrawn is the position that no longer exists, and typeDialTop is
// where its holders land. Literals rather than a reference to httpapi's list,
// because a one-time pass is a statement about a MOMENT — what 3.1.0 did — and
// must go on doing exactly that after the dial changes again.
const (
	typeDialWithdrawn = 200
	typeDialTop       = 175
)

func init() {
	RegisterOneTimePass(OneTimePass{
		Version: "3.1.0",
		Name:    "3.1.0-type-dial-max-175",
		Why:     "the text-size dial stops at 175%; move anyone parked on 200% down rather than resetting them to 100%",
		Run:     moveTypeDialOffTwoHundred,
	})
}

// The four dials, by their key in the preferences document. Spelled out rather
// than derived, for the reason above: this pass is about the four fields that
// existed in 3.1.0, and a fifth added later is not its business.
var typeDialKeys = []string{"sizeDisplay", "sizeUi", "sizeMono", "sizeHand"}

func moveTypeDialOffTwoHundred(tx *sql.Tx, env OneTimeEnv) error {
	if env.FreshInstall {
		return nil
	}
	moved := 0
	for _, key := range typeDialKeys {
		// ONLY THE ROWS THAT HOLD THE WITHDRAWN VALUE, so an account that never
		// moved the dial is not rewritten and does not look edited afterwards.
		//
		// json_valid() GUARDS THE WHOLE STATEMENT. The column is NOT NULL DEFAULT
		// '{}' (0005), but nothing has ever enforced that what is IN it parses —
		// and json_extract on a malformed document is a SQLite error, which would
		// fail this pass for every account because of one. A row nobody can read
		// is a row this pass has nothing to say about.
		res, err := tx.Exec(
			`UPDATE users
			    SET preferences = json_set(preferences, '$.'||?, ?)
			  WHERE json_valid(preferences)
			    AND json_extract(preferences, '$.'||?) = ?`,
			key, typeDialTop, key, typeDialWithdrawn)
		if err != nil {
			return fmt.Errorf("move %s off %d: %w", key, typeDialWithdrawn, err)
		}
		n, err := res.RowsAffected()
		if err != nil {
			return err
		}
		moved += int(n)
	}
	if moved > 0 {
		olog.Printf("[store] type dial: %d dial(s) moved from %d%% to %d%%", moved, typeDialWithdrawn, typeDialTop)
	}
	return nil
}
