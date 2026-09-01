package httpapi

// Staging and approval for standalone quotes (ROADMAP §24).
//
// Every import stages before it writes: nothing reaches the library until the
// pending queue is approved. staged_quotes hangs off staged_works with a NOT
// NULL foreign key, so a quote with no work could not be staged at all — and
// rather than making that column nullable (which breaks the dedupe UNIQUE, see
// 0028) a batch of standalone quotes gets ONE SYNTHETIC staged work to hang
// from. Grouping, dedupe, partial approval and discard then work untouched.
//
// The synthetic work is what the pending queue shows as the group header, so it
// carries a real title rather than an empty string: a queue row reading "" is
// indistinguishable from a parse failure.

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"tippani/internal/importer"
	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

const (
	// stagedKindQuotes is staged_works.kind for the synthetic group. 0023 made
	// that column app-validated with no CHECK precisely so a third kind would
	// cost nothing here.
	stagedKindQuotes = "quotes"
	// stagedQuotesTitle heads the group in the pending queue.
	stagedQuotesTitle = "Quotes"
)

// stageQuotesFile stages a parsed standalone-quote file. It mirrors stageBooks,
// minus the per-work loop: there is one group, always.
func (s *Server) stageQuotesFile(w http.ResponseWriter, r *http.Request, source, filename string,
	us []importer.Utterance) {

	olog.Tracef("[import] stage quotes source=%s file=%q quotes=%d", source, filename, len(us))
	uid := userID(r)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		codedError(w, r, olog.CodeImportStage, "stage quotes: begin tx", err)
		return
	}
	defer tx.Rollback()

	batchID, err := insertImportBatch(tx, uid, source, filename, nil)
	if err != nil {
		codedError(w, r, olog.CodeImportStage, "stage quotes: batch", err)
		return
	}
	workID, err := stageQuotesWork(tx, batchID)
	if err != nil {
		codedError(w, r, olog.CodeImportStage, "stage quotes: work", err)
		return
	}
	staged, err := stageUtterances(tx, workID, us)
	if err != nil {
		var ce importClientError
		if errors.As(err, &ce) {
			writeErr(w, http.StatusBadRequest, ce.msg)
		} else {
			codedError(w, r, olog.CodeImportStage, "stage quotes: rows", err)
		}
		return
	}
	if err := tx.Commit(); err != nil {
		codedError(w, r, olog.CodeImportStage, "stage quotes: commit", err)
		return
	}
	pending, err := s.pendingStagedCount(uid)
	if err != nil {
		olog.Warnf(olog.CodeImportRowScan, "[import] pending count after staging quotes: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"batch_id": batchID,
		"staged":   staged,
		"pending":  pending,
		"works": []stagedWorkPreview{{
			ID: workID, Kind: stagedKindQuotes, Title: stagedQuotesTitle, Staged: staged,
		}},
	})
}

// importCategory normalises a file's `category` binding into one of the three
// (0035), or refuses it.
//
// Empty is 'other', not an error: a file written before the boards existed named
// no category, and every line in it goes on meaning exactly what it meant. Case
// is folded because a file is hand-written as often as it is exported, and
// "Proverb" is the same answer as "proverb".
//
// An unknown value IS refused, and the refusal is an importClientError so it
// reaches the person as a 400 naming the bad word rather than as a 500 from the
// CHECK three steps later.
func importCategory(raw string) (string, error) {
	c := strings.ToLower(strings.TrimSpace(raw))
	if c == "" {
		return "other", nil
	}
	if !validQuoteCategory(c) {
		return "", importClientError{fmt.Sprintf("invalid category %q (expected %s)", raw, quoteCategoryList())}
	}
	return c, nil
}

// importQuoteKind normalises a file's `kind` binding (0053), and — when the file
// has none — reads it off the old fields the same way the 2.2.3 one-time pass
// reads them.
//
// THE FALLBACK IS THE POINT. Restoring a backup written before 0053 has to land
// where UPGRADING a live database lands, or the same library ends up in two
// different states depending on which route it took. The rule is the pass's rule:
// `medium` when it is one of the five words, then `category` for the two of its
// three values that were real answers, and nothing otherwise.
//
// 'other' IS NOT READ FROM `category`. 0035 defaulted every existing row to
// 'other' precisely so that nothing was reclassified, so 'other' there means
// "nobody has said" — reading it as a deliberate answer would invent a decision
// per row.
//
// An unknown `kind` IS refused, as an importClientError, so it reaches the person
// as a 400 naming the bad word rather than as a 500 from the CHECK three steps
// later. Same shape as importCategory, one column over.
//
// The mapping is written out twice — here and in onetime_2_2_3_quote_kind.go — and
// that is deliberate: the pass is a file to be DELETED once no instance is behind
// 2.2.3, and a shared helper would make the deletion a refactor.
func importQuoteKind(raw, medium, category string) (string, error) {
	if k := strings.ToLower(strings.TrimSpace(raw)); k != "" {
		if !validQuoteKind(k) {
			return "", importClientError{fmt.Sprintf("invalid kind %q (expected %s)", raw, quoteKindList())}
		}
		return k, nil
	}
	if m := strings.ToLower(strings.TrimSpace(medium)); m != "" && validQuoteKind(m) {
		return m, nil
	}
	switch strings.ToLower(strings.TrimSpace(category)) {
	case "proverb":
		return "proverb", nil
	case "speech":
		return "speech", nil
	}
	return "", nil
}

// stageQuotesWork creates (or reuses) the batch's one synthetic group.
func stageQuotesWork(tx *sql.Tx, batchID int64) (int64, error) {
	var id int64
	err := tx.QueryRow(
		`SELECT id FROM staged_works WHERE batch_id = ? AND kind = ? LIMIT 1`,
		batchID, stagedKindQuotes).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, err
	}
	res, err := tx.Exec(
		`INSERT INTO staged_works (batch_id, kind, title) VALUES (?, ?, ?)`,
		batchID, stagedKindQuotes, stagedQuotesTitle)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// stageUtterances writes the parsed rows into the queue.
//
// THE HASH IS UtteranceDedupeHash, NOT DedupeHash, and that is the one thing in
// here that cannot be inferred from the surrounding code. Everywhere else in
// this app the dedupe hash excludes the locator, "so the same passage recorded
// twice with different page numbers collapses to one row". §24 inverts it: the
// occasion IS a locator and it DISCRIMINATES, because the same words said on
// two occasions are two quotes. Using the plain hash here would collapse a
// speaker's repeated line across every speech they gave it in — and staging
// would then show a count the live table would never have produced.
func stageUtterances(tx *sql.Tx, workID int64, us []importer.Utterance) (int, error) {
	const q = `
		INSERT OR IGNORE INTO staged_quotes
		  (staged_work_id, quote, note, color, favorite, tags, noted_at,
		   speaker, occasion, occasion_date, place, medium, kind,
		   category, language, translation,
		   region, recipient, work_title, locator, occasion_circa, dedupe_hash,
		   anthology, anthology_note, anthology_intro)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	staged := 0
	for _, u := range us {
		color := u.Color
		if color == "" {
			color = "yellow" // a file that named no colour leaves it to the default
		}
		if !validColor(color) {
			return 0, importClientError{fmt.Sprintf("invalid color %q", color)}
		}
		// 0035. Refused HERE rather than at approval, and that is the point of
		// checking it at all: a file naming a category that does not exist is a
		// mistake in the file, and the queue is where a mistake in the file is
		// still cheap to fix. Approving it later would be a 500 from the CHECK.
		category, err := importCategory(u.Category)
		if err != nil {
			return 0, err
		}
		// 0053, refused here for the same reason the category is: a bad word in a
		// file is cheap to fix while the file is still in the queue.
		kind, err := importQuoteKind(u.Kind, u.Medium, u.Category)
		if err != nil {
			return 0, err
		}
		text := u.Quote
		if text == "" {
			text = u.Note
		}
		hash := store.UtteranceDedupeHash(text, u.Speaker, u.Occasion, u.OccasionDate)
		res, err := tx.Exec(q, workID, nullable(u.Quote), nullable(u.Note), color, u.Favorite,
			joinTags(u.Tags), nullable(u.NotedAt),
			strings.TrimSpace(u.Speaker), strings.TrimSpace(u.Occasion),
			strings.TrimSpace(u.OccasionDate), strings.TrimSpace(u.Place), strings.TrimSpace(u.Medium), kind,
			category, strings.TrimSpace(u.Language), strings.TrimSpace(u.Translation),
			// 0047. Trimmed like their neighbours, and passed as plain values — these
			// are NOT NULL DEFAULT columns, so nullable() would send a NULL where the
			// default belongs. None of them is in the hash: they LOCATE or DESCRIBE,
			// and recipient in particular is the field most likely to be refined after
			// the fact, which folding it in would turn into a forked duplicate on the
			// next import of the same file (store.UtteranceDedupeHash).
			strings.TrimSpace(u.Region), strings.TrimSpace(u.Recipient),
			strings.TrimSpace(u.WorkTitle), strings.TrimSpace(u.Locator), u.OccasionCirca,
			hash,
			// 0043. Empty for every file that is not an anthology export, which is
			// why these ride on the same row rather than needing a table: a staged
			// quote either names an anthology or it does not.
			strings.TrimSpace(u.Anthology), trimProse(u.AnthologyNote), trimProse(u.AnthologyIntro))
		if err != nil {
			return 0, err
		}
		if n, _ := res.RowsAffected(); n > 0 {
			staged++
		}
		// A collision is a file naming the same line on the same occasion twice.
		// It is dropped rather than enriched: unlike an annotation, there is no
		// parent whose later block might carry a locator worth folding in.
	}
	return staged, nil
}

// writeUtterances is the approval-time write. It returns how many rows were
// added; a collision with a quote already saved is a skip, matching the other
// two kinds, and the caller reports it as such.
//
// The occasion date is validated here rather than at parse time, because the
// file is not the authority on it — normalizePartialDate is, and it is the same
// validator the CRUD endpoint uses. A date the calendar refuses (30 February)
// is dropped rather than failing the whole approval: the quote is the thing
// worth keeping, and a refused date is recoverable by hand.
func writeUtterances(tx *sql.Tx, uid int64, us []importer.Utterance, seps metadata.CreditSeps) (int, error) {
	added := 0
	// One id reservation for the batch (idBlock, id_floor.go).
	ids := newIDBlock(tx, "utterances", len(us))
	// EVERY QUOTE IS FILED (0036). Without this the row lands with a NULL board
	// and appears on no shelf at all — visible only under All quotes, counted in
	// no board's total, and looking for all the world like an import that silently
	// dropped half the file. Naming a board IN the file is the piece still to come;
	// the default board is the right answer when the file names none.
	boardID, err := defaultBoardID(tx, uid)
	if err != nil {
		return added, err
	}
	for _, u := range us {
		color := u.Color
		if color == "" {
			color = "yellow"
		}
		if !validColor(color) {
			return added, importClientError{fmt.Sprintf("invalid color %q", color)}
		}
		category, err := importCategory(u.Category)
		if err != nil {
			return added, err
		}
		// 0053. The same normalisation the staging path runs, so an approve and a
		// direct import of one file land on the same value.
		kind, err := importQuoteKind(u.Kind, u.Medium, u.Category)
		if err != nil {
			return added, err
		}
		occDate := strings.TrimSpace(u.OccasionDate)
		if occDate != "" {
			if msg := normalizePartialDate("occasion date", &occDate); msg != "" {
				olog.Warnf(olog.CodeImportRowScan,
					"[import] dropping unusable occasion date %q on an approved quote: %s", u.OccasionDate, msg)
				occDate = ""
			}
		}
		text := u.Quote
		if text == "" {
			text = u.Note
		}
		if strings.TrimSpace(text) == "" {
			continue // a quote with no words is not a quote (0026's CHECK agrees)
		}
		speaker := strings.TrimSpace(u.Speaker)
		occasion := strings.TrimSpace(u.Occasion)
		hash := store.UtteranceDedupeHash(text, speaker, occasion, occDate)

		id, err := ids.take()
		if err != nil {
			return added, err
		}
		res, err := tx.Exec(`
			INSERT OR IGNORE INTO utterances
			  (id, user_id, quote, note, color, favorite, speaker, occasion, occasion_date,
			   place, medium, kind, category, language, translation,
			   region, recipient, work_title, locator, occasion_circa,
			   board_id, source, dedupe_hash, noted_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'import', ?, ?)`,
			id, uid, strings.TrimSpace(u.Quote), nullable(u.Note), color, u.Favorite,
			speaker, occasion, occDate,
			strings.TrimSpace(u.Place), strings.TrimSpace(u.Medium), kind,
			category, strings.TrimSpace(u.Language), strings.TrimSpace(u.Translation),
			// 0047. Plain trimmed values, NOT NULL DEFAULT columns — see stageUtterances.
			// A collision here is a skip (the file is already in the library), so unlike
			// the book and film paths there is no enrichment arm to keep in step.
			strings.TrimSpace(u.Region), strings.TrimSpace(u.Recipient),
			strings.TrimSpace(u.WorkTitle), strings.TrimSpace(u.Locator), u.OccasionCirca,
			boardID, hash, nullable(u.NotedAt))
		if err != nil {
			return added, err
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			// Already saved — a re-import of the same file. The QUOTE is a skip, and
			// the anthology entry is NOT: re-importing an anthology whose quotes are
			// already in the library is the ordinary case (it is how you get an
			// anthology back after deleting it), and skipping the entry too would
			// rebuild an empty document. So find the row this collided with and file
			// that one instead.
			if u.Anthology != "" {
				existing, err := utteranceByHash(tx, uid, hash)
				if err != nil {
					return added, err
				}
				if existing != 0 {
					if err := fileInAnthology(tx, uid, u, existing); err != nil {
						return added, err
					}
				}
			}
			continue
		}
		added++
		if err := store.SyncQuotePerson(tx, uid, store.KindUtterance, id, seps); err != nil {
			return added, err
		}
		if err := setTags(tx, "utterance", uid, id, u.Tags); err != nil {
			return added, err
		}
		if err := fileInAnthology(tx, uid, u, id); err != nil {
			return added, err
		}
	}
	return added, nil
}

// utteranceByHash finds the quote an INSERT OR IGNORE collided with, so a
// re-imported anthology can point at the copy already in the library rather than
// at the id it did not get to use.
//
// Scoped by user AND by hash because the UNIQUE index is per user: two readers can
// each hold the same line, and this must find the caller's.
func utteranceByHash(tx *sql.Tx, uid int64, hash string) (int64, error) {
	var id int64
	err := tx.QueryRow(`SELECT id FROM utterances WHERE user_id = ? AND dedupe_hash = ?`, uid, hash).Scan(&id)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return id, err
}

// fileInAnthology puts one imported quote into the anthology its file named, in
// the order the file listed it.
//
// A no-op for every import that is not an anthology, which is every import until
// 0043 — the two fields are empty on a quotes file, a Kindle clippings file and a
// book export alike. The title is resolved by NAME, find-or-create, which is the
// same trade boardByName makes and for the same stated reason: a typo makes a
// second anthology, which is visible in the list and fixable by renaming, whereas
// a refused import is a wall.
func fileInAnthology(tx *sql.Tx, uid int64, u importer.Utterance, itemID int64) error {
	if strings.TrimSpace(u.Anthology) == "" {
		return nil
	}
	anthologyID, made, err := anthologyByName(tx, uid, u.Anthology)
	if err != nil {
		return err
	}
	// THE INTRODUCTION IS WRITTEN ONLY ON THE ANTHOLOGY THIS IMPORT MADE. Importing
	// into one that already exists — the same file twice, or a second file naming the
	// same title — must not overwrite prose the reader has edited since. That is the
	// same rule "fill gaps" follows for a work's metadata: write what is empty and
	// touch nothing that is not.
	if made && trimProse(u.AnthologyIntro) != "" {
		if _, err := tx.Exec(`UPDATE anthologies SET intro = ? WHERE id = ? AND intro = ''`,
			trimProse(u.AnthologyIntro), anthologyID); err != nil {
			return err
		}
	}
	// Every imported quote is an utterance, whatever it was when it was exported —
	// the file carries no book, so a re-imported highlight comes back as a
	// standalone quote. That loss is stated in the importer's header; here it is
	// simply the kind.
	return addAnthologyEntry(tx, anthologyID, kindUtterance, itemID, u.AnthologyNote)
}
