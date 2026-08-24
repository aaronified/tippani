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
}

func (s *Server) handleCleanup(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[cleanup] handleCleanup uid=%d", uid)

	out := cleanupResp{Rules: make([]string, 0, len(cleanupRules)), Items: []cleanupItem{}}
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
			query: `SELECT a.id, a.book_id, COALESCE(b.title, ''), a.quote, COALESCE(a.note, ''), ''
			        FROM annotations a JOIN books b ON b.id = a.book_id
			        WHERE b.user_id = ? ORDER BY a.id`,
			fields: []string{"quote", "note", "translation"},
		},
		{
			kind: "screen",
			query: `SELECT d.id, d.movie_id, COALESCE(m.title, ''), d.quote, COALESCE(d.note, ''), ''
			        FROM dialogues d JOIN movies m ON m.id = d.movie_id
			        WHERE m.user_id = ? ORDER BY d.id`,
			fields: []string{"quote", "note", "translation"},
		},
		{
			// A standalone quote has no parent work, and its translation is the one
			// field the other two kinds do not have.
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

		var found []cleanupFinding
		for i, field := range fields {
			found = append(found, scanCleanup(field, texts[i])...)
		}
		if len(found) == 0 {
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
