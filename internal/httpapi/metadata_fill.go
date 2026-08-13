package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

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
// re-verify has them: own rows only, and the cap bounds provider load while the
// client chunks a large selection into sequential batches.

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
	default:
		return false
	}
}

func (s *Server) handleMetadataFill(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BookIDs  []int64 `json:"book_ids"`
		MovieIDs []int64 `json:"movie_ids"`
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

	gkey, gErr := s.Store.GetSetting(settingGoogleBooksKey)
	cookie, cErr := s.Store.GetSetting(settingAmazonCookie)
	domain, dErr := s.Store.GetSetting(settingAmazonDomain)
	for _, err := range []error{gErr, cErr, dErr} {
		if err != nil {
			olog.Warnf(olog.CodeMetaKeyRead, "[meta] provider key read failed: %v", err)
		}
	}
	tmdb, _ := s.resolveTMDB()
	tvdb, _ := s.resolveTVDB()

	ctx := r.Context()
	results := []fillResult{}
	filled, failed := 0, 0
	for _, id := range req.BookIDs {
		res := s.fillOne(ctx, uid, s.reverifyBook(ctx, uid, id, gkey, cookie, domain))
		results = append(results, res)
		countFill(&filled, &failed, res)
	}
	for _, id := range req.MovieIDs {
		res := s.fillOne(ctx, uid, s.reverifyMovie(ctx, uid, id, tmdb, tvdb))
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
		note, err = s.applyReverifyBook(ctx, uid, it.ID, set)
	} else {
		note, err = s.applyReverifyMovie(ctx, uid, it.ID, set)
	}
	res.Note = note
	if err != nil {
		res.Status, res.Error = "write_failed", err.Error()
		res.Filled = []string{} // it did not land, so it must not be counted
	}
	return res
}
