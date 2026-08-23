package store

import (
	"fmt"
	"strings"

	"tippani/internal/olog"
)

// The two keys a cast row (0048) is looked up by, and the repair that keeps one
// of them honest.
//
// A work's cast is a table rather than a blob because a provider and a reader
// both own facts about it, and provenance has to be stored per row. Two of the
// three key columns are computed here rather than in SQL, and 0048's header
// argues why at length; the short version is that SQLite's lower() knows only
// ASCII, so any fold richer than that can only be agreed on in Go.

// castKeySep is the unit separator that joins a character to its actor inside a
// provider key. A control character rather than a printable one because both
// halves are free text a provider chose: a comma, a slash or a pipe are all
// things that turn up inside a real credit, and any of them would let two
// different pairs produce one key.
const castKeySep = "\x1f"

// CastKey is how two spellings of one name become one row: typographic
// punctuation folded, whitespace collapsed, case dropped. Exactly the
// normalisation the dedupe hashes use on a quote's text (hash.go), reused rather
// than restated so a curly apostrophe means the same thing in a character's name
// as it does in the line she speaks.
//
// It is the READER-FACING key — what the dialogue autofill matches a typed
// character against, and what the API calls a duplicate. "Eowyn", "eowyn " and
// "EOWYN" are one person to everybody except a byte comparison.
func CastKey(s string) string {
	return normalizeQuoteText(s)
}

// ProviderKey identifies one entry in a provider's cast list so that the next
// fetch can find the row that entry seeded. Trimmed and joined, NEVER FOLDED.
//
// Three reasons, all pointing the same way: TMDB does not change its own casing
// between fetches, so folding buys nothing; folding would collide a genuine
// recast that differs only in case with the row it is not; and SQLite's lower()
// has no Unicode tables, so a folded key cannot be computed identically in the
// migration's backfill and here — and a key that disagrees with itself across
// the two is worse than no key at all.
//
// Both halves may be empty. A provider that lists a person with no role yields
// character == "", which is a row this app stores and refuses to let a reader
// create; a key of separator alone means neither half was given, and the merge
// skips it rather than storing nothing under a key that would collide with the
// next nothing.
func ProviderKey(character, actor string) string {
	return strings.TrimSpace(character) + castKeySep + strings.TrimSpace(actor)
}

// BackfillCastKeys re-folds character_key and actor_key wherever they disagree
// with CastKey — which on an upgraded database is every row 0048's backfill
// wrote whose name contains anything outside ASCII, because that INSERT could
// only reach for SQLite's lower().
//
// Left alone such a row is invisible to its own lookups: a reader typing
// "Éowyn" into a quote gets no actor, because the stored key still reads
// "Éowyn" and the computed one reads "éowyn".
//
// Runs from Migrate rather than from a migration file for BackfillDialogueHashes'
// reason, and is deliberately UNGUARDED AND RE-RUN ON EVERY MIGRATE for its
// second reason: that is what makes it idempotent, and what heals a key left
// stale by a later rename sweep over the same column.
//
// AND IT IS WHAT EVENTUALLY HEALS A REPAIR, one boot late rather than in place.
// The claim here used to be that re-running "survives the repair paths that copy
// base tables into a fresh database"; it does not run over the copied rows at all.
// Recover() (repair.go) calls Migrate() on the EMPTY temp database and only then
// runs `INSERT INTO main SELECT * FROM old`, so this pass sees nothing and the
// copied keys land exactly as the corrupt file held them. The next boot's Migrate
// re-folds them. That is a real difference for the window in between — the autofill
// misses those rows until the app is next started — and it is stated rather than
// papered over, because "unguarded, so a repair is covered" is the kind of claim
// that stops anybody looking. (Reset() is the other repair path and copies nothing
// at all, so there is nothing there to fold.)
//
// A UNIQUE VIOLATION IS POSSIBLE and is handled per row rather than allowed to
// fail the boot. Folding moves in the direction of FEWER distinct keys, so two
// rows stored as "Éowyn" and "éowyn" on one work — two entries a provider
// genuinely can list — collide on the pair unique the moment they agree. This
// runs from Migrate, so a returned error means the application DOES NOT START;
// refusing to boot over a pair of near-identical cast rows would be far worse
// than leaving one of them on its old key. The consequence of skipping is
// bounded and visible: that one row goes on being missed by the autofill,
// exactly as it was before.
func (s *Store) BackfillCastKeys() error {
	type pending struct {
		id                int64
		charKey, actorKey string
	}
	// Read the whole set before writing any of it: updating while a Query is
	// still open on the same small pool is the self-deadlock the write handlers
	// already take care to avoid.
	var todo []pending
	rows, err := s.DB.Query(`SELECT id, character, character_key, actor, actor_key FROM work_cast`)
	if err != nil {
		return fmt.Errorf("backfill cast keys: %w", err)
	}
	for rows.Next() {
		var (
			id                 int64
			character, charKey string
			actor, actorKey    string
		)
		if err := rows.Scan(&id, &character, &charKey, &actor, &actorKey); err != nil {
			rows.Close()
			return fmt.Errorf("backfill cast keys: %w", err)
		}
		wantChar, wantActor := CastKey(character), CastKey(actor)
		if wantChar != charKey || wantActor != actorKey {
			todo = append(todo, pending{id: id, charKey: wantChar, actorKey: wantActor})
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return fmt.Errorf("backfill cast keys: %w", err)
	}
	rows.Close()

	for _, p := range todo {
		if _, err := s.DB.Exec(
			`UPDATE work_cast SET character_key = ?, actor_key = ? WHERE id = ?`,
			p.charKey, p.actorKey, p.id); err != nil {
			// Almost certainly the pair unique — see the note above on why this
			// is not fatal. Anything else is equally not worth refusing to boot
			// over, and the row keeps keys that were already being used.
			olog.Warnf(olog.CodeCastKeyFold,
				"[store] cast row %d kept its previous lookup keys: %v", p.id, err)
		}
	}
	return nil
}
