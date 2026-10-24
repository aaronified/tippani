package httpapi

// Proposed timestamps for a film's lines, from the file its work keeps.
//
// A quote you kept has words and often no time. The subtitle knows: every cue has a
// start and an end, and the matcher (internal/srcmatch) has already placed the quote
// in it and stored the span's times beside the context (source_context.start_at /
// end_at). So a proposal is read from rows — no file is opened, and "run it again"
// is a rescan that fills in what is new.
//
// PROPOSALS, NEVER WRITES. The app does not decide that the file is right and the
// reader's timestamp wrong: it shows the current value and the proposed one with the
// file's words as evidence, and the reader presses. Cleanup's doctrine, in Cleanup's
// shape — a refusal is durable (cleanup_ignores, keyed on the proposed value, so a
// later run proposing a different time is a new proposal because it is one), and an
// accept answers `stale` when the value moved between the scan and the press.
//
// TWO BUCKETS, split by how much judgement a row needs:
//
//   - exact: the quote appeared once, verbatim after the fold, in one place. Nothing
//     for an eye to add, so these may be accepted together (measured: 12 of 30 of the
//     owner's lines for one film).
//   - review: anything fuzzy. One press each, with the evidence shown.
//
// Bulk never acts across buckets, and the route refuses a mixed set.
//
// A BOOK'S HIGHLIGHT IS PROPOSED A PLACE THE SAME WAY (the EPUB half of the plan): the
// match stored beside its context also holds the percent of the book's text before it
// and the chapter its table of contents names. The proposal is that percent as the
// highlight's `location` ("42%") and, only where the highlight has no chapter yet, the
// chapter's name. It is a location in THIS file's text, not a page and not a Kindle
// location, and says so on screen. A highlight that already has a location is never
// exact: its proposal is a replacement, one press each, with the old value shown.

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
)

const (
	// The cleanup_ignores vocabulary this feature writes: the kind word the table
	// already uses for a film line, the field it is about, and its own rule token.
	locatorIgnoreKind  = "screen"
	locatorIgnoreField = "timestamp"
	locatorIgnoreRule  = "locator-time"

	// The same table's words for a book highlight's place (0052's `book` kind).
	placeIgnoreKind  = "book"
	placeIgnoreField = "location"
	placeIgnoreRule  = "locator-position"

	kindDialogue   = "dialogue"
	kindAnnotation = "annotation"

	bucketExact  = "exact"
	bucketReview = "review"
)

// locatorProposal is one proposed change to one film line's time.
type locatorProposal struct {
	Kind      string `json:"kind"` // dialogue | annotation
	ID        int64  `json:"id"`
	Quote     string `json:"quote"`
	WorkID    int64  `json:"work_id"`
	WorkTitle string `json:"work_title"`
	Season    int    `json:"season,omitempty"`
	Episode   int    `json:"episode,omitempty"`
	// What the line has now, and what the file says.
	Current     string `json:"current"`
	CurrentEnd  string `json:"current_end"`
	Proposed    string `json:"proposed"`
	ProposedEnd string `json:"proposed_end"`
	// Evidence is the file's own words for the matched span, so the reader sees what
	// the proposal rests on.
	Evidence string `json:"evidence"`
	Bucket   string `json:"bucket"`
	Distance int    `json:"distance"`
	// A book highlight's chapter, now and proposed (the file's own table of contents), and
	// whether the proposal REPLACES a location the reader already has.
	CurrentChapter  string `json:"current_chapter,omitempty"`
	ProposedChapter string `json:"proposed_chapter,omitempty"`
	Replaces        bool   `json:"replaces,omitempty"`
}

// locKey names one proposal: a dialogue's id and an annotation's id are two sequences.
type locKey struct {
	kind string
	id   int64
}

func kindOr(k string) string {
	if k == "" {
		return kindDialogue
	}
	return k
}

// clockSeconds reads H:MM:SS or HH:MM:SS (or MM:SS) into seconds, -1 for anything else.
// Two spellings of one time are one time: proposing "00:01:02" over "1:02" would be a
// change that changes nothing.
func clockSeconds(s string) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return -1
	}
	parts := strings.Split(s, ":")
	if len(parts) < 2 || len(parts) > 3 {
		return -1
	}
	total := 0
	for _, p := range parts {
		n, err := strconv.Atoi(strings.TrimSpace(p))
		if err != nil || n < 0 {
			return -1
		}
		total = total*60 + n
	}
	return total
}

// sameTime is true when two timestamp strings name one moment, or are both empty.
func sameTime(a, b string) bool {
	if strings.TrimSpace(a) == strings.TrimSpace(b) {
		return true
	}
	x, y := clockSeconds(a), clockSeconds(b)
	return x >= 0 && x == y
}

func locatorHash(p locatorProposal) string {
	if p.Kind == kindAnnotation {
		return p.Proposed + "|" + p.ProposedChapter
	}
	return p.Proposed + "|" + p.ProposedEnd
}

// ignoreKey is how a refusal is looked up: kind, item and what was proposed.
func ignoreKey(kind string, id int64, hash string) string {
	return kind + "|" + strconv.FormatInt(id, 10) + "|" + hash
}

// loadLocatorProposals reads the reader's proposals, optionally narrowed to some ids.
// Everything is scoped to the owner in the same statement that reads it.
func (s *Server) loadLocatorProposals(uid int64, only map[locKey]bool) ([]locatorProposal, error) {
	ignored := map[string]bool{}
	for _, ig := range [][4]string{
		{kindDialogue, locatorIgnoreKind, locatorIgnoreField, locatorIgnoreRule},
		{kindAnnotation, placeIgnoreKind, placeIgnoreField, placeIgnoreRule},
	} {
		irows, err := s.Store.DB.Query(
			`SELECT item_id, match_hash FROM cleanup_ignores WHERE user_id = ? AND kind = ? AND field = ? AND rule = ?`,
			uid, ig[1], ig[2], ig[3])
		if err != nil {
			return nil, err
		}
		for irows.Next() {
			var id int64
			var h string
			if irows.Scan(&id, &h) == nil {
				ignored[ignoreKey(ig[0], id, h)] = true
			}
		}
		irows.Close()
	}

	rows, err := s.Store.DB.Query(`
		SELECT d.id, d.quote, COALESCE(d.timestamp, ''), d.timestamp_end, COALESCE(d.season, 0), COALESCE(d.episode, 0),
		       m.id, m.title, sc.start_at, sc.end_at, sc.match_dist, sc.body
		FROM source_context sc
		JOIN dialogues d ON sc.subject = 'dialogue' AND d.id = sc.item_id
		JOIN movies m ON m.id = d.movie_id AND m.user_id = ?
		WHERE sc.user_id = ? AND sc.unit = 'cue' AND sc.start_at != ''
		ORDER BY m.title COLLATE NOCASE, d.season, d.episode, sc.start_at`, uid, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []locatorProposal{}
	for rows.Next() {
		p := locatorProposal{Kind: kindDialogue}
		if err := rows.Scan(&p.ID, &p.Quote, &p.Current, &p.CurrentEnd, &p.Season, &p.Episode,
			&p.WorkID, &p.WorkTitle, &p.Proposed, &p.ProposedEnd, &p.Distance, &p.Evidence); err != nil {
			return nil, err
		}
		if only != nil && !only[locKey{kindDialogue, p.ID}] {
			continue
		}
		// A proposal that changes nothing is not one, and neither is one already refused.
		if sameTime(p.Current, p.Proposed) && sameTime(p.CurrentEnd, p.ProposedEnd) {
			continue
		}
		if ignored[ignoreKey(kindDialogue, p.ID, locatorHash(p))] {
			continue
		}
		p.Bucket = bucketReview
		if p.Distance == 0 {
			p.Bucket = bucketExact
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	places, err := s.loadPlaceProposals(uid, only, ignored)
	if err != nil {
		return nil, err
	}
	return append(out, places...), nil
}

// loadPlaceProposals reads the book half: a highlight's stored position, set against
// what the highlight carries now.
func (s *Server) loadPlaceProposals(uid int64, only map[locKey]bool, ignored map[string]bool) ([]locatorProposal, error) {
	rows, err := s.Store.DB.Query(`
		SELECT a.id, COALESCE(a.quote, ''), COALESCE(a.location, ''), COALESCE(a.chapter, ''),
		       b.id, b.title, sc.loc_pct, sc.chapter_title, sc.match_dist, sc.body
		FROM source_context sc
		JOIN annotations a ON sc.subject = 'annotation' AND a.id = sc.item_id
		JOIN books b ON b.id = a.book_id AND b.user_id = ?
		WHERE sc.user_id = ? AND sc.loc_pct >= 0
		ORDER BY b.title COLLATE NOCASE, sc.loc_pct, a.id`, uid, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []locatorProposal{}
	for rows.Next() {
		p := locatorProposal{Kind: kindAnnotation}
		var pct int
		var chapter string
		if err := rows.Scan(&p.ID, &p.Quote, &p.Current, &p.CurrentChapter, &p.WorkID, &p.WorkTitle,
			&pct, &chapter, &p.Distance, &p.Evidence); err != nil {
			return nil, err
		}
		if only != nil && !only[locKey{kindAnnotation, p.ID}] {
			continue
		}
		p.Proposed = strconv.Itoa(pct) + "%"
		// The reader's own chapter is theirs: the file names one only where there is none.
		p.ProposedChapter = p.CurrentChapter
		if p.CurrentChapter == "" {
			p.ProposedChapter = chapter
		}
		if strings.TrimSpace(p.Current) == p.Proposed && p.ProposedChapter == p.CurrentChapter {
			continue // already says what the file says
		}
		if ignored[ignoreKey(kindAnnotation, p.ID, locatorHash(p))] {
			continue
		}
		p.Replaces = strings.TrimSpace(p.Current) != "" && strings.TrimSpace(p.Current) != p.Proposed
		p.Bucket = bucketReview
		if p.Distance == 0 && !p.Replaces {
			p.Bucket = bucketExact
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// handleLocatorProposals: GET /locators/proposals.
func (s *Server) handleLocatorProposals(w http.ResponseWriter, r *http.Request) {
	ps, err := s.loadLocatorProposals(userID(r), nil)
	if err != nil {
		internalError(w, r, "locator proposals", err)
		return
	}
	exact := 0
	for _, p := range ps {
		if p.Bucket == bucketExact {
			exact++
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"proposals": ps,
		"counts":    map[string]int{"exact": exact, "review": len(ps) - exact},
	})
}

// locatorItem is one row of an accept or ignore press: what the reader SAW, so the
// server can tell whether it is still true.
type locatorItem struct {
	// Kind is dialogue (the default, so a press that never said is a film line's) or
	// annotation; the two have separate id sequences.
	Kind            string `json:"kind,omitempty"`
	CurrentChapter  string `json:"current_chapter,omitempty"`
	ProposedChapter string `json:"proposed_chapter,omitempty"`
	ID              int64  `json:"id"`
	Proposed        string `json:"proposed"`
	ProposedEnd     string `json:"proposed_end"`
	Current         string `json:"current"`
	CurrentEnd      string `json:"current_end"`
}

// handleLocatorAccept: POST /locators/accept {bucket, items}. It applies ONLY what the
// server itself proposes: a value in the request that is not the current proposal is
// stale, never written, so a client cannot use this to set arbitrary times. A line
// whose time changed since the reader looked is stale too, and is not overwritten.
func (s *Server) handleLocatorAccept(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Bucket string        `json:"bucket"`
		Items  []locatorItem `json:"items"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Bucket != bucketExact && req.Bucket != bucketReview {
		writeErr(w, http.StatusBadRequest, "bucket must be exact or review")
		return
	}
	if len(req.Items) == 0 || len(req.Items) > 5000 {
		writeErr(w, http.StatusBadRequest, "send between 1 and 5000 items")
		return
	}
	uid := userID(r)
	want := map[locKey]bool{}
	for _, it := range req.Items {
		want[locKey{kindOr(it.Kind), it.ID}] = true
	}
	ps, err := s.loadLocatorProposals(uid, want)
	if err != nil {
		internalError(w, r, "locator accept", err)
		return
	}
	byID := map[locKey]locatorProposal{}
	for _, p := range ps {
		byID[locKey{p.Kind, p.ID}] = p
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "locator accept: begin", err)
		return
	}
	defer tx.Rollback()
	applied, stale, skipped := 0, 0, 0
	for _, it := range req.Items {
		p, ok := byID[locKey{kindOr(it.Kind), it.ID}]
		switch {
		case !ok:
			// No proposal any more (refused, applied, or the context changed): stale.
			stale++
			continue
		case p.Bucket != req.Bucket:
			// Bulk acts within one bucket and never across: an exact press cannot
			// carry a fuzzy row along with it.
			skipped++
			continue
		case it.Proposed != p.Proposed || it.ProposedEnd != p.ProposedEnd ||
			it.Current != p.Current || it.CurrentEnd != p.CurrentEnd ||
			it.ProposedChapter != p.ProposedChapter || it.CurrentChapter != p.CurrentChapter:
			stale++
			continue
		}
		var res sql.Result
		var err error
		if p.Kind == kindAnnotation {
			// The place a highlight sits: its location, and its chapter where it had none.
			res, err = tx.Exec(
				`UPDATE annotations SET location = ?, chapter = ?, updated_at = datetime('now')
				 WHERE id = ? AND COALESCE(location, '') = ? AND COALESCE(chapter, '') = ?
				   AND book_id IN (SELECT id FROM books WHERE user_id = ?)`,
				nullable(p.Proposed), nullable(p.ProposedChapter), p.ID, p.Current, p.CurrentChapter, uid)
		} else {
			res, err = tx.Exec(
				`UPDATE dialogues SET timestamp = ?, timestamp_end = ?, updated_at = datetime('now')
				 WHERE id = ? AND COALESCE(timestamp, '') = ? AND timestamp_end = ?
				   AND movie_id IN (SELECT id FROM movies WHERE user_id = ?)`,
				nullable(p.Proposed), p.ProposedEnd, p.ID, p.Current, p.CurrentEnd, uid)
		}
		if err != nil {
			internalError(w, r, "locator accept: write", err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			stale++ // moved between the check and the write
			continue
		}
		applied++
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "locator accept: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"applied": applied, "stale": stale, "skipped": skipped})
}

// handleLocatorIgnore: POST /locators/ignore {items}. A refusal is as durable as
// Cleanup's: keyed on the proposed value, so it holds across rescans and a different
// proposal for the same line is a new one.
func (s *Server) handleLocatorIgnore(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []locatorItem `json:"items"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Items) == 0 || len(req.Items) > 5000 {
		writeErr(w, http.StatusBadRequest, "send between 1 and 5000 items")
		return
	}
	uid := userID(r)
	want := map[locKey]bool{}
	for _, it := range req.Items {
		want[locKey{kindOr(it.Kind), it.ID}] = true
	}
	ps, err := s.loadLocatorProposals(uid, want)
	if err != nil {
		internalError(w, r, "locator ignore", err)
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "locator ignore: begin", err)
		return
	}
	defer tx.Rollback()
	ignored := 0
	for _, p := range ps {
		var res sql.Result
		kind, field, rule := locatorIgnoreKind, locatorIgnoreField, locatorIgnoreRule
		if p.Kind == kindAnnotation {
			kind, field, rule = placeIgnoreKind, placeIgnoreField, placeIgnoreRule
		}
		res, err = tx.Exec(
			`INSERT INTO cleanup_ignores (user_id, kind, item_id, field, rule, match_hash)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (user_id, kind, item_id, field, rule, match_hash) DO NOTHING`,
			uid, kind, p.ID, field, rule, locatorHash(p))
		if err != nil {
			internalError(w, r, "locator ignore: write", err)
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			ignored++
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "locator ignore: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"ignored": ignored})
}
