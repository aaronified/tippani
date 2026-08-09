package httpapi

import (
	"database/sql"
	"errors"
	"net/http"

	"tippani/internal/olog"
)

// Editing the read log directly.
//
// Until now work_reads could only be written as a SIDE EFFECT of a status
// change: start a book and a row opens, finish it and the row closes. That is
// the right way to record what is happening now, and a hopeless way to record
// what happened before. A book read three times over fifteen years had one row
// at best, and there was no way at all to say "I finished this in 2019" about
// something already on the shelf — the log could only ever be as old as the
// account.
//
// 1.7.2 then made that log sortable ("Last read"), which turned a mostly-empty
// table into something the shelf order depends on. A sort you cannot correct is
// worse than no sort.
//
// THE OPEN READ STAYS OUT OF REACH, and this is the whole design. shelf.go's
// comment is explicit that status and the read log are kept consistent by one
// path — "a full-state PUT that carried them would let an ordinary Edit-form
// save silently rewrite reading history" — and the open row IS that consistency:
// it exists exactly while the work is in progress. So these endpoints edit
// history and refuse the present. Deleting the open row would leave a book
// reading with nothing being read; closing it by hand would leave it finished
// and still on the in-progress shelf. Both are reachable already, through the
// status control, which is where they belong.

// readEdit is the body for creating or editing one past read.
type readEdit struct {
	StartedAt  string `json:"started_at"`
	FinishedAt string `json:"finished_at"`
	Outcome    string `json:"outcome"`
}

func (e *readEdit) validate() string {
	if msg := normalizePartialDate("started_at", &e.StartedAt); msg != "" {
		return msg
	}
	if msg := normalizePartialDate("finished_at", &e.FinishedAt); msg != "" {
		return msg
	}
	switch e.Outcome {
	case ReadFinished, ReadAbandoned:
	case ReadOpen, "":
		// An open read is the status control's to create and to close. Naming
		// the reason beats a bare 400: the operation the caller wants exists,
		// it is just somewhere else.
		return "an in-progress read is set by the shelf status, not by editing history"
	default:
		return "outcome must be 'finished' or 'abandoned'"
	}
	// Partial dates compare lexically, which is what makes this test valid
	// across the three shapes: "2019" < "2019-05" < "2020". A read that ended
	// before it began is a typo worth catching at the door, since nothing
	// downstream would ever complain — it would just sort oddly forever.
	if e.StartedAt != "" && e.FinishedAt != "" && e.FinishedAt < e.StartedAt {
		return "finished_at is before started_at"
	}
	return ""
}

// readOwner reports the kind and work a read belongs to, scoped to the caller.
// A read that is not theirs is not found — 404, never 403, per the house rule
// that one account cannot learn another's row ids exist.
func (s *Server) readOwner(uid, readID int64) (kind string, workID int64, outcome string, err error) {
	err = s.Store.DB.QueryRow(
		`SELECT kind, work_id, outcome FROM work_reads WHERE id = ? AND user_id = ?`,
		readID, uid).Scan(&kind, &workID, &outcome)
	return
}

// handleAddRead: POST /books|movies/{id}/reads — record a read that already
// happened.
func (s *Server) handleAddRead(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		workID, ok := pathID(r)
		if !ok {
			writeErr(w, http.StatusBadRequest, "invalid id")
			return
		}
		var req readEdit
		if !decodeBody(w, r, &req) {
			return
		}
		if msg := req.validate(); msg != "" {
			writeErr(w, http.StatusBadRequest, msg)
			return
		}
		uid := userID(r)
		olog.Tracef("[shelf] handleAddRead uid=%v kind=%s work=%v", uid, kind, workID)
		// The work has to be the caller's, and the ownership check is the same
		// statement that would fail anyway — work_reads has no FK to books or
		// movies (0024 says so: SQLite could not express it across the two), so
		// nothing else would stop a read being attached to somebody else's shelf.
		if !s.ownsWork(uid, kind, workID) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		res, err := s.Store.DB.Exec(
			`INSERT INTO work_reads (user_id, kind, work_id, started_at, finished_at, outcome)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			uid, kind, workID, req.StartedAt, req.FinishedAt, req.Outcome)
		if err != nil {
			internalError(w, r, "add read", err)
			return
		}
		id, _ := res.LastInsertId()
		writeJSON(w, http.StatusCreated, readRow{
			ID: id, StartedAt: req.StartedAt, FinishedAt: req.FinishedAt, Outcome: req.Outcome,
		})
	}
}

// handleUpdateRead: PUT /reads/{id}.
func (s *Server) handleUpdateRead(w http.ResponseWriter, r *http.Request) {
	readID, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req readEdit
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	_, _, outcome, err := s.readOwner(uid, readID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "read not found")
		return
	case err != nil:
		internalError(w, r, "load read", err)
		return
	case outcome == ReadOpen:
		writeErr(w, http.StatusConflict, "finish or abandon this read from the shelf first")
		return
	}
	if _, err := s.Store.DB.Exec(
		`UPDATE work_reads SET started_at = ?, finished_at = ?, outcome = ?
		 WHERE id = ? AND user_id = ?`,
		req.StartedAt, req.FinishedAt, req.Outcome, readID, uid); err != nil {
		internalError(w, r, "update read", err)
		return
	}
	writeJSON(w, http.StatusOK, readRow{
		ID: readID, StartedAt: req.StartedAt, FinishedAt: req.FinishedAt, Outcome: req.Outcome,
	})
}

// handleDeleteRead: DELETE /reads/{id}.
func (s *Server) handleDeleteRead(w http.ResponseWriter, r *http.Request) {
	readID, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	uid := userID(r)
	_, _, outcome, err := s.readOwner(uid, readID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "read not found")
		return
	case err != nil:
		internalError(w, r, "load read", err)
		return
	case outcome == ReadOpen:
		writeErr(w, http.StatusConflict, "finish or abandon this read from the shelf first")
		return
	}
	if _, err := s.Store.DB.Exec(
		`DELETE FROM work_reads WHERE id = ? AND user_id = ?`, readID, uid); err != nil {
		internalError(w, r, "delete read", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ownsWork reports whether a book or movie id belongs to this account.
func (s *Server) ownsWork(uid int64, kind string, workID int64) bool {
	table := "books"
	if kind == "movie" {
		table = "movies"
	}
	var one int
	err := s.Store.DB.QueryRow(
		`SELECT 1 FROM `+table+` WHERE id = ? AND user_id = ?`, workID, uid).Scan(&one)
	return err == nil
}
