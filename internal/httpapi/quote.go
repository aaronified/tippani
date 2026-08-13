package httpapi

import (
	"net/http"
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
	return ""
}

// hash implements the PLAN §3 dedupe rule: the quote, or the note for
// note-only rows. The source locator (chapter/location, timestamp) is
// deliberately excluded, so the same passage recorded twice with different
// page numbers still collapses to one row.
func (q *quoteReq) hash() string {
	if q.Quote != "" {
		return store.DedupeHash(q.Quote)
	}
	return store.DedupeHash(q.Note)
}

// quoteRow is the response shape common to both kinds.
type quoteRow struct {
	ID        int64    `json:"id"`
	Quote     string   `json:"quote"`
	Note      string   `json:"note"`
	Color     string   `json:"color"`
	Favorite  bool     `json:"favorite"`
	Tags      []string `json:"tags"`
	NotedAt   string   `json:"noted_at"`   // date of capture (original, or add time); "" if unknown
	StickerID *int64   `json:"sticker_id"` // attached sticker (uploaded image), nil = none
	StickerX  *float64 `json:"sticker_x"`  // seal centre x as a fraction of block width; nil = top-right default
	StickerY  *float64 `json:"sticker_y"`  // seal centre y in the same width units
	CreatedAt string   `json:"created_at"`
	UpdatedAt string   `json:"updated_at"`
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
