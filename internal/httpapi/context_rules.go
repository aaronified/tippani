package httpapi

// HOW MUCH CONTEXT, the three tiers (docs/wiki/Plan-Work-Source-Files.md):
//
//	quote (source_context.want_*)  >  work or board (books/movies/boards.context_*)
//	  >  the reader's global pair (two settings rows)  >  the built-in default
//
// NULL INHERITS AND 0 IS NOTHING, per half, so "nothing before, inherit after" can be
// said. The stored span is the ceiling: a rule is arithmetic over what is already stored
// and the panel never shows more than that, nor past a boundary.
//
// CHANGING A WORK OR BOARD RULE ASKS WHETHER TO ENFORCE IT ON EXISTING QUOTES, and the
// answer is a CLAMP, never an expansion: a quote adjusted wider than the new rule is
// brought down to it; one adjusted narrower is left exactly where it is, because it is
// narrow on purpose (a chapter start, a reader's own 0). Quotes with no adjustment follow
// the rule because following it is what NULL means. The second option, "clear", removes
// the adjustments, and is the only way a raise reaches quotes that were adjusted below it.

import (
	"database/sql"
	"net/http"
	"strconv"
)

// ruleMax is the widest a rule may ask for: the larger of the two ceilings.
const ruleMax = ceilingCues

// resolveHalf is one half of the cascade: the first tier that has a value wins.
func resolveHalf(def int, midName string, own, mid, glob sql.NullInt64) (int, string) {
	switch {
	case own.Valid:
		return int(own.Int64), "quote"
	case mid.Valid:
		return int(mid.Int64), midName
	case glob.Valid:
		return int(glob.Int64), "global"
	}
	return def, "default"
}

var tierRank = map[string]int{"quote": 0, "work": 1, "board": 1, "global": 2, "default": 3}

// moreSpecific names the nearer of two tiers, which is the one the panel says once.
func moreSpecific(a, b string) string {
	if tierRank[b] < tierRank[a] {
		return b
	}
	return a
}

type ruleHalves struct {
	Before *int `json:"before"`
	After  *int `json:"after"`
}

func nullOf(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}

func halfOf(n sql.NullInt64) *int {
	if !n.Valid {
		return nil
	}
	v := int(n.Int64)
	return &v
}

func settingKey(half string, uid int64) string {
	return "context_" + half + "." + strconv.FormatInt(uid, 10)
}

// globalRule reads the reader's own pair; an absent row is NULL.
func (s *Server) globalRule(uid int64) (before, after sql.NullInt64) {
	read := func(half string) (n sql.NullInt64) {
		var v string
		if s.Store.DB.QueryRow(`SELECT value FROM settings WHERE key = ?`, settingKey(half, uid)).Scan(&v) == nil {
			if x, err := strconv.ParseInt(v, 10, 64); err == nil && x >= 0 {
				n = sql.NullInt64{Int64: x, Valid: true}
			}
		}
		return n
	}
	return read("before"), read("after")
}

// middleRule reads the work's or board's pair for one quote. A quote with no work or board
// (an utterance on no board) has no middle tier, and the answer is two NULLs.
func (s *Server) middleRule(uid int64, kind string, id int64) (before, after sql.NullInt64, from string) {
	var q string
	switch kind {
	case "annotation":
		q, from = `SELECT w.context_before, w.context_after FROM annotations x JOIN books w ON w.id = x.book_id
		           WHERE x.id = ? AND w.user_id = ?`, "work"
	case "dialogue":
		q, from = `SELECT w.context_before, w.context_after FROM dialogues x JOIN movies w ON w.id = x.movie_id
		           WHERE x.id = ? AND w.user_id = ?`, "work"
	default:
		q, from = `SELECT w.context_before, w.context_after FROM utterances x JOIN boards w ON w.id = x.board_id
		           WHERE x.id = ? AND w.user_id = ?`, "board"
	}
	_ = s.Store.DB.QueryRow(q, id, uid).Scan(&before, &after)
	return before, after, from
}

// effectiveSpan is the cascade for one quote: what to show, and which tier said so.
func (s *Server) effectiveSpan(uid int64, kind string, id int64, wantB, wantA sql.NullInt64, def int) (window, string) {
	mb, ma, midName := s.middleRule(uid, kind, id)
	gb, ga := s.globalRule(uid)
	b, fromB := resolveHalf(def, midName, wantB, mb, gb)
	a, fromA := resolveHalf(def, midName, wantA, ma, ga)
	return window{Before: b, After: a}, moreSpecific(fromB, fromA)
}

func ruleOK(p *int) bool { return p == nil || (*p >= 0 && *p <= ruleMax) }

// ---- the rule on a work, a board, or the reader --------------------------------------

type ruleScope struct {
	table   string // books | movies | boards
	subject string // the quote kind its rule governs
	quotes  string // that work's quote ids
}

var ruleScopes = map[string]ruleScope{
	"book":  {"books", "annotation", `SELECT id FROM annotations WHERE book_id = ?`},
	"movie": {"movies", "dialogue", `SELECT id FROM dialogues WHERE movie_id = ?`},
	"board": {"boards", "utterance", `SELECT id FROM utterances WHERE board_id = ?`},
}

// GET /context-rules/{scope}/{id} (scope book | movie | board) and GET /context-rules/global.
func (s *Server) handleGetContextRule(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	if r.PathValue("scope") == "" {
		b, a := s.globalRule(uid)
		writeJSON(w, http.StatusOK, ruleHalves{halfOf(b), halfOf(a)})
		return
	}
	sc, ok := ruleScopes[r.PathValue("scope")]
	id, idOK := pathID(r)
	if !ok || !idOK {
		writeErr(w, http.StatusBadRequest, "scope must be book, movie or board, with an id")
		return
	}
	var b, a sql.NullInt64
	err := s.Store.DB.QueryRow(`SELECT context_before, context_after FROM `+sc.table+` WHERE id = ? AND user_id = ?`, id, uid).Scan(&b, &a)
	if err == sql.ErrNoRows {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		internalError(w, r, "get context rule", err)
		return
	}
	writeJSON(w, http.StatusOK, ruleHalves{halfOf(b), halfOf(a)})
}

type putRuleReq struct {
	ruleHalves
	// Enforce is what to do with the quotes that already exist: "" leaves them,
	// "clamp" brings any adjusted wider than this rule down to it, "clear" removes
	// their adjustments. Meaningless for the global pair, which is never enforced.
	Enforce string `json:"enforce"`
}

// PUT /context-rules/{scope}/{id} and PUT /context-rules/global. Full state: a null half
// is "inherit", which is how a rule is reset.
func (s *Server) handlePutContextRule(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	var req putRuleReq
	if !decodeBody(w, r, &req) {
		return
	}
	if !ruleOK(req.Before) || !ruleOK(req.After) {
		writeErr(w, http.StatusBadRequest, "a context rule is between 0 and "+strconv.Itoa(ruleMax))
		return
	}
	if req.Enforce != "" && req.Enforce != "clamp" && req.Enforce != "clear" {
		writeErr(w, http.StatusBadRequest, "enforce is clamp or clear")
		return
	}
	if r.PathValue("scope") == "" {
		for half, p := range map[string]*int{"before": req.Before, "after": req.After} {
			var err error
			if p == nil {
				_, err = s.Store.DB.Exec(`DELETE FROM settings WHERE key = ?`, settingKey(half, uid))
			} else {
				_, err = s.Store.DB.Exec(`INSERT INTO settings (key, value) VALUES (?, ?)
					ON CONFLICT(key) DO UPDATE SET value = excluded.value`, settingKey(half, uid), strconv.Itoa(*p))
			}
			if err != nil {
				internalError(w, r, "put global context rule", err)
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{})
		return
	}
	sc, ok := ruleScopes[r.PathValue("scope")]
	id, idOK := pathID(r)
	if !ok || !idOK {
		writeErr(w, http.StatusBadRequest, "scope must be book, movie or board, with an id")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`UPDATE `+sc.table+` SET context_before = ?, context_after = ? WHERE id = ? AND user_id = ?`,
		nullOf(req.Before), nullOf(req.After), id, uid)
	if err != nil {
		internalError(w, r, "put context rule", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	changed := int64(0)
	inWork := `item_id IN (` + sc.quotes + `)`
	switch req.Enforce {
	case "clamp":
		// A CLAMP, NEVER AN EXPANSION: only a value wider than the rule moves, and it
		// moves down to the rule. A narrower one, and an unset one, are not touched.
		for col, p := range map[string]*int{"want_before": req.Before, "want_after": req.After} {
			if p == nil {
				continue
			}
			res, err := tx.Exec(`UPDATE source_context SET `+col+` = ? WHERE user_id = ? AND subject = ? AND `+col+` > ? AND `+inWork,
				*p, uid, sc.subject, *p, id)
			if err != nil {
				internalError(w, r, "clamp context", err)
				return
			}
			n, _ := res.RowsAffected()
			changed += n
		}
	case "clear":
		res, err := tx.Exec(`UPDATE source_context SET want_before = NULL, want_after = NULL
			WHERE user_id = ? AND subject = ? AND (want_before IS NOT NULL OR want_after IS NOT NULL) AND `+inWork,
			uid, sc.subject, id)
		if err != nil {
			internalError(w, r, "clear context", err)
			return
		}
		changed, _ = res.RowsAffected()
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit context rule", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"changed": changed})
}

// ---- the per-quote adjustment, one or many -------------------------------------------

type spanReq struct {
	Kind string  `json:"kind"`
	IDs  []int64 `json:"ids"`
	// The bulk editor's three states, as its other fields: absent leaves the half alone,
	// "" puts it back to inherited, a number sets it.
	Before *string `json:"before"`
	After  *string `json:"after"`
}

// POST /quotes/context-span — set or reset the per-quote adjustment on one quote or a
// selection. Only quotes that have stored context have a row to adjust; the answer says how
// many did.
func (s *Server) handleContextSpan(w http.ResponseWriter, r *http.Request) {
	var req spanReq
	if !decodeBody(w, r, &req) {
		return
	}
	valid := false
	for _, k := range bulkAllKinds {
		valid = valid || k == req.Kind
	}
	if !valid || len(req.IDs) == 0 || (req.Before == nil && req.After == nil) {
		writeErr(w, http.StatusBadRequest, "say a kind, the quotes, and before or after")
		return
	}
	set := ""
	var args []any
	for _, h := range []struct {
		col string
		p   *string
	}{{"want_before", req.Before}, {"want_after", req.After}} {
		if h.p == nil {
			continue
		}
		var v any
		if *h.p != "" {
			n, err := strconv.Atoi(*h.p)
			if err != nil || n < 0 || n > ruleMax {
				writeErr(w, http.StatusBadRequest, "a context size is between 0 and "+strconv.Itoa(ruleMax))
				return
			}
			v = n
		}
		if set != "" {
			set += ", "
		}
		set += h.col + " = ?"
		args = append(args, v)
	}
	uid := userID(r)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	updated := int64(0)
	for _, id := range req.IDs {
		res, err := tx.Exec(`UPDATE source_context SET `+set+` WHERE user_id = ? AND subject = ? AND item_id = ?`,
			append(append([]any{}, args...), uid, req.Kind, id)...)
		if err != nil {
			internalError(w, r, "context span", err)
			return
		}
		n, _ := res.RowsAffected()
		updated += n
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit context span", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"updated": updated})
}
