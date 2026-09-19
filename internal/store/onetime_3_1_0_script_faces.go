package store

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"tippani/internal/olog"
)

// 3.1.0: the per-SCRIPT faces stop being settable, so anyone holding one is let
// go of it rather than left wearing a choice they can no longer reach.
//
// RETIRING THIS FILE. Delete it. Nothing else mentions it — onetime.go iterates
// what registered, and the row it wrote in one_time_passes stays behind as the
// record that it ran. Delete it once no supported instance can still be upgrading
// from before 3.1.0.
//
// WHAT WENT AND WHY. Settings → Language and font used to carry two rows called
// Bengali and Devanagari: one face per SCRIPT, for quotes in it. That was this
// app's first attempt at "my German should be a serif and my English should not",
// and it cannot answer that question — German and Swedish are one script, and a
// script cannot tell a quote from a button. Per-LANGUAGE quote faces replaced it,
// read from the language table where a quote's language is actually defined. The
// two roles remain inside the font stacks, because a Bengali letter in a
// Latin-faced label still has to land on something; what they no longer have is a
// control.
//
// AND A PREFERENCE WITH NO CONTROL IS A TRAP, which is the whole reason for this
// file. An account that chose a Bengali face before this release would go on
// rendering every Bengali glyph in it for ever, with nothing on any screen to say
// where that came from and nothing anywhere to change it. That is worse than the
// feature's absence: it is the app remembering a decision the reader can no
// longer make. So the four fields are cleared once, and every account lands back
// on the bundled faces — which are what a fresh install has always used, and what
// the per-language panel now sits on top of.
//
// A CLEAR RATHER THAN A CARRY-OVER, and the alternative was real: the old script
// face could have been written into the new per-language table for every language
// of that script. It is rejected because it would invent decisions nobody made —
// a reader who set a Bengali face said nothing about Assamese — and because the
// new setting is per language precisely so that it is asked per language.
//
// FRESH INSTALLS DO NOTHING AND SAY SO. A database created after this release has
// never been able to store one; it records the pass and is not asked again.

func init() {
	RegisterOneTimePass(OneTimePass{
		Version: "3.1.0",
		Name:    "3.1.0-script-faces-cleared",
		Why:     "the per-script faces have no control any more; clear them so nobody wears a choice they cannot reach",
		Run:     clearScriptFaces,
	})
}

// The fields, spelled out rather than derived, for the reason the type-dial pass
// gives: a one-time pass is a statement about a MOMENT — what 3.1.0 did — and has
// to go on doing exactly that however the font preferences change later.
var scriptFaceKeys = []string{
	"fontBengali", "fontDevanagari",
	"fontBengaliStyle", "fontDevanagariStyle",
}

// And the same two roles inside the per-UI-language overlay, which is a JSON
// object keyed by locale with a role table under each. `json_remove` on a path
// that is not there is a no-op, so this needs no test for presence.
var scriptFaceOverlayRoles = []string{"bengali", "devanagari", "bengaliStyle", "devanagariStyle"}

func clearScriptFaces(tx *sql.Tx, env OneTimeEnv) error {
	if env.FreshInstall {
		return nil
	}
	cleared := 0
	for _, key := range scriptFaceKeys {
		// ONLY THE ROWS THAT HOLD ONE, so an account that never chose a script
		// face is not rewritten and does not look edited afterwards.
		//
		// json_valid() GUARDS THE WHOLE STATEMENT, as it does in every pass that
		// touches this column: json_extract on a malformed document is a SQLite
		// error, which would fail the pass for every account because of one. A row
		// nobody can read is a row this pass has nothing to say about.
		res, err := tx.Exec(
			`UPDATE users
			    SET preferences = json_remove(preferences, '$.'||?)
			  WHERE json_valid(preferences)
			    AND json_extract(preferences, '$.'||?) IS NOT NULL`,
			key, key)
		if err != nil {
			return fmt.Errorf("clear %s: %w", key, err)
		}
		n, err := res.RowsAffected()
		if err != nil {
			return err
		}
		cleared += int(n)
	}
	// THE OVERLAY IS PER LOCALE, so the path cannot be written out: every key of
	// `fontsByLocale` gets the same four roles removed. It is a string column
	// holding JSON rather than a JSON column, which is why it is read, edited and
	// written back rather than reached into with one json_remove.
	rows, err := tx.Query(`SELECT id, json_extract(preferences, '$.fontsByLocale')
	                         FROM users
	                        WHERE json_valid(preferences)
	                          AND json_extract(preferences, '$.fontsByLocale') IS NOT NULL`)
	if err != nil {
		return fmt.Errorf("read per-language faces: %w", err)
	}
	type edit struct {
		id   int64
		blob string
	}
	var edits []edit
	for rows.Next() {
		var id int64
		var blob sql.NullString
		if err := rows.Scan(&id, &blob); err != nil {
			rows.Close()
			return err
		}
		if blob.Valid && blob.String != "" {
			edits = append(edits, edit{id: id, blob: blob.String})
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	for _, e := range edits {
		next, changed := stripOverlayRoles(e.blob, scriptFaceOverlayRoles)
		if !changed {
			continue
		}
		if _, err := tx.Exec(
			`UPDATE users SET preferences = json_set(preferences, '$.fontsByLocale', ?) WHERE id = ?`,
			next, e.id); err != nil {
			return fmt.Errorf("clear per-language script faces for user %d: %w", e.id, err)
		}
		cleared++
	}
	if cleared > 0 {
		olog.Printf("[store] script faces: %d stored choice(s) cleared; the bundled faces are back", cleared)
	}
	return nil
}

// stripOverlayRoles removes a set of role keys from every locale in the overlay
// blob, and says whether it changed anything.
//
// IT IS PURE AND IT IS HERE, not in a shared helper: one-time passes are deleted
// as a file, and a helper in another file is exactly what makes that deletion
// stop being a deletion. A blob that does not parse is returned untouched — the
// client normalises on write, and a value that got past it is not worth failing
// an upgrade over.
func stripOverlayRoles(blob string, roles []string) (string, bool) {
	var byLocale map[string]map[string]any
	if err := json.Unmarshal([]byte(blob), &byLocale); err != nil {
		return blob, false
	}
	changed := false
	for locale, table := range byLocale {
		for _, role := range roles {
			if _, ok := table[role]; ok {
				delete(table, role)
				changed = true
			}
		}
		// A locale left with nothing of its own is not an empty table, it is a
		// locale with no opinion — and an empty table read back is a locale that
		// looks configured.
		if len(table) == 0 {
			delete(byLocale, locale)
		}
	}
	if !changed {
		return blob, false
	}
	// An overlay with nothing left in it is cleared rather than written as "{}",
	// which is what every other writer of this field does.
	if len(byLocale) == 0 {
		return "", true
	}
	out, err := json.Marshal(byLocale)
	if err != nil {
		return blob, false
	}
	return string(out), true
}
