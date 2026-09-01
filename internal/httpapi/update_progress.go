package httpapi

// WHAT THE UPDATE DID, recorded as it does it.
//
// THE FAILURE THIS EXISTS FOR is a screen that cannot see the work it started.
// The apply pulls two images and creates a container before it writes a byte,
// and the server's WriteTimeout is 60 seconds — so on any real connection the
// answer never arrives, the browser's fetch resolves to "no status at all", and
// the page has to GUESS. It guessed "probably running", which is right often
// enough to be dangerous: when the pull 404s, when the container cannot be
// identified, when the recreater starts and dies, the page waits for a version
// that is never going to change and says nothing at all about why.
//
// The owner's report is exactly that shape — "the page gets stuck on this
// message, and the app is not even posting any update command on the docker
// shell" — and nothing in the app could tell them which of the four steps it
// stopped at, because the only record was a log line on a box they would have to
// go and read.
//
// SO THE HANDLER WRITES DOWN WHERE IT IS, before each step and after the last
// one, and the page reads that instead of guessing. Every phase below is a point
// the apply can die at, and each one names the next thing it is about to try, so
// a record that stops at "pulling" means the pull is what did not come back.
//
// NO GOROUTINE, WHICH IS THE CONSTRAINT. Nothing here runs outside the request:
// the handler is doing the work anyway and simply says so as it goes. The record
// is a settings row rather than a table because it is ONE row that is always
// overwritten — the last attempt, not a history — and a table for a single row
// is a migration for nothing.

import (
	"encoding/json"
	"time"

	"tippani/internal/buildinfo"
)

// settingUpdateProgress holds the JSON below. Overwritten every attempt.
const settingUpdateProgress = "update_progress"

// The phases, in the order the apply passes through them. The name is what the
// handler is ABOUT TO DO, so the last one written is the step that did not
// finish — which is the only reading that makes a stalled record useful.
const (
	updatePhaseRequested   = "requested"   // confirmed, lock taken, nothing tried yet
	updatePhaseEngine      = "engine"      // asking whether the Docker Engine API answers
	updatePhaseIdentify    = "identify"    // asking the Engine which container we are
	updatePhasePulling     = "pulling"     // pulling the app image
	updatePhaseRecreate    = "recreating"  // pulling the recreater and starting it
	updatePhaseLaunched    = "launched"    // the recreater is running; the restart is its job now
	updatePhaseFailed      = "failed"      // stopped, with a reason
	updatePhaseUnsupported = "unsupported" // no Engine API here; nothing was attempted
)

// updateProgress is the whole record. Small on purpose: a reader needs to know
// what step, how long ago, on what, and — if it stopped — why.
type updateProgress struct {
	Phase string `json:"phase"`
	// StartedAt is the attempt's own start, not this phase's, so a page that
	// joins late can say "this has been going for four minutes" rather than
	// "this step started a moment ago".
	StartedAt int64  `json:"started_at"`
	At        int64  `json:"at"`
	From      string `json:"from"`            // the version that pressed the button
	Image     string `json:"image,omitempty"` // what is being pulled
	Container string `json:"container,omitempty"`
	Error     string `json:"error,omitempty"`
	// User is who pressed it — an instance can have several admins, and "an
	// update is already running" is a much better sentence with a name in it.
	User string `json:"user,omitempty"`
}

// updateProgressWriter records one attempt. It carries the attempt's fixed
// fields so each step is one call with one argument that varies.
//
// EVERY WRITE IS BEST-EFFORT. A settings row that will not save must never stop
// an update the operator asked for: the record exists to explain the work, not
// to gate it. A failed write costs the page its explanation and nothing else.
type updateProgressWriter struct {
	s   *Server
	rec updateProgress
}

func (s *Server) newUpdateProgress(user string) *updateProgressWriter {
	now := time.Now().Unix()
	return &updateProgressWriter{
		s: s,
		rec: updateProgress{
			StartedAt: now,
			At:        now,
			From:      buildinfo.Version,
			User:      user,
		},
	}
}

// step records that the apply is about to attempt `phase`.
func (w *updateProgressWriter) step(phase string) {
	w.rec.Phase = phase
	w.rec.At = time.Now().Unix()
	w.rec.Error = ""
	w.save()
}

// fail records that it stopped, and why. The reason is the Engine's own words
// where there are any — the same rule Probe follows, and for the same reason:
// "a Docker call failed" tells an operator nothing they can act on.
func (w *updateProgressWriter) fail(reason string) {
	w.rec.Phase = updatePhaseFailed
	w.rec.At = time.Now().Unix()
	w.rec.Error = reason
	w.save()
}

// on names what is being worked on, so a stalled record says which image.
func (w *updateProgressWriter) on(image, container string) {
	w.rec.Image = image
	w.rec.Container = container
}

func (w *updateProgressWriter) save() {
	b, err := json.Marshal(w.rec)
	if err != nil {
		return
	}
	_ = w.s.Store.SetSetting(settingUpdateProgress, string(b))
}

// readUpdateProgress returns the last recorded attempt, or false when there has
// never been one. A malformed row reads as absent rather than as an error: it is
// a report about a report, and the page it feeds has a version string of its own
// to fall back on.
func (s *Server) readUpdateProgress() (updateProgress, bool) {
	raw, err := s.Store.GetSetting(settingUpdateProgress)
	if err != nil || raw == "" {
		return updateProgress{}, false
	}
	var rec updateProgress
	if json.Unmarshal([]byte(raw), &rec) != nil || rec.Phase == "" {
		return updateProgress{}, false
	}
	return rec, true
}
