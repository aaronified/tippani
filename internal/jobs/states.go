package jobs

import "regexp"

// A job's states (0079 leaves them to Go). queued and running are the only ones
// a job leaves; the other four are where it ends.
const (
	StateQueued      = "queued"
	StateRunning     = "running"
	StateSucceeded   = "succeeded"
	StateFailed      = "failed"
	StateStopped     = "stopped"     // a person pressed Stop
	StateInterrupted = "interrupted" // the server stopped under it: a restart, a shutdown, a restore
)

// kindShape is what a job kind may look like: lower case, digits, dots and
// hyphens ("fill", "lookup.book", "reverify-apply"). Kinds are data the screens
// look up locale strings by, so they are held to a shape a key can carry.
var kindShape = regexp.MustCompile(`^[a-z0-9][a-z0-9.-]{0,63}$`)

// kindOrRequest is k when it has a kind's shape, else "request": an in-request
// job whose route no table names is still kept, as what it was.
func kindOrRequest(k string) string {
	if kindShape.MatchString(k) {
		return k
	}
	return "request"
}
