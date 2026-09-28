package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"tippani/internal/jobs"
	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// Fill in the gaps, and touch nothing else.
//
// POST /metadata/fill {book_ids?, movie_ids?} → per-item results.
//
// This is the unattended half of re-verify, and the difference between them is
// the whole point. Re-verify asks "what has changed?", shows every difference and
// waits for a human to tick the ones they believe — which is right, because a
// provider disagreeing with your library is not automatically the provider being
// correct. It is also completely unusable over forty books: nobody is going to
// adjudicate two hundred field diffs to get a missing publication year.
//
// So this endpoint applies exactly the diffs where THERE IS NOTHING TO OVERWRITE.
// A blank description becomes the fetched description; a description you have
// already written, or corrected, is never touched — and neither is a title, which
// is NOT NULL and therefore never missing. That makes the operation safe to run
// over a selection without previewing it, which is what lets it be one item in a
// selection bar rather than a console with a diff table in it.
//
// EVERYTHING ELSE IS REUSED, deliberately: the same reverifyBook / reverifyMovie
// fetch (so it targets the pinned identity rather than re-guessing by name), and
// the same applyReverifyBook / applyReverifyMovie writer (so the field whitelist,
// the validators and the image-after-text ordering are the ones already tested).
// The only new code here is the filter, which is the only new idea.
//
// requireAuth rather than admin, and the same 15-item cap, for the same reasons
// re-verify has them: own rows only, and the cap bounds provider load while an
// API caller chunks a large selection into sequential batches. The app's Fill
// gaps does not call this route since 3.1.0: it starts a fill job (runFill),
// which walks the same fillOne a work at a time.

// fillResult is one work's outcome. `Filled` names the fields written, so the
// client can say "3 books · 7 fields" rather than a bare success — and so a run
// that found nothing missing is legible as such rather than as a failure.
type fillResult struct {
	Type   string   `json:"type"`
	ID     int64    `json:"id"`
	Title  string   `json:"title,omitempty"`
	Status string   `json:"status"` // ok | unpinned | fetch_failed | not_found | write_failed
	Source string   `json:"source,omitempty"`
	Filled []string `json:"filled"`
	Note   string   `json:"note,omitempty"`
	Error  string   `json:"error,omitempty"`
	// stopped is a work a Stop reached before its write: nothing of it was
	// written (errStoppedItem).
	stopped bool
}

// missingStored reports whether a diff's STORED side is empty — which is the
// entire decision this endpoint makes.
//
// The types are whatever reverify put in the diff: a string for the text fields, an
// int for a year, a float for a series index, a []string for genres. Handled by
// type rather than by field name on purpose — a field added to reverify tomorrow
// gets the right treatment here without anybody remembering this file exists, and
// an UNRECOGNISED type answers "not missing", so the failure direction is
// "declined to fill" rather than "overwrote something".
func missingStored(v any) bool {
	switch x := v.(type) {
	case nil:
		return true
	case string:
		return strings.TrimSpace(x) == ""
	case int:
		return x == 0
	case int64:
		return x == 0
	case float64:
		return x == 0
	case []string:
		return len(x) == 0
	case []metadata.CastMember:
		// A CAST IS A GAP LIKE ANY OTHER, and until 0048 it silently was not: this
		// type fell through to `default: return false`, so the one endpoint whose
		// entire job is filling in what is missing would never seed a cast, not even
		// onto a title that had none at all. Nothing covered it, because nothing had
		// a reason to look.
		//
		// "Missing" is now read off the MAPPING rather than off the blob (see
		// reverifyMovie), which tightens it in the right direction: a title where
		// somebody has already typed one credit by hand is no longer empty, and an
		// unattended fill must not start merging a provider list into a list a
		// person has begun curating.
		//
		// AN EMPTY LIST IS STILL NOT PROOF THAT NOBODY HAS CURATED IT, and no value
		// handed to this function ever could be: a reader who DELETES every credit
		// leaves tombstones, which every read outside the merge filters out by
		// design. fillOne asks castCurated the question this switch cannot.
		return len(x) == 0
	default:
		return false
	}
}

func (s *Server) handleMetadataFill(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BookIDs  []int64 `json:"book_ids"`
		MovieIDs []int64 `json:"movie_ids"`
		// A bulk fill through this route is chunked by its caller
		// (maxReverifyItems per call), so no single request knows the run is
		// over. The LAST chunk says so: RunTotal
		// is how many works the whole run covered and RunFields how many fields
		// the earlier chunks filled. Only a notification reads either.
		RunTotal  int `json:"run_total"`
		RunFields int `json:"run_fields"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	total := len(req.BookIDs) + len(req.MovieIDs)
	if total == 0 {
		writeErr(w, http.StatusBadRequest, "nothing to fill — pass book_ids or movie_ids")
		return
	}
	if total > maxReverifyItems {
		writeErr(w, http.StatusBadRequest, "too many items per call (max 15) — send smaller batches")
		return
	}
	uid := userID(r)
	olog.Tracef("[meta] handleMetadataFill uid=%d books=%d movies=%d", uid, len(req.BookIDs), len(req.MovieIDs))

	keys, _ := s.providerKeys() // a failed read is logged there, and the fill goes on with what was read

	ctx := r.Context()
	results := []fillResult{}
	filled, failed := 0, 0
	for _, id := range req.BookIDs {
		res := s.fillOne(ctx, uid, s.reverifyBook(ctx, uid, id, keys.googleBooks, keys.amazonCookie, keys.amazonDomain, false))
		results = append(results, res)
		countFill(&filled, &failed, res)
	}
	for _, id := range req.MovieIDs {
		res := s.fillOne(ctx, uid, s.reverifyMovie(ctx, uid, id, keys.tmdb, keys.tvdb, false))
		results = append(results, res)
		countFill(&filled, &failed, res)
	}
	fields := 0
	for _, res := range results {
		fields += len(res.Filled)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"results": results, "checked": len(results), "filled": filled, "fields": fields, "failed": failed,
	})
	if req.RunTotal >= notifyFetchMin {
		s.notifyAfter(w, r, uid, "fetch", fillDoneTitle, fillDoneMessage(req.RunFields+fields, req.RunTotal))
	}
}

// What a fill over at least notifyFetchMin works says when it ends, whether the
// screens' chunked run or the fill job made it.
const fillDoneTitle = "Metadata fill finished"

func fillDoneMessage(fields, works int) string {
	return countOf(fields, "field", "fields") + " filled across " + countOf(works, "work", "works") + "."
}

// runFill is the fill job: the fill above, one work at a time, over as many works
// as one job holds (jobs_kinds.go), with a line in the job's log for each.
//
// ITS COUNTS SPLIT WHAT THE ROUTE LUMPS TOGETHER. The route's failed is every work
// that is not ok, an unpinned one included, because its screen said "none
// fetched" either way. The job's are the wire contract's three: fields filled,
// works that failed (not found, the lookup or the write failed), and works that
// are not pinned to a supplier, which have nothing wrong with them and need a
// Look up rather than a retry, so Past jobs names them apart.
//
// IT TELLS THE PHONE WHEN A LONG ONE REACHES ITS END, as the chunked run's last
// chunk did, and not when it is stopped: a run that did not finish did not
// finish, and the chunked run's last chunk was never sent when it was cut short.
//
// A STOP LEAVES THE WORK IN HAND UNTOUCHED (job_stop.go). Its lookup is cut off
// on the wire, and a lookup that ends with the job's context ended is not used
// even if one supplier had answered: part of an answer is not what is missing. A
// Stop landing after the lookup is caught by the writer's own check, before its
// transaction (applyReverifyBook, applyReverifyMovie).
func runFill(s *Server, ctx context.Context, j *jobs.Job) error {
	var p struct {
		BookIDs  []int64 `json:"book_ids"`
		MovieIDs []int64 `json:"movie_ids"`
	}
	if err := j.Params(&p); err != nil {
		return err
	}
	uid := j.Owner().UserID
	keys, err := s.providerKeys()
	if err != nil {
		j.Log(jobs.LevelWarn, "a saved supplier key could not be read, so the lookups ask without it: %v", err)
	}
	works := queuedWorks(p.BookIDs, p.MovieIDs)
	n := len(works)
	fields, failed, unpinned, walked := 0, 0, 0, 0
	for i, w := range works {
		if !s.goOn(j, i) {
			break
		}
		var it reverifyItem
		if w.kind == "book" {
			it = s.reverifyBook(ctx, uid, w.id, keys.googleBooks, keys.amazonCookie, keys.amazonDomain, false)
		} else {
			it = s.reverifyMovie(ctx, uid, w.id, keys.tmdb, keys.tvdb, false)
		}
		if ctx.Err() != nil {
			abandoned(j, itemName(w.kind, w.id, it.Title))
			break
		}
		res := s.fillOne(ctx, uid, it)
		if res.stopped {
			abandoned(j, itemName(res.Type, res.ID, res.Title))
			break
		}
		level, line := fillLine(res)
		j.Log(level, "%s", line)
		switch res.Status {
		case "ok":
			fields += len(res.Filled)
		case "unpinned":
			unpinned++
		default:
			failed++
		}
		walked++
		j.Progress(i+1, n)
	}
	if err := j.SetResult(map[string]any{"fields": fields, "failed": failed, "unpinned": unpinned}); err != nil {
		return err
	}
	if walked == n && n >= notifyFetchMin {
		s.notify(ctx, uid, "fetch", fillDoneTitle, fillDoneMessage(fields, n))
	}
	return nil
}

// fillLine is a fill's line for one work: what it filled, or why it filled
// nothing.
func fillLine(res fillResult) (level, line string) {
	name := itemName(res.Type, res.ID, res.Title)
	switch {
	case res.Status == "unpinned":
		return jobs.LevelInfo, name + " — unpinned, so there is nothing to ask: " + res.Error
	case res.Status == "not_found":
		return jobs.LevelWarn, name + " — not found"
	case res.Status != "ok":
		return jobs.LevelWarn, name + " — failed: " + res.Error
	case len(res.Filled) == 0:
		return jobs.LevelInfo, name + " — nothing missing"
	}
	line = name + " — filled " + fieldWords(res.Filled)
	if res.Note != "" {
		line += "; " + res.Note
	}
	return jobs.LevelInfo, line
}

// countFill tallies one result. "Filled nothing" is not a failure — a library
// whose metadata is already complete is the good case, and reporting it as a
// failure would teach people to distrust the button.
func countFill(filled, failed *int, res fillResult) {
	switch {
	case res.Status != "ok":
		*failed++
	case len(res.Filled) > 0:
		*filled++
	}
}

// fillOne turns one preview into a write of only its empty-stored fields.
func (s *Server) fillOne(ctx context.Context, uid int64, it reverifyItem) fillResult {
	res := fillResult{Type: it.Type, ID: it.ID, Title: it.Title, Status: it.Status, Source: it.Source,
		Filled: []string{}, Error: it.Error}
	if it.Status != "ok" {
		return res
	}
	set := map[string]json.RawMessage{}
	for _, d := range it.Diffs {
		if !missingStored(d.Stored) {
			continue
		}
		// THE ONE FIELD WHOSE EMPTINESS IS NOT IN ITS VALUE, and the only reason
		// this loop knows a field name at all.
		//
		// A reader who deletes every credit a provider seeded leaves an empty list
		// and a tombstone per row (0048), and a tombstone is filtered out of every
		// read but the merge's — deliberately, because it is not part of the cast any
		// more. So the diff's stored side is honestly empty, missingStored honestly
		// says "missing", and an unattended fill would then hand back the very list
		// somebody had just finished deleting. It would also report `filled:
		// ["cast"]` while the merge correctly refused every row, which is the worse
		// half: a bulk button that says it wrote something it did not.
		//
		// It cannot live in missingStored, which is dispatched on TYPE so that a
		// field added to reverify tomorrow needs no edit here. The tombstone is not
		// in the type, or in the value, or anywhere else this loop can see it — it is
		// in the table. So it is asked for by name, once, with the reason written
		// down.
		if d.Field == "cast" && it.Type == "movie" && castCurated(s.Store.DB, "movie", it.ID) {
			continue
		}
		raw, err := json.Marshal(d.Fresh)
		if err != nil {
			// A value that will not marshal cannot be sent to the writer, and the
			// writer is the only thing that knows how to validate it. Skipped, not
			// fatal: the other four fields on this book are still worth having.
			olog.Warnf(olog.CodeMetaFillField, "[meta] fill %s %d: field %s will not marshal: %v",
				it.Type, it.ID, d.Field, err)
			continue
		}
		set[d.Field] = raw
		res.Filled = append(res.Filled, d.Field)
	}
	if len(set) == 0 {
		return res // nothing was missing; nothing written
	}
	var note string
	var err error
	if it.Type == "book" {
		note, err = s.applyReverifyBook(ctx, uid, it.ID, set, it.Source, nil)
	} else {
		note, err = s.applyReverifyMovie(ctx, uid, it.ID, set, nil)
	}
	res.Note = note
	if err != nil {
		res.Status, res.Error = "write_failed", err.Error()
		res.Filled = []string{} // it did not land, so it must not be counted
		if errors.Is(err, errStoppedItem) {
			res.Status, res.stopped = "stopped", true
		}
	}
	return res
}
