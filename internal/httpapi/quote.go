package httpapi

import (
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/store"
)

// The shared shape of a quote.
//
// Tippani holds two kinds: an annotation (a highlight from a book) and a
// dialogue (a line from a film or show). They were built separately, as
// near-copies, and drifted — dialogues arrived without tags, then gained them;
// arrived without colour, and kept not having it; and until 0020 had neither
// noted_at nor source. Each gap was invisible until someone looked for the
// feature and found it missing on one side only.
//
// So the common parts live here, embedded into both. The two kinds now differ
// in exactly one respect — how a quote points back into its source:
//
//	annotation: chapter, location   (where in the book)
//	dialogue:   character, actor, timestamp   (who said it, and when)
//
// Everything else is shared, and anything added here appears on both at once.
//
// §24's standalone quote (utteranceReq/utteranceRow) embeds these too, so a field
// declared here is on all THREE kinds. That is the whole reason `translation`
// moved here in 0051 from the one kind that had it: a field that is prose about
// the quote rather than a pointer into its source has no business being per-kind,
// and the parity tests below only bite on a field this file declares.
// Embedding is anonymous, so the JSON wire format is unchanged: the fields
// marshal inline exactly as they did when they were declared per-kind.

// quoteReq is the create/update payload common to both kinds.
type quoteReq struct {
	Quote    string   `json:"quote"`
	Note     string   `json:"note"`
	Color    string   `json:"color"`
	Tags     []string `json:"tags"`
	Favorite bool     `json:"favorite"`
	// Attached sticker (uploaded image), or nil for none. StickerX/StickerY are
	// its centre as a fraction of the quote block's width; nil ⇒ unplaced (the
	// UI defaults to top-right). PUT is full-state, so the client carries all
	// three through on every save.
	StickerID *int64   `json:"sticker_id"`
	StickerX  *float64 `json:"sticker_x"`
	StickerY  *float64 `json:"sticker_y"`
	// NotedAt is when the quote was actually captured, for a client that saved
	// it offline and is only now flushing it; "" means now. Source records what
	// captured it ("manual" | "ocr"); "" means manual. Both are create-only —
	// a capture's origin doesn't change when you fix a typo in it.
	NotedAt string `json:"noted_at"`
	Source  string `json:"source"`
	// What the line SAYS, for a quote whose words are not in a language the reader
	// has (0051; 0035 on the third kind, which had it first). NOT the note: a note
	// is what you thought about the line, and folding the two together leaves
	// nothing downstream able to tell them apart — the review deck would prompt you
	// with your own reaction, and `notes` as a search section would stop meaning
	// notes.
	//
	// Uncapped, like Quote and Note and unlike every locator beside them: it is the
	// same kind of content, and a translation is routinely longer than its original.
	//
	// NO Language BESIDE IT HERE. A standalone quote carries its own, because it has
	// no parent to ask; an annotation's is the book's (0047's two columns); a film's
	// is nowhere yet. Promoting Language would put a permanently unfillable field on
	// two kinds — see 0051 for the argument in full.
	Translation string `json:"translation"`
}

// validate trims and checks the shared fields, returning "" when they are good
// and a client-facing message otherwise. Each kind calls this first, then adds
// its own rules — a dialogue requires a quote, an annotation accepts a
// note-only row.
func (q *quoteReq) validate() string {
	q.Quote = strings.TrimSpace(q.Quote)
	q.Note = strings.TrimSpace(q.Note)
	if q.Color == "" {
		q.Color = "yellow" // PLAN §3: colours fixed at 4, default yellow
	}
	if !validColor(q.Color) {
		return "color must be " + colorList()
	}
	if q.NotedAt != "" {
		normalized, err := parseNotedAt(q.NotedAt)
		if err != nil {
			return err.Error()
		}
		q.NotedAt = normalized
	}
	source, err := validateSource(q.Source)
	if err != nil {
		return err.Error()
	}
	q.Source = source
	// Trimmed but NOT capped, for the reason on the field: it holds prose, and the
	// words it translates are uncapped too.
	q.Translation = strings.TrimSpace(q.Translation)
	return ""
}

// hash implements the PLAN §3 dedupe rule: the quote, or the note for
// note-only rows. The source locator (chapter/location, timestamp) is
// deliberately excluded, so the same passage recorded twice with different
// page numbers still collapses to one row.
//
// Translation is excluded for a sharper reason than the locators are: the hash
// answers "is this the same quote", and that answer must not depend on whether
// anyone has got round to translating it. Folding it in would make typing a
// translation fork a second copy of the line on the next import of the same file.
func (q *quoteReq) hash() string {
	if q.Quote != "" {
		return store.DedupeHash(q.Quote)
	}
	return store.DedupeHash(q.Note)
}

// quoteRow is the response shape common to both kinds.
type quoteRow struct {
	ID    int64  `json:"id"`
	Quote string `json:"quote"`
	Note  string `json:"note"`
	// 0051. On every kind's LIST row and not only its single read, because the card
	// draws it — see utteranceMeta, where it has been a second line under the meta
	// strip since 0035. A list that omitted it would leave every card to fetch its
	// own quote again to render one line of text.
	Translation string   `json:"translation"`
	Color       string   `json:"color"`
	Favorite    bool     `json:"favorite"`
	Tags        []string `json:"tags"`
	NotedAt     string   `json:"noted_at"`   // date of capture (original, or add time); "" if unknown
	StickerID   *int64   `json:"sticker_id"` // attached sticker (uploaded image), nil = none
	StickerX    *float64 `json:"sticker_x"`  // seal centre x as a fraction of block width; nil = top-right default
	StickerY    *float64 `json:"sticker_y"`  // seal centre y in the same width units
	CreatedAt   string   `json:"created_at"`
	UpdatedAt   string   `json:"updated_at"`
	// Spaced-repetition state for the status dot (v0.5.0). Reviewed=false is the
	// "unseen" pool; the client derives remembered/forgetting/probably-forgotten
	// from stability + last_reviewed_at + last_result (a lapse forces
	// probably-forgotten). Absent on create/update responses.
	Reviewed       bool    `json:"reviewed"`
	Stability      float64 `json:"stability"`
	LastReviewedAt string  `json:"last_reviewed_at"`
	LastResult     string  `json:"last_result"` // "got" | "forgot" | ""
	// 0033. Kept out of the deck on purpose. Reported so the card can say so and
	// the selection bar can offer the right one of the two words — a bar that
	// always says "Exclude" over a selection that is already excluded is a control
	// nobody can tell the state of.
	ReviewExcluded bool `json:"review_excluded"`
	// And the parent WORK's flag, because 0033 put the column on both and
	// reviewSource.where() drops a child whose work is excluded. A card reading
	// only the field above shows no mark on the forty highlights of a skipped
	// reference manual, which are precisely the rows a mark is for.
	//
	// SHARED HERE RATHER THAN book_review_excluded / movie_review_excluded, and
	// the parity test is what decided it. Named per kind, it read exactly like
	// BookTitle beside MovieID and would have passed review as one — but every
	// client would then have to write `book_x || movie_x` at each card, and
	// forgetting one name is a mark that is right on books and silently absent on
	// films. One name is one thing to get wrong instead of two, and the test's
	// whole job is to catch a field that arrived on one kind and not the other.
	//
	// A standalone quote has no parent, so this is always false for that kind —
	// accurate rather than meaningless, and the same asymmetry §24 has
	// everywhere else.
	WorkReviewExcluded bool `json:"work_review_excluded"`
}

// annotationColors is the colour set, in slot order. Adding to it is not a code
// change — it is a migration, because each value is gated by a CHECK on four
// tables and SQLite cannot alter a CHECK (see 0029, which widened four to six).
// The order is the order the pickers draw, and it is append-only: 'yellow' is
// slot 1 and stays the column default and the value an import writes when the
// source named no colour.
var annotationColors = []string{"yellow", "blue", "pink", "orange", "green", "purple"}

// colorList is the human list for an error message, built from the set rather
// than typed out beside it — four handlers used to spell "yellow, blue, pink or
// orange" independently, which is four messages to forget when the set grows.
func colorList() string {
	return strings.Join(annotationColors[:len(annotationColors)-1], ", ") +
		" or " + annotationColors[len(annotationColors)-1]
}

// validColor gates the fixed highlight colours (PLAN §3), shared by every kind
// and by the list filters.
func validColor(c string) bool {
	for _, v := range annotationColors {
		if c == v {
			return true
		}
	}
	return false
}

// idFilter narrows a quote list to ONE row. Shared by all three kinds, for the
// same one caller: the review card, which can now edit the quote it is asking
// about and needs the full row before it can PUT one back.
//
// A LIST RATHER THAN A NEW GET /annotations/{id}, and that is the decision. The
// three list endpoints already carry the exact shape an edit form wants — the
// tags, the sticker and its position, the parent's title, the schedule columns —
// assembled by a query that has been correct for twenty releases. A per-kind
// single-row handler would be a fourth place that has to stay in step with
// annotationRow, and the failure when it drifts is a form that silently blanks
// whichever field the new handler forgot.
//
// It answers 200 with an EMPTY list for an id that is not yours, not 403: the
// ownership clause is already in the WHERE of every one of these queries, and a
// list that says "no rows" is the honest report of a filter that matched
// nothing. Distinguishing "not yours" from "not there" is how a list endpoint
// becomes an existence oracle for other people's ids.
func idFilter(w http.ResponseWriter, r *http.Request, alias string, q *string, args *[]any) bool {
	v := r.URL.Query().Get("id")
	if v == "" {
		return true
	}
	id, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return false
	}
	*q += ` AND ` + alias + `.id = ?`
	*args = append(*args, id)
	return true
}

// colorFilter appends the shared ?color= list filter for the given table alias.
// Writes a 400 and returns false on a bad value.
func colorFilter(w http.ResponseWriter, r *http.Request, alias string, q *string, args *[]any) bool {
	if v := r.URL.Query().Get("color"); v != "" {
		if !validColor(v) {
			writeErr(w, http.StatusBadRequest, "color must be "+colorList())
			return false
		}
		*q += ` AND ` + alias + `.color = ?`
		*args = append(*args, v)
	}
	return true
}

// chapterNoProblem is the one rule for what a chapter number may be, in words for
// the person who typed it. "" means the value is fine, and a BLANK STRING IS FINE:
// every caller reads blank as "clear it", which is a legitimate edit.
//
// Shared by the two bulk editors and spelled the same way as the single-quote
// form's own check (annotationReq.validate), because a number the details form
// accepts and the bulk bar refuses is a rule nobody can learn.
func chapterNoProblem(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return ""
	}
	n, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return "a chapter number has to be a number — the chapter's name takes anything"
	}
	if n < 0 {
		return "a chapter number cannot be negative"
	}
	if n >= 10000 {
		return "that is too large for a chapter number — the name field takes anything"
	}
	return ""
}
