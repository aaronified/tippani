package httpapi

import (
	"database/sql"
	"net/http"

	"tippani/internal/olog"
)

// GET /cleanup — every quote in the library, read once, and what the rules found.
//
// IT LISTS AND NEVER TOUCHES ANYTHING. There is no companion POST, deliberately:
// each rule has a false positive that is somebody's real writing (cleanup.go
// argues this at length), so the reader decides case by case and the app's job
// ends at showing them where to look. A "fix all" button would edit their own
// words on the strength of a guess.
//
// ONE PASS OVER THE WHOLE LIBRARY, THREE QUERIES. Not paged: the answer is a
// worklist somebody works through, and a paged worklist that reshuffles as they
// edit is worse than a long one. The findings are capped instead — see
// maxCleanupFindings — and the reply says plainly when it stopped early, because
// a silently truncated list is indistinguishable from a clean library.
//
// WHICH TEXT IS SCANNED: the quote, the note, and a standalone quote's
// translation. The prose, in other words. Names — a character, an actor, a
// speaker — are deliberately left out: they are short, they are picked from
// autofill far more often than typed, and a rule like reference-mark fires on a
// perfectly ordinary "Henry V".
const maxCleanupFindings = 500

// cleanupItem is one quote with something worth looking at, in the shape the
// client needs to link to it.
type cleanupItem struct {
	// Kind is the client's own vocabulary for the three quote kinds — the same
	// words the review loop and the trash use, so a row can be opened with the
	// navigation that already exists.
	Kind      string           `json:"kind"` // book | screen | quote
	ID        int64            `json:"id"`
	WorkID    int64            `json:"work_id,omitempty"` // 0 for a standalone quote
	WorkTitle string           `json:"work_title,omitempty"`
	Findings  []cleanupFinding `json:"findings"`
}

// cleanupBucket is which half of the list to answer with: what is left, or what has
// been refused. ONE SCAN SERVES BOTH — the bucket partitions one walk rather than
// running a second query — so the two counts on the page cannot disagree with each
// other, which is the bug a second code path would eventually produce.
//
// It also means the ignored bucket lists only ignores that still MATCH something: an
// ignore whose text the reader later changed by hand is a row about nothing, and
// offering to restore it would restore nothing.
type cleanupResp struct {
	// Rules is every rule the scan CAN report, whether or not it fired, so the
	// client can name them all and show a zero rather than omitting the row. A
	// rule that vanishes when it finds nothing reads as a rule that is missing.
	Rules []string      `json:"rules"`
	Items []cleanupItem `json:"items"`
	// Scanned is how many quotes were read, so "nothing found" is distinguishable
	// from "nothing looked at".
	Scanned int `json:"scanned"`
	// Truncated says the cap was reached and the list is partial.
	Truncated bool `json:"truncated"`
	// Counts is how many findings are in each bucket, over the WHOLE scan rather
	// than the returned page: the page needs to say "3 ignored" on a chip while
	// showing the other bucket.
	Counts map[string]int `json:"counts"`

	// ---- not serialised: the walk's own working state ------------------------
	bucket  string
	ignored map[cleanupTarget]bool
	// countsOnly drops the item list and, with it, the cap — see the note on
	// handleCleanup's ?counts=1.
	countsOnly bool
}

// countsOnly answers ?counts=1 — the shape /import/staged already uses for the
// same reason, and the reason is a badge.
//
// THE RAIL NAMES CHECKS WITH TWO NUMBERS, imports waiting and marks still open,
// and the second of those is this scan. The shell used to refuse to ask for it:
// building five hundred findings and their work titles on every page load, to
// print one number, is the standing cost this app turns down. Dropping the list
// leaves the part that is actually cheap — three indexed reads and a regex pass
// over text the reader has already stored — and none of the allocation.
//
// AND IT IS MORE ACCURATE THAN THE LIST IT OMITS. maxCleanupFindings stops the
// walk early, which stops the COUNTING early with it, so a library past the cap
// reports a truncated total to the page that asked for items. With no items
// there is nothing to cap, so this arm reads every quote and the number it
// returns is the whole library's.
func cleanupCountsOnly(r *http.Request) bool { return r.URL.Query().Get("counts") == "1" }

func (s *Server) handleCleanup(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	bucket := r.URL.Query().Get("bucket")
	if bucket == "" {
		bucket = "open"
	}
	if bucket != "open" && bucket != "ignored" {
		writeErr(w, http.StatusBadRequest, "bucket must be open or ignored")
		return
	}
	olog.Tracef("[cleanup] handleCleanup uid=%d bucket=%s", uid, bucket)

	// THE IGNORE SET IS READ FIRST AND A FAILURE IS FATAL TO THE REQUEST, rather
	// than falling back to an unfiltered scan. Showing the list without it would
	// re-offer every finding the reader has already dismissed, which is worse than
	// showing nothing: the page's whole usefulness is that it does not do that.
	ignored, err := s.cleanupIgnores(uid)
	if err != nil {
		codedError(w, r, olog.CodeCleanupIgnore, "cleanup: read ignores", err)
		return
	}

	out := cleanupResp{
		Rules:      make([]string, 0, len(cleanupRules)),
		Items:      []cleanupItem{},
		Counts:     map[string]int{"open": 0, "ignored": 0},
		bucket:     bucket,
		ignored:    ignored,
		countsOnly: cleanupCountsOnly(r),
	}
	for _, rule := range cleanupRules {
		out.Rules = append(out.Rules, rule.ID)
	}

	// Three queries, one per kind, each scoped through the parent that carries the
	// user — annotations and dialogues have no user_id of their own, which is the
	// arrangement every read in this package follows.
	type source struct {
		kind  string
		query string
		// fields names the columns after the fixed three (id, work id, work title),
		// in the order they are selected, so one loop serves all three kinds.
		fields []string
	}
	sources := []source{
		{
			kind: "book",
			query: `SELECT a.id, a.book_id, COALESCE(b.title, ''), a.quote, COALESCE(a.note, ''), a.translation
			        FROM annotations a JOIN books b ON b.id = a.book_id
			        WHERE b.user_id = ? ORDER BY a.id`,
			fields: []string{"quote", "note", "translation"},
		},
		{
			kind: "screen",
			query: `SELECT d.id, d.movie_id, COALESCE(m.title, ''), d.quote, COALESCE(d.note, ''), d.translation
			        FROM dialogues d JOIN movies m ON m.id = d.movie_id
			        WHERE m.user_id = ? ORDER BY d.id`,
			fields: []string{"quote", "note", "translation"},
		},
		{
			// A standalone quote has no parent work. Its translation was for one
			// release the only field the other two kinds lacked; 0051 gave it to them,
			// and the literal '' this slot used to hold on those two queries became
			// the real column with no other change here — which is the whole reason
			// the slot was named and scanned from the start.
			kind: "quote",
			query: `SELECT u.id, 0, '', u.quote, COALESCE(u.note, ''), COALESCE(u.translation, '')
			        FROM utterances u WHERE u.user_id = ? ORDER BY u.id`,
			fields: []string{"quote", "note", "translation"},
		},
	}

	for _, src := range sources {
		rows, err := s.Store.DB.Query(src.query, uid)
		if err != nil {
			internalError(w, r, "scan "+src.kind+" quotes", err)
			return
		}
		stop := s.scanCleanupRows(rows, src.kind, src.fields, &out)
		rows.Close()
		if stop {
			break
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// scanCleanupRows drains one kind's rows into the response. Returns true when the
// cap was reached, so the caller stops rather than reading two more tables it will
// not report.
func (s *Server) scanCleanupRows(rows *sql.Rows, kind string, fields []string, out *cleanupResp) bool {
	for rows.Next() {
		var id, workID int64
		var title string
		texts := make([]string, len(fields))
		dest := []any{&id, &workID, &title}
		for i := range texts {
			dest = append(dest, &texts[i])
		}
		if err := rows.Scan(dest...); err != nil {
			// One unreadable row must not cost the reader the rest of the scan — the
			// same rule every list in this package follows.
			olog.Warnf(olog.CodeCleanupRowScan, "[cleanup] %s row scan failed: %v", kind, err)
			continue
		}
		out.Scanned++

		// found is still collected under countsOnly and then dropped. The loop is
		// what computes the counts, so it has to run either way, and it allocates
		// only for a row that has a finding at all — the minority. A branch here
		// to save that would be a second place the bucket rule is written, which
		// is a worse trade than the slice.
		var found []cleanupFinding
		for i, field := range fields {
			for _, f := range scanCleanup(field, texts[i]) {
				// Counted in the bucket it belongs to, always, and returned only in the
				// bucket that was asked for. The counts are therefore over the whole
				// library even when the list is capped or filtered.
				f.Ignored = out.ignored[cleanupTarget{Kind: kind, ID: id, Field: f.Field, Rule: f.Rule, Hash: f.Hash}]
				if f.Ignored {
					out.Counts["ignored"]++
				} else {
					out.Counts["open"]++
				}
				if f.Ignored == (out.bucket == "ignored") {
					found = append(found, f)
				}
			}
		}
		if out.countsOnly || len(found) == 0 {
			continue
		}
		out.Items = append(out.Items, cleanupItem{
			Kind: kind, ID: id, WorkID: workID, WorkTitle: title, Findings: found,
		})
		if len(out.Items) >= maxCleanupFindings {
			out.Truncated = true
			return true
		}
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeCleanupRowScan, "[cleanup] %s row iteration failed: %v", kind, err)
	}
	return false
}
