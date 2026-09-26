package jobs

import (
	"context"
	"fmt"
	"reflect"
	"sync"
	"time"
)

// Recorder is where a line goes when something looks outward: the queued job it
// is part of (the runner's *Job), or the request it is part of (*Lazy). The outbound hook and
// the queued kinds' item loops write lines; handlers only name a subject — the
// title, ISBN or name a reader typed — and never write prose into a job.
type Recorder interface {
	Log(level, format string, args ...any)
	Subject(s string)
}

type recorderKey struct{}

// WithRecorder returns ctx carrying r, so everything called with it logs into r.
// A nil r, or a typed nil pointer inside one, leaves ctx as it is: From must
// never hand out an interface that is not nil and panics when called.
func WithRecorder(ctx context.Context, r Recorder) context.Context {
	if r == nil {
		return ctx
	}
	if v := reflect.ValueOf(r); v.Kind() == reflect.Pointer && v.IsNil() {
		return ctx
	}
	return context.WithValue(ctx, recorderKey{}, r)
}

// From is the Recorder ctx carries, or nil when it carries none.
func From(ctx context.Context) Recorder {
	r, _ := ctx.Value(recorderKey{}).(Recorder)
	return r
}

// A request's log is held in memory until the request ends, and bounded: an
// in-request job is one person's lookup, and five hundred lines or a quarter of a
// megabyte is far past anything one makes.
const (
	lazyLines = 500
	lazyBytes = 256 << 10
)

// Lazy is one request's job, before it is known whether there is one. The
// request logger puts one in every request's context; it becomes an in-request
// job only when something is logged into it (an outbound call) or a handler
// names it with Begin (an import, a restore, a backup through the API). A
// request that does neither leaves no row.
//
// NO DATABASE WRITE ON THE REQUEST PATH. The lines are held here, and Finish
// hands the row and its lines to the logbook in one piece when the request ends.
// A single manual lookup is as fast as it was before any of this existed, which
// is the owner's ask: "as fast as today, never queued behind a bulk run, and each
// is still recorded as a job with its log".
type Lazy struct {
	lb     *Logbook
	kindOf func(pattern string) string
	start  time.Time

	mu       sync.Mutex
	uid      int64
	username string
	gen      uint64
	pattern  string
	kind     string // from Begin; else kindOf(pattern) at Finish
	subject  string
	begun    bool // something was logged, or Begin was called
	lines    []Line
	bytes    int
	lost     int
	done     bool
}

// NewLazy starts a request's job. kindOf names the kind for a route pattern
// (httpapi's table: "POST /books/lookup" → "lookup.book"); it may be nil, and a
// pattern it does not know makes a job of kind "request" whose subject is the
// pattern.
func NewLazy(lb *Logbook, kindOf func(pattern string) string) *Lazy {
	return &Lazy{lb: lb, kindOf: kindOf, start: time.Now()}
}

// Viewer notes who the request is for, and the store generation that was read
// before their account was (store.Generation says why the order matters). The
// authentication middleware calls it; a request that never authenticates is
// kept with no owner.
func (l *Lazy) Viewer(uid int64, username string, gen uint64) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.uid, l.username, l.gen = uid, username, gen
}

// Route notes the route pattern the request matched (http.Request.Pattern,
// known only inside the mux).
func (l *Lazy) Route(pattern string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.pattern = pattern
}

// Log adds a line, and makes the request a job.
func (l *Lazy) Log(level, format string, args ...any) {
	lvl := levelOf(level)
	text := clean(lvl, fmt.Sprintf(format, args...))
	l.mu.Lock()
	if l.done {
		// Logged after its request ended (something outlived the request with
		// its context): kept in the system log rather than lost.
		l.mu.Unlock()
		if l.lb != nil {
			l.lb.System(lvl, "", text)
		}
		return
	}
	defer l.mu.Unlock()
	l.begun = true
	if len(l.lines) >= lazyLines || l.bytes+len(text) > lazyBytes {
		l.lost++
		return
	}
	l.lines = append(l.lines, Line{At: time.Now(), Level: lvl, Text: text})
	l.bytes += len(text)
}

// Subject names what the request is about. It does not make the request a job
// on its own: a lookup answered without looking outward left nothing to record.
func (l *Lazy) Subject(s string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.subject = cleanSubject(s)
}

// Begin makes the request in ctx a job of kind, whether or not anything is ever
// logged into it: the routes whose work is worth a record in itself (an import,
// a restore, a factory reset, a backup through the API, an update, the daily
// deck). A context without a *Lazy — a queued job's, or none — is left alone.
func Begin(ctx context.Context, kind, subject string) {
	l, ok := From(ctx).(*Lazy)
	if !ok {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.done {
		return
	}
	l.begun = true
	l.kind = kind
	if subject != "" {
		l.subject = cleanSubject(subject)
	}
}

// Finish ends the request's job. The request logger calls it with the status the
// response carried. If the request became a job, its row and lines go to the
// logbook as one entry: succeeded under 400, else failed with "HTTP <status>".
// Called twice, the second call does nothing.
func (l *Lazy) Finish(status int) {
	l.mu.Lock()
	if l.done || !l.begun {
		l.done = true
		l.mu.Unlock()
		return
	}
	l.done = true
	kind, subject := l.kind, l.subject
	if kind == "" && l.kindOf != nil {
		kind = l.kindOf(l.pattern)
	}
	if kind == "" || kind == "request" {
		kind = "request"
		if subject == "" {
			subject = l.pattern
		}
	}
	row := Row{
		UserID: l.uid, Username: l.username, Gen: l.gen,
		Kind: kind, Subject: subject, State: StateSucceeded,
		Created: l.start, Finished: time.Now(),
	}
	if status >= 400 {
		row.State = StateFailed
		row.Error = fmt.Sprintf("HTTP %d", status)
	}
	lines := l.lines
	if l.lost > 0 {
		lines = append(lines, Line{At: time.Now(), Level: LevelWarn,
			Text: fmt.Sprintf("%d more lines were not kept", l.lost)})
	}
	l.lines = nil
	l.mu.Unlock()
	if l.lb != nil {
		l.lb.InRequest(row, lines)
	}
}

// levelOf is a job line's level, as the logbook will keep it.
func levelOf(l string) string { return level(l, jobLevels) }
