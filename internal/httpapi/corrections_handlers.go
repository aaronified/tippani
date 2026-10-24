package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strconv"

	"tippani/internal/olog"
)

// The three routes behind the correction family:
//
//	GET  /corrections          buckets with counts, and the proposals (?bucket= narrows them)
//	POST /corrections/accept   {bucket, bulk, items} the file's words replace the quote
//	POST /corrections/ignore   {items} a durable "keep mine"
//
// Everything is proposed from source_context rows, so no route opens a file. An accept
// applies ONLY what the server itself proposes now: a request carrying a different
// quote or a different proposal is stale and writes nothing, and a client cannot use
// this to set arbitrary text. Bulk acts within one bucket, and a bulk press skips the
// quotes the reader edited since they arrived (updated_at past created_at): those are
// deliberate wordings, the likeliest false positive in the family, and are one press
// each.

// wrongFileMin is how many quotes of one work must have context before "the file is
// the wrong one" is a claim worth making; below it a few differing quotes are just
// differing quotes.
const wrongFileMin = 4

type corrProposal struct {
	Kind      string `json:"kind"` // book | screen | quote, cleanup's vocabulary
	ID        int64  `json:"id"`
	WorkID    int64  `json:"work_id,omitempty"`
	WorkTitle string `json:"work_title,omitempty"`
	Quote     string `json:"quote"`
	Proposed  string `json:"proposed"`
	// From and To are the differing stretch on each side, for marking.
	From     string `json:"from"`
	To       string `json:"to"`
	Bucket   string `json:"bucket"`
	Edited   bool   `json:"edited,omitempty"`
	Distance int    `json:"distance"`
}

// corrWrongFile is the one work-level row that replaces a wall of per-quote ones.
type corrWrongFile struct {
	Kind      string `json:"kind"`
	WorkID    int64  `json:"work_id"`
	WorkTitle string `json:"work_title"`
	Differing int    `json:"differing"`
	Total     int    `json:"total"`
}

func corrHash(proposed string) string {
	h := sha256.Sum256([]byte(corrIgnoreRule + "\x1f" + proposed))
	return hex.EncodeToString(h[:])[:32]
}

func corrKey(kind string, id int64) string { return kind + ":" + strconv.FormatInt(id, 10) }

// loadCorrections reads, classifies and filters. `only` narrows to some quotes.
func (s *Server) loadCorrections(uid int64, only map[string]bool) ([]corrProposal, []corrWrongFile, error) {
	ignored := map[string]bool{}
	irows, err := s.Store.DB.Query(
		`SELECT kind, item_id, match_hash FROM cleanup_ignores WHERE user_id = ? AND field = 'quote' AND rule = ?`,
		uid, corrIgnoreRule)
	if err != nil {
		return nil, nil, err
	}
	for irows.Next() {
		var k, h string
		var id int64
		if irows.Scan(&k, &id, &h) == nil {
			ignored[corrKey(k, id)+"\x00"+h] = true
		}
	}
	irows.Close()

	type src struct{ kind, query string }
	srcs := []src{
		{"book", `SELECT a.id, a.quote, a.updated_at > a.created_at, b.id, COALESCE(b.title, ''), sc.match_dist, sc.body
			FROM source_context sc JOIN annotations a ON sc.subject = 'annotation' AND a.id = sc.item_id
			JOIN books b ON b.id = a.book_id AND b.user_id = ?
			WHERE sc.user_id = ? ORDER BY b.title COLLATE NOCASE, a.id`},
		{"screen", `SELECT d.id, d.quote, d.updated_at > d.created_at, m.id, COALESCE(m.title, ''), sc.match_dist, sc.body
			FROM source_context sc JOIN dialogues d ON sc.subject = 'dialogue' AND d.id = sc.item_id
			JOIN movies m ON m.id = d.movie_id AND m.user_id = ?
			WHERE sc.user_id = ? ORDER BY m.title COLLATE NOCASE, d.id`},
		{"quote", `SELECT u.id, u.quote, u.updated_at > u.created_at, 0, '', sc.match_dist, sc.body
			FROM source_context sc JOIN utterances u ON sc.subject = 'utterance' AND u.id = sc.item_id
			WHERE u.user_id = ? AND sc.user_id = ? ORDER BY u.id`},
	}
	type workKey struct {
		kind string
		id   int64
	}
	total := map[workKey]int{}
	wording := map[workKey]int{}
	titles := map[workKey]string{}
	var all []corrProposal
	for _, sr := range srcs {
		rows, err := s.Store.DB.Query(sr.query, uid, uid)
		if err != nil {
			return nil, nil, err
		}
		for rows.Next() {
			p := corrProposal{Kind: sr.kind}
			var body string
			if err := rows.Scan(&p.ID, &p.Quote, &p.Edited, &p.WorkID, &p.WorkTitle, &p.Distance, &body); err != nil {
				rows.Close()
				return nil, nil, err
			}
			wk := workKey{sr.kind, p.WorkID}
			if p.WorkID != 0 {
				total[wk]++
				titles[wk] = p.WorkTitle
			}
			c, ok := classifyCorrection(p.Quote, body)
			if !ok {
				continue
			}
			p.Bucket, p.Proposed, p.From, p.To = c.Bucket, c.Proposed, c.From, c.To
			if p.WorkID != 0 && p.Bucket == corrWording {
				wording[wk]++
			}
			all = append(all, p)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, nil, err
		}
	}

	// A work most of whose quotes differ wholesale has the wrong file attached: one row
	// says so and its wholesale rows are not listed forty times over.
	var wrong []corrWrongFile
	off := map[workKey]bool{}
	for wk, n := range wording {
		if total[wk] >= wrongFileMin && n*2 >= total[wk] {
			off[wk] = true
			wrong = append(wrong, corrWrongFile{Kind: wk.kind, WorkID: wk.id, WorkTitle: titles[wk], Differing: n, Total: total[wk]})
		}
	}
	out := []corrProposal{}
	for _, p := range all {
		if only != nil && !only[corrKey(p.Kind, p.ID)] {
			continue
		}
		if p.Bucket == corrWording && off[workKey{p.Kind, p.WorkID}] {
			continue
		}
		if ignored[corrKey(p.Kind, p.ID)+"\x00"+corrHash(p.Proposed)] {
			continue
		}
		out = append(out, p)
	}
	return out, wrong, nil
}

// handleCorrections: GET /corrections.
func (s *Server) handleCorrections(w http.ResponseWriter, r *http.Request) {
	only := r.URL.Query().Get("bucket")
	if only != "" && !corrBucketKnown(only) {
		writeErr(w, http.StatusBadRequest, "unknown bucket")
		return
	}
	ps, wrong, err := s.loadCorrections(userID(r), nil)
	if err != nil {
		internalError(w, r, "corrections", err)
		return
	}
	counts := map[string]int{}
	edited := map[string]int{}
	list := []corrProposal{}
	for _, p := range ps {
		counts[p.Bucket]++
		if p.Edited {
			edited[p.Bucket]++
		}
		if only == "" || only == p.Bucket {
			list = append(list, p)
		}
	}
	type bucketRow struct {
		ID     string `json:"id"`
		Count  int    `json:"count"`
		Edited int    `json:"edited"`
	}
	buckets := []bucketRow{}
	for _, b := range corrBuckets {
		buckets = append(buckets, bucketRow{b, counts[b], edited[b]})
	}
	if wrong == nil {
		wrong = []corrWrongFile{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"buckets": buckets, "proposals": list, "wrong_file": wrong})
}

// corrItem is what the reader SAW, so the server can tell whether it is still true.
type corrItem struct {
	Kind     string `json:"kind"`
	ID       int64  `json:"id"`
	Quote    string `json:"quote"`
	Proposed string `json:"proposed"`
}

func corrItemsOK(w http.ResponseWriter, items []corrItem) (map[string]bool, bool) {
	if len(items) == 0 || len(items) > 5000 {
		writeErr(w, http.StatusBadRequest, "send between 1 and 5000 items")
		return nil, false
	}
	want := map[string]bool{}
	for _, it := range items {
		if cleanupTable(it.Kind) == "" || it.ID <= 0 {
			writeErr(w, http.StatusBadRequest, "invalid item")
			return nil, false
		}
		want[corrKey(it.Kind, it.ID)] = true
	}
	return want, true
}

// handleCorrectionAccept: POST /corrections/accept {bucket, bulk, items}.
func (s *Server) handleCorrectionAccept(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Bucket string     `json:"bucket"`
		Bulk   bool       `json:"bulk"`
		Items  []corrItem `json:"items"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if !corrBucketKnown(req.Bucket) {
		writeErr(w, http.StatusBadRequest, "unknown bucket")
		return
	}
	want, ok := corrItemsOK(w, req.Items)
	if !ok {
		return
	}
	uid := userID(r)
	ps, _, err := s.loadCorrections(uid, want)
	if err != nil {
		internalError(w, r, "corrections accept", err)
		return
	}
	byKey := map[string]corrProposal{}
	for _, p := range ps {
		byKey[corrKey(p.Kind, p.ID)] = p
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "corrections accept: begin", err)
		return
	}
	defer tx.Rollback()
	applied, stale, skipped, skippedEdited, duplicates := 0, 0, 0, 0, 0
	for _, it := range req.Items {
		p, found := byKey[corrKey(it.Kind, it.ID)]
		switch {
		case !found || it.Quote != p.Quote || it.Proposed != p.Proposed:
			// Refused, applied, edited or re-matched since the page was drawn.
			stale++
			continue
		case p.Bucket != req.Bucket:
			skipped++
			continue
		case req.Bulk && p.Edited:
			skippedEdited++
			continue
		}
		row, ok, err := s.cleanupRow(tx, uid, cleanupTarget{Kind: p.Kind, ID: p.ID})
		if err != nil {
			codedError(w, r, olog.CodeCleanupApply, "corrections: read row", err)
			return
		}
		if !ok || row.quote != p.Quote {
			stale++
			continue
		}
		q := `UPDATE OR IGNORE ` + cleanupTable(p.Kind) + ` SET quote = ?, updated_at = datetime('now')`
		args := []any{p.Proposed}
		// The dedupe hash follows the words, as cleanup's accept does, so a later import
		// of the corrected text is recognised as the duplicate it is.
		if hash := row.dedupeHash("quote", p.Proposed); hash != "" {
			q += `, dedupe_hash = ?`
			args = append(args, hash)
		}
		q += ` WHERE id = ? AND quote = ?`
		args = append(args, p.ID, p.Quote)
		res, err := tx.Exec(q, args...)
		if err != nil {
			codedError(w, r, olog.CodeCleanupApply, "corrections: rewrite", err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			duplicates++ // the corrected words already exist under another row
			continue
		}
		applied++
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "corrections accept: commit", err)
		return
	}
	olog.Printf("[corrections] user %d: %d applied, %d stale, %d edited skipped", uid, applied, stale, skippedEdited)
	writeJSON(w, http.StatusOK, map[string]int{
		"applied": applied, "stale": stale, "skipped": skipped,
		"skipped_edited": skippedEdited, "duplicates": duplicates,
	})
}

// handleCorrectionIgnore: POST /corrections/ignore {items}. Keyed on the proposed
// words, so it holds across rescans and a different proposal for the same quote is a
// new one. Ownership is the proposal load itself: it only ever returns this reader's.
func (s *Server) handleCorrectionIgnore(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []corrItem `json:"items"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	want, ok := corrItemsOK(w, req.Items)
	if !ok {
		return
	}
	uid := userID(r)
	ps, _, err := s.loadCorrections(uid, want)
	if err != nil {
		internalError(w, r, "corrections ignore", err)
		return
	}
	seen := map[string]bool{}
	for _, it := range req.Items {
		seen[corrKey(it.Kind, it.ID)+"\x00"+it.Proposed] = true
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "corrections ignore: begin", err)
		return
	}
	defer tx.Rollback()
	ignored := 0
	for _, p := range ps {
		// Only what the reader saw is refused: a proposal that moved is a new one.
		if !seen[corrKey(p.Kind, p.ID)+"\x00"+p.Proposed] {
			continue
		}
		res, err := tx.Exec(
			`INSERT INTO cleanup_ignores (user_id, kind, item_id, field, rule, match_hash)
			 VALUES (?, ?, ?, 'quote', ?, ?)
			 ON CONFLICT (user_id, kind, item_id, field, rule, match_hash) DO NOTHING`,
			uid, p.Kind, p.ID, corrIgnoreRule, corrHash(p.Proposed))
		if err != nil {
			internalError(w, r, "corrections ignore: write", err)
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			ignored++
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "corrections ignore: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"ignored": ignored})
}
