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
// and looked up in docs/wiki/Troubleshooting.md.
//
// Both streams carry the standard "2006/01/02 15:04:05" timestamp prefix, so a
// reader merging them back (which is what `docker logs` does) gets one ordered
// sequence; Docker/compose adds its own outer timestamp on top.
package olog

import (
	"fmt"
	"io"
	"log"
	"os"
	"regexp"
	"strings"
	"sync/atomic"
	"time"
)

var (
	out = log.New(os.Stdout, "", log.LstdFlags)
	err = log.New(os.Stderr, "", log.LstdFlags)
	// access is the request logger's own line (Accessf), on stderr as it always
	// was, and on a logger of its own so the standard logger's tee (StdWriter)
	// does not keep it a second time: the request logger keeps its own,
	// structured line.
	access = log.New(os.Stderr, "", log.LstdFlags)
	// debugEnabled gates Tracef. Set once at startup via SetLevel; atomic so a
	// concurrent request logging a trace can't race the startup write.
	debugEnabled atomic.Bool
	// sink is where every line also goes to be kept (SetSink), or nil.
	sink atomic.Pointer[func(Entry)]
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
	put(out, "info", fmt.Sprintf(format, args...))
}

// put writes one line to its stream and hands it to the sink. Which stream is a
// decision this package makes once, per function, rather than a choice offered at
// every call site; so is which level the line is kept at.
func put(l *log.Logger, level, line string) {
	l.Print(line)
	if fn := sink.Load(); fn != nil {
		(*fn)(entryOf(level, line))
	}
}

// Alertf is Printf for problems — same dual-stream delivery, but prefixed so a
// corruption/repair alert stands out in a wall of logs. Prefer Errorf/Warnf for
// new code so the line carries a lookup Code; Alertf remains for un-coded
// operational notices (e.g. "FACTORY RESET requested").
func Alertf(format string, args ...any) {
	put(out, "info", fmt.Sprintf("!! "+format, args...))
}

// Errorf logs a handled error with its lookup Code: `[error] TIP-XXX-NNN msg`.
// Always emits (errors are never gated). Use at the point an error is handled
// (not merely wrapped-and-returned); the code sends a reader to docs/wiki/Troubleshooting.md.
func Errorf(code Code, format string, args ...any) {
	put(err, "error", fmt.Sprintf("[error] "+string(code)+" "+format, args...))
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
	put(out, "warn", fmt.Sprintf("[warn] "+string(code)+" "+format, args...))
}

// Tracef logs a per-operation trace line: `[trace] msg`. A NO-OP unless
// TIPPANI_LOG_LEVEL=debug, so it is safe to sprinkle across request/operation
// steps without spamming a normal deployment.
func Tracef(format string, args ...any) {
	if !debugEnabled.Load() {
		return
	}
	put(out, "trace", fmt.Sprintf("[trace] "+format, args...))
}

// Accessf writes the request logger's one line per request to stderr, exactly as
// the standard logger used to, and hands nothing to the sink: the request logger
// keeps a structured line of its own, with the parts a kept log must not hold
// taken out, and this one — the whole request URI, as `docker logs` has always
// shown it — is for the terminal only.
func Accessf(format string, args ...any) {
	access.Printf(format, args...)
}

// THE SINK: WHERE A LINE IS KEPT AS WELL AS PRINTED. Since 3.1.0 the server keeps
// its log in its database (the Jobs tab's System logs), and every line this
// package writes is one of those lines. stdout and stderr stay exactly as they
// were, for `docker logs`; the sink is told as well.

// Entry is one line as the sink receives it.
type Entry struct {
	Level string    // error, warn, info or trace: which function wrote it; or request (ServerLog)
	Code  string    // the TIP code the line carries, or ""
	Line  string    // the text, without the level tag and code already in Level and Code
	At    time.Time // when it was written
}

// SetSink makes fn the place every line is handed to after it is printed: Printf
// and Alertf at info, Warnf at warn, Errorf at error, Tracef at trace (and only
// while tracing is on, as ever), and the standard logger's lines through
// StdWriter. nil removes it. serve() sets it once, before the store opens, so the
// boot and migration lines are kept too.
//
// fn runs on the logging goroutine, under whatever locks the caller holds, so it
// must return at once and must never log through this package (the logbook
// buffers and returns; its own failures go straight to stderr).
func SetSink(fn func(Entry)) {
	if fn == nil {
		sink.Store(nil)
		return
	}
	sink.Store(&fn)
}

// codeAt is a TIP code anywhere in a line; codeLead is one that starts it, as
// Errorf and Warnf write them.
var (
	codeAt   = regexp.MustCompile(`TIP-[A-Z]+-[0-9]+`)
	codeLead = regexp.MustCompile(`^TIP-[A-Z]+-[0-9]+ `)
)

// entryOf is the sink's view of one printed line. The level tag goes, since the
// level is kept beside the line; so does a code that leads the line, since it is
// kept beside it too. A code further in (a line quoting another's) is noted and
// left where it is. "!! " stays: it is the only mark an alert has.
func entryOf(level, line string) Entry {
	e := Entry{Level: level, At: time.Now()}
	for _, tag := range []string{"[error] ", "[warn] ", "[trace] "} {
		if strings.HasPrefix(line, tag) {
			line = line[len(tag):]
			break
		}
	}
	if m := codeLead.FindString(line); m != "" {
		e.Code, line = m[:len(m)-1], line[len(m):]
	} else {
		e.Code = codeAt.FindString(line)
	}
	e.Line = strings.TrimRight(line, "\n")
	return e
}

// StdWriter is the standard logger's half of the sink: serve() tees the standard
// logger into it (log.SetOutput(io.MultiWriter(os.Stderr, olog.StdWriter()))), so
// the lines written through package log — the boot and shutdown lines in main,
// and the handlers that predate this package — are kept like this package's own.
// Each is kept at info, or at warn or error when its text says so the way this
// package's own lines do ("[warn] …", "[error] …").
func StdWriter() io.Writer { return stdWriter{} }

type stdWriter struct{}

// stdStamp is the prefix log.LstdFlags writes, which the kept line does not need:
// the database keeps the time in a column of its own.
var stdStamp = regexp.MustCompile(`^\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}(\.\d+)? `)

func (stdWriter) Write(p []byte) (int, error) {
	fn := sink.Load()
	if fn == nil {
		return len(p), nil
	}
	line := stdStamp.ReplaceAllString(string(p), "")
	level := "info"
	switch {
	case strings.HasPrefix(line, "[error]"):
		level = "error"
	case strings.HasPrefix(line, "[warn]"):
		level = "warn"
	}
	(*fn)(entryOf(level, line))
	return len(p), nil
}

// ServerLog is the logger for http.Server's ErrorLog: the lines net/http writes
// about connections and handlers, which with no ErrorLog go through the standard
// logger, where StdWriter keeps every one at info. Two of them are not info:
//
//   - "http: panic serving …" is a handler that panicked, with its stack; net/http
//     recovered it and the server went on. It is an error, written as Errorf
//     writes one, with CodeHTTPPanic, so it can be found and looked up.
//   - "http: TLS handshake error from …" is a connection that never became a
//     request. On a server terminating its own TLS, internet scanners send a
//     steady stream of these, and at info they would be kept for thirty days in
//     the class the log drops last when it is full. At "request" they are kept
//     with the request lines, dropped first when it is full — and still there
//     for the one time they matter, a phone that cannot connect because of the
//     certificate.
//
// Everything else stays at info. Each line still reaches stderr with the standard
// timestamp, as it did through the standard logger.
func ServerLog() *log.Logger { return log.New(serverWriter{}, "", 0) }

type serverWriter struct{}

func (serverWriter) Write(p []byte) (int, error) {
	line := strings.TrimRight(string(p), "\n")
	switch {
	case strings.HasPrefix(line, "http: panic serving "):
		Errorf(CodeHTTPPanic, "%s", line)
	case strings.HasPrefix(line, "http: TLS handshake error "):
		put(err, "request", line)
	default:
		put(err, "info", line)
	}
	return len(p), nil
}
