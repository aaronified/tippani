package httpapi

// FILLING AN ANTHOLOGY FROM A SEARCH (0075) — the app's first stored query.
//
// A RULE IS A WAY TO FILL AN ANTHOLOGY, NOT A WAY TO BE ONE. The argument is in
// 0075 and it is the decision the whole feature turns on: a live query anthology
// can hold neither an order nor your writing, and those two are what an anthology
// IS. So a fill APPENDS real rows and then gets out of the way — from that moment
// they are ordinary entries, draggable and annotatable and removable, and nothing
// about them remembers that a rule put them there.
//
// THE SAME QUERY BUILDER, NOT A COPY, and this is the one thing that had to be got
// right. `facetedHits` is what the search bar runs, with the same per-kind sources,
// the same facet clause, the same FTS columns and the same ordering — so a rule
// CANNOT find different quotes from the search bar showing the same words. The
// exporters already make this argument about renderers ("three would drift, and
// drift in an exporter is invisible until someone re-imports a file written by the
// wrong one"); it is sharper here, because the drift would be between a thing the
// reader can see and a thing they cannot.
//
// The cost of that reuse is that each row is scanned into its full hit struct to
// take one id off it. That is a few hundred bytes per candidate on a path that runs
// when a reader presses a button, and it buys the guarantee above. A leaner
// id-only query would be a second query builder, which is the thing this comment
// exists to refuse.
//
// NEVER REMOVES AND NEVER REORDERS. A fill that could remove would delete the
// reader's commentary as a side effect of a library change — a tag edited on a
// quote, and a paragraph they wrote about it is gone. `INSERT OR IGNORE` against
// the existing primary key is the whole mechanism: a quote already in the anthology
// is skipped, not duplicated, and that behaviour was already tested before this
// file existed.
//
// WHAT THE CREDIT FACETS REACH, which a reader building an anthology OF AN ACTOR
// will notice and should not have to discover: `author`, `actor`, `character` and
// `speaker` match the quote's or work's OWN column, not `work_cast` (0048). So
// "every line Rajesh Khanna spoke" finds the lines where he is named on the line
// and misses the ones where he is in the film's cast and the line is unattributed.
// That is the existing search's behaviour and this does not change it — the rule
// screen is where it has to be said.

import (
	"database/sql"
	"net/http"
	"net/url"
	"strings"

	"tippani/internal/olog"
)

// anthologyFillScan is how many candidates one kind is examined for.
//
// IT IS NOT THE ADD LIMIT, and the two exist for different reasons.
// `anthologyAddMax` (200) is how many entries one request may APPEND, which is a
// promise to the reader about how much their anthology can change at once. This is
// how far the search is read in order to say how many MATCHED — because a count and
// a page are two queries, and the count one cannot be reused here: `facetedCount`
// reads the base table and knows nothing about FTS, so under a free-text rule it
// would count every row the facets allow and ignore the words.
//
// 5000 over a personal quote library is a ceiling nobody reaches, and when somebody
// does the response says so rather than quietly reporting the ceiling as the truth.
const anthologyFillScan = 5000

type anthologyFillReq struct {
	Rule string `json:"rule"`
	// Preview asks what a fill WOULD do and writes nothing — the number the rule
	// screen shows before the reader commits to it.
	//
	// IT IS THE SAME CODE PATH, ROLLED BACK, and that is the whole reason it is a
	// flag here rather than a counting endpoint of its own. A preview that counts
	// differently from the fill is the same drift this file exists to refuse, one
	// layer up: the reader would be shown a number and then given a different one.
	// So the fill runs inside a transaction and the transaction is abandoned.
	Preview bool `json:"preview"`
	// Auto stores "keep it fed" alongside the rule, because a reader who presses
	// Fill with the switch on means both — and two requests to say one thing is how
	// the switch and the rule get out of step.
	Auto bool `json:"auto"`
}

type anthologyFillResp struct {
	// Added is what actually landed: matched, minus what was already here, capped.
	Added int `json:"added"`
	// Matched is how many quotes the rule found in the whole library.
	Matched int `json:"matched"`
	// Skipped is how many of those were already in the anthology. REPORTED RATHER
	// THAN FOLDED INTO Added, because "found 40, added 0" and "found 40, added 0,
	// all 40 were already here" are the same number and completely different news.
	Skipped int `json:"skipped"`
	// Capped says the cap was reached, so `matched - added` is work still to do
	// rather than work that was refused. The Kindle-clippings habit: report what you
	// did not take rather than truncate quietly.
	Capped bool `json:"capped"`
	// MatchedCapped says Matched is a FLOOR — the scan ceiling was reached and the
	// true number is larger. Separate from Capped because they are different facts
	// and a reader pressing Fill again wants to know which one they hit.
	MatchedCapped bool `json:"matched_capped,omitempty"`
}

// fillExec is the half of a database handle appendFill needs. `*sql.DB` and
// `*sql.Tx` both satisfy it, which is what lets one function serve the fill and its
// preview without either knowing which it is.
type fillExec interface {
	QueryRow(string, ...any) *sql.Row
	Exec(string, ...any) (sql.Result, error)
}

// anthologyFillItem is one candidate: the entry vocabulary, not the search's.
type anthologyFillItem struct {
	Kind   string
	ItemID int64
}

// handleFillAnthology runs a rule and appends what it finds.
func (s *Server) handleFillAnthology(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	var req anthologyFillReq
	if !decodeBody(w, r, &req) {
		return
	}
	uid := userID(r)
	// THE ANTHOLOGY IS CHECKED BEFORE THE LIBRARY IS READ. A fill against somebody
	// else's anthology must not first run a search over the caller's own quotes and
	// then refuse — that is a 404 that took a second and told a timer something.
	var exists int
	switch err := s.Store.DB.QueryRow(`SELECT 1 FROM anthologies WHERE id = ? AND user_id = ?`, id, uid).Scan(&exists); {
	case err == sql.ErrNoRows:
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	case err != nil:
		internalError(w, r, "fill anthology", err)
		return
	}

	rule := strings.TrimSpace(req.Rule)
	if rule == "" {
		// AN EMPTY RULE IS REFUSED RATHER THAN TREATED AS "EVERYTHING". A search bar
		// with nothing in it shows the library; a fill with nothing in it would put
		// the library in an anthology, two hundred quotes at a time, and there is no
		// undo for that beyond removing them one at a time.
		writeErr(w, http.StatusBadRequest, "give the rule something to match")
		return
	}
	items, matched, scanned, err := s.anthologyMatches(uid, rule)
	if err != nil {
		// A rule that will not parse is the reader's, not the server's.
		writeErr(w, http.StatusBadRequest, "that rule could not be read")
		return
	}
	olog.Tracef("[anthologies] fill uid=%d id=%d matched=%d", uid, id, matched)

	var res anthologyFillResp
	if req.Preview {
		// THE REAL WRITE, ABANDONED. A transaction that is never committed leaves
		// nothing behind, and running it is the only way the preview's numbers are
		// the fill's numbers rather than a second opinion about them.
		tx, err := s.Store.DB.Begin()
		if err != nil {
			internalError(w, r, "preview fill", err)
			return
		}
		res, err = appendFill(tx, uid, id, items)
		_ = tx.Rollback()
		if err != nil {
			internalError(w, r, "preview fill", err)
			return
		}
	} else {
		res, err = appendFill(s.Store.DB, uid, id, items)
		if err != nil {
			internalError(w, r, "fill anthology", err)
			return
		}
	}
	res.Matched = matched
	res.MatchedCapped = scanned
	if req.Preview {
		// A PREVIEW STORES NOTHING, not even the rule. The reader has not agreed to
		// it yet, and a rule saved by looking at it is a rule that "keep it fed"
		// would go on running.
		writeJSON(w, http.StatusOK, res)
		return
	}
	// THE RULE IS STORED BY THE FILL THAT RAN IT, not by a separate save. A rule the
	// reader pressed Fill on is the rule they meant; storing it anywhere else means
	// the stored rule and the last one actually run can differ, and "keep it fed"
	// would then feed the anthology from a query nobody tested.
	if _, err := s.Store.DB.Exec(
		`UPDATE anthologies SET rule = ?, rule_auto = ?, rule_run_at = datetime('now'), updated_at = datetime('now')
		  WHERE id = ? AND user_id = ?`, rule, req.Auto, id, uid); err != nil {
		internalError(w, r, "fill anthology", err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// anthologyMatches runs the rule and returns the candidates in the search's own
// order, how many matched, and whether the scan ceiling was reached.
//
// THE ORDER ACROSS KINDS IS THE SEARCH RESPONSE'S — highlights, then film lines,
// then standalone quotes — because that is the order a reader saw them in when they
// built the rule in the search bar. Within a kind it is whatever the search itself
// orders by: relevance under a free-text rule, newest first without one. Inventing
// an order here would make the fill's result unrecognisable against the screen that
// produced it.
func (s *Server) anthologyMatches(uid int64, rule string) ([]anthologyFillItem, int, bool, error) {
	vals, err := url.ParseQuery(rule)
	if err != nil {
		return nil, 0, false, err
	}
	f, err := parseSearchFacets(vals)
	if err != nil {
		return nil, 0, false, err
	}
	q := strings.TrimSpace(vals.Get("q"))
	// THE SAME ftsCols THE SEARCH USES FOR THESE SECTIONS. "quote translation" is
	// 0051's decision, argued where the search makes it: somebody searching a shelf
	// of Bengali highlights types the English, and the hit they want is the
	// highlight rather than a translations section holding the same card twice.
	const cols = "quote translation"

	out := []anthologyFillItem{}
	capped := false

	anns, err := facetedHits(s, rowAnnotation, hitReq{what: "fill annotation", ftsCols: cols, q: q, limit: anthologyFillScan}, f, uid, scanAnnotationHit)
	if err != nil {
		return nil, 0, false, err
	}
	capped = capped || len(anns) == anthologyFillScan
	for _, h := range anns {
		out = append(out, anthologyFillItem{Kind: kindBook, ItemID: h.ID})
	}

	dias, err := facetedHits(s, rowDialogue, hitReq{what: "fill dialogue", ftsCols: cols, q: q, limit: anthologyFillScan}, f, uid, scanDialogueHit)
	if err != nil {
		return nil, 0, false, err
	}
	capped = capped || len(dias) == anthologyFillScan
	for _, h := range dias {
		out = append(out, anthologyFillItem{Kind: kindScreen, ItemID: h.ID})
	}

	utts, err := facetedHits(s, rowUtterance, hitReq{what: "fill quote", ftsCols: cols, q: q, limit: anthologyFillScan}, f, uid, scanUtteranceHit)
	if err != nil {
		return nil, 0, false, err
	}
	capped = capped || len(utts) == anthologyFillScan
	for _, h := range utts {
		out = append(out, anthologyFillItem{Kind: kindUtterance, ItemID: h.ID})
	}

	return out, len(out), capped, nil
}

// appendFill writes the candidates onto the end of the anthology.
//
// THE POSITION IS READ ONCE AND STEPPED IN GO, not recomputed per row: the entries
// are being appended in a known order, and `SELECT max(position)` inside the loop
// would be one query per quote to answer a question that only changes because of
// this loop.
//
// SKIPPED IS COUNTED FROM RowsAffected AND NOT BY ASKING FIRST. `INSERT OR IGNORE`
// already knows whether the row was there, and a pre-check would be both a second
// query and a race — a quote added by another tab between the check and the insert
// would be counted as added and not be.
func appendFill(db fillExec, uid, id int64, items []anthologyFillItem) (anthologyFillResp, error) {
	res := anthologyFillResp{}
	if len(items) == 0 {
		return res, nil
	}
	var next float64
	if err := db.QueryRow(
		`SELECT COALESCE(MAX(position), 0) + 1 FROM anthology_entries WHERE anthology_id = ?`, id).Scan(&next); err != nil {
		return res, err
	}
	for _, it := range items {
		if res.Added >= anthologyAddMax {
			res.Capped = true
			break
		}
		// THE QUOTE HAS TO BELONG TO THE CALLER, checked the way every other write
		// here checks it. It is redundant — the search that produced these ids was
		// already scoped by user — and it stays for the reason the entry query's own
		// redundant scope stays: the day it stops being redundant is the day an entry
		// points somewhere it should not.
		if !quoteOwned(db, uid, it.Kind, it.ItemID) {
			continue
		}
		r, err := db.Exec(
			`INSERT OR IGNORE INTO anthology_entries (anthology_id, position, kind, item_id) VALUES (?, ?, ?, ?)`,
			id, next, it.Kind, it.ItemID)
		if err != nil {
			return res, err
		}
		n, _ := r.RowsAffected()
		if n == 0 {
			res.Skipped++
			continue
		}
		res.Added++
		next++
	}
	return res, nil
}
