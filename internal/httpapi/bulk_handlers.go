package httpapi

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"tippani/internal/olog"
)

// Bulk actions over a selection from the search results (and reusable elsewhere):
// tag a set of annotations/dialogues, or field-correct a set of movies. Books
// already have handleBulkUpdateBooks (metadata_bulk.go); these mirror it. Every
// op is user-scoped and runs in one transaction.

// ownedChildIDs filters ids to rows of `table` (annotations|dialogues) whose
// parent (books|movies) belongs to uid. parentCol is book_id / movie_id and
// parentTable is books / movies — all package constants, never client input.
func (s *Server) ownedChildIDs(table, parentCol, parentTable string, uid int64, ids []int64) ([]int64, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	args := make([]any, 0, len(ids)+1)
	for _, id := range ids {
		args = append(args, id)
	}
	args = append(args, uid)
	rows, err := s.Store.DB.Query(
		`SELECT id FROM `+table+` WHERE id IN (`+inClause(len(ids))+`)
		 AND `+parentCol+` IN (SELECT id FROM `+parentTable+` WHERE user_id = ?)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			olog.Warnf(olog.CodeBulkRowScan, "[bulk] ownedChildIDs row scan failed: %v", err)
			continue
		}
		out = append(out, id)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeBulkRowScan, "[bulk] ownedChildIDs row iteration failed: %v", err)
		return out, err
	}
	return out, nil
}

// bulkTagReq is the shared shape for tagging/flagging/recolouring a set of quotes
// of any of the three kinds. Only the present fields act; add_tags unions (never
// detaches), favorite and color set when non-nil.
//
// Pointer-typed for the same reason every partial update in this app is: a client
// sending one field must not clear the others, and `false` and "not sent" are the
// same JSON at a bool.
type bulkTagReq struct {
	IDs      []int64  `json:"ids"`
	AddTags  []string `json:"add_tags"`
	Favorite *bool    `json:"favorite"`
	// Colour became a six-slot, user-named category in 1.7.1, which made it the
	// single most plausible reason to select forty quotes — and the bulk endpoints
	// could not set it. Validated against the same allowlist validColor uses, so a
	// colour the API accepts is a colour the CHECK constraint accepts.
	Color *string `json:"color"`
	// The seal on the card. 0 is a real value here and means "take the sticker
	// off", which is why it is a pointer to an int rather than an int: `0` and
	// "not sent" are the same JSON at a number, and a selection recoloured in one
	// call must not lose its stickers as a side effect.
	StickerID *int64 `json:"sticker_id"`
	// 0033. TRUE means "put these back in the deck", false means "stop asking me
	// about these" — stated as the thing a reader wants rather than as the column,
	// which is the negative of it.
	Review *bool `json:"review"`
	// The rest of the locator (1.16.0), per kind. Sent to a kind that has no such
	// column they are refused rather than ignored — see bulkQuoteCols.
	//
	// THE WORDS THEMSELVES ARE NOT HERE. `quote` is the row; setting it across a
	// selection does not correct forty quotes, it replaces forty different
	// sentences with one and loses thirty-nine of them irrecoverably. `note` IS
	// here, because a note is a remark ABOUT a quote and "same thought about all
	// of these" is a real thing to want — but it warns like every other field,
	// because it still overwrites.
	Note    *string `json:"note"`
	Chapter *string `json:"chapter"` // annotation
	// The chapter NUMBER (0044), carried as a string for the reason the staged
	// editor's season is: absent, cleared and "0" are three states and a *float64
	// holds two. Blank clears it.
	ChapterNo *string `json:"chapter_no"` // annotation
	Location  *string `json:"location"`   // annotation
	// Character reaches ANNOTATIONS AS WELL AS DIALOGUES from 0047 on: a novel has
	// speakers, and correcting the same misspelt name on thirty highlights is the
	// most obvious reason there is to select thirty highlights. There is still no
	// `actor` beside it on that side — nobody plays Ahab.
	Character   *string `json:"character"`    // annotation, dialogue
	Actor       *string `json:"actor"`        // dialogue
	Timestamp   *string `json:"timestamp"`    // dialogue
	Act         *string `json:"act"`          // dialogue (a game's)
	Quest       *string `json:"quest"`        // dialogue (a game's)
	EpisodeName *string `json:"episode_name"` // dialogue (a show's)
	Speaker     *string `json:"speaker"`      // quote
	Occasion    *string `json:"occasion"`     // quote
	Place       *string `json:"place"`        // quote
	Medium      *string `json:"medium"`       // quote (superseded by kind, 0053)
	Kind        *string `json:"kind"`         // quote, and one of 0053's five words
	Region      *string `json:"region"`       // quote
	Recipient   *string `json:"recipient"`    // quote
	WorkTitle   *string `json:"work_title"`   // quote
	Locator     *string `json:"locator"`      // quote
	// occasion_circa is DELIBERATELY NOT HERE. It says how precisely one date is
	// known, and "all forty of these dates are approximate" is not a thing anybody
	// knows about forty quotes at once — it is a claim about each of them. The same
	// reasoning keeps published_circa out of the book bulk editor.
	// Which board these are filed on (0036). STANDALONE QUOTES ONLY — an
	// annotation belongs to its book and a dialogue to its film, and neither has
	// a board to be moved between. Sent to either of those kinds it is refused
	// rather than ignored: a bulk call that reports success and moved nothing is
	// the failure this file's ownership comment is already about.
	//
	// A pointer, and nil means "leave it alone". There is deliberately no way to
	// spell "no board" here — every quote is on exactly one board, and the single
	// -quote PUT already treats a null board_id as "the default one" rather than
	// as none.
	BoardID *int64 `json:"board_id"`
}

// quoteBulkKind describes one binnable quote kind for the bulk path: its table,
// and how ownership is established. THE TWO ARE DIFFERENT SHAPES, which is why
// this table exists rather than a triple of string swaps: an annotation and a
// dialogue are CHILD rows owned through their parent work, and a standalone quote
// carries user_id on the row itself. A helper that "parameterised" over all three
// by swapping three names would silently produce a query matching nothing — a bulk
// action that reports success and does nothing.
type quoteBulkKind struct {
	Table       string
	ParentCol   string // "" when the row is owned directly
	ParentTable string
}

var quoteBulkKinds = map[string]quoteBulkKind{
	"annotation": {Table: "annotations", ParentCol: "book_id", ParentTable: "books"},
	"dialogue":   {Table: "dialogues", ParentCol: "movie_id", ParentTable: "movies"},
	"utterance":  {Table: "utterances"},
}

// binnableKinds is every kind bulk DELETE serves, keyed by the bin's own word for
// it — the three quote kinds plus the two works. It is a second table rather than
// an addition to the one above because the two answer different questions: that
// one says how to TAG a quote kind (and a book has no colour and no tag of its
// own), this one says how to establish ownership before binning a row.
//
// A work is owned directly, like a standalone quote, so both come out as a bare
// table name. The bin already knows how to snapshot all five (see trashKinds).
var binnableKinds = map[string]quoteBulkKind{
	"annotation": {Table: "annotations", ParentCol: "book_id", ParentTable: "books"},
	"dialogue":   {Table: "dialogues", ParentCol: "movie_id", ParentTable: "movies"},
	"quote":      {Table: "utterances"},
	"book":       {Table: "books"},
	"movie":      {Table: "movies"},
}

// quoteFieldKinds names, per optional field, the kinds that actually have the
// column. One table, so "which fields does a dialogue take" has one answer and
// adding a column means editing a list rather than remembering a switch.
//
// THE KIND NAMES ARE bulkTag's, which is to say quoteBulkKinds': annotation,
// dialogue, utterance. That has to be spelled out because the bin's table one line
// down calls the third kind "quote", and for four releases this table did too —
// with the result that `POST /quotes/bulk` answered 400 to every per-kind field
// the Quotes screen offers ("speaker does not apply to this kind"), for a kind
// that has the column. Two vocabularies for one concept, and the mismatch was
// invisible because the refusal is a legitimate answer for some other kind.
// TestEveryBulkFieldKindIsAKindBulkTagKnows now walks the two tables against each
// other, so a third spelling cannot be introduced quietly.
var quoteFieldKinds = map[string][]string{
	"note":       {"annotation", "dialogue", "utterance"},
	"chapter":    {"annotation"},
	"chapter_no": {"annotation"},
	"location":   {"annotation"},
	// 0047: a book character is a character. The word and the column are the same
	// on both sides, which is what lets one facet and one autocomplete serve them.
	"character":    {"annotation", "dialogue"},
	"actor":        {"dialogue"},
	"timestamp":    {"dialogue"},
	"act":          {"dialogue"},
	"quest":        {"dialogue"},
	"episode_name": {"dialogue"},
	"speaker":      {"utterance"},
	"occasion":     {"utterance"},
	"place":        {"utterance"},
	"medium":       {"utterance"},
	"kind":         {"utterance"},
	"region":       {"utterance"},
	"recipient":    {"utterance"},
	"work_title":   {"utterance"},
	"locator":      {"utterance"},
}

// notNullQuoteCols are the bulk-settable columns declared NOT NULL with an
// empty-string default, so a clear has to write the empty string rather than a
// NULL. THIS IS THE MISTAKE THAT WOULD NOT BE CAUGHT BY READING THE CODE:
// nullable("") is nil, and the rest of this file's fields go through it, so
// clearing one of these over a selection is a NOT NULL violation reported as a
// 500 — after the ownership check and inside the transaction, which is the most
// expensive place to find out.
//
// FOUR OF THESE ARE NOT 0047'S. speaker, occasion, place and medium have been NOT
// NULL with an empty-string default since 0026, so clearing any of them in bulk
// has been a 500 for as long as the fields have existed — which nobody found,
// because the kind-name bug above answered 400 first and the 400 never let the
// request reach the UPDATE. Fixing the 400 uncovers the 500, so both are fixed
// here; splitting them would ship a release where the endpoint answers 500 where
// it used to answer 400, which is worse than either.
//
// `character` is in the set although it is only NOT NULL on annotations. The
// empty string is legal in the dialogues column too, and every reader of it
// coalesces (dialogueCols, vocabulary_handler, search_facets), so one rule per
// column name beats one rule per (kind, column) pair.
//
// The columns deliberately ABSENT are the genuinely nullable ones — note, chapter,
// location, actor, timestamp — where NULL is what the single-quote writers store
// for empty. Writing the empty string there instead would be a quiet change of
// representation under every exporter that coalesces.
var notNullQuoteCols = map[string]bool{
	"character": true, "act": true, "quest": true, "episode_name": true,
	"speaker": true, "occasion": true, "place": true, "medium": true,
	// 0053's column is NOT NULL DEFAULT '' like its neighbours, and '' is a legal
	// VALUE here rather than only a cleared one — "nobody has said what kind this
	// is" is the answer the empty string means.
	"kind":   true,
	"region": true, "recipient": true, "work_title": true, "locator": true,
}

// bulkQuoteFieldPtrs is the one mapping from a column name to the request field
// that carries it. ONE TABLE, because there were two — the applicability check
// and the write loop each carried their own literal, and a field present in the
// first and missing from the second is accepted, reported as updated and silently
// dropped. That is the failure this file's own header calls the worst answer
// available.
//
// chapter_no is not here: it is the one field written through nullableMeasure
// rather than as text, so it keeps its own line in both places.
func bulkQuoteFieldPtrs(req *bulkTagReq) map[string]*string {
	return map[string]*string{
		"note": req.Note, "chapter": req.Chapter, "location": req.Location,
		"character": req.Character, "actor": req.Actor, "timestamp": req.Timestamp,
		"act": req.Act, "quest": req.Quest, "episode_name": req.EpisodeName,
		"speaker": req.Speaker, "occasion": req.Occasion,
		"place": req.Place, "medium": req.Medium, "kind": req.Kind,
		"region": req.Region, "recipient": req.Recipient,
		"work_title": req.WorkTitle, "locator": req.Locator,
	}
}

// unsupportedQuoteField returns the name of the first field this kind cannot
// take, or "".
func unsupportedQuoteField(kind string, req *bulkTagReq) string {
	if req.ChapterNo != nil && !slices.Contains(quoteFieldKinds["chapter_no"], kind) {
		return "chapter_no"
	}
	for name, p := range bulkQuoteFieldPtrs(req) {
		if p == nil {
			continue
		}
		if !slices.Contains(quoteFieldKinds[name], kind) {
			return name
		}
	}
	return ""
}

// bulkTag applies a bulkTagReq to owned rows of `kind`
// (annotation|dialogue|utterance).
func (s *Server) bulkTag(w http.ResponseWriter, r *http.Request, kind string) {
	spec, ok := quoteBulkKinds[kind]
	if !ok {
		internalError(w, r, "bulk tag", fmt.Errorf("unknown kind %q", kind))
		return
	}
	table := spec.Table
	var req bulkTagReq
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.IDs) == 0 {
		writeErr(w, http.StatusBadRequest, "nothing selected")
		return
	}
	if len(req.IDs) > 5000 {
		writeErr(w, http.StatusBadRequest, "too many items (max 5000)")
		return
	}
	if req.Color != nil && !validColor(*req.Color) {
		writeErr(w, http.StatusBadRequest, "invalid color")
		return
	}
	// 0053's CHECK is on the column, so an unknown value would arrive as a 500 from
	// inside the transaction, after the ownership check — the most expensive place
	// to find out. Refused here, in the same shape as the colour above it. Lowered
	// first, so "Speech" is the same answer as "speech".
	if req.Kind != nil {
		k := strings.ToLower(strings.TrimSpace(*req.Kind))
		if !validQuoteKind(k) {
			writeErr(w, http.StatusBadRequest, "kind must be "+quoteKindList())
			return
		}
		req.Kind = &k
	}
	// A FIELD THIS KIND HAS NO COLUMN FOR IS A 400, NOT A SILENT DROP. `character`
	// on a shelf of standalone quotes is a request the caller has got wrong, and
	// answering 200 to it reports a narrowing that never happened — the same rule
	// parseSearchFacets states for an unknown facet, and the same failure: a
	// success that did nothing looks exactly like a success that did something.
	if bad := unsupportedQuoteField(kind, &req); bad != "" {
		writeErr(w, http.StatusBadRequest, bad+" does not apply to this kind")
		return
	}
	// Refused rather than quietly nulled. nullableMeasure maps junk to NULL, which
	// over a selection would clear the chapter number on forty rows and report
	// success — the worst answer available, because nothing on screen would say it.
	if req.ChapterNo != nil {
		if msg := chapterNoProblem(*req.ChapterNo); msg != "" {
			writeErr(w, http.StatusBadRequest, msg)
			return
		}
	}
	uid := userID(r)
	// A sticker is a per-user row, so a borrowed id has to be refused rather than
	// written: sticker_id is ON DELETE SET NULL and the FK alone is not user-scoped,
	// so it would happily hold somebody else's seal. Same guard the single-quote
	// writes use. 0 clears, and clearing needs no ownership.
	if req.StickerID != nil && *req.StickerID != 0 && !s.stickerOwned(uid, req.StickerID) {
		writeErr(w, http.StatusNotFound, "no such sticker")
		return
	}
	// The ownership query follows the shape of the kind, not a swapped table name:
	// a child row is reached through its parent, a standalone quote is not. Both
	// directions get a test, because an ownership filter that matches nothing is a
	// bulk action that reports success and does nothing, and one that matches
	// everything is somebody else's library.
	var owned []int64
	var err error
	if spec.ParentCol == "" {
		owned, err = s.ownedRowIDs(table, uid, req.IDs)
	} else {
		owned, err = s.ownedChildIDs(table, spec.ParentCol, spec.ParentTable, uid, req.IDs)
	}
	if err != nil {
		internalError(w, r, "bulk tag: ownership", err)
		return
	}
	if len(owned) == 0 {
		writeErr(w, http.StatusNotFound, "no matching items")
		return
	}
	addTagsList := cleanNames(req.AddTags)

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "bulk tag: begin", err)
		return
	}
	defer tx.Rollback()

	for _, id := range owned {
		if len(addTagsList) > 0 {
			if err := addTags(tx, kind, uid, id, addTagsList); err != nil {
				internalError(w, r, "bulk tag: add tags", err)
				return
			}
		}
	}
	if req.Favorite != nil {
		if err := bulkSetChild(tx, table, "favorite", boolToInt(*req.Favorite), owned); err != nil {
			internalError(w, r, "bulk tag: favorite", err)
			return
		}
	}
	// The per-kind columns, driven off the same table the applicability check reads
	// so the two cannot disagree. A field this kind does not have has already been
	// refused above, so anything reaching here is a column that exists.
	//
	// chapter_no is NOT in this loop: every field here is written as TEXT, and a
	// number goes through nullableMeasure below so "7" lands as 7 rather than as the
	// text "7" in a REAL column — which SQLite would accept and then sort as text.
	//
	// Iterated in sorted order, not map order, so a failure names the same column
	// twice in a row and the UPDATEs land in a reproducible sequence.
	ptrs := bulkQuoteFieldPtrs(&req)
	cols := make([]string, 0, len(ptrs))
	for col := range ptrs {
		cols = append(cols, col)
	}
	slices.Sort(cols)
	for _, col := range cols {
		p := ptrs[col]
		if p == nil {
			continue
		}
		// A clear is '' on a NOT NULL column and NULL on a nullable one — see
		// notNullQuoteCols for why getting this wrong is a 500 and not a 400.
		var val any = nullable(strings.TrimSpace(*p))
		if notNullQuoteCols[col] {
			val = strings.TrimSpace(*p)
		}
		if err := bulkSetChild(tx, table, col, val, owned); err != nil {
			internalError(w, r, "bulk tag: "+col, err)
			return
		}
	}
	if req.Color != nil {
		if err := bulkSetChild(tx, table, "color", *req.Color, owned); err != nil {
			internalError(w, r, "bulk tag: color", err)
			return
		}
	}
	if req.ChapterNo != nil {
		if err := bulkSetChild(tx, table, "chapter_no", nullableMeasure(*req.ChapterNo), owned); err != nil {
			internalError(w, r, "bulk tag: chapter_no", err)
			return
		}
	}
	if req.StickerID != nil {
		// 0 is the clear. Written as a real NULL rather than a zero, because
		// sticker_id is a nullable FK and a 0 in it points at no sticker that can
		// ever exist — a row the join would silently drop instead of a row with no
		// sticker.
		var val any
		if *req.StickerID != 0 {
			val = *req.StickerID
		}
		if err := bulkSetChild(tx, table, "sticker_id", val, owned); err != nil {
			internalError(w, r, "bulk tag: sticker", err)
			return
		}
	}
	if req.Review != nil {
		// The body says what the reader wants ("put these back in the deck"); the
		// column stores the opposite. Inverted in exactly one place, here.
		if err := bulkSetChild(tx, table, "review_excluded", boolToInt(!*req.Review), owned); err != nil {
			internalError(w, r, "bulk tag: review", err)
			return
		}
	}
	if req.BoardID != nil {
		// Refused rather than ignored for the two kinds that have no board. An
		// annotation belongs to its book and a dialogue to its film; accepting the
		// field and doing nothing with it would make "move these to Speeches"
		// report success over a selection of highlights.
		if kind != "utterance" {
			writeErr(w, http.StatusBadRequest, "only standalone quotes are filed on boards")
			return
		}
		// Somebody else's board is refused, not silently swapped for the default —
		// the same rule resolveBoard states for a single quote, and for the same
		// reason: filing forty quotes somewhere other than where the request said
		// is worse than refusing, because nothing on screen would say it happened.
		if !boardOwned(tx, uid, *req.BoardID) {
			writeErr(w, http.StatusNotFound, "no such board")
			return
		}
		if err := bulkSetChild(tx, table, "board_id", *req.BoardID, owned); err != nil {
			internalError(w, r, "bulk tag: board", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "bulk tag: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"updated": len(owned)})
}

// cascadeWorkReview writes a work's quiz opt-out onto every quote it holds.
//
// WHY THIS IS A WRITE AND NOT A JOIN. 0033 made the work's flag a term in the
// deck's eligibility query, so excluding a book covered its future highlights for
// free and cost one column. It also meant a highlight could be barred from the
// deck by a flag that was not on it — and the control that clears the quote's own
// flag then reported an outcome that did not happen ("back in the quiz", on a
// card the deck still refused). The gate is the quote's own column now, so
// reaching its quotes is something the work's control has to actually do.
//
// The ids are already ownership-filtered by the caller, and the children are
// reached through them, so no user_id term is needed here — the same reasoning
// ownedChildIDs uses in the other direction.
func cascadeWorkReview(tx *sql.Tx, childTable, parentKey string, val int, workIDs []int64) error {
	if len(workIDs) == 0 {
		return nil
	}
	args := make([]any, 0, len(workIDs)+1)
	args = append(args, val)
	for _, id := range workIDs {
		args = append(args, id)
	}
	_, err := tx.Exec(
		`UPDATE `+childTable+` SET review_excluded = ?, updated_at = datetime('now')
		 WHERE `+parentKey+` IN (`+inClause(len(workIDs))+`)`, args...)
	return err
}

// bulkSetChild runs `UPDATE <table> SET <col> = ?, updated_at = now WHERE id IN (ids)`.
// col is a package constant.
func bulkSetChild(tx *sql.Tx, table, col string, val any, ids []int64) error {
	args := make([]any, 0, len(ids)+1)
	args = append(args, val)
	for _, id := range ids {
		args = append(args, id)
	}
	_, err := tx.Exec(
		`UPDATE `+table+` SET `+col+` = ?, updated_at = datetime('now') WHERE id IN (`+inClause(len(ids))+`)`, args...)
	return err
}

// nullableFromPtr / intFromPtr / boolIntFromPtr adapt an optional request field
// to what the column stores. They exist so the bulk setters can be driven from a
// TABLE rather than from one if-block per column — nine of those in a row is
// nine chances to paste the wrong column name beside the right value, which is a
// mistake no test catches because both halves compile.
func nullableFromPtr(p *string) any {
	if p == nil {
		return nil
	}
	return nullable(strings.TrimSpace(*p))
}

func intFromPtr(p *int) any {
	if p == nil {
		return 0
	}
	return *p
}

// strFromPtr is nullableFromPtr for a NOT NULL column: an emptied field stores
// the empty string, because that is what the column's default is and a NULL there
// would make every read COALESCE around a state the schema forbids.
func strFromPtr(p *string) any {
	if p == nil {
		return ""
	}
	return strings.TrimSpace(*p)
}

func boolIntFromPtr(p *bool) any {
	if p == nil {
		return 0
	}
	return boolToInt(*p)
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func (s *Server) handleBulkTagAnnotations(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[bulk] handleBulkTagAnnotations uid=%v", userID(r))
	s.bulkTag(w, r, "annotation")
}
func (s *Server) handleBulkTagDialogues(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[bulk] handleBulkTagDialogues uid=%v", userID(r))
	s.bulkTag(w, r, "dialogue")
}

// handleBulkTagQuotes is the fifth bulk endpoint, and the one that was missing:
// annotations and dialogues had one, standalone quotes did not, so a selection on
// the Quotes screen had nothing to post to.
func (s *Server) handleBulkTagQuotes(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[bulk] handleBulkTagQuotes uid=%v", userID(r))
	s.bulkTag(w, r, "utterance")
}

// handleBulkUpdateMovies mirrors handleBulkUpdateBooks for films/shows: batch
// director / series / genre correction over a selection, one transaction.
//
// NO COLOUR HERE, deliberately: a colour category is a note about a QUOTE, and a
// work has never had one. The three quote endpoints take it; these two take the
// fields a work has instead.
func (s *Server) handleBulkUpdateMovies(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs         []int64  `json:"ids"`
		Director    *string  `json:"director"`
		Series      *string  `json:"series"`
		SeriesIndex *float64 `json:"series_index"`
		AddGenres   []string `json:"add_genres"`
		// 0033, mirroring books: a property of the film or show, inherited by the
		// lines saved from it afterwards.
		Review *bool `json:"review"`
		// The rest of the record (1.16.0). See handleBulkUpdateBooks for why the
		// title and the supplier ids are absent — the same two reasons, and
		// tmdb_id/tvdb_id/igdb_id each carry a UNIQUE index per user, so a bulk
		// set of one is a constraint violation rather than a bad idea.
		MediaType    *string `json:"media_type"`
		ReleaseYear  *int    `json:"release_year"`
		ReleaseCirca *bool   `json:"release_circa"`
		Description  *string `json:"description"`
		Favorite     *bool   `json:"favorite"`
		// A game's publisher (0042). Here for the same reason Director is: a
		// selection of titles from one label is exactly the shape a bulk
		// correction is for, and the column that most needs correcting is the one
		// every game added before 1.17.0 has empty.
		Publisher *string `json:"publisher"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.IDs) == 0 {
		writeErr(w, http.StatusBadRequest, "no titles selected")
		return
	}
	if len(req.IDs) > 2000 {
		writeErr(w, http.StatusBadRequest, "too many titles (max 2000)")
		return
	}
	uid := userID(r)
	olog.Tracef("[bulk] handleBulkUpdateMovies uid=%v ids=%d", uid, len(req.IDs))
	owned, err := s.ownedRowIDs("movies", uid, req.IDs)
	if err != nil {
		internalError(w, r, "bulk movies: ownership", err)
		return
	}
	if len(owned) == 0 {
		writeErr(w, http.StatusNotFound, "no matching titles")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "bulk movies: begin", err)
		return
	}
	defer tx.Rollback()
	set := func(col string, val any) error {
		a := make([]any, 0, len(owned)+2)
		a = append(a, val)
		for _, id := range owned {
			a = append(a, id)
		}
		a = append(a, uid)
		_, err := tx.Exec(`UPDATE movies SET `+col+` = ?, updated_at = datetime('now') WHERE id IN (`+inClause(len(owned))+`) AND user_id = ?`, a...)
		return err
	}
	if req.Director != nil {
		if err := set("director", nullable(*req.Director)); err != nil {
			internalError(w, r, "bulk movies: director", err)
			return
		}
	}
	if req.Series != nil {
		if err := set("series", nullable(*req.Series)); err != nil {
			internalError(w, r, "bulk movies: series", err)
			return
		}
	}
	if req.SeriesIndex != nil {
		if err := set("series_index", nullableFloat(*req.SeriesIndex)); err != nil {
			internalError(w, r, "bulk movies: series_index", err)
			return
		}
	}
	// media_type is validated rather than trusted: it is a CHECK'd column, so a
	// bad value is a 500 from the driver rather than a 400 the reader can act on.
	if req.MediaType != nil {
		mt := strings.TrimSpace(*req.MediaType)
		// normalizeMediaType is the single-record validator, reused rather than
		// re-spelled: a second list of the three legal values is a second thing to
		// forget when a fourth medium lands.
		if msg := normalizeMediaType(&mt); msg != "" {
			writeErr(w, http.StatusBadRequest, msg)
			return
		}
		if err := set("media_type", mt); err != nil {
			internalError(w, r, "bulk movies: media_type", err)
			return
		}
	}
	for _, f := range []struct {
		col string
		val any
		on  bool
	}{
		{"description", nullableFromPtr(req.Description), req.Description != nil},
		{"release_year", intFromPtr(req.ReleaseYear), req.ReleaseYear != nil},
		{"release_circa", boolIntFromPtr(req.ReleaseCirca), req.ReleaseCirca != nil},
		{"favorite", boolIntFromPtr(req.Favorite), req.Favorite != nil},
		// NOT nullable: the column is NOT NULL DEFAULT '' (0042), so clearing it
		// writes the empty string rather than a NULL the reads would have to
		// COALESCE around.
		{"publisher", strFromPtr(req.Publisher), req.Publisher != nil},
	} {
		if !f.on {
			continue
		}
		if err := set(f.col, f.val); err != nil {
			internalError(w, r, "bulk movies: "+f.col, err)
			return
		}
	}
	if req.Review != nil {
		// The work's own column is kept, with a narrower job than 0033 gave it:
		// it seeds the lines saved from this film LATER. It no longer gates the
		// deck, so on its own it would not take today's lines out of the quiz —
		// which is what the reader pressing this means.
		val := boolToInt(!*req.Review)
		if err := set("review_excluded", val); err != nil {
			internalError(w, r, "bulk movies: review", err)
			return
		}
		if err := cascadeWorkReview(tx, "dialogues", "movie_id", val, owned); err != nil {
			internalError(w, r, "bulk movies: review cascade", err)
			return
		}
	}
	if add := cleanNames(req.AddGenres); len(add) > 0 {
		for _, id := range owned {
			cur, err := genresOf(tx, "movie", id)
			if err != nil {
				internalError(w, r, "bulk movies: read genres", err)
				return
			}
			if err := setGenres(tx, "movie", uid, id, append(cur, add...)); err != nil {
				internalError(w, r, "bulk movies: set genres", err)
				return
			}
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "bulk movies: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"updated": len(owned)})
}

// ---- bulk delete ------------------------------------------------------------
//
// LAST, ALONE, AND UNREACHABLE BY GESTURE. It is the only path in the app that
// removes many things at once, so it is reached only by selecting, then pressing
// Delete in the selection bar, then typing what it will do. Never from the context
// menu, never from a swipe.
//
// It routes every item through the same collect-then-delete the single deletes use,
// and writes ONE bin entry for the whole selection — so the whole thing is one
// Undo, recoverable for the retention window because 1.8.0 shipped first.

// handleBulkDelete deletes a selection of one quote kind.
func (s *Server) handleBulkDelete(w http.ResponseWriter, r *http.Request, kind string) {
	var req struct {
		IDs     []int64 `json:"ids"`
		Confirm string  `json:"confirm"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.IDs) == 0 {
		writeErr(w, http.StatusBadRequest, "nothing selected")
		return
	}
	if len(req.IDs) > 5000 {
		writeErr(w, http.StatusBadRequest, "too many items (max 5000)")
		return
	}
	uid := userID(r)
	olog.Tracef("[bulk] handleBulkDelete kind=%s uid=%v ids=%d", kind, uid, len(req.IDs))

	spec, ok := binnableKinds[kind]
	if !ok {
		internalError(w, r, "bulk delete", fmt.Errorf("unknown kind %q", kind))
		return
	}
	var owned []int64
	var err error
	if spec.ParentCol == "" {
		owned, err = s.ownedRowIDs(spec.Table, uid, req.IDs)
	} else {
		owned, err = s.ownedChildIDs(spec.Table, spec.ParentCol, spec.ParentTable, uid, req.IDs)
	}
	if err != nil {
		internalError(w, r, "bulk delete: ownership", err)
		return
	}
	if len(owned) == 0 {
		writeErr(w, http.StatusNotFound, "no matching items")
		return
	}
	// THE COUNT IN THE PHRASE IS THE OWNED COUNT, not the requested one. Otherwise a
	// selection holding one id that is not yours would refuse every phrase a reader
	// could possibly type, with no way to find out why.
	want := bulkDeletePhrase(kind, len(owned))
	if !strings.EqualFold(strings.TrimSpace(req.Confirm), want) {
		writeErr(w, http.StatusBadRequest, "type “"+want+"” to confirm")
		return
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "bulk delete: begin", err)
		return
	}
	defer tx.Rollback()
	trashID, done, err := s.binSelection(tx, uid, kind, owned)
	if err != nil {
		olog.Warnf(olog.CodeTrashWrite, "[trash] could not bin a selection of %d %s: %v", len(owned), kind, err)
		internalError(w, r, "bulk delete: bin it first", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "bulk delete: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": done, "trash_id": trashID})
}

// kindKeyFor maps the bin's kind word to the bulk table key. The two vocabularies
// differ by one word — the bin says 'quote' for a standalone quote and the bulk
// tables say 'utterance', after the table — and this is the one place that has to
// know it.
func kindKeyFor(kind string) string {
	if kind == "quote" {
		return "utterance"
	}
	return kind
}

func (s *Server) handleBulkDeleteAnnotations(w http.ResponseWriter, r *http.Request) {
	s.handleBulkDelete(w, r, "annotation")
}
func (s *Server) handleBulkDeleteDialogues(w http.ResponseWriter, r *http.Request) {
	s.handleBulkDelete(w, r, "dialogue")
}
func (s *Server) handleBulkDeleteQuotes(w http.ResponseWriter, r *http.Request) {
	s.handleBulkDelete(w, r, "quote")
}

// A work carries its quotes with it, which makes this the heaviest delete in the
// app: five selected books can be four hundred highlights, their tags, their
// review schedules, their genres and their read logs. All of it goes into ONE bin
// entry and comes back together — the same collect-then-delete a single work
// delete already used, so there is no second path that could put a book back
// without its quotes.
func (s *Server) handleBulkDeleteBooks(w http.ResponseWriter, r *http.Request) {
	s.handleBulkDelete(w, r, "book")
}
func (s *Server) handleBulkDeleteMovies(w http.ResponseWriter, r *http.Request) {
	s.handleBulkDelete(w, r, "movie")
}

// ---- bulk shelf state -------------------------------------------------------
//
// "I finished these four" and "I've abandoned this shelf" are the two things a
// selection of works is most often FOR, and until now each was one dialog per
// title. It routes every item through applyStatusChange — the same function the
// single PUT uses — so the read log cannot drift from the status: a move into
// reading/watching opens a read, a move into completed/abandoned closes it, and
// nothing here knows any of that.
//
// NO POSITION, deliberately. The single endpoint takes a page or an episode
// because it is about one work; "page 143" across forty books is not a fact about
// anything. Progress therefore comes only from the status itself.
//
// A COMPLETED WORK IS SKIPPED RATHER THAN REFUSED. The lifecycle's one rule is
// that completed is settled and can only be started again, and a selection of
// forty holding one finished book must not refuse the other thirty-nine — that
// would be a bulk action whose success depends on a property of its least
// convenient member. The response says how many were passed over so the toast can.
func (s *Server) bulkSetStatus(w http.ResponseWriter, r *http.Request, kind string) {
	var req struct {
		IDs    []int64 `json:"ids"`
		Status string  `json:"status"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.IDs) == 0 {
		writeErr(w, http.StatusBadRequest, "nothing selected")
		return
	}
	if len(req.IDs) > 2000 {
		writeErr(w, http.StatusBadRequest, "too many titles (max 2000)")
		return
	}
	// The SET of active words, not one of them: a catalogue selection can hold
	// films and games together, and each row gets its own in-progress word
	// resolved from its own media_type inside the loop below.
	if msg := normalizeBulkStatus(kind, &req.Status); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[bulk] bulkSetStatus kind=%s uid=%v ids=%d status=%q", kind, uid, len(req.IDs), req.Status)

	table := "books"
	if kind == "movie" {
		table = "movies"
	}
	owned, err := s.ownedRowIDs(table, uid, req.IDs)
	if err != nil {
		internalError(w, r, "bulk status: ownership", err)
		return
	}
	if len(owned) == 0 {
		writeErr(w, http.StatusNotFound, "no matching titles")
		return
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "bulk status: begin", err)
		return
	}
	defer tx.Rollback()

	// media_type comes back with the status for a film row, because "in progress"
	// is a different word for a game than for a film and the row is the only
	// thing that knows which it is. Books have no media type and select neither.
	sel := `SELECT status, '' FROM books WHERE id = ? AND user_id = ?`
	if kind == "movie" {
		sel = `SELECT status, media_type FROM movies WHERE id = ? AND user_id = ?`
	}

	updated, skipped := 0, 0
	for _, id := range owned {
		var from, mediaType string
		if err := tx.QueryRow(sel, id, uid).Scan(&from, &mediaType); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				continue // raced away between the ownership filter and here
			}
			internalError(w, r, "bulk status: load", err)
			return
		}
		status := resolveActiveStatus(kind, mediaType, req.Status)
		if !statusTransitionAllowed(kind, mediaType, from, status) {
			skipped++
			continue
		}
		if err := applyStatusChange(tx, kind, mediaType, uid, id, from, statusChange{Status: status}); err != nil {
			internalError(w, r, "bulk status: apply", err)
			return
		}
		updated++
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "bulk status: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"updated": updated, "skipped": skipped})
}

func (s *Server) handleBulkStatusBooks(w http.ResponseWriter, r *http.Request) {
	s.bulkSetStatus(w, r, "book")
}
func (s *Server) handleBulkStatusMovies(w http.ResponseWriter, r *http.Request) {
	s.bulkSetStatus(w, r, "movie")
}
