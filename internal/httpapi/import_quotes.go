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
		   speaker, occasion, occasion_date, place, medium,
		   category, language, translation, dedupe_hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
		text := u.Quote
		if text == "" {
			text = u.Note
		}
		hash := store.UtteranceDedupeHash(text, u.Speaker, u.Occasion, u.OccasionDate)
		res, err := tx.Exec(q, workID, nullable(u.Quote), nullable(u.Note), color, u.Favorite,
			joinTags(u.Tags), nullable(u.NotedAt),
			strings.TrimSpace(u.Speaker), strings.TrimSpace(u.Occasion),
			strings.TrimSpace(u.OccasionDate), strings.TrimSpace(u.Place), strings.TrimSpace(u.Medium),
			category, strings.TrimSpace(u.Language), strings.TrimSpace(u.Translation),
			hash)
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
func writeUtterances(tx *sql.Tx, uid int64, us []importer.Utterance) (int, error) {
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
			   place, medium, category, language, translation, board_id, source, dedupe_hash, noted_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'import', ?, ?)`,
			id, uid, strings.TrimSpace(u.Quote), nullable(u.Note), color, u.Favorite,
			speaker, occasion, occDate,
			strings.TrimSpace(u.Place), strings.TrimSpace(u.Medium),
			category, strings.TrimSpace(u.Language), strings.TrimSpace(u.Translation),
			boardID, hash, nullable(u.NotedAt))
		if err != nil {
			return added, err
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			continue // already saved — a re-import of the same file
		}
		added++
		if err := setTags(tx, "utterance", uid, id, u.Tags); err != nil {
			return added, err
		}
	}
	return added, nil
}
