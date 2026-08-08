package store

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"

	"tippani/internal/olog"
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
	sum := sha256.Sum256([]byte(normalizeQuoteText(text)))
	return hex.EncodeToString(sum[:])
}

// normalizeQuoteText is what "the same words" means across every hash here:
// typographic punctuation folded, case dropped, and runs of whitespace
// collapsed to single spaces with none at either end.
//
// It exists as a function because the alternative — normalising after joining a
// field onto the text — puts the separator inside the run being collapsed, and
// then a trailing space in one field changes the hash of the whole. That was a
// live bug in DialogueDedupeHash and a caught-in-review one in
// UtteranceDedupeHash. Normalise each field, THEN join.
func normalizeQuoteText(text string) string {
	return strings.ToLower(strings.Join(strings.Fields(typographicFold.Replace(text)), " "))
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
	// THE TEXT IS NORMALISED BEFORE THE SUFFIX IS APPENDED, not after. Running
	// strings.Fields over the JOINED string made a space beside the separator a
	// token boundary, so a line stored as "hello " hashed differently from the
	// same line stored as "hello" — the one thing normalisation exists to
	// prevent, and invisible because both hashes are equally valid-looking.
	// UtteranceDedupeHash was written this way from the start after the same bug
	// was caught there by its own test.
	//
	// \x1f (unit separator) cannot occur in normalized quote text, so no line can
	// collide with another by spelling its own episode suffix.
	var b strings.Builder
	b.WriteString(normalizeQuoteText(text))
	b.WriteString("\x1f")
	if season != nil {
		b.WriteString("s")
		b.WriteString(strconv.Itoa(*season))
	}
	if episode != nil {
		b.WriteString("e")
		b.WriteString(strconv.Itoa(*episode))
	}
	sum := sha256.Sum256([]byte(b.String()))
	return hex.EncodeToString(sum[:])
}

// UtteranceDedupeHash is the dedupe rule for a quote that belongs to no book and
// no film (ROADMAP §24): the text, qualified by the OCCASION it was said on.
//
// This is the third rule, and it sits at the far end of the same argument the
// first two make. For a book, excluding the locator is right: a book is one
// work, a passage in it is one passage, and the same highlight re-synced with a
// different page number must collapse. For a series it is wrong, because a
// series is one `movies` row while a line is located by episode — so
// DialogueDedupeHash folds the episode in. For an utterance the roadmap states
// it outright: "the occasion is a locator, and it discriminates. The same words
// said on two occasions are two quotes, the way the same line in two episodes is
// two quotes."
//
// WHICH FIELDS DISCRIMINATE, AND WHY NOT ALL OF THEM. The occasion has five
// columns and only three are folded in: speaker, occasion and occasion_date.
// place and medium stay out.
//
// The cut is the same one DialogueDedupeHash draws when it says "season and
// episode still are not a locator in the excluded sense: the timestamp is, and
// it stays out". Who said it, on what occasion, and when identify the occasion.
// Where exactly, and through what, describe it — and they are the fields most
// often refined after the fact, from "Burma" to "Rangoon", from "radio" to
// "Azad Hind Radio". Folding those in would mean the refinement forks a
// duplicate on the next import of the same file rather than enriching the row
// that is already there.
//
// It is a real trade-off, not a free one: the same speaker delivering the same
// line at two rallies on the same date in different places collapses to one
// quote. That is rarer than the typo, and it is recoverable by editing the
// occasion, whereas a silently forked duplicate is the failure DialogueDedupeHash
// was written to stop.
//
// When all three are empty the result is byte-identical to DedupeHash(text).
// That is deliberate rather than incidental: a proverb, or a line somebody
// remembers without knowing who said it, has no occasion to be qualified by, and
// two copies of the same unattributed words are the same quote.
func UtteranceDedupeHash(text, speaker, occasion, occasionDate string) string {
	if strings.TrimSpace(speaker) == "" && strings.TrimSpace(occasion) == "" && strings.TrimSpace(occasionDate) == "" {
		return DedupeHash(text)
	}
	// Each field is normalised BEFORE the fields are joined, not after — see
	// normalizeQuoteText, which both hashes now share.
	//
	// Normalising the JOINED string is the bug: strings.Fields run over it treats
	// a space either side of the \x1f as a token boundary, making
	// "freedom\x1fsubhas" and "freedom \x1f subhas" different strings, so a
	// trailing space in a form field would produce a second copy of the quote on
	// the next import. DialogueDedupeHash was written that way and carried the
	// same latent fault until it was corrected.
	//
	// \x1f (unit separator) survives normalisation because it is not whitespace,
	// cannot occur in typed text, and so keeps the fields from bleeding into each
	// other: ("ab","c") and ("a","bc") stay distinct, and a quote whose text
	// happens to name a speaker cannot forge one that genuinely has that speaker.
	joined := strings.Join([]string{
		normalizeQuoteText(text),
		normalizeQuoteText(speaker),
		normalizeQuoteText(occasion),
		normalizeQuoteText(occasionDate),
	}, "\x1f")
	sum := sha256.Sum256([]byte(joined))
	return hex.EncodeToString(sum[:])
}

// DedupeHashOfJoined hashes an ALREADY-NORMALISED string. Exported for the
// tests that pin an exact expected value, so they can state what the hash is
// over rather than restating the hashing itself and passing whatever it does.
func DedupeHashOfJoined(normalized string) string {
	sum := sha256.Sum256([]byte(normalized))
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
// A UNIQUE VIOLATION IS NOW POSSIBLE, and it is handled per row rather than
// allowed to fail the boot. The original backfill could not collide: it replaced
// a text-only hash with a strictly MORE discriminating one. Fixing the
// whitespace bug above moves in the other direction — two rows stored as
// "hello " and "hello" in one work hashed differently before and hash the same
// now, which is the correction, and which UNIQUE (movie_id, dedupe_hash) then
// refuses.
//
// This runs from Migrate, so a returned error means the application DOES NOT
// START. Refusing to boot over a pair of near-identical quotes would be a far
// worse outcome than leaving one of them on its old hash, so a failed row is
// logged and skipped. The consequence of skipping is bounded and visible: that
// row can still be duplicated by a future import, exactly as it could before.
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
				// Almost certainly the UNIQUE — see the note above on why this is
				// not fatal. Anything else is equally not worth refusing to boot
				// over, and the row keeps a hash that was already working.
				olog.Alertf("[store] quote %d kept its previous dedupe hash: %v", p.id, err)
			}
		}
	}
	return nil
}
