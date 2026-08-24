package httpapi

import (
	"database/sql"
	"errors"
	"net/http"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// The three endpoints that turn the cleanup list into a worklist you can finish.
//
// POST /cleanup/accept     rewrite the fields named, rule by rule
// POST /cleanup/ignore     never offer these findings again
// POST /cleanup/unignore   put an ignored one back on the list
//
// GET /cleanup itself is unchanged in shape and grew two things: every finding now
// carries the text it would become, and `?bucket=ignored` returns what has been
// refused instead of what is left. See cleanup_handlers.go.
//
// NOTHING HERE DECIDES WHAT A REWRITE IS. The request names a (quote, field, rule);
// the server reads that field out of the database and applies that rule's own fix to
// it (cleanup_fix.go). A caller cannot hand this endpoint a string to store — the
// only thing it can do is name a rule the server already offered, which is what
// keeps "accept" honest even against a client that has gone wrong.
//
// ONE TRANSACTION FOR THE WHOLE BATCH. Accept-all on a rule is one press over up to
// five hundred fields, and half of that applied is a library in a state nobody
// chose. A duplicate is the one per-item outcome that does not roll the batch back —
// see the note on it below.

// cleanupBatchMax bounds one request. Five hundred is the scan's own cap
// (maxCleanupFindings), so "accept everything on this page" fits in one call and
// nothing larger can be asked for.
const cleanupBatchMax = maxCleanupFindings

// cleanupTable maps the kind word the API answers with to the table that holds it.
// `book`, `screen`, `quote` — cleanup_handlers.go's vocabulary, which is also
// item_reviews' and anthology_entries'.
func cleanupTable(kind string) string {
	switch kind {
	case "book":
		return "annotations"
	case "screen":
		return "dialogues"
	case "quote":
		return "utterances"
	}
	return ""
}

// cleanupFieldOK is the three text columns the scan reads and this may write. A
// field outside it is refused rather than ignored: a client asking to rewrite
// `character` is a client that would report success for a write that never happened.
func cleanupFieldOK(field string) bool {
	return field == "quote" || field == "note" || field == "translation"
}

// cleanupTarget identifies one finding. It is the request shape for all three
// endpoints and the map key the scan filters against.
type cleanupTarget struct {
	Kind  string `json:"kind"`
	ID    int64  `json:"id"`
	Field string `json:"field"`
	Rule  string `json:"rule"`
	Hash  string `json:"match_hash"`
}

func (t cleanupTarget) validFor(needHash bool) bool {
	if cleanupTable(t.Kind) == "" || t.ID <= 0 || !cleanupFieldOK(t.Field) {
		return false
	}
	if _, ok := cleanupRuleByID(t.Rule); !ok {
		return false
	}
	return !needHash || t.Hash != ""
}

// ---------------------------------------------------------------- accept

func (s *Server) handleCleanupAccept(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []cleanupTarget `json:"items"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Items) == 0 {
		writeErr(w, http.StatusBadRequest, "nothing to accept")
		return
	}
	if len(req.Items) > cleanupBatchMax {
		writeErr(w, http.StatusBadRequest, "too many items (max 500)")
		return
	}
	uid := userID(r)
	for _, it := range req.Items {
		if !it.validFor(false) {
			writeErr(w, http.StatusBadRequest, "invalid item")
			return
		}
		// A rule this build knows but cannot rewrite is refused here rather than
		// counted as applied. Every rule has a fix today; the check exists because
		// the table in cleanup_fix.go is allowed not to.
		if !cleanupFixable(it.Rule) {
			writeErr(w, http.StatusBadRequest, "that rule has no correction to apply")
			return
		}
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "cleanup: begin", err)
		return
	}
	defer tx.Rollback()

	applied, stale, duplicates := 0, 0, 0
	for _, it := range req.Items {
		row, ok, err := s.cleanupRow(tx, uid, it)
		if err != nil {
			codedError(w, r, olog.CodeCleanupApply, "cleanup: read row", err)
			return
		}
		if !ok {
			// Not this reader's, or deleted since the page was drawn. 404 for the
			// reason every read in this package gives: a 403 confirms the row exists.
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		before := row.text(it.Field)
		after, changed := cleanupApplyRule(before, it.Rule)
		if !changed {
			// The text has changed since the scan the page is showing, so the rule no
			// longer fires. Not an error — the reader loses a suggestion, not a quote
			// — and reported so the page can say so and refresh.
			stale++
			continue
		}
		q := `UPDATE OR IGNORE ` + cleanupTable(it.Kind) + ` SET ` + it.Field + ` = ?, updated_at = datetime('now')`
		args := []any{after}
		// THE DEDUPE HASH IS RECOMPUTED when the words themselves change. The bulk
		// find-and-replace path does not, which leaves a row whose stored hash
		// describes words it no longer holds — so a later import of the corrected
		// text is not recognised as the duplicate it is. A note and a translation are
		// in no hash, so those rewrites leave it alone rather than writing the same
		// value back.
		if hash := row.dedupeHash(it.Field, after); hash != "" {
			q += `, dedupe_hash = ?`
			args = append(args, hash)
		}
		q += ` WHERE id = ?`
		args = append(args, it.ID)
		res, err := tx.Exec(q, args...)
		if err != nil {
			codedError(w, r, olog.CodeCleanupApply, "cleanup: rewrite", err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			// OR IGNORE swallowed a UNIQUE (parent, dedupe_hash): the corrected words
			// are already in the library under another row, which is exactly what an
			// import run twice produces. Counted and reported rather than rolling the
			// batch back, because refusing everything over one duplicate would make
			// accept-all useless on the library that most needs it.
			duplicates++
			continue
		}
		applied++
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "cleanup: commit", err)
		return
	}
	olog.Printf("[cleanup] user %d: %d field(s) rewritten, %d stale, %d duplicate", uid, applied, stale, duplicates)
	writeJSON(w, http.StatusOK, map[string]any{"applied": applied, "stale": stale, "duplicates": duplicates})
}

// cleanupRowText is one quote as accept reads it: the three fields it may rewrite,
// and everything the dedupe hash for its kind is keyed by.
type cleanupRowText struct {
	kind        string
	quote       string
	note        string
	translation string
	season      *int
	episode     *int
	act         string
	quest       string
	speaker     string
	occasion    string
	occDate     string
}

func (r cleanupRowText) text(field string) string {
	switch field {
	case "note":
		return r.note
	case "translation":
		return r.translation
	}
	return r.quote
}

// dedupeHash is the new hash for a rewritten field, or "" when that field is not
// part of one. All three hashes are keyed on the QUOTE plus its locators, so a note
// or a translation must leave the stored hash alone.
func (r cleanupRowText) dedupeHash(field, after string) string {
	if field != "quote" {
		return ""
	}
	switch r.kind {
	case "book":
		return store.DedupeHash(after)
	case "screen":
		return store.DialogueDedupeHash(after, r.season, r.episode, r.act, r.quest)
	case "quote":
		return store.UtteranceDedupeHash(after, r.speaker, r.occasion, r.occDate)
	}
	return ""
}

// cleanupRow reads one quote, scoped to its owner in the SQL — JOINing through the
// parent for the two child tables, exactly as the scan does.
func (s *Server) cleanupRow(tx *sql.Tx, uid int64, t cleanupTarget) (cleanupRowText, bool, error) {
	out := cleanupRowText{kind: t.Kind}
	var err error
	switch t.Kind {
	case "book":
		err = tx.QueryRow(`
			SELECT a.quote, COALESCE(a.note, ''), COALESCE(a.translation, '')
			FROM annotations a JOIN books b ON b.id = a.book_id
			WHERE a.id = ? AND b.user_id = ?`, t.ID, uid).
			Scan(&out.quote, &out.note, &out.translation)
	case "screen":
		err = tx.QueryRow(`
			SELECT d.quote, COALESCE(d.note, ''), COALESCE(d.translation, ''),
			       d.season, d.episode, COALESCE(d.act, ''), COALESCE(d.quest, '')
			FROM dialogues d JOIN movies m ON m.id = d.movie_id
			WHERE d.id = ? AND m.user_id = ?`, t.ID, uid).
			Scan(&out.quote, &out.note, &out.translation, &out.season, &out.episode, &out.act, &out.quest)
	case "quote":
		err = tx.QueryRow(`
			SELECT quote, COALESCE(note, ''), COALESCE(translation, ''),
			       COALESCE(speaker, ''), COALESCE(occasion, ''), COALESCE(occasion_date, '')
			FROM utterances WHERE id = ? AND user_id = ?`, t.ID, uid).
			Scan(&out.quote, &out.note, &out.translation, &out.speaker, &out.occasion, &out.occDate)
	default:
		return out, false, nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return out, false, nil
	}
	if err != nil {
		return out, false, err
	}
	return out, true, nil
}

// ---------------------------------------------------------------- ignore
//
// BOTH DIRECTIONS ARE IDEMPOTENT, and that is not politeness: the page can be open
// in two tabs and a phone can retry a request whose reply it never saw. Ignoring
// twice is one row (the UNIQUE index, with ON CONFLICT DO NOTHING); un-ignoring
// something that is not ignored changes nothing and reports 0.

func (s *Server) handleCleanupIgnore(w http.ResponseWriter, r *http.Request) {
	s.cleanupIgnoreWrite(w, r, true)
}

func (s *Server) handleCleanupUnignore(w http.ResponseWriter, r *http.Request) {
	s.cleanupIgnoreWrite(w, r, false)
}

func (s *Server) cleanupIgnoreWrite(w http.ResponseWriter, r *http.Request, ignore bool) {
	var req struct {
		Items []cleanupTarget `json:"items"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Items) == 0 {
		writeErr(w, http.StatusBadRequest, "nothing selected")
		return
	}
	if len(req.Items) > cleanupBatchMax {
		writeErr(w, http.StatusBadRequest, "too many items (max 500)")
		return
	}
	uid := userID(r)
	for _, it := range req.Items {
		if !it.validFor(true) {
			writeErr(w, http.StatusBadRequest, "invalid item")
			return
		}
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "cleanup: begin", err)
		return
	}
	defer tx.Rollback()
	changed := 0
	for _, it := range req.Items {
		if ignore {
			// OWNERSHIP IS CHECKED BEFORE THE INSERT, not inferred from it.
			// cleanup_ignores carries no foreign key to the quote — it cannot, being
			// polymorphic — so nothing in the schema would stop a row pointing at
			// somebody else's highlight, and an unchecked insert would let a caller
			// enumerate ids by watching which ones succeed.
			if _, ok, err := s.cleanupRow(tx, uid, it); err != nil {
				codedError(w, r, olog.CodeCleanupIgnore, "cleanup: ownership", err)
				return
			} else if !ok {
				writeErr(w, http.StatusNotFound, "not found")
				return
			}
			res, err := tx.Exec(`
				INSERT INTO cleanup_ignores (user_id, kind, item_id, field, rule, match_hash)
				VALUES (?, ?, ?, ?, ?, ?)
				ON CONFLICT (user_id, kind, item_id, field, rule, match_hash) DO NOTHING`,
				uid, it.Kind, it.ID, it.Field, it.Rule, it.Hash)
			if err != nil {
				codedError(w, r, olog.CodeCleanupIgnore, "cleanup: ignore", err)
				return
			}
			if n, _ := res.RowsAffected(); n > 0 {
				changed++
			}
			continue
		}
		// Un-ignoring is scoped by user_id, which is the whole ownership check it
		// needs: a row that is not this reader's cannot be matched, so it deletes
		// nothing and reports nothing.
		res, err := tx.Exec(`
			DELETE FROM cleanup_ignores
			WHERE user_id = ? AND kind = ? AND item_id = ? AND field = ? AND rule = ? AND match_hash = ?`,
			uid, it.Kind, it.ID, it.Field, it.Rule, it.Hash)
		if err != nil {
			codedError(w, r, olog.CodeCleanupIgnore, "cleanup: unignore", err)
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			changed++
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "cleanup: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"changed": changed})
}

// cleanupIgnores reads this user's whole ignore set into a map, for the scan to
// filter against. One query and a few hundred rows at worst; the alternative is one
// query per rule per field per quote.
func (s *Server) cleanupIgnores(uid int64) (map[cleanupTarget]bool, error) {
	rows, err := s.Store.DB.Query(
		`SELECT kind, item_id, field, rule, match_hash FROM cleanup_ignores WHERE user_id = ?`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[cleanupTarget]bool{}
	for rows.Next() {
		var t cleanupTarget
		if err := rows.Scan(&t.Kind, &t.ID, &t.Field, &t.Rule, &t.Hash); err != nil {
			return nil, err
		}
		out[t] = true
	}
	return out, rows.Err()
}
