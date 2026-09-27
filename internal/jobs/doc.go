// Package jobs runs the routines a reader starts on the server rather than in
// their tab, and keeps the logs: every job's own lines and the app's system log,
// in the database, for thirty days.
//
// THE OWNER'S ASK: "Run every routine a reader starts on the server, so it
// survives leaving the screen or closing the tab", with one job at a time across
// the server, the rest queued in the order started, and a Stop that stops after
// the item in hand. And the invariant this package is the reason for rewording,
// verbatim: "nothing runs unless a person or the app's own lookup started it, and
// nothing wakes on a timer."
//
// So there are goroutines here, and exactly two kinds, and neither is a pool, a
// ticker or a scheduler:
//
//   - the Logbook's drainer, which exists while there are lines to write and
//     exits when there are none;
//   - the Runner's worker, which exists while there are jobs to run and exits
//     when there are none.
//
// Each is started by the call that gives it work, and each guards the moment it
// decides to exit against work arriving in that same moment (the lost wakeup:
// a worker that looks, finds nothing, and exits just after somebody queued
// something and saw it still alive, leaves that job waiting for the next
// person's press). Neither sleeps, except to back off while SQLite's write lock
// is held by somebody else (busyRetry): the drainer between attempts at a batch,
// the worker between attempts at claiming a job or recording its end.
//
// Three pieces:
//
//   - Logbook (logbook.go): the asynchronous, batched writer onto the store's
//     log connection. Every line passes one door, clean, before it is kept.
//   - Runner (runner.go): the queue. The routines a person starts that walk many
//     items (fill, covers, people, re-verify) and the backup are rows with a
//     state, run one at a time by the worker.
//   - Recorders (recorder.go): how a line finds its job. A queued job is a
//     *Job; everything else a request does that looks outward is a *Lazy, which
//     becomes an in-request job only if something is logged into it.
package jobs
