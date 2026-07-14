// Package olog writes operational log lines to BOTH stdout and stderr, so a
// deployment that captures only one stream still sees them (owner request: keep
// detailed logs on stdout and stderr). Use it for significant events — startup,
// integrity checks, index repair, database reset, and any handled error.
//
// It carries a small level system (ROADMAP §12): error/warn/info always emit;
// trace is gated behind TIPPANI_LOG_LEVEL=debug so deep per-operation tracing is
// opt-in and never spams a normal deployment. Errors carry a stable Code
// (TIP-<SUBSYS>-<NNN>, see codes.go) so any failure in `docker logs` is greppable
// and looked up in docs/troubleshoot.md.
//
// Both streams get the standard "2006/01/02 15:04:05" timestamp prefix so the two
// copies line up; Docker/compose adds its own outer timestamp on top.
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

// Printf logs an operational line to stdout and stderr.
func Printf(format string, args ...any) {
	out.Printf(format, args...)
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
	Printf("[error] "+string(code)+" "+format, args...)
}

// Warnf logs a recoverable/degraded condition with its Code: `[warn] TIP-XXX-NNN
// msg`. Always emits. Use for "we carried on, but you should know" situations —
// a best-effort step that failed, or N rows skipped during an import.
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
