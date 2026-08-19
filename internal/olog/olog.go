// Package olog writes operational log lines, splitting them the way a Unix
// program is expected to: EVERYTHING GOES TO STDOUT EXCEPT ERRORS, WHICH GO TO
// STDERR. Use it for significant events — startup, integrity checks, index
// repair, database reset, and any handled error.
//
// IT USED TO WRITE EVERY LINE TO BOTH STREAMS. The intent was that a deployment
// capturing only one of them still saw everything, and the effect in a container
// was that every line appeared twice: `docker logs` merges the two streams, so a
// NAS paid double the log volume and read a doubled log for a redundancy that
// helped nobody who was actually looking at it. Nor could it be detected and
// disabled — Docker hands the process two genuinely separate pipes and merges
// them downstream, so from in here they look like different destinations.
//
// The split costs one thing, stated plainly: a deployment that captures ONLY
// stdout no longer sees errors. That is the conventional bargain every other
// program on the box already makes, and it buys `2>/dev/null` for a clean
// operational log and `1>/dev/null` for nothing but failures.
//
// It carries a small level system (ROADMAP §12): error/warn/info always emit;
// trace is gated behind TIPPANI_LOG_LEVEL=debug so deep per-operation tracing is
// opt-in and never spams a normal deployment. Errors carry a stable Code
// (TIP-<SUBSYS>-<NNN>, see codes.go) so any failure in `docker logs` is greppable
// and looked up in docs/troubleshoot.md.
//
// Both streams carry the standard "2006/01/02 15:04:05" timestamp prefix, so a
// reader merging them back (which is what `docker logs` does) gets one ordered
// sequence; Docker/compose adds its own outer timestamp on top.
package olog

import (
	"log"
	"os"
	"strings"
	"sync/atomic"
)

var (
	out = log.New(os.Stdout, "", log.LstdFlags)
	err = log.New(os.Stderr, "", log.LstdFlags)
	// debugEnabled gates Tracef. Set once at startup via SetLevel; atomic so a
	// concurrent request logging a trace can't race the startup write.
	debugEnabled atomic.Bool
)

// SetLevel configures the log level from a string (typically TIPPANI_LOG_LEVEL).
// "debug" (or "trace") enables Tracef output; anything else — including "", the
// default — leaves it off. Call once at startup. Safe to call from tests.
func SetLevel(s string) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug", "trace":
		debugEnabled.Store(true)
	default:
		debugEnabled.Store(false)
	}
}

// DebugEnabled reports whether trace-level logging is on. Handy to guard the
// construction of an expensive trace argument before calling Tracef.
func DebugEnabled() bool { return debugEnabled.Load() }

// Printf logs an operational line to stdout. This is the ordinary path: startup,
// progress, integrity results — the things that are true rather than wrong.
func Printf(format string, args ...any) {
	out.Printf(format, args...)
}

// errPrintf logs to stderr. Private, and there is exactly one caller (Errorf),
// because "which stream" is a decision this package makes once rather than a
// choice offered at every call site.
func errPrintf(format string, args ...any) {
	err.Printf(format, args...)
}

// Alertf is Printf for problems — same dual-stream delivery, but prefixed so a
// corruption/repair alert stands out in a wall of logs. Prefer Errorf/Warnf for
// new code so the line carries a lookup Code; Alertf remains for un-coded
// operational notices (e.g. "FACTORY RESET requested").
func Alertf(format string, args ...any) {
	Printf("!! "+format, args...)
}

// Errorf logs a handled error with its lookup Code: `[error] TIP-XXX-NNN msg`.
// Always emits (errors are never gated). Use at the point an error is handled
// (not merely wrapped-and-returned); the code sends a reader to docs/troubleshoot.md.
func Errorf(code Code, format string, args ...any) {
	errPrintf("[error] "+string(code)+" "+format, args...)
}

// Warnf logs a recoverable/degraded condition with its Code: `[warn] TIP-XXX-NNN
// msg`. Always emits. Use for "we carried on, but you should know" situations —
// a best-effort step that failed, or N rows skipped during an import.
//
// ON STDOUT, NOT STDERR, which is the owner's call and a defensible one: a warning
// is something that HAPPENED, not something that failed, and putting it on stderr
// makes `1>/dev/null` — "show me only what went wrong" — noisy with things that
// did not. Only Errorf crosses to stderr.
func Warnf(code Code, format string, args ...any) {
	Printf("[warn] "+string(code)+" "+format, args...)
}

// Tracef logs a per-operation trace line: `[trace] msg`. A NO-OP unless
// TIPPANI_LOG_LEVEL=debug, so it is safe to sprinkle across request/operation
// steps without spamming a normal deployment.
func Tracef(format string, args ...any) {
	if !debugEnabled.Load() {
		return
	}
	Printf("[trace] "+format, args...)
}
