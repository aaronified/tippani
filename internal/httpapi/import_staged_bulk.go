package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/olog"
)

// Bulk edits over a staging selection (ROADMAP 1.2.0). This is the endpoint the
// queue's BulkBar drives, and it does two things POST /annotations/bulk cannot:
//
//   - Tags come off as well as on. The live endpoint can only union, because its
//     one additive helper is all it has and the full-state alternative would need
//     each row's current tag set. Staged tags are denormalized text on the row, so
//     a removal is a set operation on that string — no join rows, no vocabulary
//     entry created for a tag nobody approved.
//   - Retargeting, book and film interchangeable. A staged quote can move to
//     another work in the queue or onto a work already in the library, including
//     across kinds, because that is the repair for a misdetected file.
//
// Plus location formulae (locformula.go), which is the reason editing locations in
// bulk needs more than a text box.

// stagedRetarget names the destination of a move. Exactly one form is used:
// StagedWorkID moves into another group already in the queue; Kind+ID pins the
// group onto a row in the library.
type stagedRetarget struct {
	StagedWorkID int64  `json:"staged_work_id"`
	Kind         string `json:"kind"` // book | movie (a show is a movie row)
	ID           int64  `json:"id"`
}

// stagedBulkReq mirrors the house bulk convention: absent key = leave alone. A
// *string set to "" clears the field; the tag lists and the formula are their own
// shapes because they are set operations rather than assignments.
type stagedBulkReq struct {
	stagedSelector
	AddTags    []string `json:"add_tags"`
	RemoveTags []string `json:"remove_tags"`
	Color      *string  `json:"color"`
	Favorite   *bool    `json:"favorite"`
	Chapter    *string  `json:"chapter"`
	ChapterNo  *string  `json:"chapter_no"` // 0044, a decimal as text — see Season
	Location   *string  `json:"location"`
	Character  *string  `json:"character"`
	Actor      *string  `json:"actor"`
	Timestamp  *string  `json:"timestamp"`
	// Counts arrive as strings, not numbers, because three states have to be
	// distinguishable and a *int only carries two: absent (leave alone), "" (clear
	// it) and "0" (season 0, where a series keeps its specials).
	Season  *string `json:"season"`
	Episode *string `json:"episode"`

	Retarget *stagedRetarget `json:"retarget"`
	Formula  *locFormula     `json:"formula"`
}

// validate trims and caps the free-text fields and checks the colour, returning a
// client-facing message or "".
func (req *stagedBulkReq) validate() string {
	for _, f := range []struct {
		val  **string
		name string
	}{
		{&req.Chapter, "chapter"},
		{&req.Location, "location"},
		{&req.Character, "character"},
		{&req.Actor, "actor"},
		{&req.Timestamp, "timestamp"},
	} {
		if *f.val == nil {
			continue
		}
		trimmed, ok := trimCap(**f.val, 128)
		if !ok {
			return f.name + " too long (max 128 characters)"
		}
		*f.val = &trimmed
	}
	if req.Color != nil && !validColor(*req.Color) {
		return "color must be " + colorList()
	}
	if req.ChapterNo != nil {
		if msg := chapterNoProblem(*req.ChapterNo); msg != "" {
			return msg
		}
	}
	for _, f := range []struct {
		val  *string
		name string
		max  int
	}{
		{req.Season, "season", maxSeason},
		{req.Episode, "episode", maxEpisode},
	} {
		if f.val == nil || strings.TrimSpace(*f.val) == "" {
			continue // absent, or an explicit clear
		}
		n, err := strconv.Atoi(strings.TrimSpace(*f.val))
		if err != nil || n < 0 || n > f.max {
			return f.name + " must be a number between 0 and " + strconv.Itoa(f.max)
		}
	}
	if req.Retarget != nil {
		r := req.Retarget
		if r.StagedWorkID <= 0 && r.ID <= 0 {
			return "retarget needs a staged_work_id, or a kind and id"
		}
		if r.StagedWorkID <= 0 {
			switch r.Kind {
			case "book", "movie":
			default:
				return "retarget kind must be book or movie"
			}
		}
	}
	if req.Formula != nil {
		if msg := req.Formula.validate(); msg != "" {
			return msg
		}
	}
	return ""
}

// handleBulkStaged applies one edit to a selection of staged quotes in a single
// transaction. Answers {"updated": N} like the other bulk endpoints.
func (s *Server) handleBulkStaged(w http.ResponseWriter, r *http.Request) {
	var req stagedBulkReq
	if !decodeBody(w, r, &req) {
		return
	}
	olog.Tracef("[import] bulk staged user=%d %s", userID(r), req.describe())
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	picked, ok := s.resolveStagedSelection(w, r, uid, req.stagedSelector)
	if !ok {
		return
	}
	// A bulk edit acts on quotes. A selection that resolved to works only (a group
	// staged with nothing in it) has nothing to edit, and reads as absent.
	ids := picked.QuoteIDs
	if len(ids) == 0 {
		writeErr(w, http.StatusNotFound, "no matching staged quotes")
		return
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		codedError(w, r, olog.CodeImportStagedOp, "bulk staged: begin tx", err)
		return
	}
	defer tx.Rollback()

	// Order matters and is fixed: plain assignments, then tags, then the formula,
	// then the retarget. So a request carrying both `location` and a `formula`
	// re-bases the snapshot first and then shifts from the value just set — which
	// is the reading a user would predict from the form they filled in.
	//
	// Plain column assignments first — one UPDATE over the whole selection.
	sets, args := []string{}, []any{}
	set := func(col string, val any) {
		sets = append(sets, col+" = ?")
		args = append(args, val)
	}
	if req.Color != nil {
		set("color", *req.Color)
	}
	if req.Favorite != nil {
		set("favorite", boolToInt(*req.Favorite))
	}
	if req.Chapter != nil {
		set("chapter", nullable(*req.Chapter))
	}
	if req.ChapterNo != nil {
		set("chapter_no", nullableMeasure(*req.ChapterNo))
	}
	if req.Location != nil {
		// Assigning a location outright also re-bases its snapshot: the value the
		// user just typed is the one `reset` should come back to, not the one the
		// file happened to carry.
		set("location", nullable(*req.Location))
		set("location_orig", nullable(*req.Location))
	}
	if req.Character != nil {
		set("character", nullable(*req.Character))
	}
	if req.Actor != nil {
		set("actor", nullable(*req.Actor))
	}
	if req.Timestamp != nil {
		set("timestamp", nullable(*req.Timestamp))
		set("timestamp_orig", nullable(*req.Timestamp))
	}
	// No _orig pair for these: nothing rewrites an episode number, so there is
	// nothing to reset back to (see 0025).
	if req.Season != nil {
		set("season", nullableCount(*req.Season))
	}
	if req.Episode != nil {
		set("episode", nullableCount(*req.Episode))
	}
	if len(sets) > 0 {
		setSQL := `UPDATE staged_quotes SET ` + strings.Join(sets, ", ") + ` WHERE id IN (`
		err := chunkIDs(ids, func(batch []int64) error {
			_, err := tx.Exec(setSQL+inClause(len(batch))+`)`,
				append(append([]any{}, args...), int64sAsAny(batch)...)...)
			return err
		})
		if err != nil {
			codedError(w, r, olog.CodeImportStagedOp, "bulk staged: set fields", err)
			return
		}
	}

	if len(req.AddTags) > 0 || len(req.RemoveTags) > 0 {
		if err := retagStaged(tx, ids, req.AddTags, req.RemoveTags); err != nil {
			codedError(w, r, olog.CodeImportStagedOp, "bulk staged: tags", err)
			return
		}
	}
	if req.Formula != nil {
		if err := applyStagedFormula(tx, ids, req.Formula); err != nil {
			codedError(w, r, olog.CodeImportStagedOp, "bulk staged: formula", err)
			return
		}
	}
	if req.Retarget != nil {
		if err := retargetStaged(tx, uid, ids, req.Retarget); err != nil {
			var ce importClientError
			if errors.As(err, &ce) {
				writeErr(w, http.StatusBadRequest, ce.msg)
			} else {
				codedError(w, r, olog.CodeImportStagedOp, "bulk staged: retarget", err)
			}
			return
		}
		if err := gcStaging(tx, uid); err != nil { // a group the move emptied
			codedError(w, r, olog.CodeImportStagedOp, "bulk staged: gc", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		codedError(w, r, olog.CodeImportStagedOp, "bulk staged: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"updated": len(ids)})
}

// retagStaged rewrites each selected row's denormalized tag string: remove first,
// then add, so a request carrying the same name in both lists ends with it on
// (the same order POST /annotations/bulk would produce if it could remove).
// Matching is case-insensitive, because a stored "Epic" and a typed "epic" are one
// tag as far as the person editing is concerned.
func retagStaged(tx *sql.Tx, ids []int64, add, remove []string) error {
	addNames, removeNames := cleanNames(add), cleanNames(remove)
	drop := map[string]bool{}
	for _, n := range removeNames {
		drop[strings.ToLower(n)] = true
	}

	type update struct {
		id   int64
		tags string
	}
	var pending []update
	if err := chunkIDs(ids, func(batch []int64) error {
		rows, err := tx.Query(`SELECT id, COALESCE(tags, '') FROM staged_quotes WHERE id IN (`+
			inClause(len(batch))+`)`, int64sAsAny(batch)...)
		if err != nil {
			return err
		}
		defer rows.Close() // collect before writing: SQLite dislikes writes mid-cursor
		for rows.Next() {
			var id int64
			var stored string
			if err := rows.Scan(&id, &stored); err != nil {
				return err
			}
			kept := []string{}
			seen := map[string]bool{}
			for _, n := range splitStoredList(stored) {
				key := strings.ToLower(n)
				if drop[key] || seen[key] {
					continue
				}
				seen[key] = true
				kept = append(kept, n)
			}
			for _, n := range addNames {
				if key := strings.ToLower(n); !seen[key] {
					seen[key] = true
					kept = append(kept, n)
				}
			}
			next := strings.Join(kept, ", ")
			if next != stored {
				pending = append(pending, update{id, next})
			}
		}
		return rows.Err()
	}); err != nil {
		return err
	}

	for _, u := range pending {
		if _, err := tx.Exec(`UPDATE staged_quotes SET tags = ? WHERE id = ?`, u.tags, u.id); err != nil {
			return err
		}
	}
	return nil
}

// applyStagedFormula rewrites one locator column across the selection. Read the
// rows, transform in Go (the arithmetic is textual — see locformula.go), then
// write; SQL could not express "shift the numbers inside this string".
func applyStagedFormula(tx *sql.Tx, ids []int64, f *locFormula) error {
	col, origCol := "location", "location_orig"
	if f.Field == "timestamp" {
		col, origCol = "timestamp", "timestamp_orig"
	}
	type update struct {
		id  int64
		val string
	}
	var pending []update
	if err := chunkIDs(ids, func(batch []int64) error {
		rows, err := tx.Query(`SELECT id, COALESCE(`+col+`, ''), COALESCE(`+origCol+`, '')
		                         FROM staged_quotes WHERE id IN (`+inClause(len(batch))+`)`,
			int64sAsAny(batch)...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id int64
			var cur, orig string
			if err := rows.Scan(&id, &cur, &orig); err != nil {
				return err
			}
			next := applyLocFormula(f, cur, orig)
			// Re-cap the rendered result: the locator columns carry the same
			// 128-rune contract as every other free-text metadata field, and a
			// transform is an unvalidated way into them.
			if runes := []rune(next); len(runes) > 128 {
				next = string(runes[:128])
			}
			if next != cur {
				pending = append(pending, update{id, next})
			}
		}
		return rows.Err()
	}); err != nil {
		return err
	}

	for _, u := range pending {
		// Only the live column moves. The _orig snapshot is what `reset` restores,
		// so a formula must never touch it — that is the whole undo story.
		if _, err := tx.Exec(`UPDATE staged_quotes SET `+col+` = ? WHERE id = ?`, nullable(u.val), u.id); err != nil {
			return err
		}
	}
	return nil
}

// retargetStaged moves a selection onto a different work — the repair for a
// misdetected file, and the reason a staged row carries both locator sets.
//
// Moving onto a LIBRARY row is expressed as a staged work pinned to it, so
// approval has one code path (resolve target, write quotes) rather than two. The
// pinned group is created per batch, so a quote never silently changes which file
// it arrived from — the batch stays a usable grouping and filter.
func retargetStaged(tx *sql.Tx, uid int64, ids []int64, rt *stagedRetarget) error {
	if rt.StagedWorkID > 0 {
		// Moving into another group already in the queue: it must be the user's.
		var exists int
		err := tx.QueryRow(`
			SELECT 1 FROM staged_works w JOIN import_batches b ON b.id = w.batch_id
			 WHERE w.id = ? AND b.user_id = ?`, rt.StagedWorkID, uid).Scan(&exists)
		if errors.Is(err, sql.ErrNoRows) {
			return importClientError{"that staged work is not in your queue"}
		}
		if err != nil {
			return err
		}
		return moveStagedQuotes(tx, ids, rt.StagedWorkID)
	}

	// Pinning onto a library row: read its identity so the queue can show what the
	// group now points at, and so approval knows the destination kind.
	kind, title, year := rt.Kind, "", 0
	if kind == "book" {
		err := tx.QueryRow(`SELECT title, COALESCE(published_year, 0) FROM books WHERE id = ? AND user_id = ?`,
			rt.ID, uid).Scan(&title, &year)
		if errors.Is(err, sql.ErrNoRows) {
			return importClientError{"no such book"}
		}
		if err != nil {
			return err
		}
	} else {
		var mediaType string
		err := tx.QueryRow(`SELECT title, COALESCE(release_year, 0), media_type FROM movies WHERE id = ? AND user_id = ?`,
			rt.ID, uid).Scan(&title, &year, &mediaType)
		if errors.Is(err, sql.ErrNoRows) {
			return importClientError{"no such film or show"}
		}
		if err != nil {
			return err
		}
		kind = importMediaType(mediaType) // a show keeps being a show
	}

	// One pinned group per batch the selection spans.
	batches, err := batchesOfStaged(tx, ids)
	if err != nil {
		return err
	}
	for _, batchID := range batches {
		workID, err := pinnedStagedWork(tx, batchID, kind, rt.Kind, rt.ID, title, year)
		if err != nil {
			return err
		}
		if err := moveStagedQuotesInBatch(tx, ids, batchID, workID); err != nil {
			return err
		}
	}
	return nil
}

func batchesOfStaged(tx *sql.Tx, ids []int64) ([]int64, error) {
	var out []int64
	seen := map[int64]bool{}
	err := chunkIDs(ids, func(batch []int64) error {
		rows, err := tx.Query(`
			SELECT DISTINCT w.batch_id FROM staged_quotes q JOIN staged_works w ON w.id = q.staged_work_id
			 WHERE q.id IN (`+inClause(len(batch))+`) ORDER BY w.batch_id`, int64sAsAny(batch)...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				return err
			}
			if !seen[id] { // chunks can each report the same batch
				seen[id] = true
				out = append(out, id)
			}
		}
		return rows.Err()
	})
	return out, err
}

// pinnedStagedWork finds or creates the staged work in this batch that points at
// one library row, so repeated retargets to the same destination reuse one group.
// targetKind is the TABLE ("book" or "movie"); kind is the display kind, which for
// a series is "show".
func pinnedStagedWork(tx *sql.Tx, batchID int64, kind, targetKind string, targetID int64, title string, year int) (int64, error) {
	var id int64
	err := tx.QueryRow(
		`SELECT id FROM staged_works WHERE batch_id = ? AND target_kind = ? AND target_id = ? LIMIT 1`,
		batchID, targetKind, targetID).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, err
	}
	res, err := tx.Exec(
		`INSERT INTO staged_works (batch_id, kind, title, release_year, target_kind, target_id)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		batchID, kind, title, nullableInt(year), targetKind, targetID)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// moveStagedQuotes reassigns rows to a work. A move can collide with a quote
// already staged under the destination (same dedupe hash) — the UNIQUE constraint
// is per work — so the collision is resolved by dropping the duplicate, which is
// what merging two groups means.
func moveStagedQuotes(tx *sql.Tx, ids []int64, workID int64) error {
	if err := chunkIDs(ids, func(batch []int64) error {
		_, err := tx.Exec(`UPDATE OR IGNORE staged_quotes SET staged_work_id = ? WHERE id IN (`+
			inClause(len(batch))+`)`, append([]any{workID}, int64sAsAny(batch)...)...)
		return err
	}); err != nil {
		return err
	}
	// Anything OR IGNORE refused is a duplicate of a row already under the
	// destination; it has served its purpose and should not linger in its old group.
	return chunkIDs(ids, func(batch []int64) error {
		_, err := tx.Exec(`DELETE FROM staged_quotes WHERE id IN (`+inClause(len(batch))+`) AND staged_work_id <> ?`,
			append(int64sAsAny(batch), workID)...)
		return err
	})
}

// moveStagedQuotesInBatch is moveStagedQuotes restricted to one batch, so a
// selection spanning several files lands in that file's own pinned group.
func moveStagedQuotesInBatch(tx *sql.Tx, ids []int64, batchID, workID int64) error {
	scoped, err := stagedIDsInBatch(tx, ids, batchID)
	if err != nil || len(scoped) == 0 {
		return err
	}
	return moveStagedQuotes(tx, scoped, workID)
}

func stagedIDsInBatch(tx *sql.Tx, ids []int64, batchID int64) ([]int64, error) {
	var out []int64
	err := chunkIDs(ids, func(batch []int64) error {
		rows, err := tx.Query(`
			SELECT q.id FROM staged_quotes q JOIN staged_works w ON w.id = q.staged_work_id
			 WHERE w.batch_id = ? AND q.id IN (`+inClause(len(batch))+`)`,
			append([]any{batchID}, int64sAsAny(batch)...)...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				return err
			}
			out = append(out, id)
		}
		return rows.Err()
	})
	return out, err
}

func int64sAsAny(ids []int64) []any {
	out := make([]any, len(ids))
	for i, id := range ids {
		out[i] = id
	}
	return out
}
