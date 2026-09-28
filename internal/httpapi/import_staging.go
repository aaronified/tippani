package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"tippani/internal/importer"
	"tippani/internal/jobs"
	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// Import staging (ROADMAP 1.2.0). A file import parses into a holding area and
// stays there — indefinitely, across sessions, books and films mixed together —
// until it is explicitly okayed. Okaying is itself a bulk action.
//
// The shape of the flow:
//
//	POST /import/<source>          parse -> stage; answers a batch id + staged count
//	GET  /import/staged            the whole pending queue (batches, works, quotes)
//	POST /import/staged/bulk       edit a selection (import_staged_bulk.go)
//	POST /import/staged/approve    convert a selection into real rows; answers the counters
//	DELETE /import/staged          discard a selection
//
// Approval deliberately converts staged rows BACK into the importer's own
// intermediate shape (importer.Annotation / importer.Dialogue) and runs the
// existing persist path, so dedupe, duplicate enrichment (fill-empty-only, colour
// upgrading off yellow, favourite only upward, tags union) and the
// ISBN → ASIN → title/author book resolution behave exactly as they did when the
// importers wrote straight through. There is one implementation of those rules,
// not two.

// ---- staging a parsed import ------------------------------------------------

// stagedWorkPreview is one work in a staging reply: what was parsed, plus a
// read-only preview of where its quotes would land if approved right now.
type stagedWorkPreview struct {
	ID           int64  `json:"id"`
	Kind         string `json:"kind"` // book | movie | show
	Title        string `json:"title"`
	Author       string `json:"author"` // the work's primary credit: author for a book, director for a film
	Staged       int    `json:"staged"`
	TargetID     int64  `json:"target_id"`    // 0 = a new row would be created
	TargetTitle  string `json:"target_title"` // the library row it would join
	TargetYear   int    `json:"target_year"`
	// The destination's artwork, so a reader can pick a work out of a queue by
	// looking rather than by reading. `books.cover_path` or `movies.poster_path`,
	// whichever kind this is, and "" when the row would create a NEW work — the
	// same state TargetTitle is already in, so no caller needs a second branch.
	TargetCover string `json:"target_cover"`
	Ambiguous    bool   `json:"ambiguous"`    // more than one same-title candidate
	Alternatives int    `json:"alternatives"` // how many were passed over
}

// stageBooks writes a parsed batch of books (one or many) into the staging tables
// in a single transaction and answers with the batch id, the per-work breakdown
// and a look-alike warning. Extra keys are merged into the answer so a format
// with its own counters (Kindle clippings: bookmarks, merged notes,
// near-duplicates) can report them; they are also kept on the batch so the queue
// can still show them later.
func (s *Server) stageBooks(ctx context.Context, uid int64, source, filename string,
	results []*importer.Result, extra map[string]any) importAnswer {

	olog.Tracef("[import] stage books source=%s file=%q works=%d", source, filename, len(results))
	tx, err := s.Store.DB.Begin()
	if err != nil {
		return importFault(ctx, olog.CodeImportStage, "stage books: begin tx", err)
	}
	defer tx.Rollback()

	batchID, err := insertImportBatch(tx, uid, source, filename, extra)
	if err != nil {
		return importFault(ctx, olog.CodeImportStage, "stage books: batch", err)
	}

	// One preview per staged WORK, not per parsed block: a file naming the same
	// book twice groups into one staged work, and reporting it twice would split its
	// count across two entries sharing an id.
	works := []stagedWorkPreview{}
	byWork := map[int64]int{}
	allDupes := []dupHint{}
	dupeSeen := map[int64]bool{}
	staged := 0
	for i, res := range results {
		// A Stop between two works: the transaction rolls back, and nothing of the
		// file is staged (importHalted says where a Stop lands).
		if importHalted(ctx, stopStageWork, i) {
			return importAnswer{stopped: true}
		}
		workID, err := stageBookWork(tx, batchID, res.Book)
		if err != nil {
			return importFault(ctx, olog.CodeImportStage, "stage books: work", err)
		}
		n, err := stageQuotes(tx, workID, res.Annotations, nil)
		if err != nil {
			var ce importClientError
			if errors.As(err, &ce) {
				return importRefused(ctx, ce.msg)
			}
			return importFault(ctx, olog.CodeImportStage, "stage books: quotes", err)
		}
		staged += n

		// Where would this land? An existing row means the quotes will join a
		// book the user already has; nothing means a new row, and then a
		// look-alike already in the library is worth flagging BEFORE the write
		// rather than after it: "Homo Deus" arriving beside "Homo Deus: The
		// million-copy bestseller…".
		prev := stagedWorkPreview{ID: workID, Kind: "book", Title: res.Book.Title, Author: res.Book.Author, Staged: n}
		targetID, err := findImportBook(tx, uid, res.Book)
		if err != nil {
			return importFault(ctx, olog.CodeImportStage, "stage books: resolve", err)
		}
		if targetID != 0 {
			prev.TargetID = targetID
			if err := tx.QueryRow(`SELECT title FROM books WHERE id = ?`, targetID).Scan(&prev.TargetTitle); err != nil {
				return importFault(ctx, olog.CodeImportStage, "stage books: target title", err)
			}
		} else {
			dupes, err := findSimilarBooks(tx, uid, res.Book.Title, 0)
			if err != nil {
				return importFault(ctx, olog.CodeImportStage, "stage books: look-alikes", err)
			}
			for _, d := range dupes { // the same look-alike, once
				if !dupeSeen[d.ID] {
					dupeSeen[d.ID] = true
					allDupes = append(allDupes, d)
				}
			}
		}
		if at, ok := byWork[workID]; ok {
			works[at].Staged += n
			continue
		}
		byWork[workID] = len(works)
		works = append(works, prev)
	}
	if importHalted(ctx, stopStageCommit, 0) {
		return importAnswer{stopped: true}
	}
	if err := tx.Commit(); err != nil {
		return importFault(ctx, olog.CodeImportStage, "stage books: commit", err)
	}
	return s.stagedAnswer(ctx, uid, source, batchID, staged, works, allDupes, extra)
}

// stageMovies is the catalogue counterpart of stageBooks: it stages parsed
// film/show dialogue and previews the anchor each title would resolve to.
func (s *Server) stageMovies(ctx context.Context, uid int64, source, filename string,
	results []*importer.MovieResult, extra map[string]any) importAnswer {

	olog.Tracef("[import] stage titles source=%s file=%q works=%d", source, filename, len(results))
	tx, err := s.Store.DB.Begin()
	if err != nil {
		return importFault(ctx, olog.CodeImportStage, "stage titles: begin tx", err)
	}
	defer tx.Rollback()

	batchID, err := insertImportBatch(tx, uid, source, filename, extra)
	if err != nil {
		return importFault(ctx, olog.CodeImportStage, "stage titles: batch", err)
	}

	works := []stagedWorkPreview{}
	byWork := map[int64]int{} // one preview per staged work — see stageBooks
	staged := 0
	for i, res := range results {
		if importHalted(ctx, stopStageWork, i) { // as stageBooks
			return importAnswer{stopped: true}
		}
		workID, err := stageMovieWork(tx, batchID, res.Movie)
		if err != nil {
			return importFault(ctx, olog.CodeImportStage, "stage titles: work", err)
		}
		n, err := stageQuotes(tx, workID, nil, res.Dialogues)
		if err != nil {
			var ce importClientError
			if errors.As(err, &ce) {
				return importRefused(ctx, ce.msg)
			}
			return importFault(ctx, olog.CodeImportStage, "stage titles: quotes", err)
		}
		staged += n

		prev := stagedWorkPreview{
			ID: workID, Kind: importMediaType(res.Movie.MediaType),
			Title: res.Movie.Title, Author: res.Movie.Director, Staged: n,
		}
		anchor, err := findImportMovie(tx, uid, res.Movie.Title, res.Movie.MediaType, res.Movie.Year)
		if err != nil {
			return importFault(ctx, olog.CodeImportStage, "stage titles: anchor", err)
		}
		if anchor.ID != 0 {
			prev.TargetID, prev.TargetYear = anchor.ID, anchor.MatchedYear
			prev.Ambiguous, prev.Alternatives = anchor.Ambiguous, anchor.Alternatives
			if err := tx.QueryRow(`SELECT title FROM movies WHERE id = ?`, anchor.ID).Scan(&prev.TargetTitle); err != nil {
				return importFault(ctx, olog.CodeImportStage, "stage titles: target title", err)
			}
		}
		if at, ok := byWork[workID]; ok {
			works[at].Staged += n
			continue
		}
		byWork[workID] = len(works)
		works = append(works, prev)
	}
	if importHalted(ctx, stopStageCommit, 0) {
		return importAnswer{stopped: true}
	}
	if err := tx.Commit(); err != nil {
		return importFault(ctx, olog.CodeImportStage, "stage titles: commit", err)
	}
	return s.stagedAnswer(ctx, uid, source, batchID, staged, works, []dupHint{}, extra)
}

// stagedAnswer is an import's answer: what was staged, and how much is now
// waiting in total, so a client can show the pending badge without a second
// request.
//
// IT NAMES THE SOURCE, because the reader no longer chose one. With seven cards
// the format was whichever card you pressed; with one drop target it is whatever
// the bytes said, so the result row has to state the reading back — "read as
// Goodreads" — and offer to be told otherwise. It is reported on every path, not
// only the sniffed one: a fact about an import does not change shape depending on
// which door it came through.
//
// THE PHONE'S MESSAGE RIDES ON THE ANSWER rather than being sent from here: the
// job sends it once the answer is kept (runImport), as the request used to send
// it once the answer was written, so Pushover's round trip never stands between
// the staging and the screen reading what was staged.
func (s *Server) stagedAnswer(ctx context.Context, uid int64, source string, batchID int64, staged int,
	works []stagedWorkPreview, dupes []dupHint, extra map[string]any) importAnswer {

	pending, err := s.pendingStagedCount(uid)
	if err != nil {
		olog.Warnf(olog.CodeImportRowScan, "[import] pending count after staging: %v", err)
	}
	noteJob(ctx, jobs.LevelInfo, "staged %s from %s as batch %d; %d waiting in the queue to be approved",
		countOf(staged, "quote", "quotes"), countOf(len(works), "work", "works"), batchID, pending)
	if counted := importCounted(extra); counted != "" {
		noteJob(ctx, jobs.LevelInfo, "the format counted, beside the quotes: %s", counted)
	}
	body := map[string]any{
		"source":              source,
		"batch_id":            batchID,
		"staged":              staged,
		"pending":             pending,
		"works":               works,
		"possible_duplicates": dupes,
	}
	for k, v := range extra {
		body[k] = v
	}
	ans := importAnswer{Status: http.StatusOK, Body: body}
	if staged >= notifyImportMin {
		ans.ready = countOf(staged, "quote", "quotes") + " waiting in the import queue."
	}
	return ans
}

// importCounted is what a format counted beside the quotes it staged (a Kindle
// file's bookmarks and merged notes, Readest's unmapped colours), as a line for
// the import's log: "bookmarks skipped 3, notes merged 1". Only the counts that
// are not zero, in name order so the line reads the same every time.
func importCounted(extra map[string]any) string {
	var parts []string
	for _, k := range slices.Sorted(maps.Keys(extra)) {
		if n, ok := extra[k].(int); ok && n != 0 {
			parts = append(parts, fmt.Sprintf("%s %d", strings.ReplaceAll(k, "_", " "), n))
		}
	}
	return strings.Join(parts, ", ")
}

func insertImportBatch(tx *sql.Tx, uid int64, source, filename string, extra map[string]any) (int64, error) {
	encoded := ""
	if len(extra) > 0 {
		if b, err := json.Marshal(extra); err == nil {
			encoded = string(b)
		}
	}
	res, err := tx.Exec(
		`INSERT INTO import_batches (user_id, source, filename, extra) VALUES (?, ?, ?, ?)`,
		uid, source, filename, encoded)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// stageBookWork finds or creates the staged work a parsed book's quotes attach
// to. Reusing a row within the same batch mirrors what upsertImportBook does at
// approval — a file that names the same book in two blocks used to collapse into
// one row, and the queue should not show it as two groups.
func stageBookWork(tx *sql.Tx, batchID int64, b importer.Book) (int64, error) {
	var id int64
	err := tx.QueryRow(
		`SELECT id FROM staged_works
		  WHERE batch_id = ? AND kind = 'book' AND target_id IS NULL
		    AND lower(title) = lower(?) AND lower(COALESCE(author, '')) = lower(?)
		  LIMIT 1`, batchID, b.Title, b.Author).Scan(&id)
	if err == nil {
		// Backfill what this block carries and the row lacks — upsertImportBook did
		// exactly this on a match, so a second block's ISBN or series must not be
		// dropped just because staging grouped the two together.
		if _, err := tx.Exec(
			`UPDATE staged_works SET isbn = COALESCE(isbn, ?), asin = COALESCE(asin, ?),
			                         author = COALESCE(author, ?), series = COALESCE(series, ?),
			                         series_index = COALESCE(series_index, ?),
			                         language = CASE WHEN language = '' THEN ? ELSE language END,
			                         orig_language = CASE WHEN orig_language = '' THEN ? ELSE orig_language END,
			                         subtitle = CASE WHEN subtitle = '' THEN ? ELSE subtitle END,
			                         publisher = CASE WHEN publisher = '' THEN ? ELSE publisher END,
			                         pages = CASE WHEN pages = 0 THEN ? ELSE pages END,
			                         links = CASE WHEN links = '' THEN ? ELSE links END,
			                         status = CASE WHEN status = '' THEN ? ELSE status END,
			                         progress = max(progress, ?),
			                         pos_json = CASE WHEN pos_json = '' THEN ? ELSE pos_json END,
			                         reads_json = CASE WHEN reads_json = '[]' THEN ? ELSE reads_json END,
			                         cast_json = CASE WHEN cast_json = '[]' THEN ? ELSE cast_json END
			  WHERE id = ?`,
			nullable(b.ISBN), nullable(b.ASIN), nullable(b.Author),
			nullable(b.Series), nullableFloat(b.SeriesIndex),
			// The two languages are NOT NULL DEFAULT '' (0047), so `CASE WHEN col = ''`
			// rather than COALESCE — the same reason spelled out at enrichStagedQuote.
			b.Language, b.OrigLanguage,
			b.Subtitle, b.Publisher, b.Pages, b.Links, // 0061 and 0062, fill-empty-only
			b.Status, b.Progress, encodePos(bookShelf(b).Pos), encodeReads(b.Reads),
			encodeCast(b.Cast), id); err != nil {
			return 0, err
		}
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, err
	}
	res, err := tx.Exec(
		`INSERT INTO staged_works (batch_id, kind, title, author, translator, editor,
		                           language, orig_language, subtitle, publisher, pages, links,
		                           isbn, asin, series, series_index,
		                           status, progress, pos_json, reads_json, cast_json)
		 VALUES (?, 'book', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		batchID, b.Title, nullable(b.Author), nullable(b.Translator), nullable(b.Editor),
		b.Language, b.OrigLanguage, // plain strings: NOT NULL DEFAULT '' (0047)
		b.Subtitle, b.Publisher, b.Pages, b.Links, // and 0061's and 0062's
		nullable(b.ISBN), nullable(b.ASIN),
		nullable(b.Series), nullableFloat(b.SeriesIndex),
		b.Status, b.Progress, encodePos(bookShelf(b).Pos), encodeReads(b.Reads),
		encodeCast(b.Cast))
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// stageMovieWork is stageBookWork for a film or show: same within-batch reuse,
// keyed on title + media type + year, since that is what anchoring keys on.
func stageMovieWork(tx *sql.Tx, batchID int64, m importer.MovieHeader) (int64, error) {
	kind := importMediaType(m.MediaType)
	var id int64
	err := tx.QueryRow(
		`SELECT id FROM staged_works
		  WHERE batch_id = ? AND kind = ? AND target_id IS NULL
		    AND lower(title) = lower(?) AND COALESCE(release_year, 0) = ?
		  LIMIT 1`, batchID, kind, m.Title, m.Year).Scan(&id)
	if err == nil {
		// Same reason as stageBookWork: a later block's director, collection or
		// genres would otherwise be discarded before approval could backfill them.
		if _, err := tx.Exec(
			`UPDATE staged_works SET director = COALESCE(director, ?), imdb_id = COALESCE(imdb_id, ?),
			                         series = COALESCE(series, ?), series_index = COALESCE(series_index, ?),
			                         genres = CASE WHEN genres = '' THEN ? ELSE genres END,
			                         publisher = CASE WHEN publisher = '' THEN ? ELSE publisher END,
			                         links = CASE WHEN links = '' THEN ? ELSE links END,
			                         status = CASE WHEN status = '' THEN ? ELSE status END,
			                         progress = max(progress, ?),
			                         pos_json = CASE WHEN pos_json = '' THEN ? ELSE pos_json END,
			                         reads_json = CASE WHEN reads_json = '[]' THEN ? ELSE reads_json END,
			                         cast_json = CASE WHEN cast_json = '[]' THEN ? ELSE cast_json END
			  WHERE id = ?`,
			nullable(m.Director), nullable(m.IMDbID), nullable(m.Series),
			nullableFloat(m.SeriesIndex), strings.Join(m.Genres, ", "),
			// A GAME'S PUBLISHER WAS BEING LOST HERE, and had been since staging
			// and 0042 met: the parser read it, the library column existed, and the
			// queue between them had no slot — so an import of a catalogue export
			// dropped it in silence, with matching counts. 0062's links join it.
			m.Publisher, m.Links,
			m.Status, m.Progress, encodePos(movieShelf(m).Pos), encodeReads(m.Reads),
			encodeCast(m.Cast), id); err != nil {
			return 0, err
		}
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, err
	}
	res, err := tx.Exec(
		`INSERT INTO staged_works
		   (batch_id, kind, title, series, series_index, release_year, imdb_id, director, genres,
		    publisher, links, status, progress, pos_json, reads_json, cast_json)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		batchID, kind, m.Title, nullable(m.Series), nullableFloat(m.SeriesIndex),
		nullableInt(m.Year), nullable(m.IMDbID), nullable(m.Director),
		strings.Join(m.Genres, ", "), m.Publisher, m.Links, m.Status, m.Progress,
		encodePos(movieShelf(m).Pos), encodeReads(m.Reads), encodeCast(m.Cast))
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// stageQuotes writes one work's parsed quotes into staged_quotes. Exactly one of
// anns/dialogues is non-nil. INSERT OR IGNORE against
// UNIQUE (staged_work_id, dedupe_hash) collapses a file's internal duplicates,
// which is what the live insert used to do, so the count a user sees in the queue
// is the count they will approve.
func stageQuotes(tx *sql.Tx, workID int64, anns []importer.Annotation, dialogues []importer.Dialogue) (int, error) {
	const q = `
		INSERT OR IGNORE INTO staged_quotes
		  (staged_work_id, quote, note, translation, language, color, favorite, chapter, chapter_no, location, location_orig,
		   character, actor, timestamp, timestamp_orig, timestamp_end, season, episode,
		   act, quest, dlc, episode_name, tags, noted_at, dedupe_hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	staged := 0
	add := func(quote, note, translation, language, color string, favorite bool, chapter string, chapterNo float64,
		location, character, actor, timestamp, timestampEnd string,
		season, episode *int, act, quest, dlc, episodeName string, tags []string, notedAt string) error {
		if color == "" {
			color = "yellow" // Kindle and IMDb sources carry no colour (PLAN §3)
		}
		if !validColor(color) {
			return importClientError{fmt.Sprintf("invalid color %q", color)}
		}
		text := quote
		if text == "" {
			text = note
		}
		// Episode- AND quest-qualified, so two occurrences of a recurring line stage
		// as two rows rather than one. season/episode are nil and act/quest empty for
		// every book, and DialogueDedupeHash is then byte-identical to DedupeHash — so
		// this is a no-op on the annotation half of the queue.
		//
		// THE QUEUE HAS TO HASH THE WAY THE LIVE TABLE DOES, or the count a reader
		// approves is not the count they were shown: a game file naming one bark in
		// two quests would collapse to a single staged row and then arrive as a single
		// line, with a matching "1 staged, 1 added" to say nothing was lost.
		hash := store.DialogueDedupeHash(text, season, episode, act, quest)
		res, err := tx.Exec(q, workID, nullable(quote), nullable(note),
			// A plain string: staged_quotes.translation is NOT NULL DEFAULT '' (0035),
			// and nullable("") is nil.
			translation, language, color, favorite,
			nullable(chapter), nullableFloat(chapterNo), nullable(location), nullable(location),
			nullable(character), nullable(actor), nullable(timestamp), nullable(timestamp),
			// A PLAIN STRING, unlike the two beside it: 0070's column is NOT NULL
			// DEFAULT '' and nullable("") is nil, which is the violation. `timestamp`
			// predates that rule and is nullable, which is why the pair look
			// different here and mean the same thing. No _orig snapshot: only the
			// locators the reader can RESET in the queue carry one, and the end is
			// not one of them.
			timestampEnd,
			season, episode,
			// Plain strings, NOT nullable(): these are NOT NULL DEFAULT '' (0047), and
			// nullable("") is nil, which is a NOT NULL violation rather than a default.
			act, quest, dlc, episodeName,
			joinTags(tags), nullable(notedAt), hash)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n > 0 {
			staged++
			return nil
		}
		// The row collided with one already staged under this work — the same
		// passage twice in one file, or a book named by two frontmatter blocks. The
		// live importer enriched in that case rather than discarding, so staging
		// must too, or the second copy's locators, note, colour and tags are lost
		// silently before anyone can see them.
		// ONLY THE EPISODE NAME IS DONATED, of the three 0047 added. Act and quest
		// are IN the hash, so a row this one collided with already holds the same
		// pair by construction and donating them would be writing a value onto
		// itself — the same reason season and episode are listed below and can
		// never actually change either. The episode name is NOT in the hash, which
		// is exactly why the copy already staged can be missing it.
		// dlc joins episodeName as a donatable field, and act/quest still do not: those
		// two are IN the hash, so a row this one collided with already holds the same
		// pair and donating them would be writing a value onto itself. A DLC name is
		// deliberately out of the hash (0071), which is exactly why the copy already
		// staged can be missing it.
		return enrichStagedQuote(tx, workID, hash, quote, note, translation, language, color, favorite,
			chapter, chapterNo, location, character, actor, timestamp, timestampEnd, season, episode,
			dlc, episodeName, tags, notedAt)
	}
	for _, a := range anns {
		// A book highlight now carries a CHARACTER (0047). This position was hardwired
		// to "" when only a film's line could name one, and leaving it there would
		// have lost the field between the parser and the queue — with a successful
		// import and matching counts to say nothing happened, which is the failure
		// 0034 supplied the proof for.
		//
		// No actor beside it: a novel has speakers, not a cast. No act, quest or
		// episode name either — a book has none, and a book file retargeted onto a
		// game is repaired by the media-type gate at approval rather than by inventing
		// a locator here.
		if err := add(a.Quote, a.Note, a.Translation, a.Language, a.Color, a.Favorite, a.Chapter, a.ChapterNo, a.Location,
			a.Character, "", "", "", nil, nil, "", "", "", "", a.Tags, a.NotedAt); err != nil {
			return 0, err
		}
	}
	for _, d := range dialogues {
		if err := add(d.Quote, d.Note, d.Translation, d.Language, d.Color, d.Favorite, "", 0, "", d.Character, d.Actor, d.Timestamp, d.TimestampEnd,
			d.Season, d.Episode, d.Act, d.Quest, d.DLC, d.EpisodeName, d.Tags, d.NotedAt); err != nil {
			return 0, err
		}
	}
	return staged, nil
}

// enrichStagedQuote donates whatever an already-staged copy lacks, with the same
// fill-empty-only rule the live importer uses: locators, note and date fill when
// absent, colour upgrades off the yellow default, favourite only ever turns on,
// tags union. Existing values always win, so the first copy in the file is the one
// whose edits survive. The _orig snapshots follow their live column, so a locator
// that arrives only on the second copy is still resettable.
func enrichStagedQuote(tx *sql.Tx, workID int64, hash, quote, note, translation, language, color string, favorite bool,
	chapter string, chapterNo float64, location, character, actor, timestamp, timestampEnd string, season, episode *int,
	dlc, episodeName string, tags []string, notedAt string) error {

	var id int64
	var storedTags string
	err := tx.QueryRow(`SELECT id, COALESCE(tags, '') FROM staged_quotes
	                     WHERE staged_work_id = ? AND dedupe_hash = ?`, workID, hash).Scan(&id, &storedTags)
	if errors.Is(err, sql.ErrNoRows) {
		return nil // vanished under us; nothing to enrich
	}
	if err != nil {
		return err
	}
	if _, err := tx.Exec(`
		UPDATE staged_quotes SET
		  note           = COALESCE(note, ?),
		  noted_at       = COALESCE(noted_at, ?),
		  chapter        = COALESCE(chapter, ?),
		  chapter_no     = COALESCE(chapter_no, ?),
		  location       = COALESCE(location, ?),
		  location_orig  = COALESCE(location_orig, ?),
		  character      = COALESCE(character, ?),
		  actor          = COALESCE(actor, ?),
		  timestamp      = COALESCE(timestamp, ?),
		  timestamp_orig = COALESCE(timestamp_orig, ?),
		  timestamp_end  = CASE WHEN timestamp_end = '' THEN ? ELSE timestamp_end END,
		  season         = COALESCE(season, ?),
		  episode        = COALESCE(episode, ?),
		  dlc            = CASE WHEN dlc = '' THEN ? ELSE dlc END,
		  episode_name   = CASE WHEN episode_name = '' THEN ? ELSE episode_name END,
		  language       = CASE WHEN language = '' THEN ? ELSE language END,
		  translation    = CASE WHEN translation = '' THEN ? ELSE translation END,
		  color          = CASE WHEN color = 'yellow' AND ? <> 'yellow' THEN ? ELSE color END,
		  favorite       = MAX(favorite, ?)
		 WHERE id = ?`,
		nullable(note), nullable(notedAt), nullable(chapter), nullableFloat(chapterNo),
		nullable(location), nullable(location),
		nullable(character), nullable(actor),
		nullable(timestamp), nullable(timestamp),
		// CASE WHEN, not COALESCE — see the note below on why a NOT NULL DEFAULT ''
		// column cannot use it.
		timestampEnd,
		season, episode,
		// COALESCE CANNOT EXPRESS FILL-EMPTY-ONLY ON A NOT NULL DEFAULT '' COLUMN:
		// COALESCE('', x) is '', so the donation would never happen and the column
		// would merely look as though it had enriched. `CASE WHEN col = ''` is the
		// same rule spelled the way `status` two functions up already spells it, and
		// upsertImportBook's NULLIF() is a third spelling of the one idea. 0051's
		// translation is the same shape of column and takes the same spelling.
		dlc, episodeName, language, translation,
		color, color, favorite, id); err != nil {
		return err
	}
	// A note-only first copy followed by a quoted duplicate keeps the quote too:
	// the hash is over quote-or-note, so both are the same passage.
	if quote != "" {
		if _, err := tx.Exec(`UPDATE staged_quotes SET quote = COALESCE(quote, ?) WHERE id = ?`,
			nullable(quote), id); err != nil {
			return err
		}
	}
	if len(tags) == 0 {
		return nil
	}
	merged := splitStoredList(storedTags)
	seen := map[string]bool{}
	for _, n := range merged {
		seen[strings.ToLower(n)] = true
	}
	for _, n := range cleanNames(tags) {
		if !seen[strings.ToLower(n)] {
			seen[strings.ToLower(n)] = true
			merged = append(merged, n)
		}
	}
	_, err = tx.Exec(`UPDATE staged_quotes SET tags = ? WHERE id = ?`, strings.Join(merged, ", "), id)
	return err
}

// ---- reading the queue ------------------------------------------------------

type stagedBatchRow struct {
	ID        int64          `json:"id"`
	Source    string         `json:"source"`
	Filename  string         `json:"filename"`
	CreatedAt string         `json:"created_at"`
	Works     int            `json:"works"`
	Quotes    int            `json:"quotes"`
	Extra     map[string]any `json:"extra,omitempty"`
}

type stagedWorkRow struct {
	ID           int64    `json:"id"`
	BatchID      int64    `json:"batch_id"`
	Kind         string   `json:"kind"`
	Title        string   `json:"title"`
	Author       string   `json:"author"`
	ISBN         string   `json:"isbn"`
	ASIN         string   `json:"asin"`
	Series       string   `json:"series"`
	SeriesIndex  float64  `json:"series_index"`
	ReleaseYear  int      `json:"release_year"`
	IMDbID       string   `json:"imdb_id"`
	Director     string   `json:"director"`
	Genres       []string `json:"genres"`
	Quotes       int      `json:"quotes"`
	Pinned       bool     `json:"pinned"` // the user chose the destination
	TargetID     int64    `json:"target_id"`
	TargetTitle  string   `json:"target_title"`
	TargetYear   int      `json:"target_year"`
	TargetCover  string   `json:"target_cover"` // see stagedWorkPreview

	Ambiguous    bool     `json:"ambiguous"`
	Alternatives int      `json:"alternatives"`
}

type stagedQuoteRow struct {
	ID            int64   `json:"id"`
	StagedWorkID  int64   `json:"staged_work_id"`
	BatchID       int64   `json:"batch_id"`
	Quote         string  `json:"quote"`
	Note          string  `json:"note"`
	Color         string  `json:"color"`
	Favorite      bool    `json:"favorite"`
	Chapter       string  `json:"chapter"`
	ChapterNo     float64 `json:"chapter_no"` // 0044; 0 = the file gave no number
	Location      string  `json:"location"`
	LocationOrig  string  `json:"location_orig"`
	Character     string  `json:"character"`
	Actor         string  `json:"actor"`
	Timestamp     string  `json:"timestamp"`
	TimestampOrig string  `json:"timestamp_orig"`
	// 0070. No _orig snapshot beside it: only the locators the reader can RESET in
	// the queue carry one, and the end of a range is not one of them.
	TimestampEnd string `json:"timestamp_end"`
	Season       *int   `json:"season"`  // shows only; null = the file didn't say
	Episode      *int   `json:"episode"` // (season 0 is a real season — see 0025)
	// 0047. The rest of the screen locator: the episode's NAME, and the two a game
	// is placed by. Plain strings, because empty is unset for all three (gameRef).
	// Which of them survives approval depends on the DESTINATION's media type, not
	// on the file's — writeMovieDialogues owns that gate — so the queue holds
	// whatever the file said and shows it before anybody commits to it.
	EpisodeName string `json:"episode_name"`
	// 0071. Which pack a game's line came in. Beside episode_name for the reason
	// that field gives: the queue holds whatever the file said, and the
	// DESTINATION's media type decides at approval which locators survive.
	DLC   string `json:"dlc"`
	Act   string `json:"act"`
	Quest string `json:"quest"`
	// The occasion (§24), the third kind's locator. Empty on every book and
	// film row, as chapter/character are on this one.
	Speaker      string `json:"speaker"`
	Occasion     string `json:"occasion"`
	OccasionDate string `json:"occasion_date"`
	Place        string `json:"place"`
	Medium       string `json:"medium"`
	// 0053. Carried through the queue for the reason `category` above is carried:
	// this app's own export is an importer's source and every import is staged, so
	// a field the queue does not hold survives the export, survives the parse and
	// is silently dropped on the way in — with a successful import and matching
	// counts saying nothing happened.
	Kind string `json:"kind"`
	// 0035, and carried through the queue for the reason 0034 records about
	// translator: this app's own export is an importer's source and every import
	// is staged, so a field the queue does not hold is a field that survives the
	// export, survives the parse and is dropped on the way in — with a successful
	// import and matching counts saying nothing happened.
	Category    string `json:"category"`
	Language    string `json:"language"`
	Translation string `json:"translation"`
	// 0069, in the queue for the reason the paragraph above gives about the other
	// three: this app's own export is an importer's source, so a field the queue
	// does not hold survives the export, survives the parse and is dropped on the
	// way in — with matching counts saying nothing happened.
	// 0047, and in the queue for exactly the reason the paragraph above gives. These
	// five are a standalone quote's per-kind fields; the kind lives on the BOARD,
	// which does not round-trip yet, so they are carried for every quote whatever
	// board it lands on rather than gated on one.
	Region        string   `json:"region"`
	Recipient     string   `json:"recipient"`
	WorkTitle     string   `json:"work_title"`
	Locator       string   `json:"locator"`
	SourceAuthor  string   `json:"source_author"` // 0070
	OccasionCirca bool     `json:"occasion_circa"`
	Tags          []string `json:"tags"`
	NotedAt       string   `json:"noted_at"`
	CreatedAt     string   `json:"created_at"`
	// 0043. The anthology this row belongs to, by TITLE, and the commentary that
	// introduces it there. Held in the queue for exactly the reason the paragraph
	// above gives: an anthology file's whole content beyond the quotes is its order
	// and its prose, so a queue that dropped the prose would report a successful
	// import of an anthology with nothing written in it.
	Anthology      string `json:"anthology"`
	AnthologyNote  string `json:"anthology_note"`
	AnthologyIntro string `json:"anthology_intro"`
}

// handleListStaged answers the pending queue: every batch, every work, and the
// staged quotes (paged, since a My Clippings.txt can stage thousands). Filters:
// ?batch_id= / ?work_id= narrow the quotes; ?counts=1 returns the totals with
// empty lists, which is all the pending badge needs.
func (s *Server) handleListStaged(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[import] list staged user=%d batch=%s work=%s counts=%s", userID(r),
		r.URL.Query().Get("batch_id"), r.URL.Query().Get("work_id"), r.URL.Query().Get("counts"))
	uid := userID(r)

	batchID, _, ok := intParam(w, r, "batch_id", 0, 1<<31)
	if !ok {
		return
	}
	workID, _, ok := intParam(w, r, "work_id", 0, 1<<31)
	if !ok {
		return
	}

	pending, err := s.pendingStagedCount(uid)
	if err != nil {
		codedError(w, r, olog.CodeImportRowScan, "list staged: count", err)
		return
	}
	// `pending` is always the user's whole queue; `total` is what the filter
	// matched, so a client can show "12 of 400" without a second request. With no
	// filter they are the same number.
	out := map[string]any{
		"pending": pending,
		"batches": []stagedBatchRow{},
		"works":   []stagedWorkRow{},
		"quotes":  []stagedQuoteRow{},
		"total":   pending,
	}
	if r.URL.Query().Get("counts") == "1" {
		writeJSON(w, http.StatusOK, out)
		return
	}

	batches, err := s.listStagedBatches(uid)
	if err != nil {
		codedError(w, r, olog.CodeImportRowScan, "list staged: batches", err)
		return
	}
	out["batches"] = batches

	works, err := s.listStagedWorks(uid)
	if err != nil {
		codedError(w, r, olog.CodeImportRowScan, "list staged: works", err)
		return
	}
	out["works"] = works

	quotes, total, err := s.listStagedQuotes(w, r, uid, int64(batchID), int64(workID))
	if err != nil {
		codedError(w, r, olog.CodeImportRowScan, "list staged: quotes", err)
		return
	}
	if quotes == nil { // a paging 400 was already written
		return
	}
	out["quotes"] = quotes
	out["total"] = total
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) pendingStagedCount(uid int64) (int, error) {
	var n int
	err := s.Store.DB.QueryRow(`
		SELECT count(*) FROM staged_quotes q
		  JOIN staged_works w ON w.id = q.staged_work_id
		  JOIN import_batches b ON b.id = w.batch_id
		 WHERE b.user_id = ?`, uid).Scan(&n)
	return n, err
}

func (s *Server) listStagedBatches(uid int64) ([]stagedBatchRow, error) {
	rows, err := s.Store.DB.Query(`
		SELECT b.id, b.source, b.filename, b.created_at, COALESCE(b.extra, ''),
		       (SELECT count(*) FROM staged_works w WHERE w.batch_id = b.id),
		       (SELECT count(*) FROM staged_quotes q JOIN staged_works w ON w.id = q.staged_work_id
		         WHERE w.batch_id = b.id)
		  FROM import_batches b
		 WHERE b.user_id = ?
		 ORDER BY b.id DESC`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []stagedBatchRow{}
	for rows.Next() {
		var b stagedBatchRow
		var extra string
		if err := rows.Scan(&b.ID, &b.Source, &b.Filename, &b.CreatedAt, &extra, &b.Works, &b.Quotes); err != nil {
			olog.Warnf(olog.CodeImportRowScan, "[import] staged batch row scan failed: %v", err)
			continue
		}
		if extra != "" {
			_ = json.Unmarshal([]byte(extra), &b.Extra)
		}
		out = append(out, b)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeImportRowScan, "[import] staged batch iteration failed: %v", err)
	}
	return out, nil
}

// listStagedWorks returns every staged work with a live preview of where its
// quotes would land. The preview is computed on read rather than stored because
// the library moves while quotes wait: a book added yesterday should change the
// answer for a batch staged last week.
func (s *Server) listStagedWorks(uid int64) ([]stagedWorkRow, error) {
	rows, err := s.Store.DB.Query(`
		SELECT w.id, w.batch_id, w.kind, w.title, COALESCE(w.author, ''), COALESCE(w.isbn, ''),
		       COALESCE(w.asin, ''), COALESCE(w.series, ''), COALESCE(w.series_index, 0),
		       COALESCE(w.release_year, 0), COALESCE(w.imdb_id, ''), COALESCE(w.director, ''),
		       COALESCE(w.genres, ''), COALESCE(w.target_kind, ''), COALESCE(w.target_id, 0),
		       (SELECT count(*) FROM staged_quotes q WHERE q.staged_work_id = w.id)
		  FROM staged_works w
		  JOIN import_batches b ON b.id = w.batch_id
		 WHERE b.user_id = ?
		 ORDER BY w.batch_id DESC, w.id`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type pending struct {
		row        stagedWorkRow
		targetKind string
	}
	var scanned []pending
	for rows.Next() {
		var p pending
		var genres string
		if err := rows.Scan(&p.row.ID, &p.row.BatchID, &p.row.Kind, &p.row.Title, &p.row.Author,
			&p.row.ISBN, &p.row.ASIN, &p.row.Series, &p.row.SeriesIndex, &p.row.ReleaseYear,
			&p.row.IMDbID, &p.row.Director, &genres, &p.targetKind, &p.row.TargetID,
			&p.row.Quotes); err != nil {
			olog.Warnf(olog.CodeImportRowScan, "[import] staged work row scan failed: %v", err)
			continue
		}
		p.row.Genres = splitStoredList(genres)
		scanned = append(scanned, p)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeImportRowScan, "[import] staged work iteration failed: %v", err)
	}
	rows.Close()

	// Resolve each work's destination after the cursor is done — a preview needs
	// its own queries, and SQLite dislikes them mid-iteration.
	out := make([]stagedWorkRow, 0, len(scanned))
	for _, p := range scanned {
		row := p.row
		if row.TargetID != 0 {
			row.Pinned = true
			if ok, dest, err := s.libraryWork(uid, p.targetKind, row.TargetID); err != nil {
				return nil, err
			} else if ok {
				row.TargetTitle, row.TargetYear, row.TargetCover = dest.Title, dest.Year, dest.Cover
			} else {
				// The pinned row was deleted while the quotes waited. Drop the
				// stale pin from the preview so the queue shows what approval
				// will actually do — re-resolve by parsed identity.
				row.Pinned, row.TargetID = false, 0
			}
		}
		if row.TargetID == 0 {
			resolved, err := s.previewStagedTarget(uid, row)
			if err != nil {
				return nil, err
			}
			row.TargetID, row.TargetTitle, row.TargetYear = resolved.TargetID, resolved.TargetTitle, resolved.TargetYear
			// THE PREVIEW PATH CARRIES THE COVER TOO, and forgetting it here would
			// leave exactly half the queue with artwork: a PINNED row reads through
			// libraryWork above, an unpinned one through previewStagedTarget, and a
			// reader cannot tell which of their rows is which.
			row.TargetCover = resolved.TargetCover
			row.Ambiguous, row.Alternatives = resolved.Ambiguous, resolved.Alternatives
		}
		out = append(out, row)
	}
	return out, nil
}

// previewStagedTarget answers "where would this work's quotes land?" without
// writing. It runs the same resolution approval will run.
func (s *Server) previewStagedTarget(uid int64, row stagedWorkRow) (stagedWorkPreview, error) {
	var out stagedWorkPreview
	// ReadOnly, and it has to be: the DSN sets _txlock=immediate, so a read-write
	// Begin takes SQLite's write lock up front. This transaction never writes — it is
	// the "where would this land?" preview, called once per staged work while a
	// staging list is being rendered — and a preview has no business queueing behind
	// a real writer, or making one queue behind it.
	tx, err := s.Store.DB.BeginTx(context.Background(), &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return out, err
	}
	defer tx.Rollback()
	if row.Kind == "book" {
		id, err := findImportBook(tx, uid, importer.Book{
			Title: row.Title, Author: row.Author, ISBN: row.ISBN, ASIN: row.ASIN,
		})
		if err != nil {
			return out, err
		}
		if id != 0 {
			out.TargetID = id
			// COALESCE because cover_path is nullable on books and poster_path on
			// movies: a work with no artwork is the ordinary case, not an error, and
			// "" is what the client already reads as "draw the stand-in".
			if err := tx.QueryRow(`SELECT title, COALESCE(cover_path, '') FROM books WHERE id = ?`, id).
				Scan(&out.TargetTitle, &out.TargetCover); err != nil {
				return out, err
			}
		}
		return out, nil
	}
	anchor, err := findImportMovie(tx, uid, row.Title, row.Kind, row.ReleaseYear)
	if err != nil {
		return out, err
	}
	if anchor.ID != 0 {
		out.TargetID, out.TargetYear = anchor.ID, anchor.MatchedYear
		out.Ambiguous, out.Alternatives = anchor.Ambiguous, anchor.Alternatives
		if err := tx.QueryRow(`SELECT title, COALESCE(poster_path, '') FROM movies WHERE id = ?`, anchor.ID).
			Scan(&out.TargetTitle, &out.TargetCover); err != nil {
			return out, err
		}
	}
	return out, nil
}

// libraryWork reads a pinned destination. ok=false means the row is gone (or was
// never the caller's), which is not an error — the pin is simply stale.
// A STRUCT RATHER THAN A FIFTH RETURN VALUE. Four was already at the edge of what
// reads; the cover would make it five positional values a caller has to get in the
// right order, and `(true, title, year, cover, nil)` is a line nobody can check by
// eye. The named fields also say which of the two column pairs this row came out of.
type libraryWorkRow struct {
	Title string
	Year  int
	Cover string // books.cover_path or movies.poster_path, "" when there is none
}

func (s *Server) libraryWork(uid int64, kind string, id int64) (bool, libraryWorkRow, error) {
	var (
		out libraryWorkRow
		err error
	)
	if kind == "book" {
		err = s.Store.DB.QueryRow(
			`SELECT title, COALESCE(published_year, 0), COALESCE(cover_path, '') FROM books WHERE id = ? AND user_id = ?`,
			id, uid).Scan(&out.Title, &out.Year, &out.Cover)
	} else {
		err = s.Store.DB.QueryRow(
			`SELECT title, COALESCE(release_year, 0), COALESCE(poster_path, '') FROM movies WHERE id = ? AND user_id = ?`,
			id, uid).Scan(&out.Title, &out.Year, &out.Cover)
	}
	if errors.Is(err, sql.ErrNoRows) {
		return false, libraryWorkRow{}, nil
	}
	return err == nil, out, err
}

// listStagedQuotes returns the staged quotes matching the filter plus the
// unpaged total. A nil slice with a nil error means applyPaging already answered
// a 400.
func (s *Server) listStagedQuotes(w http.ResponseWriter, r *http.Request, uid, batchID, workID int64) ([]stagedQuoteRow, int, error) {
	where := ` WHERE b.user_id = ?`
	args := []any{uid}
	if batchID > 0 {
		where += ` AND b.id = ?`
		args = append(args, batchID)
	}
	if workID > 0 {
		where += ` AND w.id = ?`
		args = append(args, workID)
	}
	from := ` FROM staged_quotes q
		  JOIN staged_works w ON w.id = q.staged_work_id
		  JOIN import_batches b ON b.id = w.batch_id` + where

	var total int
	if err := s.Store.DB.QueryRow(`SELECT count(*)`+from, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	q := `SELECT q.id, q.staged_work_id, w.batch_id, COALESCE(q.quote, ''), COALESCE(q.note, ''),
	             q.color, q.favorite, COALESCE(q.chapter, ''), COALESCE(q.chapter_no, 0), COALESCE(q.location, ''),
	             COALESCE(q.location_orig, ''), COALESCE(q.character, ''), COALESCE(q.actor, ''),
	             COALESCE(q.timestamp, ''), COALESCE(q.timestamp_orig, ''), q.timestamp_end, q.season, q.episode,
	             q.episode_name, q.act, q.quest, q.dlc,
	             COALESCE(q.tags, ''),
	             COALESCE(q.noted_at, ''), q.created_at,
	             COALESCE(q.speaker, ''), COALESCE(q.occasion, ''), COALESCE(q.occasion_date, ''),
	             COALESCE(q.place, ''), COALESCE(q.medium, ''), COALESCE(q.kind, ''),
	             COALESCE(q.category, 'other'), COALESCE(q.language, ''),
	             COALESCE(q.translation, ''),
	             q.region, q.recipient, q.work_title, q.locator, q.source_author, q.occasion_circa,
	             COALESCE(q.anthology, ''), COALESCE(q.anthology_note, ''),
	             COALESCE(q.anthology_intro, '')` + from + ` ORDER BY w.batch_id DESC, q.staged_work_id, q.id`
	if !applyPaging(w, r, &q, &args) {
		return nil, 0, nil
	}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []stagedQuoteRow{}
	for rows.Next() {
		var sq stagedQuoteRow
		var tags string
		if err := rows.Scan(&sq.ID, &sq.StagedWorkID, &sq.BatchID, &sq.Quote, &sq.Note, &sq.Color,
			&sq.Favorite, &sq.Chapter, &sq.ChapterNo, &sq.Location, &sq.LocationOrig, &sq.Character, &sq.Actor,
			&sq.Timestamp, &sq.TimestampOrig, &sq.TimestampEnd, &sq.Season, &sq.Episode,
			&sq.EpisodeName, &sq.Act, &sq.Quest, &sq.DLC,
			&tags, &sq.NotedAt, &sq.CreatedAt,
			&sq.Speaker, &sq.Occasion, &sq.OccasionDate, &sq.Place, &sq.Medium, &sq.Kind,
			&sq.Category, &sq.Language, &sq.Translation,
			&sq.Region, &sq.Recipient, &sq.WorkTitle, &sq.Locator, &sq.SourceAuthor, &sq.OccasionCirca,
			&sq.Anthology, &sq.AnthologyNote, &sq.AnthologyIntro); err != nil {
			olog.Warnf(olog.CodeImportRowScan, "[import] staged quote row scan failed: %v", err)
			continue
		}
		sq.Tags = splitStoredList(tags)
		out = append(out, sq)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeImportRowScan, "[import] staged quote iteration failed: %v", err)
	}
	return out, total, nil
}

// ---- approving --------------------------------------------------------------

// handleApproveStaged queues the approval of a selection of staged quotes, and
// answers 202 {job}: what the selection names is checked here, so a selection
// naming nothing is answered now (400, 404), and the writing is the job's
// (runApproveStaged).
//
// AN APPROVAL IS A QUEUED JOB (3.1.0) because it is the one import step that
// writes to the library, and it was the one no screen could see: it ran in its
// request, beside whatever the queue was running, and left no row in Settings ›
// Jobs. The owner's ask was that no eligible action skip the queue. Its subject is
// the file the quotes came from when they came from one, else the first work's
// title; its total is the works it approves, which is what its progress counts.
func (s *Server) handleApproveStaged(w http.ResponseWriter, r *http.Request) {
	if s.Jobs == nil {
		noQueue(w)
		return
	}
	var sel stagedSelector
	if !decodeBody(w, r, &sel) {
		return
	}
	olog.Tracef("[import] approve staged user=%d %s", userID(r), sel.describe())
	uid := userID(r)
	picked, ok := s.resolveStagedSelection(w, r, uid, sel)
	if !ok {
		return
	}
	v := viewer(r)
	id, err := s.Jobs.Enqueue(v, "import.approve", s.approvalSubject(uid, picked), sel, len(picked.WorkIDs), nil)
	if err != nil {
		s.writeJobRefusal(w, r, err)
		return
	}
	s.writeJob(w, r, http.StatusAccepted, id, v)
}

// approvalSubject names an approval as Past jobs lists it: the file its quotes
// came from, when every work it approves came from one, else the first work's
// title. Data, not prose, like every subject; "" when neither can be read.
func (s *Server) approvalSubject(uid int64, picked stagedSelection) string {
	if len(picked.WorkIDs) == 0 {
		return ""
	}
	batches := map[int64]bool{}
	_ = chunkIDs(picked.WorkIDs, func(batch []int64) error {
		rows, err := s.Store.DB.Query(`SELECT DISTINCT batch_id FROM staged_works WHERE id IN (`+inClause(len(batch))+`)`,
			int64sAsAny(batch)...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id int64
			if rows.Scan(&id) == nil {
				batches[id] = true
			}
		}
		return rows.Err()
	})
	if len(batches) == 1 {
		var filename, source string
		for id := range batches {
			_ = s.Store.DB.QueryRow(`SELECT COALESCE(filename, ''), source FROM import_batches WHERE id = ? AND user_id = ?`,
				id, uid).Scan(&filename, &source)
		}
		if filename != "" {
			return filename
		}
		if source != "" {
			return source
		}
	}
	var title string
	_ = s.Store.DB.QueryRow(`SELECT title FROM staged_works WHERE id = ?`, picked.WorkIDs[0]).Scan(&title)
	return title
}

// runApproveStaged is the approval job: the selection it was queued with, read
// again (the queue may have changed while it waited), written into the library a
// work at a time, and what the request used to answer kept as its result
// ({status, body}, as an import's).
func runApproveStaged(s *Server, ctx context.Context, j *jobs.Job) error {
	var sel stagedSelector
	if err := j.Params(&sel); err != nil {
		return errors.New("this approval's record could not be read")
	}
	uid := j.Owner().UserID
	ans := s.approveStaged(ctx, j, uid, sel)
	if err := j.SetResult(ans); err != nil {
		return err
	}
	if ans.ready != "" {
		s.notify(ctx, uid, "import", "Import finished", ans.ready)
	}
	if ans.Status >= http.StatusBadRequest {
		msg, _ := ans.Body["error"].(string)
		if msg == "" {
			msg = http.StatusText(ans.Status)
		}
		return errors.New(msg)
	}
	return nil
}

// approvalTally is what an approval has written so far, work by work: the counters
// the approval's answer carries.
type approvalTally struct {
	approved, quotesAdded, added, skipped, enriched int
	books                                           []bookSummary
	movies                                          []movieSummary
	bookIDs, movieIDs                               []int64
	dupes                                           []dupHint
}

// approveStaged converts a selection of staged quotes into real annotations and
// dialogues and says what the request used to answer: the counters, per work and
// in total.
//
// ONE TRANSACTION PER WORK, where the request's approval was one for the whole
// selection. A job can be stopped, and the owner's rule is that a Stop "shall not
// break anything", so a stop has to leave something whole on either side of it:
// every work before it is in the library and out of the queue, and the work in
// hand and every one after it are still staged, exactly as they were (importHalted
// says where a Stop is heard: before each work, and just before its commit). The
// price is that a failure part-way is no longer all or nothing — the works before
// it stay approved, the one that failed and the rest stay staged, and the answer
// says so with the counters of what landed. The alternative, keeping one
// transaction and checking Stop inside it, would hold SQLite's write lock for the
// whole approval of a library-sized export and roll all of it back on a Stop.
func (s *Server) approveStaged(ctx context.Context, j *jobs.Job, uid int64, sel stagedSelector) importAnswer {
	picked, ref, err := s.stagedSelectionOf(uid, sel)
	if err != nil {
		return approveFault(ctx, "approve staged: selection", err, nil)
	}
	if ref != nil {
		noteJob(ctx, jobs.LevelWarn, "nothing approved: %s", ref.msg)
		return importAnswer{Status: ref.status, Body: map[string]any{"error": ref.msg}}
	}
	plan, err := s.approvalPlan(picked)
	if err != nil {
		return approveFault(ctx, "approve staged: load", err, nil)
	}
	var tally approvalTally
	n := len(plan)
	j.Progress(0, n)
	for i, pw := range plan {
		if importHalted(ctx, stopApproveWork, i) {
			noteJob(ctx, jobs.LevelInfo, "stopped before %s; %s stay in the import queue",
				countOf(n-i, "work", "works"), pronounFor(n-i))
			break
		}
		ans, ended := s.approveWork(ctx, uid, i, pw, &tally)
		if ended && ans.stopped {
			// Its transaction rolled back: the work in hand is as staged as the
			// ones after it.
			noteJob(ctx, jobs.LevelInfo, "stopped before its write; %s stay in the import queue",
				countOf(n-i, "work", "works"))
			break
		}
		if ended {
			if n-i > 1 {
				noteJob(ctx, jobs.LevelWarn, "%s after it stay in the import queue", countOf(n-i-1, "work", "works"))
			}
			return ans
		}
		j.Progress(i+1, n)
	}
	return s.approvalAnswer(ctx, uid, http.StatusOK, "", &tally)
}

// pronounFor is "it" for one and "they" for more, for a line about works left.
func pronounFor(n int) string {
	if n == 1 {
		return "it"
	}
	return "they"
}

// plannedWork is one work an approval will write, with the staged quotes of the
// selection that sit under it.
type plannedWork struct {
	workID   int64
	quoteIDs []int64
}

// approvalPlan is the works a selection approves, in order, each with its quotes:
// read once, before the first work is written, and each work read again inside its
// own transaction (approveWork), so what is written is the queue as it is then.
func (s *Server) approvalPlan(picked stagedSelection) ([]plannedWork, error) {
	tx, err := s.Store.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	works, byWork, err := loadStagedForApproval(tx, picked)
	if err != nil {
		return nil, err
	}
	plan := make([]plannedWork, 0, len(works))
	for _, w := range works {
		pw := plannedWork{workID: w.ID}
		for _, q := range byWork[w.ID] {
			pw.quoteIDs = append(pw.quoteIDs, q.ID)
		}
		plan = append(plan, pw)
	}
	return plan, nil
}

// approveWork writes planned work n into the library and takes it out of the
// queue, in one transaction, adding what it wrote to t only once that has
// committed. ended says the approval ends here: stopped (ans.stopped), the work
// rolled back whole because a Stop reached it before its commit; or failed, with
// ans its answer — a file's fault (a 400) or the server's (a 500), with the
// counters of what landed before.
func (s *Server) approveWork(ctx context.Context, uid int64, n int, pw plannedWork, t *approvalTally) (ans importAnswer, ended bool) {
	tx, err := s.Store.DB.Begin()
	if err != nil {
		return approveFault(ctx, "approve staged: begin tx", err, t), true
	}
	defer tx.Rollback()

	works, byWork, err := loadStagedForApproval(tx, stagedSelection{QuoteIDs: pw.quoteIDs, WorkIDs: []int64{pw.workID}})
	if err != nil {
		return approveFault(ctx, "approve staged: load", err, t), true
	}
	if len(works) == 0 {
		// Discarded, or approved from another screen, while this waited.
		noteJob(ctx, jobs.LevelInfo, "staged work #%d is no longer in the import queue", pw.workID)
		return importAnswer{}, false
	}
	work := works[0]
	// A work with no quotes is not skipped: the pre-1.2.0 importer created the
	// row for a book or film that carried none (an export writes every work,
	// quoted or not), so approval must still create it or a whole-library
	// export would lose them all on the way back in.
	quotes := byWork[work.ID]
	quoteIDs := make([]int64, 0, len(quotes))
	for _, q := range quotes {
		quoteIDs = append(quoteIDs, q.ID)
	}
	refused := func(err error, what string) (importAnswer, bool) {
		var ce importClientError
		if errors.As(err, &ce) {
			noteJob(ctx, jobs.LevelWarn, "%s not approved: %s", itemName(work.Kind, work.ID, work.Title), ce.msg)
			return s.approvalAnswer(ctx, uid, http.StatusBadRequest, ce.msg, t), true
		}
		return approveFault(ctx, what, err, t), true
	}

	var mine approvalTally // what this work adds, kept only if it commits
	destKind, destID, created, anchor, err := resolveApprovalTarget(tx, uid, work, s.creditSeps(tx, uid))
	if err != nil {
		return refused(err, "approve staged: resolve target")
	}
	switch {
	case destKind == stagedKindQuotes:
		added, err := writeUtterances(tx, uid, stagedAsUtterances(quotes), s.creditSeps(tx, uid))
		if err != nil {
			return refused(err, "approve staged: write quotes")
		}
		mine.quotesAdded = added
		mine.added, mine.skipped = added, len(quotes)-added
	case destKind == "book":
		if created {
			// A brand-new book: flag look-alikes already in the library so the
			// answer can offer to merge, as the importers always have.
			hints, err := findSimilarBooks(tx, uid, work.Title, destID)
			if err != nil {
				return approveFault(ctx, "approve staged: look-alikes", err, t), true
			}
			mine.dupes = hints
		}
		added, enriched, err := writeBookAnnotations(tx, uid, work.Source, destID, stagedAsAnnotations(quotes), s.creditSeps(tx, uid))
		if err != nil {
			return refused(err, "approve staged: write annotations")
		}
		mine.books = []bookSummary{{destID, work.Title, created, added, len(quotes) - added, enriched}}
		mine.bookIDs = []int64{destID}
		mine.added, mine.skipped, mine.enriched = added, len(quotes)-added, enriched
	default:
		if err := backfillImportMovie(tx, uid, destID, work.header(), s.creditSeps(tx, uid)); err != nil {
			return approveFault(ctx, "approve staged: backfill title", err, t), true
		}
		added, enriched, err := writeMovieDialogues(tx, uid, destID, stagedAsDialogues(quotes), s.creditSeps(tx, uid))
		if err != nil {
			return refused(err, "approve staged: write dialogues")
		}
		mine.movies = []movieSummary{{
			MovieID: destID, Title: work.Title, MediaType: destKind, Created: created,
			Anchored: anchor.Anchored, YearImported: work.ReleaseYear, MatchedYear: anchor.MatchedYear,
			Ambiguous: anchor.Ambiguous, Alternatives: anchor.Alternatives,
			Added: added, Skipped: len(quotes) - added, Enriched: enriched,
		}}
		mine.movieIDs = []int64{destID}
		mine.added, mine.skipped, mine.enriched = added, len(quotes)-added, enriched
	}

	if err := deleteStagedIDs(tx, quoteIDs); err != nil {
		return approveFault(ctx, "approve staged: clear queue", err, t), true
	}
	// A work approved with no quotes has nothing to delete, so drop it explicitly;
	// gcStaging then takes the batch it emptied.
	if err := deleteEmptyStagedWorks(tx, []int64{work.ID}); err != nil {
		return approveFault(ctx, "approve staged: clear works", err, t), true
	}
	if err := gcStaging(tx, uid); err != nil {
		return approveFault(ctx, "approve staged: gc", err, t), true
	}
	if importHalted(ctx, stopApproveCommit, n) {
		return importAnswer{stopped: true}, true
	}
	if err := tx.Commit(); err != nil {
		return approveFault(ctx, "approve staged: commit", err, t), true
	}

	t.approved += len(quoteIDs)
	t.quotesAdded += mine.quotesAdded
	t.added, t.skipped, t.enriched = t.added+mine.added, t.skipped+mine.skipped, t.enriched+mine.enriched
	t.books = append(t.books, mine.books...)
	t.movies = append(t.movies, mine.movies...)
	for _, id := range mine.bookIDs {
		t.bookIDs = appendUnique(t.bookIDs, id)
	}
	for _, id := range mine.movieIDs {
		t.movieIDs = appendUnique(t.movieIDs, id)
	}
	t.dupes = append(t.dupes, mine.dupes...)
	line := fmt.Sprintf("%s: %d added, %d skipped", itemName(work.Kind, destID, work.Title), mine.added, mine.skipped)
	if mine.enriched > 0 {
		line += fmt.Sprintf(", %d enriched", mine.enriched)
	}
	if created {
		line += ", new to the library"
	}
	noteJob(ctx, jobs.LevelInfo, "%s", line)
	return importAnswer{}, false
}

// approveFault is approveStaged's answer to a failure of the server's own: the
// cause in the system log under TIP-IMPORT-003, and the 500 the request answered,
// with whatever had already landed (t, which may be nil).
func approveFault(ctx context.Context, what string, err error, t *approvalTally) importAnswer {
	olog.Errorf(olog.CodeImportApprove, "[import] %s: %v", what, err)
	noteJob(ctx, jobs.LevelError, "the approval stopped on an internal error (%s)", olog.CodeImportApprove)
	if t == nil {
		t = &approvalTally{}
	}
	return approvalBody(http.StatusInternalServerError, "internal error", t, 0)
}

// approvalAnswer is an approval's answer, with the queue's pending count read now.
func (s *Server) approvalAnswer(ctx context.Context, uid int64, status int, msg string, t *approvalTally) importAnswer {
	pending, err := s.pendingStagedCount(uid)
	if err != nil {
		olog.Warnf(olog.CodeImportRowScan, "[import] pending count after approve: %v", err)
	}
	olog.Tracef("[import] approved %d staged quotes over %d works -> %d added, %d skipped, %d enriched",
		t.approved, len(t.books)+len(t.movies), t.added, t.skipped, t.enriched)
	if status < http.StatusBadRequest {
		noteJob(ctx, jobs.LevelInfo, "approved %s: %d added, %d skipped, %d enriched; %d still in the import queue",
			countOf(t.approved, "quote", "quotes"), t.added, t.skipped, t.enriched, pending)
	}
	ans := approvalBody(status, msg, t, pending)
	if t.added >= notifyImportMin {
		ans.ready = countOf(t.added, "quote", "quotes") + " added to your library."
	}
	return ans
}

// approvalBody is the body the approval's request answered with — the counters,
// per work and in total — and, for one that failed part-way, its error beside what
// landed before it.
func approvalBody(status int, msg string, t *approvalTally, pending int) importAnswer {
	body := map[string]any{
		"approved":            t.approved,
		"quotes_added":        t.quotesAdded,
		"added":               t.added,
		"skipped":             t.skipped,
		"enriched":            t.enriched,
		"books":               orEmpty(t.books),
		"movies":              orEmpty(t.movies),
		"book_ids":            orEmpty(t.bookIDs),
		"movie_ids":           orEmpty(t.movieIDs),
		"possible_duplicates": orEmpty(t.dupes),
		"pending":             pending,
	}
	if msg != "" {
		body["error"] = msg
	}
	// Single-work back-compat keys, the shape the import endpoints answered with
	// before staging: one book or one title is the common case, and a client
	// (or a test) that only ever looked at book_id / movie_id still works.
	if len(t.books) > 0 {
		body["book_id"] = t.books[0].BookID
		body["title"] = t.books[0].Title
		body["created"] = t.books[0].Created
	}
	if len(t.movies) > 0 {
		m := t.movies[0]
		body["movie_id"] = m.MovieID
		body["media_type"] = m.MediaType
		body["anchored"] = m.Anchored
		body["year_imported"] = m.YearImported
		body["matched_year"] = m.MatchedYear
		body["ambiguous"] = m.Ambiguous
		body["alternatives"] = m.Alternatives
		if len(t.books) == 0 {
			body["title"] = m.Title
			body["created"] = m.Created
		}
	}
	return importAnswer{Status: status, Body: body}
}

// orEmpty is a list as the answer carries it: [] rather than null when empty, as
// the request's answer always had it.
func orEmpty[T any](v []T) []T {
	if v == nil {
		return []T{}
	}
	return v
}

// countApprove is what Past jobs says of an approval: the quotes it added and the
// ones already there, whether it finished, stopped or failed part-way — what landed
// before a stop or a failure is in the library all the same.
func countApprove(result json.RawMessage) map[string]any {
	var a struct {
		Body struct {
			Added   *float64 `json:"added"`
			Skipped *float64 `json:"skipped"`
		} `json:"body"`
	}
	if json.Unmarshal(result, &a) != nil {
		return nil
	}
	out := map[string]any{}
	if a.Body.Added != nil {
		out["added"] = *a.Body.Added
	}
	if a.Body.Skipped != nil {
		out["skipped"] = *a.Body.Skipped
	}
	return out
}

// stagedWorkForApproval is a staged work plus the batch's source, everything the
// write path needs.
type stagedWorkForApproval struct {
	ID     int64
	Kind   string
	Title  string
	Author string
	// Books only, and in practice only ever from Tippani's own Markdown (0034).
	// Carried through the queue rather than dropped in it because staging sits in
	// the MIDDLE of the export/import round trip: parsed out of the file, into
	// staged_works, and back out here into the importer.Book that approval writes.
	// A gap at any one of those four points loses the field silently, with a
	// successful import and matching counts to say nothing happened.
	Translator string
	Editor     string
	// The two languages (0047) ride here for the reason the paragraph above gives
	// about translator, and they are absent from stagedWorkRow for the same reason
	// translator and editor are: the queue's LIST view is a destination preview, and
	// a language is not a fact about where a book will land. Setting them in the
	// queue is import_staged_bulk's business, which cannot set the credits either —
	// its own piece of work, flagged rather than half-done here.
	Language     string
	OrigLanguage string
	// 0061's three, here for the same reason and under the same warning: the queue
	// is the MIDDLE of the round trip, and a field that reaches staged_works and
	// not this struct is lost with a successful import and matching counts.
	Subtitle    string
	Publisher   string
	Pages       int
	Links       string
	ISBN        string
	ASIN        string
	Series      string
	SeriesIndex float64
	ReleaseYear int
	IMDbID      string
	Director    string
	Genres      []string
	Status      string // shelf state as parsed; validated per side at approval
	Progress    int
	Pos         position
	Reads       []importer.Read
	// The work's cast (0048), carried across the queue for the reason the
	// translator note above gives at length: staging sits in the MIDDLE of the
	// export/import round trip, and a field parsed out of a file and not carried
	// through here is lost between the parse and the approval.
	Cast       []importer.CastEntry
	TargetKind string
	TargetID   int64
	Source     string
}

func (w stagedWorkForApproval) book() importer.Book {
	return importer.Book{
		Title: w.Title, Author: w.Author, Translator: w.Translator, Editor: w.Editor,
		Language: w.Language, OrigLanguage: w.OrigLanguage,
		Subtitle: w.Subtitle, Publisher: w.Publisher, Pages: w.Pages, Links: w.Links,
		ISBN: w.ISBN, ASIN: w.ASIN,
		Series: w.Series, SeriesIndex: w.SeriesIndex,
		Status: w.Status, Progress: w.Progress, Reads: w.Reads, Cast: w.Cast,
		Pos: w.Pos.Pos, PosTotal: w.Pos.PosTotal,
	}
}

func (w stagedWorkForApproval) header() importer.MovieHeader {
	return importer.MovieHeader{
		Title: w.Title, Year: w.ReleaseYear, IMDbID: w.IMDbID,
		MediaType: importMediaType(w.Kind), Director: w.Director, Genres: w.Genres,
		Publisher: w.Publisher, Links: w.Links,
		Series: w.Series, SeriesIndex: w.SeriesIndex,
		Status: w.Status, Progress: w.Progress, Reads: w.Reads, Cast: w.Cast,
		Pos: w.Pos.Pos, PosTotal: w.Pos.PosTotal,
		Season: w.Pos.Season, SeasonTotal: w.Pos.SeasonTotal,
	}
}

// loadStagedForApproval reads the works and quotes a selection covers, fully,
// before any writing starts — a cursor left open across writes on the same
// SQLite connection is the bug refillMovieActors was written around.
//
// Works come from the selection's own work list rather than from the quotes, so a
// work with no quotes is still approved (and its library row still created). Both
// reads chunk their id lists: a resolved selection can be the whole queue, which
// is not bounded by anything a client sent.
func loadStagedForApproval(tx *sql.Tx, picked stagedSelection) ([]stagedWorkForApproval, map[int64][]stagedQuoteRow, error) {
	var works []stagedWorkForApproval
	seen := map[int64]bool{}
	err := chunkIDs(picked.WorkIDs, func(batch []int64) error {
		rows, err := tx.Query(`
			SELECT w.id, w.kind, w.title, COALESCE(w.author, ''),
			       COALESCE(w.translator, ''), COALESCE(w.editor, ''),
			       w.language, w.orig_language, w.subtitle, w.publisher, w.pages, w.links,
			       COALESCE(w.isbn, ''),
			       COALESCE(w.asin, ''), COALESCE(w.series, ''), COALESCE(w.series_index, 0),
			       COALESCE(w.release_year, 0), COALESCE(w.imdb_id, ''), COALESCE(w.director, ''),
			       COALESCE(w.genres, ''), w.status, w.progress, w.pos_json, w.reads_json,
			       w.cast_json, COALESCE(w.target_kind, ''), COALESCE(w.target_id, 0), b.source
			  FROM staged_works w
			  JOIN import_batches b ON b.id = w.batch_id
			 WHERE w.id IN (`+inClause(len(batch))+`)
			 ORDER BY w.id`, int64sAsAny(batch)...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var wk stagedWorkForApproval
			var genres, posJSON, readsJSON, castJSON string
			if err := rows.Scan(&wk.ID, &wk.Kind, &wk.Title, &wk.Author,
				&wk.Translator, &wk.Editor, &wk.Language, &wk.OrigLanguage,
				&wk.Subtitle, &wk.Publisher, &wk.Pages, &wk.Links, &wk.ISBN, &wk.ASIN,
				&wk.Series, &wk.SeriesIndex, &wk.ReleaseYear, &wk.IMDbID, &wk.Director,
				&genres, &wk.Status, &wk.Progress, &posJSON, &readsJSON, &castJSON,
				&wk.TargetKind, &wk.TargetID, &wk.Source); err != nil {
				return err
			}
			if seen[wk.ID] { // chunk boundaries must not approve a work twice
				continue
			}
			seen[wk.ID] = true
			wk.Genres = splitStoredList(genres)
			wk.Pos = decodePos(posJSON)
			wk.Reads = decodeReads(readsJSON)
			wk.Cast = decodeCast(castJSON)
			works = append(works, wk)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, nil, err
	}

	byWork := map[int64][]stagedQuoteRow{}
	err = chunkIDs(picked.QuoteIDs, func(batch []int64) error {
		rows, err := tx.Query(`
			SELECT q.id, q.staged_work_id, COALESCE(q.quote, ''), COALESCE(q.note, ''), q.color, q.favorite,
			       COALESCE(q.chapter, ''), COALESCE(q.chapter_no, 0), COALESCE(q.location, ''), COALESCE(q.character, ''),
			       COALESCE(q.actor, ''), COALESCE(q.timestamp, ''), q.season, q.episode,
			       q.episode_name, q.act, q.quest, COALESCE(q.tags, ''),
			       COALESCE(q.noted_at, ''),
			       COALESCE(q.speaker, ''), COALESCE(q.occasion, ''), COALESCE(q.occasion_date, ''),
			       COALESCE(q.place, ''), COALESCE(q.medium, ''), COALESCE(q.kind, ''),
			       COALESCE(q.category, 'other'), COALESCE(q.language, ''), COALESCE(q.translation, ''),
			       q.region, q.recipient, q.work_title, q.locator, q.occasion_circa,
			       COALESCE(q.anthology, ''), COALESCE(q.anthology_note, ''),
			       COALESCE(q.anthology_intro, '')
			  FROM staged_quotes q
			 WHERE q.id IN (`+inClause(len(batch))+`)
			 ORDER BY q.id`, int64sAsAny(batch)...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var sq stagedQuoteRow
			var tags string
			if err := rows.Scan(&sq.ID, &sq.StagedWorkID, &sq.Quote, &sq.Note, &sq.Color, &sq.Favorite,
				&sq.Chapter, &sq.ChapterNo, &sq.Location, &sq.Character, &sq.Actor, &sq.Timestamp,
				&sq.Season, &sq.Episode, &sq.EpisodeName, &sq.Act, &sq.Quest, &tags, &sq.NotedAt,
				&sq.Speaker, &sq.Occasion, &sq.OccasionDate, &sq.Place, &sq.Medium, &sq.Kind,
				&sq.Category, &sq.Language, &sq.Translation,
				&sq.Region, &sq.Recipient, &sq.WorkTitle, &sq.Locator, &sq.OccasionCirca,
				&sq.Anthology, &sq.AnthologyNote, &sq.AnthologyIntro); err != nil {
				return err
			}
			sq.Tags = splitStoredList(tags)
			byWork[sq.StagedWorkID] = append(byWork[sq.StagedWorkID], sq)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, nil, err
	}
	return works, byWork, nil
}

// resolveApprovalTarget decides which library row a staged work's quotes join,
// creating it when nothing matches. A pin the user set wins; a pin whose row has
// since been deleted falls back to resolving by parsed identity rather than
// failing the approval. The destination's kind — not the staged work's — is what
// selects the locator set, which is how retargeting across kinds works.
func resolveApprovalTarget(tx *sql.Tx, uid int64, work stagedWorkForApproval, seps metadata.CreditSeps) (kind string, id int64, created bool, anchor importMovieResult, err error) {
	if work.TargetID != 0 {
		table, col := "books", "published_year"
		if work.TargetKind != "book" {
			table, col = "movies", "release_year"
		}
		var year int
		var mediaType string
		if table == "books" {
			err = tx.QueryRow(`SELECT COALESCE(`+col+`, 0) FROM books WHERE id = ? AND user_id = ?`,
				work.TargetID, uid).Scan(&year)
			mediaType = "book"
		} else {
			err = tx.QueryRow(`SELECT COALESCE(`+col+`, 0), media_type FROM movies WHERE id = ? AND user_id = ?`,
				work.TargetID, uid).Scan(&year, &mediaType)
			mediaType = importMediaType(mediaType)
		}
		switch {
		case err == nil:
			return mediaType, work.TargetID, false, importMovieResult{Anchored: true, MatchedYear: year}, nil
		case !errors.Is(err, sql.ErrNoRows):
			return "", 0, false, importMovieResult{}, err
		}
		// Stale pin: fall through and resolve by parsed identity.
	}
	if work.Kind == stagedKindQuotes {
		// There is nothing to resolve. A standalone quote has no destination work
		// — the synthetic staged_work exists only so the queue can group, dedupe
		// and part-approve it like anything else. destID stays 0 and is not read.
		return stagedKindQuotes, 0, false, importMovieResult{}, nil
	}
	if work.Kind == "book" {
		id, created, err := upsertImportBook(tx, uid, work.book(), seps)
		return "book", id, created, importMovieResult{Anchored: !created}, err
	}
	got, err := upsertImportMovie(tx, uid, work.header())
	return importMediaType(work.Kind), got.ID, got.Created, got, err
}

// stagedAsAnnotations turns staged rows back into the importer's own intermediate
// shape, so approval runs the same dedupe/enrichment path a direct import did.
func stagedAsAnnotations(quotes []stagedQuoteRow) []importer.Annotation {
	out := make([]importer.Annotation, 0, len(quotes))
	for _, q := range quotes {
		out = append(out, importer.Annotation{
			Quote: q.Quote, Note: q.Note, Chapter: q.Chapter, ChapterNo: q.ChapterNo, Location: q.Location,
			Character:   q.Character,   // 0047; no actor — a novel has speakers, not a cast
			Translation: q.Translation, // 0051; the queue has carried it since 0035
			Language:    q.Language,    // 0071 — the LINE's, which the book's own does not answer

			Color: q.Color, Tags: q.Tags, Favorite: q.Favorite, NotedAt: q.NotedAt,
		})
	}
	return out
}

// stagedAsUtterances turns staged rows back into the parser's own shape, so
// approval runs the same path a direct import would have.
func stagedAsUtterances(quotes []stagedQuoteRow) []importer.Utterance {
	out := make([]importer.Utterance, 0, len(quotes))
	for _, q := range quotes {
		out = append(out, importer.Utterance{
			Quote: q.Quote, Note: q.Note, Speaker: q.Speaker, Occasion: q.Occasion,
			OccasionDate: q.OccasionDate, Place: q.Place, Medium: q.Medium, Kind: q.Kind,
			Category: q.Category, Language: q.Language, Translation: q.Translation,
			Region: q.Region, Recipient: q.Recipient, WorkTitle: q.WorkTitle,
			Locator: q.Locator, OccasionCirca: q.OccasionCirca, // 0047
			SourceAuthor: q.SourceAuthor, // 0070
			Color:        q.Color, Tags: q.Tags, Favorite: q.Favorite, NotedAt: q.NotedAt,
			Anthology: q.Anthology, AnthologyNote: q.AnthologyNote, AnthologyIntro: q.AnthologyIntro,
		})
	}
	return out
}

func stagedAsDialogues(quotes []stagedQuoteRow) []importer.Dialogue {
	out := make([]importer.Dialogue, 0, len(quotes))
	for _, q := range quotes {
		out = append(out, importer.Dialogue{
			Quote: q.Quote, Note: q.Note, Character: q.Character, Actor: q.Actor,
			Timestamp: q.Timestamp, TimestampEnd: q.TimestampEnd, // 0070
			Season: q.Season, Episode: q.Episode,
			EpisodeName: q.EpisodeName, Act: q.Act, Quest: q.Quest, // 0047
			DLC:         q.DLC,         // 0071
			Language:    q.Language,    // 0071
			Translation: q.Translation, // 0051
			Color:       q.Color, Tags: q.Tags, Favorite: q.Favorite,
			NotedAt: q.NotedAt,
		})
	}
	return out
}

// ---- discarding -------------------------------------------------------------

// handleDiscardStaged drops a selection from the queue without writing anything
// to the library. Hard delete, like everywhere else in the schema.
func (s *Server) handleDiscardStaged(w http.ResponseWriter, r *http.Request) {
	var sel stagedSelector
	if !decodeBody(w, r, &sel) {
		return
	}
	olog.Tracef("[import] discard staged user=%d %s", userID(r), sel.describe())
	uid := userID(r)
	picked, ok := s.resolveStagedSelection(w, r, uid, sel)
	if !ok {
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		codedError(w, r, olog.CodeImportStagedOp, "discard staged: begin tx", err)
		return
	}
	defer tx.Rollback()
	if err := deleteStagedIDs(tx, picked.QuoteIDs); err != nil {
		codedError(w, r, olog.CodeImportStagedOp, "discard staged: delete", err)
		return
	}
	// Discarding a group that holds no quotes has to remove the group itself.
	if err := deleteEmptyStagedWorks(tx, picked.WorkIDs); err != nil {
		codedError(w, r, olog.CodeImportStagedOp, "discard staged: delete works", err)
		return
	}
	if err := gcStaging(tx, uid); err != nil {
		codedError(w, r, olog.CodeImportStagedOp, "discard staged: gc", err)
		return
	}
	if err := tx.Commit(); err != nil {
		codedError(w, r, olog.CodeImportStagedOp, "discard staged: commit", err)
		return
	}
	pending, err := s.pendingStagedCount(uid)
	if err != nil {
		olog.Warnf(olog.CodeImportRowScan, "[import] pending count after discard: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"discarded": len(picked.QuoteIDs), "pending": pending})
}

// appendUnique keeps the id lists in an approval reply free of repeats: two
// staged works — two batches for the same book, say — legitimately resolve to one
// library row, and a client iterating book_ids should not visit it twice.
func appendUnique(ids []int64, id int64) []int64 {
	for _, have := range ids {
		if have == id {
			return ids
		}
	}
	return append(ids, id)
}

func deleteStagedIDs(tx *sql.Tx, ids []int64) error {
	return chunkIDs(ids, func(batch []int64) error {
		_, err := tx.Exec(`DELETE FROM staged_quotes WHERE id IN (`+inClause(len(batch))+`)`,
			int64sAsAny(batch)...)
		return err
	})
}

// deleteEmptyStagedWorks removes named works that hold no quotes. It is scoped to
// works the caller already resolved as owned, and the NOT EXISTS guard means a work
// whose quotes were only partly selected survives.
func deleteEmptyStagedWorks(tx *sql.Tx, workIDs []int64) error {
	return chunkIDs(workIDs, func(batch []int64) error {
		_, err := tx.Exec(`DELETE FROM staged_works WHERE id IN (`+inClause(len(batch))+`)
		                    AND NOT EXISTS (SELECT 1 FROM staged_quotes q WHERE q.staged_work_id = staged_works.id)`,
			int64sAsAny(batch)...)
		return err
	})
}

// gcStaging removes works and batches the last of whose quotes just left, so the
// queue never shows an empty group and the pending count is the only state a user
// has to reason about.
func gcStaging(tx *sql.Tx, uid int64) error {
	if _, err := tx.Exec(`
		DELETE FROM staged_works
		 WHERE id IN (SELECT w.id FROM staged_works w
		                JOIN import_batches b ON b.id = w.batch_id
		               WHERE b.user_id = ?
		                 AND NOT EXISTS (SELECT 1 FROM staged_quotes q WHERE q.staged_work_id = w.id))`, uid); err != nil {
		return err
	}
	_, err := tx.Exec(`
		DELETE FROM import_batches
		 WHERE user_id = ?
		   AND NOT EXISTS (SELECT 1 FROM staged_works w WHERE w.batch_id = import_batches.id)`, uid)
	return err
}

// ---- shared plumbing --------------------------------------------------------

// stagedSelector names the staged quotes an operation applies to. Any one of the
// four is enough; combining them narrows. `all` exists so "approve everything"
// does not have to ship thousands of ids through a 64 KiB body.
type stagedSelector struct {
	IDs     []int64 `json:"ids"`
	WorkIDs []int64 `json:"work_ids"`
	BatchID int64   `json:"batch_id"`
	All     bool    `json:"all"`
}

func (sel stagedSelector) describe() string {
	var b strings.Builder
	if len(sel.IDs) > 0 {
		b.WriteString("ids=" + strconv.Itoa(len(sel.IDs)) + " ")
	}
	if len(sel.WorkIDs) > 0 {
		b.WriteString("works=" + strconv.Itoa(len(sel.WorkIDs)) + " ")
	}
	if sel.BatchID > 0 {
		b.WriteString("batch=" + strconv.FormatInt(sel.BatchID, 10) + " ")
	}
	if sel.All {
		b.WriteString("all ")
	}
	return strings.TrimSpace(b.String())
}

const maxStagedSelection = 5000

// sqlIDChunk bounds how many ids go into one IN (...) list.
//
// SQLite's compiled parameter limit is 32766, and a resolved selection is NOT
// bounded by maxStagedSelection: that cap only guards the explicit ids a client
// sends, while `all` and `batch_id` expand server-side to the whole queue — and
// the queue is designed to hold quotes indefinitely, so one 5 MB Kindle export
// can put tens of thousands in it. Without chunking, "Approve all" answers 500
// exactly when there is most to approve, and the queue cannot even be discarded.
const sqlIDChunk = 900

// chunkIDs calls fn with successive slices of ids, none longer than sqlIDChunk.
// Every caller runs inside one transaction, so a chunked statement is still all
// or nothing.
func chunkIDs(ids []int64, fn func([]int64) error) error {
	for start := 0; start < len(ids); start += sqlIDChunk {
		end := start + sqlIDChunk
		if end > len(ids) {
			end = len(ids)
		}
		if err := fn(ids[start:end]); err != nil {
			return err
		}
	}
	return nil
}

// stagedSelection is what a selector resolves to: the owned staged-quote ids, and
// the owned staged works those quotes belong to.
//
// Works are resolved separately rather than derived from the quotes because a
// work can legitimately have none. A book or film exported with no quotes at all
// re-imports as exactly that, and the pre-1.2.0 importer still created its row —
// so approving such a work has to create the row too, or a whole-library export
// would lose every unquoted work on the way back in.
type stagedSelection struct {
	QuoteIDs []int64
	WorkIDs  []int64
}

// resolveStagedSelection turns a selector into the owned rows it names, answering
// the request itself when it cannot (stagedSelectionOf says which answers).
func (s *Server) resolveStagedSelection(w http.ResponseWriter, r *http.Request, uid int64, sel stagedSelector) (stagedSelection, bool) {
	out, ref, err := s.stagedSelectionOf(uid, sel)
	switch {
	case err != nil:
		codedError(w, r, olog.CodeImportRowScan, "staged selection", err)
		return out, false
	case ref != nil:
		writeErr(w, ref.status, ref.msg)
		return out, false
	}
	return out, true
}

// stagedSelectionOf turns a selector into the owned rows it names. Another user's
// ids simply do not match, so a foreign selection reads as an empty one and is
// refused as a 404 — no existence leak. A selector naming nothing, or too many
// ids, is refused as a 400. It takes no request because an approval reads it
// twice: in its request, for the answer before anything queues, and again in its
// job, which may run after the queue has changed.
func (s *Server) stagedSelectionOf(uid int64, sel stagedSelector) (stagedSelection, *refusal, error) {
	var out stagedSelection
	if len(sel.IDs) == 0 && len(sel.WorkIDs) == 0 && sel.BatchID <= 0 && !sel.All {
		return out, &refusal{http.StatusBadRequest, "nothing selected"}, nil
	}
	if len(sel.IDs) > maxStagedSelection || len(sel.WorkIDs) > maxStagedSelection {
		return out, &refusal{http.StatusBadRequest, "too many items (max 5000)"}, nil
	}

	// The selector's own predicates, shared by both reads.
	where := ` WHERE b.user_id = ?`
	args := []any{uid}
	if len(sel.WorkIDs) > 0 {
		where += ` AND w.id IN (` + inClause(len(sel.WorkIDs)) + `)`
		args = append(args, int64sAsAny(sel.WorkIDs)...)
	}
	if sel.BatchID > 0 {
		where += ` AND b.id = ?`
		args = append(args, sel.BatchID)
	}

	scan := func(q string, qargs []any) ([]int64, error) {
		rows, err := s.Store.DB.Query(q, qargs...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var ids []int64
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				olog.Warnf(olog.CodeImportRowScan, "[import] staged selection row scan failed: %v", err)
				continue
			}
			ids = append(ids, id)
		}
		return ids, rows.Err()
	}

	quoteQ := `SELECT q.id FROM staged_quotes q
	             JOIN staged_works w ON w.id = q.staged_work_id
	             JOIN import_batches b ON b.id = w.batch_id` + where
	quoteArgs := args
	if len(sel.IDs) > 0 {
		quoteQ += ` AND q.id IN (` + inClause(len(sel.IDs)) + `)`
		quoteArgs = append(append([]any{}, args...), int64sAsAny(sel.IDs)...)
	}
	quoteIDs, err := scan(quoteQ+` ORDER BY q.id`, quoteArgs)
	if err != nil {
		return out, nil, err
	}
	out.QuoteIDs = quoteIDs

	// An explicit id list names quotes, so its works are exactly the works those
	// quotes sit under — naming a quote must never drag its quoteless siblings in.
	// A work/batch/all selector names works directly, empty ones included.
	if len(sel.IDs) > 0 {
		seen := map[int64]bool{}
		if err := chunkIDs(quoteIDs, func(batch []int64) error {
			ids, err := scan(`SELECT DISTINCT staged_work_id FROM staged_quotes WHERE id IN (`+
				inClause(len(batch))+`)`, int64sAsAny(batch))
			if err != nil {
				return err
			}
			for _, id := range ids {
				if !seen[id] {
					seen[id] = true
					out.WorkIDs = append(out.WorkIDs, id)
				}
			}
			return nil
		}); err != nil {
			return out, nil, err
		}
	} else {
		workIDs, err := scan(`SELECT w.id FROM staged_works w
		                       JOIN import_batches b ON b.id = w.batch_id`+where+` ORDER BY w.id`, args)
		if err != nil {
			return out, nil, err
		}
		out.WorkIDs = workIDs
	}

	if len(out.QuoteIDs) == 0 && len(out.WorkIDs) == 0 {
		return out, &refusal{http.StatusNotFound, "no matching staged quotes"}, nil
	}
	return out, nil, nil
}

// joinTags / splitStoredList are the denormalized tag+genre encoding these tables
// use instead of join rows: a tag that exists only in an unapproved import must
// not appear in the user's vocabulary, so it stays plain text until approval.
func joinTags(names []string) string {
	return strings.Join(cleanNames(names), ", ")
}

func splitStoredList(s string) []string {
	out := []string{}
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
