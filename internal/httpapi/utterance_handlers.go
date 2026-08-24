package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// Utterances: quotes belonging to no book and no film (ROADMAP §24) — a line
// from a speech, a letter, an interview, a song, a proverb.
//
// The third kind, and the odd one out in exactly one respect: OWNERSHIP.
//
// An annotation is owned through its book and a dialogue through its film, so
// `JOIN books b ON b.id = a.book_id WHERE b.user_id = ?` is simultaneously the
// parent join and the access check. Forgetting to scope one of those queries is
// not really possible — there is nothing to select from without the join.
//
// An utterance has no parent, so that safety net does not exist. EVERY query in
// this file carries its own `WHERE user_id = ?`, and a missing one is a
// cross-account leak rather than a hidden row. Per-user isolation is a security
// property here, not a layout choice: a foreign row answers 404 and never 403,
// because 403 confirms the row exists. There is an ownership test per endpoint.
//
// Everything else is deliberately the same as the other two kinds. The shared
// half of the payload and the response come from quoteReq/quoteRow in quote.go,
// embedded anonymously so the JSON stays flat, and colours, tags, notes,
// favourites, stickers and the review dot all behave identically.

// quoteKinds is WHAT KIND OF THING a standalone quote is (0053) — the fixed list
// that replaced the free-text `medium` 0026 gave this table.
//
// THE EMPTY STRING IS A LEGAL VALUE and it is the default: a quote whose kind
// nobody has said is
// not an 'other'. 'other' is a decision, and a default pretending to be one is a
// lie the interface then reports as a fact. So the empty string is in the CHECK, in
// this list, and in the interface as "(not set)".
//
// WIDENING IT IS A MIGRATION, not an edit here — the CHECK is on the column. That
// is the cost of a fixed vocabulary, and it is worth paying: `medium` was free text
// and the Quotes board groups on it, so grouping produced one shelf per spelling
// and nothing could tell you that "Speech" and "speech" were the same kind of
// thing.
var quoteKinds = []string{"", "speech", "letter", "essay", "proverb", "other"}

func validQuoteKind(k string) bool {
	for _, v := range quoteKinds {
		if k == v {
			return true
		}
	}
	return false
}

// quoteKindList is the human list for an error message, built from the set for the
// reason quoteCategoryList is. The empty value is skipped, because a list that
// starts with nothing is not a sentence and "omit it" is what it would mean.
func quoteKindList() string {
	named := quoteKinds[1:]
	return strings.Join(named[:len(named)-1], ", ") + " or " + named[len(named)-1]
}

// quoteCategories is what KIND of standalone quote a row is (0035), in the order
// the screens are offered. Unlike annotationColors this is NOT append-only for a
// schema reason — the CHECK is on one column of one table — but it is still a
// migration to widen, so a fourth value is a schema change and not a code one.
//
// 'other' is last and is the default: it is the residual bucket, and a value a
// client omitted has to land somewhere that claims nothing about the quote.
var quoteCategories = []string{"proverb", "speech", "other"}

func validQuoteCategory(c string) bool {
	for _, v := range quoteCategories {
		if c == v {
			return true
		}
	}
	return false
}

// quoteCategoryList is the human list for an error message, built from the set
// for the reason colorList is — one place to forget when the set grows.
func quoteCategoryList() string {
	return strings.Join(quoteCategories[:len(quoteCategories)-1], ", ") +
		" or " + quoteCategories[len(quoteCategories)-1]
}

// utteranceReq is quoteReq plus the occasion — this kind's locator.
type utteranceReq struct {
	quoteReq
	Speaker      string `json:"speaker"`
	Occasion     string `json:"occasion"`      // a rally, a broadcast, a letter, a recording
	OccasionDate string `json:"occasion_date"` // PARTIAL: YYYY | YYYY-MM | YYYY-MM-DD
	Place        string `json:"place"`
	// SUPERSEDED BY Kind (0053) and still accepted. Free text, and the interface no
	// longer offers a box for it — but it is on every row already stored, the
	// Markdown export writes it, and the importer reads it back, so refusing it here
	// would make a backup taken yesterday fail to restore today.
	Medium string `json:"medium"` // radio, speech, letter, interview, song
	// 0053. What kind of thing this quote is, from a fixed list: speech, letter,
	// essay, proverb, other — or '' for "nobody has said". This is what `medium`
	// was trying to be and could not, because a hand-typed value cannot be grouped
	// on. See the vocabulary above.
	Kind string `json:"kind"`
	// 0035. Which of the three boards this quote lives on, and — for a line that
	// is not in the reader's own language — what it says.
	//
	// Category is where you FILED it, not what it is, which is why it stays out of
	// the dedupe hash: the same words filed as a proverb and as an other are one
	// saved line somebody moved. See 0035's header for the full argument.
	Category string `json:"category"` // "" -> "other" (0035; superseded by BoardID)
	// BoardID is where it is FILED (0036), and it supersedes Category. A pointer
	// so that absent and zero are different things: absent means "the default
	// board", which is what the ＋ pressed outside a board sends, while a zero
	// would be a board id that cannot exist and is worth a 400.
	BoardID *int64 `json:"board_id"`
	// A plain language name ('Bengali'), not a BCP-47 tag, and free text rather
	// than an enum — the set of languages is the reader's, not this schema's.
	//
	// STILL PER-KIND, though the translation it pairs with is now shared (0051).
	// This kind has no parent to ask: a book's language is on the book and a
	// proverb's is nowhere else, so the field is meaningful here and unfillable on
	// the other two. See quoteReq.Translation.
	Language string `json:"language"`
	// 0047 — the fields the kinds a board can now hold actually carry. Which of
	// them a form OFFERS is the board's kind's business; which of them this table
	// STORES is all of them, because the kind lives on the board and a quote moved
	// from one board to another must not lose a field on the way.
	//
	// Region pairs with Language: a Bengali proverb from Sylhet is not one from
	// Kolkata. Recipient is what makes a letter a letter. WorkTitle and Locator are
	// an essay's two — and they are named GENERICALLY on purpose, so that poem,
	// lyrics and article are one day a label and a list entry rather than another
	// migration. Those kinds are not being added; do not read this as a promise.
	Region    string `json:"region"`
	Recipient string `json:"recipient"`
	WorkTitle string `json:"work_title"`
	Locator   string `json:"locator"`
	// Whether the occasion date is approximate — "around 1890". A plain bool with
	// no cross-field rule, exactly like bookReq.PublishedCirca: a reader who ticks
	// it before typing the year has not made a mistake worth a 400, and the box
	// clears with the date it describes on the next save because every PUT here is
	// full-state.
	//
	// DELIBERATELY OUT OF THE DEDUPE HASH, though occasion_date is in it: ticking a
	// precision box says nothing new about which quote this is, and folding it in
	// would make the tick fork a duplicate on the next import of the same file. See
	// store.UtteranceDedupeHash.
	OccasionCirca bool `json:"occasion_circa"`
}

// validate runs the shared rules, then this kind's own.
func (u *utteranceReq) validate() string {
	if msg := u.quoteReq.validate(); msg != "" {
		return msg
	}
	for _, f := range []struct {
		name string
		v    *string
		max  int
	}{
		{"speaker", &u.Speaker, 200},
		{"occasion", &u.Occasion, 200},
		{"place", &u.Place, 200},
		{"medium", &u.Medium, 100},
		{"language", &u.Language, 100},
		// 0047. Region is a place name, so it is sized like `place`'s smaller
		// sibling; recipient and work title are 200 because a name and a title are
		// the shape `speaker` and `occasion` already are; locator is 128 because it
		// is a locator, and every locator in this schema is 128.
		{"region", &u.Region, 100},
		{"recipient", &u.Recipient, 200},
		{"work title", &u.WorkTitle, 200},
		{"locator", &u.Locator, 128},
	} {
		s, ok := trimCap(*f.v, f.max)
		if !ok {
			return f.name + " is too long"
		}
		*f.v = s
	}
	// An omitted category is 'other' rather than a 400, matching the column
	// default — an older client that has never heard of 0035 goes on saving
	// quotes, and they land in the bucket that claims nothing.
	if u.Category == "" {
		u.Category = "other"
	}
	if !validQuoteCategory(u.Category) {
		return "category must be " + quoteCategoryList()
	}
	// AN OMITTED KIND IS '' AND NOT A 400 — the column default, and the honest
	// value: a client that has never heard of 0053 is not claiming this quote is an
	// 'other', it is saying nothing. A value that is not on the list IS a 400,
	// because a fixed vocabulary that silently accepts anything is free text with
	// extra steps.
	u.Kind = strings.ToLower(strings.TrimSpace(u.Kind))
	if !validQuoteKind(u.Kind) {
		return "kind must be " + quoteKindList()
	}

	// A quote with no words is not a quote by anything the word could mean. An
	// annotation may be a bare note about a page, because the page is the thing
	// being remembered; here there is no page, so the text is all there is.
	if u.Quote == "" {
		return "a quote is required"
	}
	// The occasion date is PARTIAL by design — "1944" is usually the honest
	// answer, and padding it to a January morning invents precision nobody has.
	// normalizePartialDate is the shelf read log's validator, reused rather than
	// reimplemented: same three shapes, same calendar checks, same message, so
	// the two places in the app that accept a partial date cannot disagree about
	// what one is.
	if msg := normalizePartialDate("occasion date", &u.OccasionDate); msg != "" {
		return msg
	}
	return ""
}

// hash folds the occasion in, because for this kind the locator DISCRIMINATES:
// the same words said on two occasions are two quotes. See
// store.UtteranceDedupeHash for which of the five occasion fields count and why
// place and medium do not.
func (u *utteranceReq) hash() string {
	return store.UtteranceDedupeHash(u.Quote, u.Speaker, u.Occasion, u.OccasionDate)
}

// utteranceRow is quoteRow plus the occasion. See quote.go for the shared half.
type utteranceRow struct {
	quoteRow
	Speaker      string `json:"speaker"`
	Occasion     string `json:"occasion"`
	OccasionDate string `json:"occasion_date"`
	Place        string `json:"place"`
	Medium       string `json:"medium"`
	// 0053. On the list row for the reason category is: it is what the card says a
	// quote IS, and a board that had to fetch each quote singly to caption its own
	// shelf is the thing the two-level screen exists to avoid.
	Kind string `json:"kind"`
	// 0035. On the LIST row as well as the single read, unlike book credits: the
	// board a quote belongs on is what the client needs in order to draw the
	// board at all. The translation moved to quoteRow in 0051 and reaches this
	// shape by embedding, for the same reason and on all three kinds.
	Category string `json:"category"`
	Language string `json:"language"`
	// 0047. On the list row as well, for the reason the two above are: these are
	// what the card DRAWS on a proverb, a letter and an essay board, and a board
	// that had to fetch each quote singly to render its own shelf is the thing the
	// two-level screen exists to avoid.
	Region        string `json:"region"`
	Recipient     string `json:"recipient"`
	WorkTitle     string `json:"work_title"`
	Locator       string `json:"locator"`
	OccasionCirca bool   `json:"occasion_circa"`
	// 0036. The board this quote is filed on. Always set — the migration
	// backfilled every existing row and the API never writes a null — so the
	// client can key on it without a "no board" branch.
	BoardID int64 `json:"board_id"`
}

// utteranceCols includes the LEFT-JOINed spaced-repetition state; every SELECT
// using it must add utteranceReviewJoin.
const utteranceCols = `u.id, u.quote, COALESCE(u.note, ''), u.color, u.favorite,
	u.speaker, u.occasion, u.occasion_date, u.place, u.medium, COALESCE(u.kind, ''),
	u.category, u.language, u.translation, COALESCE(u.board_id, 0),
	u.region, u.recipient, u.work_title, u.locator, u.occasion_circa,
	COALESCE(u.noted_at, ''), u.sticker_id, u.sticker_x, u.sticker_y, u.created_at, u.updated_at,
	r.item_id IS NOT NULL, COALESCE(r.stability, 0), COALESCE(r.last_reviewed_at, ''), COALESCE(r.last_result, ''),
	u.review_excluded`

const utteranceReviewJoin = ` LEFT JOIN item_reviews r ON r.kind = 'utterance' AND r.item_id = u.id`

func scanUtterance(sc interface{ Scan(...any) error }) (utteranceRow, error) {
	var u utteranceRow
	err := sc.Scan(&u.ID, &u.Quote, &u.Note, &u.Color, &u.Favorite,
		&u.Speaker, &u.Occasion, &u.OccasionDate, &u.Place, &u.Medium, &u.Kind,
		&u.Category, &u.Language, &u.Translation, &u.BoardID,
		&u.Region, &u.Recipient, &u.WorkTitle, &u.Locator, &u.OccasionCirca,
		&u.NotedAt, &u.StickerID, &u.StickerX, &u.StickerY, &u.CreatedAt, &u.UpdatedAt,
		&u.Reviewed, &u.Stability, &u.LastReviewedAt, &u.LastResult, &u.ReviewExcluded)
	u.Tags = []string{}
	return u, err
}

func (s *Server) fetchUtterance(uid, id int64) (*utteranceRow, error) {
	u, err := scanUtterance(s.Store.DB.QueryRow(
		`SELECT `+utteranceCols+` FROM utterances u`+utteranceReviewJoin+`
		 WHERE u.id = ? AND u.user_id = ?`, id, uid))
	if err != nil {
		return nil, err
	}
	rows, err := s.Store.DB.Query(`
		SELECT t.name FROM utterance_tags ut JOIN tags t ON t.id = ut.tag_id
		WHERE ut.utterance_id = ? ORDER BY t.name`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeTagRowScan, "[utt] tag row scan failed: %v", err)
			continue
		}
		u.Tags = append(u.Tags, n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeTagRowScan, "[utt] tag row iteration failed: %v", err)
	}
	return &u, nil
}

func (s *Server) handleCreateUtterance(w http.ResponseWriter, r *http.Request) {
	var req utteranceReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[utt] handleCreateUtterance uid=%v speaker=%q", uid, req.Speaker)
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
	id, err := nextID(tx, "utterances")
	if err != nil {
		internalError(w, r, "reserve quote id", err)
		return
	}
	// Where it is filed (0036). Resolved inside the transaction so a first quote
	// on a fresh account and the row that quote creates are one atomic act.
	boardID, err := resolveBoard(tx, uid, req.BoardID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "board not found")
		return
	}
	res, err := tx.Exec(`
		INSERT INTO utterances (id, user_id, quote, note, color, favorite,
		                        speaker, occasion, occasion_date, place, medium, kind,
		                        category, language, translation, board_id,
		                        region, recipient, work_title, locator, occasion_circa,
		                        source, dedupe_hash, noted_at, sticker_id, sticker_x, sticker_y)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?)
		ON CONFLICT DO NOTHING`,
		id, uid, req.Quote, nullable(req.Note), req.Color, req.Favorite,
		req.Speaker, req.Occasion, req.OccasionDate, req.Place, req.Medium, req.Kind,
		req.Category, req.Language, req.Translation, boardID,
		// Plain values, like the five above them: every column here is NOT NULL with
		// a zero-value default, so nullable() would turn "" into the violation.
		req.Region, req.Recipient, req.WorkTitle, req.Locator, req.OccasionCirca,
		req.Source, req.hash(), nullable(req.NotedAt), req.StickerID, req.StickerX, req.StickerY)
	if err != nil {
		internalError(w, r, "insert utterance", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 { // same (user_id, dedupe_hash) already here
		// Release this transaction's connection BEFORE reading the existing row —
		// the pool is capped at 4 and the lookup below needs a second connection,
		// so holding the tx across it self-deadlocks once the pool saturates. The
		// INSERT matched nothing, so there is no work to commit. See the same note
		// in handleCreateAnnotation and TestDuplicatePostUnderPoolPressure.
		_ = tx.Rollback()

		var existingID int64
		switch err := s.Store.DB.QueryRow(
			`SELECT id FROM utterances WHERE user_id = ? AND dedupe_hash = ?`,
			uid, req.hash()).Scan(&existingID); {
		case errors.Is(err, sql.ErrNoRows):
			writeErr(w, http.StatusConflict, "duplicate quote")
			return
		case err != nil:
			internalError(w, r, "locate duplicate quote", err)
			return
		}
		existing, err := s.fetchUtterance(uid, existingID)
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, http.StatusConflict, "duplicate quote")
			return
		}
		if err != nil {
			internalError(w, r, "fetch duplicate quote", err)
			return
		}
		writeConflictExisting(w, "duplicate quote", existing)
		return
	}
	if err := setTags(tx, "utterance", uid, id, req.Tags); err != nil {
		internalError(w, r, "set tags", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	u, err := s.fetchUtterance(uid, id)
	if err != nil {
		internalError(w, r, "fetch utterance", err)
		return
	}
	writeJSON(w, http.StatusCreated, u)
}

func (s *Server) handleListUtterances(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[utt] handleListUtterances uid=%v color=%q tag=%q speaker=%q", uid,
		r.URL.Query().Get("color"), r.URL.Query().Get("tag"), r.URL.Query().Get("speaker"))
	// The user scope is in the base query rather than appended by a filter, so
	// no combination of query parameters can produce a statement without it.
	q := `SELECT ` + utteranceCols + ` FROM utterances u` + utteranceReviewJoin + `
	      WHERE u.user_id = ?`
	args := []any{uid}
	if v := strings.TrimSpace(r.URL.Query().Get("speaker")); v != "" {
		q += ` AND u.speaker = ?`
		args = append(args, v)
	}
	// 0035. ?category= is what makes the three boards three boards, so a bad value
	// is a 400 rather than an empty list: a client asking for a category that does
	// not exist has a bug, and an empty board hides it.
	if v := strings.TrimSpace(r.URL.Query().Get("category")); v != "" {
		if !validQuoteCategory(v) {
			writeErr(w, http.StatusBadRequest, "category must be "+quoteCategoryList())
			return
		}
		q += ` AND u.category = ?`
		args = append(args, v)
	}
	// ?board= is the 0036 replacement for ?category=, and it is validated the same
	// way and for the same reason: a client asking for a board that is not theirs
	// has a bug, and an empty shelf hides it.
	if v := strings.TrimSpace(r.URL.Query().Get("board")); v != "" {
		bid, err := strconv.ParseInt(v, 10, 64)
		if err != nil || !boardOwned(s.Store.DB, uid, bid) {
			writeErr(w, http.StatusBadRequest, "board not found")
			return
		}
		q += ` AND u.board_id = ?`
		args = append(args, bid)
	}
	// ?language= is free text and therefore NOT validated — the set is whatever
	// has been typed, so an unknown value is legitimately an empty board.
	if v := strings.TrimSpace(r.URL.Query().Get("language")); v != "" {
		q += ` AND u.language = ?`
		args = append(args, v)
	}
	// One row, for the review card's in-card edit — see idFilter.
	if !idFilter(w, r, "u", &q, &args) {
		return
	}
	if !colorFilter(w, r, "u", &q, &args) {
		return
	}
	if v := r.URL.Query().Get("tag"); v != "" {
		q += ` AND EXISTS (SELECT 1 FROM utterance_tags ut JOIN tags t ON t.id = ut.tag_id
		                   WHERE ut.utterance_id = u.id AND t.name = ?)`
		args = append(args, v)
	}
	if !favoriteFilter(w, r, "u", &q, &args) {
		return
	}
	q += ` ORDER BY u.created_at DESC, u.id DESC`
	if !applyPaging(w, r, &q, &args) {
		return
	}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		internalError(w, r, "list utterances", err)
		return
	}
	defer rows.Close()
	items := []utteranceRow{} // not nil, so an empty result marshals as [] rather than null
	byID := map[int64]int{}
	for rows.Next() {
		u, err := scanUtterance(rows)
		if err != nil {
			olog.Warnf(olog.CodeUttRowScan, "[utt] row scan failed: %v", err)
			continue
		}
		byID[u.ID] = len(items)
		items = append(items, u)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeUttRowScan, "[utt] row iteration failed: %v", err)
	}
	if len(items) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"utterances": items})
		return
	}
	// Tags in one batch rather than per row, matching the other two kinds. Scoped
	// by user on BOTH sides: tags are per-user, and so are the quotes they hang on.
	trows, err := s.Store.DB.Query(`
		SELECT ut.utterance_id, t.name
		FROM utterance_tags ut
		JOIN tags t ON t.id = ut.tag_id
		JOIN utterances u ON u.id = ut.utterance_id
		WHERE t.user_id = ? AND u.user_id = ?
		ORDER BY t.name`, uid, uid)
	if err != nil {
		internalError(w, r, "list utterance tags", err)
		return
	}
	defer trows.Close()
	for trows.Next() {
		var id int64
		var name string
		if err := trows.Scan(&id, &name); err != nil {
			olog.Warnf(olog.CodeTagRowScan, "[utt] tag row scan failed: %v", err)
			continue
		}
		if i, ok := byID[id]; ok {
			items[i].Tags = append(items[i].Tags, name)
		}
	}
	if err := trows.Err(); err != nil {
		olog.Warnf(olog.CodeTagRowScan, "[utt] tag row iteration failed: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"utterances": items})
}

func (s *Server) handleUpdateUtterance(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid quote id")
		return
	}
	var req utteranceReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[utt] handleUpdateUtterance uid=%v id=%v", uid, id)
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
	// Read inside the transaction, and only to spot the favourite transition
	// below — the UPDATE still carries its own scope, so this is not a
	// permission check and a missing row needs no handling here.
	var wasFavorite bool
	_ = tx.QueryRow(`SELECT favorite FROM utterances WHERE id = ? AND user_id = ?`, id, uid).Scan(&wasFavorite)
	// EVERY PUT HERE IS FULL-STATE, so a body with no board_id would move the
	// quote to the default board rather than leave it where it is. That is the
	// same trap 0034 caught on `translator` and 0035 caught on category — and it
	// is why utteranceState on the client carries board_id too.
	boardID, err := resolveBoard(tx, uid, req.BoardID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "board not found")
		return
	}
	// The user scope is in the UPDATE itself, not a preflight SELECT: a check
	// followed by an unscoped write is a race, and here it would be a race that
	// edits someone else's quote.
	//
	// The hash is recomputed because editing the words or the occasion changes
	// what this quote IS. source and noted_at are create-only — a capture's
	// origin does not change when you fix a typo in it.
	//
	// Recategorising, by contrast, does NOT change the hash and must not: moving a
	// line from Others to Proverbs is the same saved line under a different
	// heading. See 0035.
	res, err := tx.Exec(`
		UPDATE utterances SET quote = ?, note = ?, color = ?, favorite = ?,
		       speaker = ?, occasion = ?, occasion_date = ?, place = ?, medium = ?, kind = ?,
		       category = ?, language = ?, translation = ?, board_id = ?,
		       region = ?, recipient = ?, work_title = ?, locator = ?, occasion_circa = ?,
		       dedupe_hash = ?, sticker_id = ?, sticker_x = ?, sticker_y = ?,
		       updated_at = datetime('now')
		WHERE id = ? AND user_id = ?`,
		req.Quote, nullable(req.Note), req.Color, req.Favorite,
		req.Speaker, req.Occasion, req.OccasionDate, req.Place, req.Medium, req.Kind,
		req.Category, req.Language, req.Translation, boardID,
		// Full-state, like every other field in this UPDATE — see the note above on
		// board_id for what a client that omits one of them is asking for.
		req.Region, req.Recipient, req.WorkTitle, req.Locator, req.OccasionCirca,
		req.hash(), req.StickerID, req.StickerX, req.StickerY, id, uid)
	if err != nil {
		internalError(w, r, "update utterance", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// Missing, or someone else's — indistinguishable on purpose.
		writeErr(w, http.StatusNotFound, "quote not found")
		return
	}
	if err := setTags(tx, "utterance", uid, id, req.Tags); err != nil {
		internalError(w, r, "set tags", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	// Favouriting a quote counts as "seeing" it (marginal half-life bump); only
	// on the false→true transition, so re-saving a favourite doesn't re-credit.
	if req.Favorite && !wasFavorite {
		s.applySeen(uid, kindUtterance, id)
	}
	u, err := s.fetchUtterance(uid, id)
	if err != nil {
		internalError(w, r, "fetch utterance", err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// handleDeleteUtterance bins the quote, then deletes it (see trash.go).
//
// The tag rows and the item_reviews row still go with it — utterance_tags cascades
// on the foreign key, and item_reviews is cleared by the 0026 AFTER DELETE trigger,
// since a polymorphic table cannot hold a real foreign key to three parents. Both
// are read into the snapshot before the delete for exactly that reason: a trigger
// leaves nothing behind to find afterwards.
func (s *Server) handleDeleteUtterance(w http.ResponseWriter, r *http.Request) {
	s.binDelete(w, r, "quote", "quote not found", nil, nil)
}
