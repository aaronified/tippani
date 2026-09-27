package httpapi

import (
	"errors"
	"net/http"

	"tippani/internal/jobs"
)

// WHAT MUST NOT RUN UNDER A JOB, AND WHAT NO JOB MAY START UNDER. A restore and a
// factory reset swap the database files; a search rebuild may escalate to a
// whole-file recovery, which is a swap too; an update replaces the server. Each
// would pull the ground out from under a job in the middle of an item — its rows
// in a file that has just been moved aside, or its process about to be
// recreated — so each runs with the queue held (jobs.Runner.Exclusive): refused
// while a job runs, and while it runs no job starts and none can be queued. A job
// that is only waiting does not refuse it: a restore interrupts the waiting jobs
// as it carries the history over, and a reset empties the table, and either way
// the job is kept, with its log, to run again.
//
// The first-run restore needs no hold: it runs only while there are no accounts,
// so there can be no jobs.

// jobRunningMessage is what the refused press is told, and the restore and reset
// prompts say the same before their first step (they read /jobs/summary).
const jobRunningMessage = "A job is running. Stop it in Settings › Jobs, or wait for it to finish."

// withQueueHeld runs fn with the queue held, or answers 409 {error, busy: true}
// while a job runs (503 while the server shuts down, or once a launched update
// has retired the queue for the container's replacement). On a server with no
// queue fn simply runs.
func (s *Server) withQueueHeld(w http.ResponseWriter, fn func()) {
	if s.Jobs == nil {
		fn()
		return
	}
	switch err := s.Jobs.Exclusive(func() error { fn(); return nil }); {
	case err == nil:
	case errors.Is(err, jobs.ErrBusy):
		writeErrDetail(w, http.StatusConflict, jobRunningMessage, map[string]any{"busy": true})
	case errors.Is(err, jobs.ErrClosed):
		writeErr(w, http.StatusServiceUnavailable, "the server is shutting down")
	default:
		writeErr(w, http.StatusInternalServerError, "internal error")
	}
}
