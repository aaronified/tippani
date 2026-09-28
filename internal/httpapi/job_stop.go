package httpapi

import (
	"context"
	"fmt"

	"tippani/internal/jobs"
)

// A STOP IS INSTANT AND IT BREAKS NOTHING. The owner's two rulings, one after
// the other: "the job cancel button must also be the most responsive kill switch.
// No dillydallying after it has been pressed", then "Stop cancels instantly: but
// it still shall not break anything. That's important."
//
// The first is the runner's: Stop cancels the job's context the moment it is
// pressed, so a lookup on the wire aborts there and then (jobs.Kind). The second
// is every kind's, and it is kept the same way in each of them:
//
//   - A cancellation lands only on OUTWARD I/O — a supplier's answer, a picture
//     on its way — and at the kind's own checks. Database calls carry no context
//     (health.go says why), so a write that has begun finishes or rolls back
//     whole; a Stop never lands inside one.
//   - An item's outward steps all come first, and its writes after the last of
//     them, in one transaction, begun only once ctx.Err() has been asked and
//     answered nil. An item a Stop reached before that is ABANDONED WHOLE: no
//     field from the one supplier that answered before the cancel, no cover row
//     without its file, no person half-updated. A file it downloaded is removed.
//   - The kind then asks j.Stopping(), which tells the runner it stopped short,
//     and ends; what it had finished before the Stop stays finished and counted,
//     and the item it abandoned is neither counted nor in its result.
//
// errStoppedItem is how the writers say the item was abandoned. It wraps
// context.Canceled, so a kind that hands it back as its own error still ends
// stopped rather than failed.
var errStoppedItem = fmt.Errorf("stopped before anything of it was written: %w", context.Canceled)

// stoppedLine is the log line for the item a Stop abandoned.
func stoppedLine(name string) string {
	return name + " — left untouched: stopped before anything of it was written"
}

// goOn is a kind's check at the top of its loop: whether item next may begin.
// itemSeam runs first, when a test has set it.
func (s *Server) goOn(j *jobs.Job, next int) bool {
	if s.itemSeam != nil {
		s.itemSeam(j, next)
	}
	return !j.Stopping()
}

// abandoned tells the job a Stop cut its item short — Stopping, which is what
// makes it read stopped rather than finished — and logs which item that was.
func abandoned(j *jobs.Job, name string) {
	j.Stopping()
	j.Log(jobs.LevelInfo, "%s", stoppedLine(name))
}
