package store

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
)

// typographicFold maps smart punctuation to its ASCII form so the same passage
// synced through different tools (Bookcision emits ’ and –, markdown exports
// often use ' and -) hashes identically.
var typographicFold = strings.NewReplacer(
	"‘", "'", "’", "'", "‚", "'", "‛", "'", // ‘ ’ ‚ ‛
	"“", `"`, "”", `"`, "„", `"`, "‟", `"`, // “ ” „ ‟
	"«", `"`, "»", `"`, // « »
	"‐", "-", "‑", "-", "‒", "-", "–", "-", "—", "-", "−", "-", // ‐ ‑ ‒ – — −
	"…", "...", // …
)

// DedupeHash is the dedupe rule shared by annotations and dialogues:
// sha256(lower(collapse_ws(fold_punct(text)))). The source *locator* — chapter,
// location, timestamp — is deliberately excluded, so the same passage recorded
// twice with different page numbers collapses to one row and a re-import of a
// growing `My Clippings.txt` stays a no-op.
func DedupeHash(text string) string {
	norm := typographicFold.Replace(text)
	norm = strings.ToLower(strings.Join(strings.Fields(norm), " "))
	sum := sha256.Sum256([]byte(norm))
	return hex.EncodeToString(sum[:])
}

// DialogueDedupeHash is DedupeHash for a show's line: the text, qualified by the
// episode it is spoken in.
//
// Excluding the locator is right for a book, because a book is one work and a
// passage in it is one passage. It is wrong for a series, because a series is a
// single `movies` row while a line is located *by episode* — so "the same text
// twice in one work" is not a duplicate there, it is two different quotes.
// Television is full of them: a catchphrase recurs by design, and before this
// only the first occurrence could be stored (the rest hit
// `UNIQUE (movie_id, dedupe_hash)` and were silently folded into it, or worse,
// relabelled it with the newer episode via the importer's COALESCE enrichment).
//
// Season and episode still are not a *locator* in the excluded sense: the
// timestamp is, and it stays out. This is the same distinction the export makes
// by writing the episode as a binding on the line rather than as its position.
//
// When both are nil the result is byte-identical to DedupeHash(text). That is
// load-bearing: films and un-episoded lines keep the hashes already on disk, so
// nothing needs rewriting for them and film dedupe is untouched. Only rows that
// carry an episode hash differently, and BackfillDialogueHashes migrates those.
func DialogueDedupeHash(text string, season, episode *int) string {
	if season == nil && episode == nil {
		return DedupeHash(text)
	}
	// \x1f (unit separator) cannot occur in normalized quote text, so no line can
	// collide with another by spelling its own episode suffix.
	var b strings.Builder
	b.WriteString(typographicFold.Replace(text))
	b.WriteString("\x1f")
	if season != nil {
		b.WriteString("s")
		b.WriteString(strconv.Itoa(*season))
	}
	if episode != nil {
		b.WriteString("e")
		b.WriteString(strconv.Itoa(*episode))
	}
	norm := strings.ToLower(strings.Join(strings.Fields(b.String()), " "))
	sum := sha256.Sum256([]byte(norm))
	return hex.EncodeToString(sum[:])
}

// BackfillDialogueHashes rewrites dedupe_hash wherever a row carries an episode
// and still holds the old text-only hash — the rows written by 1.3.0, which added
// season/episode but kept hashing the line alone.
//
// Left alone, such a row is a latent duplicate: the next import of the same file
// recomputes the qualified hash, misses the stored one, and inserts a second copy.
//
// Runs from Migrate rather than from a migration file because SQLite has no
// sha256 — the value can only be computed in Go. It is deliberately **unguarded
// and re-run on every Migrate** instead of being gated behind a settings flag:
// that makes it idempotent and self-healing on all four Migrate paths, including
// the two repair paths that copy base tables into a fresh database and could
// otherwise carry stale hashes back in past a one-shot flag. The scan touches
// only episoded rows and costs orders of magnitude less than the CheckIntegrity
// quick_check that already runs at every boot.
//
// No UNIQUE violation is possible: the qualified hash is strictly more
// discriminating than the one it replaces, and its \x1f marker means it can never
// equal an un-episoded row's hash.
func (s *Store) BackfillDialogueHashes() error {
	for _, t := range []struct{ sel, upd string }{
		{
			`SELECT id, quote, season, episode, dedupe_hash FROM dialogues
			  WHERE season IS NOT NULL OR episode IS NOT NULL`,
			`UPDATE dialogues SET dedupe_hash = ? WHERE id = ?`,
		},
		{
			// Staging mirrors the live rule, so it needs the same repair. Its text is
			// the quote or, for a note-only row, the note — as staged_quotes writes it.
			`SELECT id, COALESCE(NULLIF(quote, ''), note, ''), season, episode, dedupe_hash
			   FROM staged_quotes WHERE season IS NOT NULL OR episode IS NOT NULL`,
			`UPDATE staged_quotes SET dedupe_hash = ? WHERE id = ?`,
		},
	} {
		type pending struct {
			id   int64
			hash string
		}
		// Read the whole set before writing any of it: updating while a Query is
		// still open on the same small pool is the self-deadlock the write handlers
		// already take care to avoid.
		var todo []pending
		rows, err := s.DB.Query(t.sel)
		if err != nil {
			return fmt.Errorf("backfill dialogue hashes: %w", err)
		}
		for rows.Next() {
			var (
				id            int64
				text, stored  string
				season, episo *int
			)
			if err := rows.Scan(&id, &text, &season, &episo, &stored); err != nil {
				rows.Close()
				return fmt.Errorf("backfill dialogue hashes: %w", err)
			}
			if want := DialogueDedupeHash(text, season, episo); want != stored {
				todo = append(todo, pending{id: id, hash: want})
			}
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return fmt.Errorf("backfill dialogue hashes: %w", err)
		}
		rows.Close()

		for _, p := range todo {
			if _, err := s.DB.Exec(t.upd, p.hash, p.id); err != nil {
				return fmt.Errorf("backfill dialogue hashes: %w", err)
			}
		}
	}
	return nil
}
