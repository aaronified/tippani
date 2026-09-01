package httpapi

import (
	"net/http"
	"strings"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// Find and replace across a selection — preview, then apply.
//
// The single most useful post-import tool, and the one that stops being optional
// the moment a bad export leaves the same artefact on four hundred rows.
//
// TWO ENDPOINTS, NOT ONE WITH A FLAG. `POST /replace/preview` answers what WOULD
// change and writes nothing; `POST /replace/apply` does it. That split is the
// whole design, and it is the same review-before-apply shape the metadata
// re-verify flow already uses — because this is the most destructive bulk
// operation in the app and the only one whose damage is invisible afterwards. A
// wrong bulk tag is a tag you can see and remove. A wrong replace has rewritten
// the words, and the words are the thing this app exists to keep.
//
// SO THE PREVIEW IS NOT A COURTESY, IT IS THE FEATURE. It returns the before and
// after of every row it would touch, capped, so the decision is made against what
// will actually happen rather than against a regular expression somebody believes
// they understand.
//
// NO REGULAR EXPRESSIONS, and that is deliberate rather than unfinished. A regex
// over a library of prose is a foot-gun with no undo: `.*` is one keystroke from
// `.` and would empty every quote in the selection. Literal text, optionally
// case-insensitive and optionally whole-word, covers the actual post-import
// complaints — a doubled space, a stray running head, a mangled quote mark —
// and cannot express "delete everything".

// replaceScope names the field a replace runs over, per kind. The quote's own
// words ARE replaceable here, unlike in the bulk field editor, and the
// difference is the preview: bulk-setting a quote replaces forty different
// sentences with one, while replacing "teh" with "the" leaves forty different
// sentences forty different sentences.
// A book highlight gains `character` in 0047 for the same reason a film line has
// always had it: the single commonest post-import cleanup is one name spelled two
// ways, and a column that can be typed by hand on four hundred rows is a column
// find-and-replace has to reach. The game's act and quest and the essay's title
// and page are deliberately NOT here — they are locators, and a locator is
// corrected by the bulk field editor (one value for the selection) rather than by
// a substring rewrite across four hundred different ones.
// THE KEYS ARE bulkTag'S VOCABULARY — annotation, dialogue, UTTERANCE — and this
// table said "quote" until it was found to 500.
//
// quoteBulkKinds is what resolves a kind to a table here, and it has always
// called the third kind "utterance"; `replaceFields["quote"]` therefore passed
// validation, took a ZERO-VALUE spec with Table == "", and died on
// `SELECT ... FROM  WHERE ...` before reaching any write. Find-and-replace on a
// standalone quote's speaker, occasion, place or medium — four of the eleven
// fields this endpoint offers — could not run at all, and answered 500 rather
// than saying so. Nothing shipped calls it yet, which is why it was never
// reported.
//
// It is the SAME MISTAKE quoteFieldKinds documents one file over, made a second
// time in a second table, which is the argument for translating the reader's word
// exactly once. replaceKind does that, and a test walks these keys against
// quoteBulkKinds so a third spelling cannot arrive quietly.
var replaceFields = map[string][]string{
	"annotation": {"quote", "note", "character"},
	"dialogue":   {"quote", "note", "character", "actor"},
	"utterance":  {"quote", "note", "speaker", "occasion", "place", "medium"},
}

// replaceKind turns the word the API speaks into the word the tables use. "quote"
// is the bin's name for a standalone quote and the one every /quotes route wears,
// so it stays the wire word; "utterance" is the table's. One direction, one
// place.
func replaceKind(wire string) string {
	if wire == "quote" {
		return "utterance"
	}
	return wire
}

type replaceReq struct {
	Kind    string  `json:"kind"`
	IDs     []int64 `json:"ids"`
	Field   string  `json:"field"`
	Find    string  `json:"find"`
	Replace string  `json:"replace"`
	// MatchCase off is the useful default for post-import cleanup; WholeWord
	// stops "the" inside "there".
	MatchCase bool `json:"match_case"`
	WholeWord bool `json:"whole_word"`
}

type replaceHit struct {
	ID     int64  `json:"id"`
	Before string `json:"before"`
	After  string `json:"after"`
	Count  int    `json:"count"`
}

// replacePreviewMax caps what comes back. A selection can be thousands of rows
// and a preview nobody can read is a preview nobody reads — the count of
// affected rows is reported in full alongside it, so the number is never capped
// even when the list is.
const replacePreviewMax = 200

func (s *Server) handleReplacePreview(w http.ResponseWriter, r *http.Request) {
	s.replace(w, r, false)
}

func (s *Server) handleReplaceApply(w http.ResponseWriter, r *http.Request) {
	s.replace(w, r, true)
}

func (s *Server) replace(w http.ResponseWriter, r *http.Request, apply bool) {
	var req replaceReq
	if !decodeBody(w, r, &req) {
		return
	}
	kind := replaceKind(req.Kind)
	fields, ok := replaceFields[kind]
	if !ok {
		writeErr(w, http.StatusBadRequest, "kind must be annotation, dialogue or quote")
		return
	}
	if !containsStr(fields, req.Field) {
		writeErr(w, http.StatusBadRequest, "field does not apply to this kind")
		return
	}
	// AN EMPTY `find` IS REFUSED. It matches at every position, so a replace with
	// it would interleave the replacement through every character of every quote
	// in the selection — the single most destructive thing this endpoint could be
	// asked to do, and the easiest to ask for by accident by leaving a box blank.
	if strings.TrimSpace(req.Find) == "" {
		writeErr(w, http.StatusBadRequest, "type the text to find")
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
	olog.Tracef("[replace] kind=%s field=%s apply=%v ids=%d", req.Kind, req.Field, apply, len(req.IDs))

	spec := quoteBulkKinds[kind]
	var owned []int64
	var err error
	if spec.ParentCol == "" {
		owned, err = s.ownedRowIDs(spec.Table, uid, req.IDs)
	} else {
		owned, err = s.ownedChildIDs(spec.Table, spec.ParentCol, spec.ParentTable, uid, req.IDs)
	}
	if err != nil {
		internalError(w, r, "replace: ownership", err)
		return
	}
	if len(owned) == 0 {
		writeErr(w, http.StatusNotFound, "no matching items")
		return
	}

	args := make([]any, 0, len(owned))
	for _, id := range owned {
		args = append(args, id)
	}
	rows, err := s.Store.DB.Query(
		`SELECT id, COALESCE(`+req.Field+`, '') FROM `+spec.Table+
			` WHERE id IN (`+inClause(len(owned))+`)`, args...)
	if err != nil {
		internalError(w, r, "replace: read", err)
		return
	}
	type change struct {
		id    int64
		after string
		hit   replaceHit
	}
	var changes []change
	for rows.Next() {
		var id int64
		var before string
		if err := rows.Scan(&id, &before); err != nil {
			rows.Close()
			internalError(w, r, "replace: scan", err)
			return
		}
		after, n := replaceAll(before, req.Find, req.Replace, req.MatchCase, req.WholeWord)
		if n == 0 {
			continue
		}
		changes = append(changes, change{id, after, replaceHit{ID: id, Before: before, After: after, Count: n}})
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		internalError(w, r, "replace: rows", err)
		return
	}

	if !apply {
		hits := make([]replaceHit, 0, min(len(changes), replacePreviewMax))
		for i, c := range changes {
			if i >= replacePreviewMax {
				break
			}
			hits = append(hits, c.hit)
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"rows": len(changes), "shown": len(hits), "hits": hits,
		})
		return
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "replace: begin", err)
		return
	}
	defer tx.Rollback()
	// The person link follows the column here as it does everywhere else (0059).
	// A find-and-replace over `actor` or `speaker` is precisely the rewrite that
	// re-attributes a line — correcting one spelling across four hundred rows is
	// the use this endpoint exists for — so a row it changed and did not re-link
	// would leave the person panel showing the name nobody types any more.
	personKind, links := quotePersonKind[kind]
	seps := s.creditSeps(uid)
	for _, c := range changes {
		if _, err := tx.Exec(
			`UPDATE `+spec.Table+` SET `+req.Field+` = ?, updated_at = datetime('now') WHERE id = ?`,
			c.after, c.id); err != nil {
			internalError(w, r, "replace: update", err)
			return
		}
		if links {
			if err := store.SyncQuotePerson(tx, uid, personKind, c.id, seps); err != nil {
				internalError(w, r, "replace: link person", err)
				return
			}
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "replace: commit", err)
		return
	}
	olog.Printf("[replace] %s.%s: %d row(s) rewritten for user %d", spec.Table, req.Field, len(changes), uid)
	writeJSON(w, http.StatusOK, map[string]any{"rows": len(changes)})
}

// replaceAll is literal find-and-replace with two options, and returns the count
// so a row that did not change is never rewritten (and never gets a new
// updated_at for nothing).
//
// WHOLE WORD IS IMPLEMENTED WITHOUT A REGEX, deliberately — see the header. A
// boundary here is "not a letter or a digit on either side", which is what a
// reader means by a word in prose and what \b would give for Latin text without
// the escaping hazard of building a pattern out of user input.
func replaceAll(text, find, repl string, matchCase, wholeWord bool) (string, int) {
	if find == "" {
		return text, 0
	}
	hay, needle := text, find
	if !matchCase {
		hay, needle = strings.ToLower(text), strings.ToLower(find)
	}
	var b strings.Builder
	count, i := 0, 0
	for {
		j := strings.Index(hay[i:], needle)
		if j < 0 {
			b.WriteString(text[i:])
			break
		}
		at := i + j
		end := at + len(needle)
		if wholeWord && !isWordBoundary(hay, at, end) {
			// Copy one byte and keep looking, so overlapping near-misses do not
			// swallow the rest of the string.
			b.WriteString(text[i : at+1])
			i = at + 1
			continue
		}
		b.WriteString(text[i:at])
		b.WriteString(repl)
		count++
		i = end
	}
	if count == 0 {
		return text, 0
	}
	return b.String(), count
}

func isWordBoundary(s string, start, end int) bool {
	wordish := func(b byte) bool {
		return b >= 'a' && b <= 'z' || b >= 'A' && b <= 'Z' || b >= '0' && b <= '9' || b == '_'
	}
	if start > 0 && wordish(s[start-1]) {
		return false
	}
	if end < len(s) && wordish(s[end]) {
		return false
	}
	return true
}

func containsStr(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}
