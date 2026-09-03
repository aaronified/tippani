package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// annotationReq is quoteReq plus the book locator: where in the book the
// passage sits. See quote.go for the shared half.
type annotationReq struct {
	quoteReq
	BookID int64 `json:"book_id"`
	// Chapter is the chapter's NAME; ChapterNo is its number (0044). Both optional
	// and independent — most books give a number and no name, an essay collection
	// the reverse. 0 is absent, which is series_index's convention for the same
	// shape of field; see the migration for what that costs.
	Chapter   string  `json:"chapter"`
	ChapterNo float64 `json:"chapter_no"`
	Location  string  `json:"location"`
	// Who says it (0047). A NOVEL HAS SPEAKERS AND NOT A CAST, which is why this is
	// the only one of the dialogue's three credit fields that crosses over: there is
	// no actor to autofill from, because nobody plays Ahab in a book. Spelled
	// `character` and not `speaker` deliberately — it is the same word for the same
	// column the screen side already uses, so `character:Ahab` is one facet and one
	// vocabulary rather than two that have to be kept in step.
	Character string `json:"character"`
}

func (a *annotationReq) validate() string {
	if msg := a.quoteReq.validate(); msg != "" {
		return msg
	}
	// A book highlight may be a standalone note with no quote — a thought about
	// the page rather than a passage from it. A dialogue may not.
	if a.Quote == "" && a.Note == "" {
		return "quote or note is required"
	}
	var ok bool
	if a.Chapter, ok = trimCap(a.Chapter, 128); !ok {
		return "chapter too long (max 128 characters)"
	}
	if a.Location, ok = trimCap(a.Location, 128); !ok {
		return "location too long (max 128 characters)"
	}
	// 128, the same cap the dialogue's character carries — same column, same word,
	// and a line credited to two of them ("Rosencrantz & Guildenstern") has to fit
	// on both sides or the facet finds one and not the other.
	if a.Character, ok = trimCap(a.Character, 128); !ok {
		return "character too long (max 128 characters)"
	}
	// Through chapterNoProblem, the same function the two bulk editors call, so a
	// number this form accepts can never be one the selection bar refuses. The bound
	// it applies is generous rather than meaningful: nothing has ten thousand
	// chapters, and the point is to catch a page number, a year or a whole locator
	// pasted into the number box and say so.
	if msg := chapterNoProblem(strconv.FormatFloat(a.ChapterNo, 'f', -1, 64)); msg != "" {
		return msg
	}
	return ""
}

// favoriteFilter appends the PLAN §3 favorite=1 list filter (shared by
// annotations and dialogues) for the given table alias. Writes a 400 and
// returns false on a bad value. The args param is retained for a stable
// signature across callers even though the favorite filter binds no value.
func favoriteFilter(w http.ResponseWriter, r *http.Request, alias string, q *string, args *[]any) bool {
	if v := r.URL.Query().Get("favorite"); v != "" {
		if v != "1" {
			writeErr(w, http.StatusBadRequest, "favorite filter must be 1")
			return false
		}
		*q += ` AND ` + alias + `.favorite = 1`
	}
	return true
}

// annotationRow is quoteRow plus the book locator and the parent attribution
// that cross-book lists (Home favourites) render. See quote.go for the shared
// half.
type annotationRow struct {
	quoteRow
	BookID     int64   `json:"book_id"`
	BookTitle  string  `json:"book_title"`  // parent attribution for cross-book lists
	BookAuthor string  `json:"book_author"` // "" if unknown
	Chapter    string  `json:"chapter"`
	ChapterNo  float64 `json:"chapter_no"`
	Location   string  `json:"location"`
	Character  string  `json:"character"` // 0047; see annotationReq.Character
	// The stored picture for each character named on this line (0050). It rides
	// BESIDE Character rather than in quoteRow for the identical reason Character
	// does: the third kind has no characters at all — a standalone quote has a
	// SPEAKER, a person rather than a role — so promoting it would put a
	// permanently empty field on utterances to spare two structs a line. The
	// parity test spells that argument out and now names both.
	//
	// A BOOK'S CHARACTER HAS A PICTURE FOR THE SAME REASON A FILM'S DOES: the
	// reader can add a cast row on a book (0048) and give it a picture (0050), and
	// nobody plays Ahab but somebody has drawn him.
	CharacterImages []characterImage `json:"character_images,omitempty"`
	// WHO SAID IT, as opposed to who is NAMED on the line above. `speaker_cast_id`
	// has been stored since 0056 and serialised by nothing since — see
	// quote_speaker.go for why the two are different questions and why this cannot
	// be derived from CharacterImages. It rides beside Character for that field's
	// own stated reason: an utterance has no cast to point into, so promoting it to
	// quoteRow would put a permanently null field on the third kind.
	SpeakerCast *quoteSpeakerCast `json:"speaker_cast,omitempty"`
	// The book's exclusion is NOT here beside the title and the author, though it
	// is borrowed from the same row: it is quoteRow.WorkReviewExcluded, shared
	// with dialogues. See that field for why the parity test settled it.
}

func (s *Server) fetchAnnotation(uid, id int64) (*annotationRow, error) {
	var a annotationRow
	// Scanned into a local rather than onto the row: the column is the LINK and
	// what ships is the resolved chip, so annotationRow never carries the raw id.
	var castID int64
	err := s.Store.DB.QueryRow(`
		SELECT a.id, a.book_id, b.title, COALESCE(b.author, ''),
		       COALESCE(a.quote, ''), COALESCE(a.note, ''), a.translation, a.color,
		       COALESCE(a.chapter, ''), COALESCE(a.chapter_no, 0), COALESCE(a.location, ''),
		       a.character, a.favorite,
		       COALESCE(a.noted_at, ''), a.sticker_id, a.sticker_x, a.sticker_y, a.created_at, a.updated_at,
		       a.review_excluded, b.review_excluded, COALESCE(a.speaker_cast_id, 0)
		FROM annotations a JOIN books b ON b.id = a.book_id
		WHERE a.id = ? AND b.user_id = ?`, id, uid).
		Scan(&a.ID, &a.BookID, &a.BookTitle, &a.BookAuthor, &a.Quote, &a.Note, &a.Translation, &a.Color,
			&a.Chapter, &a.ChapterNo, &a.Location, &a.Character,
			&a.Favorite, &a.NotedAt, &a.StickerID, &a.StickerX, &a.StickerY, &a.CreatedAt, &a.UpdatedAt,
			&a.ReviewExcluded, &a.WorkReviewExcluded, &castID)
	if err != nil {
		return nil, err
	}
	a.SpeakerCast = speakerFor(s.loadQuoteSpeakers(uid, []int64{castID}), castID)
	a.Tags = []string{}
	rows, err := s.Store.DB.Query(`
		SELECT t.name FROM annotation_tags at JOIN tags t ON t.id = at.tag_id
		WHERE at.annotation_id = ? ORDER BY t.name`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeAnnoRowScan, "[anno] annotation tags row scan failed: %v", err)
			continue
		}
		a.Tags = append(a.Tags, n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeAnnoRowScan, "[anno] annotation tags row iteration failed: %v", err)
	}
	return &a, nil
}

func (s *Server) handleCreateAnnotation(w http.ResponseWriter, r *http.Request) {
	var req annotationReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[anno] handleCreateAnnotation uid=%v book_id=%v", uid, req.BookID)
	var owned bool
	if err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM books WHERE id = ? AND user_id = ?)`,
		req.BookID, uid).Scan(&owned); err != nil {
		internalError(w, r, "check book ownership", err)
		return
	}
	if !owned { // someone else's book looks identical to a missing one
		writeErr(w, http.StatusNotFound, "book not found")
		return
	}
	if !s.stickerOwned(uid, req.StickerID) {
		writeErr(w, http.StatusBadRequest, "sticker not found")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	// noted_at defaults to now (the "date of addition"); imports set it from the
	// source, and a client flushing an offline capture sends the date it was
	// actually taken — COALESCE picks whichever applies.
	// The id is allocated rather than left to SQLite, so a deleted quote's id is
	// never handed to a new one — see id_floor.go. Everything downstream uses this
	// value instead of LastInsertId().
	id, err := nextID(tx, "annotations")
	if err != nil {
		internalError(w, r, "reserve annotation id", err)
		return
	}
	res, err := tx.Exec(`
		INSERT INTO annotations (id, book_id, quote, note, translation, color, chapter, chapter_no, location, character,
		                         favorite, source, dedupe_hash, noted_at, sticker_id, sticker_x, sticker_y,
		                         review_excluded)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?,
		        -- INHERITED FROM THE BOOK, which is the one job its column still has.
		        -- The deck reads this row's flag and not its book's, so "skip this
		        -- reference manual" has to reach the highlight added tomorrow at the
		        -- moment it is added rather than by being ANDed in at query time.
		        (SELECT COALESCE(review_excluded, 0) FROM books WHERE id = ?)) ON CONFLICT DO NOTHING`,
		id, req.BookID, nullable(req.Quote), nullable(req.Note),
		// A plain string like `character` below and for the identical reason: 0051's
		// column is NOT NULL DEFAULT '', and nullable("") is nil — the constraint
		// violation rather than the empty value.
		req.Translation, req.Color,
		nullable(req.Chapter), nullableFloat(req.ChapterNo), nullable(req.Location),
		// A PLAIN STRING, not nullable(): character is NOT NULL DEFAULT '' (0047), and
		// nullable("") is nil, which is the constraint violation rather than the empty
		// value. Every column 0047 adds has this trap.
		req.Character,
		req.Favorite, req.Source, req.hash(),
		nullable(req.NotedAt), req.StickerID, req.StickerX, req.StickerY, req.BookID)
	if err != nil {
		internalError(w, r, "insert annotation", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 { // same dedupe_hash already in this book
		// Release this transaction's connection BEFORE reading the existing row.
		//
		// The pool is capped at 4 (store.Open's SetMaxOpenConns), and the lookup
		// below goes through s.Store.DB, which needs a SECOND connection. Holding
		// the tx across it self-deadlocks once the pool is saturated: the handler
		// blocks waiting for a connection that only it can free, so the request
		// hangs until busy_timeout turns it into a 500. Concurrent duplicate posts
		// — an offline client flushing a queue is exactly that — reach it over
		// plain HTTP. See TestDuplicatePostUnderPoolPressure.
		//
		// Rolling back here is safe and complete: the INSERT matched nothing, so
		// there is no work to commit. The deferred Rollback still runs and returns
		// ErrTxDone, which is ignored.
		_ = tx.Rollback()

		// Hand back the row holding this (book_id, dedupe_hash) slot so an
		// offline client retrying an unacknowledged POST can tell its own
		// earlier write from a real clash (see writeConflictExisting).
		var existingID int64
		switch err := s.Store.DB.QueryRow(
			`SELECT id FROM annotations WHERE book_id = ? AND dedupe_hash = ?`,
			req.BookID, req.hash()).Scan(&existingID); {
		case errors.Is(err, sql.ErrNoRows):
			// A concurrent delete removed it between the failed insert and this
			// read. Still a duplicate as far as this request went, just with
			// nothing left to point at.
			writeErr(w, http.StatusConflict, "duplicate annotation")
			return
		case err != nil:
			internalError(w, r, "locate duplicate annotation", err)
			return
		}
		existing, err := s.fetchAnnotation(uid, existingID)
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, http.StatusConflict, "duplicate annotation")
			return
		}
		if err != nil {
			internalError(w, r, "fetch duplicate annotation", err)
			return
		}
		writeConflictExisting(w, "duplicate annotation", existing)
		return
	}
	if err := setTags(tx, "annotation", uid, id, req.Tags); err != nil {
		internalError(w, r, "set tags", err)
		return
	}
	// THE SPEAKER IS A CAST ROW AND NOT ONLY A STRING. See store/quote_cast.go: the
	// column has existed since characters got records and nothing wrote it, so every
	// reader of "which cast row said this" folded the text instead — three folds
	// that could disagree, and no way to ask the question in reverse.
	if err := store.SyncQuoteCast(tx, uid, "book", id, s.creditSeps(uid)); err != nil {
		internalError(w, r, "link annotation speaker", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	a, err := s.fetchAnnotation(uid, id)
	if err != nil {
		internalError(w, r, "fetch annotation", err)
		return
	}
	writeJSON(w, http.StatusCreated, a)
}

func (s *Server) handleListAnnotations(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[anno] handleListAnnotations uid=%v book_id=%q color=%q tag=%q", uid,
		r.URL.Query().Get("book_id"), r.URL.Query().Get("color"), r.URL.Query().Get("tag"))
	q := `
		SELECT a.id, a.book_id, b.title, COALESCE(b.author, ''),
		       COALESCE(a.quote, ''), COALESCE(a.note, ''), a.translation, a.color,
		       COALESCE(a.chapter, ''), COALESCE(a.chapter_no, 0), COALESCE(a.location, ''),
		       a.character, a.favorite,
		       COALESCE(a.noted_at, ''), a.sticker_id, a.sticker_x, a.sticker_y, a.created_at, a.updated_at,
		       r.item_id IS NOT NULL, COALESCE(r.stability, 0), COALESCE(r.last_reviewed_at, ''), COALESCE(r.last_result, ''),
		       a.review_excluded, b.review_excluded, COALESCE(a.speaker_cast_id, 0)
		FROM annotations a JOIN books b ON b.id = a.book_id
		LEFT JOIN item_reviews r ON r.kind = 'book' AND r.item_id = a.id
		WHERE b.user_id = ?`
	args := []any{uid}
	if v := r.URL.Query().Get("book_id"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "invalid book_id")
			return
		}
		q += ` AND a.book_id = ?`
		args = append(args, id)
	}
	// One row, for the review card's in-card edit — see idFilter.
	if !idFilter(w, r, "a", &q, &args) {
		return
	}
	if !colorFilter(w, r, "a", &q, &args) {
		return
	}
	if v := r.URL.Query().Get("tag"); v != "" {
		q += ` AND EXISTS (SELECT 1 FROM annotation_tags at JOIN tags t ON t.id = at.tag_id
		                   WHERE at.annotation_id = a.id AND t.name = ?)`
		args = append(args, v)
	}
	if !favoriteFilter(w, r, "a", &q, &args) {
		return
	}
	q += ` ORDER BY a.created_at DESC, a.id DESC`
	// Optional cap for widgets that only need the newest few (e.g. the Home
	// screen's "recently favourited" pair), and the offset a client mirroring
	// the library pages with — without either, the whole set ships.
	if !applyPaging(w, r, &q, &args) {
		return
	}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		internalError(w, r, "list annotations", err)
		return
	}
	defer rows.Close()
	items := []annotationRow{}
	// Parallel to `items`, because the link is a column and the chip is a join:
	// the ids are collected in the scan loop and resolved in one query after it,
	// exactly as the character pictures below are.
	castIDs := []int64{}
	for rows.Next() {
		var a annotationRow
		var castID int64
		a.Tags = []string{}
		if err := rows.Scan(&a.ID, &a.BookID, &a.BookTitle, &a.BookAuthor, &a.Quote, &a.Note, &a.Translation, &a.Color,
			&a.Chapter, &a.ChapterNo, &a.Location, &a.Character,
			&a.Favorite, &a.NotedAt, &a.StickerID, &a.StickerX, &a.StickerY, &a.CreatedAt, &a.UpdatedAt,
			&a.Reviewed, &a.Stability, &a.LastReviewedAt, &a.LastResult,
			&a.ReviewExcluded, &a.WorkReviewExcluded, &castID); err != nil {
			// Never silently drop a row: a scan error means the SELECT and the
			// annotationRow struct drifted apart (e.g. a migration added a column),
			// which would otherwise show up as a mysteriously short/empty list with a
			// 200 — exactly the kind of "favourites vanished" symptom that's painful
			// to trace. Log it loudly and keep going.
			olog.Warnf(olog.CodeAnnoRowScan, "[annotations] list row scan failed (schema/query drift?): %v", err)
			continue
		}
		items = append(items, a)
		castIDs = append(castIDs, castID)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeAnnoRowScan, "[annotations] list row iteration failed: %v", err)
	}
	if found := s.loadQuoteSpeakers(uid, castIDs); len(found) > 0 {
		for i := range items {
			items[i].SpeakerCast = speakerFor(found, castIDs[i])
		}
	}
	// One query fills every row's character pictures, the same shape the tag lists
	// below use. Best-effort: a library with no character art renders as it did.
	refs := make([]characterImageRef, 0, len(items))
	for _, a := range items {
		if a.Character != "" {
			refs = append(refs, characterImageRef{WorkID: a.BookID, Character: a.Character})
		}
	}
	if found := s.loadCharacterImages(uid, "book", refs); len(found) > 0 {
		seps := s.creditSeps(uid)
		for i := range items {
			items[i].CharacterImages = characterImagesFor(found, seps, items[i].BookID, items[i].Character)
		}
	}

	// One query fills all tag lists (tags are per-user, so this can't leak).
	tagRows, err := s.Store.DB.Query(`
		SELECT at.annotation_id, t.name FROM annotation_tags at
		JOIN tags t ON t.id = at.tag_id WHERE t.user_id = ? ORDER BY t.name`, uid)
	if err != nil {
		internalError(w, r, "load tags", err)
		return
	}
	defer tagRows.Close()
	byAnn := map[int64][]string{}
	for tagRows.Next() {
		var id int64
		var n string
		if err := tagRows.Scan(&id, &n); err != nil {
			olog.Warnf(olog.CodeAnnoRowScan, "[anno] tag row scan failed: %v", err)
			continue
		}
		byAnn[id] = append(byAnn[id], n)
	}
	if err := tagRows.Err(); err != nil {
		olog.Warnf(olog.CodeAnnoRowScan, "[anno] tag row iteration failed: %v", err)
	}
	for i := range items {
		if ts := byAnn[items[i].ID]; ts != nil {
			items[i].Tags = ts
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"annotations": items})
}

func (s *Server) handleUpdateAnnotation(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid annotation id")
		return
	}
	var req annotationReq // full new state; book_id in the body is ignored
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[anno] handleUpdateAnnotation uid=%v id=%v", uid, id)
	var bookID int64
	var wasFavorite bool
	err := s.Store.DB.QueryRow(`
		SELECT a.book_id, a.favorite FROM annotations a JOIN books b ON b.id = a.book_id
		WHERE a.id = ? AND b.user_id = ?`, id, uid).Scan(&bookID, &wasFavorite)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "annotation not found")
		return
	case err != nil:
		internalError(w, r, "load annotation", err)
		return
	}
	hash := req.hash()
	var clash bool
	if err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM annotations WHERE book_id = ? AND dedupe_hash = ? AND id <> ?)`,
		bookID, hash, id).Scan(&clash); err != nil {
		internalError(w, r, "check duplicate annotation", err)
		return
	}
	if clash { // the edit now collides with a sibling annotation
		writeErr(w, http.StatusConflict, "duplicate annotation")
		return
	}
	if !s.stickerOwned(uid, req.StickerID) {
		writeErr(w, http.StatusBadRequest, "sticker not found")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`
		UPDATE annotations SET quote = ?, note = ?, translation = ?, color = ?, chapter = ?, chapter_no = ?, location = ?,
		       character = ?,
		       favorite = ?, dedupe_hash = ?, sticker_id = ?, sticker_x = ?, sticker_y = ?, updated_at = datetime('now')
		WHERE id = ?`,
		nullable(req.Quote), nullable(req.Note), req.Translation, req.Color,
		nullable(req.Chapter), nullableFloat(req.ChapterNo), nullable(req.Location),
		req.Character, // plain string — NOT NULL DEFAULT '', see the create path
		req.Favorite, hash, req.StickerID, req.StickerX, req.StickerY, id); err != nil {
		internalError(w, r, "update annotation", err)
		return
	}
	if err := setTags(tx, "annotation", uid, id, req.Tags); err != nil {
		internalError(w, r, "set tags", err)
		return
	}
	// The speaker link follows the name it was edited to — see the create path.
	if err := store.SyncQuoteCast(tx, uid, "book", id, s.creditSeps(uid)); err != nil {
		internalError(w, r, "link annotation speaker", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	// Favouriting a quote counts as "seeing" it (marginal half-life bump); only
	// on the false→true transition, so re-saving a favourite doesn't re-credit.
	if req.Favorite && !wasFavorite {
		s.applySeen(uid, kindBook, id)
	}
	a, err := s.fetchAnnotation(uid, id)
	if err != nil {
		internalError(w, r, "fetch annotation", err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

// handleDeleteAnnotation bins the quote, then deletes it (see trash.go). Tag join
// rows cascade and the item_reviews row goes with it via the 0015 trigger — both
// are in the snapshot first, so a restore brings the tags and the review schedule
// back with the words. The tags themselves persist either way (managed
// vocabulary, §10).
func (s *Server) handleDeleteAnnotation(w http.ResponseWriter, r *http.Request) {
	s.binDelete(w, r, "annotation", "annotation not found", nil, nil)
}
