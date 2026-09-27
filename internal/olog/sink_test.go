package olog

import (
	"bytes"
	"io"
	"log"
	"strings"
	"sync"
	"testing"
)

// WHAT THE KEPT LOG IS HANDED. The sink is this package's whole contract with the
// logbook that keeps the server's log in its database, so the functions are the
// observable unit: a line written through each one arrives at the sink at its
// level, with its code beside it and not repeated inside it, and the terminal
// still reads exactly what it read before there was a sink. The standard logger's
// lines arrive through StdWriter the same way, and the request logger's terminal
// line does not arrive at all — it keeps a line of its own.

type sunk struct {
	mu  sync.Mutex
	got []Entry
}

func (s *sunk) take(e Entry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.got = append(s.got, e)
}

func (s *sunk) entries() []Entry {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Entry(nil), s.got...)
}

func sinkForTest(t *testing.T) *sunk {
	t.Helper()
	s := &sunk{}
	SetSink(s.take)
	t.Cleanup(func() { SetSink(nil) })
	return s
}

func TestEveryLineIsKeptAtItsLevelWithItsCode(t *testing.T) {
	printed := CaptureForTest(t)
	s := sinkForTest(t)
	t.Cleanup(func() { SetLevel("") })

	Printf("tippani listening on %s", "http://127.0.0.1:8080")
	Alertf("FACTORY RESET requested by %s", "alice")
	Warnf(CodeLocaleDuplicate, "[locale] %s and %s both resolve to %q", "fr.txt", "FR.txt", "fr")
	Errorf(CodeStoreCheckpoint, "wal checkpoint on shutdown failed: %v", "disk full")
	Printf("[jobs] #3 fill for aro failed: the job stopped on an internal error (%s)", CodeJobPanic)
	Tracef("not while tracing is off")
	SetLevel("debug")
	Tracef("[meta] GET %s -> %d", "openlibrary.org/search.json", 200)
	Accessf("GET /api/books?q=dune 200 3ms 12B 192.0.2.1:1234 alice r1")

	want := []Entry{
		{Level: "info", Line: "tippani listening on http://127.0.0.1:8080"},
		{Level: "info", Line: "!! FACTORY RESET requested by alice"},
		{Level: "warn", Code: "TIP-LOCALE-001", Line: `[locale] fr.txt and FR.txt both resolve to "fr"`},
		{Level: "error", Code: "TIP-STORE-005", Line: "wal checkpoint on shutdown failed: disk full"},
		// A code further in is noted, and the line keeps it: it is part of what
		// the line says, not a label written in front of it.
		{Level: "info", Code: "TIP-JOBS-001", Line: "[jobs] #3 fill for aro failed: the job stopped on an internal error (TIP-JOBS-001)"},
		{Level: "trace", Line: "[meta] GET openlibrary.org/search.json -> 200"},
	}
	got := s.entries()
	if len(got) != len(want) {
		t.Fatalf("the sink was handed %d lines, want %d (the access line and the gated trace are not kept):\n%+v", len(got), len(want), got)
	}
	for i, w := range want {
		g := got[i]
		if g.Level != w.Level || g.Code != w.Code || g.Line != w.Line || g.At.IsZero() {
			t.Errorf("line %d kept as %+v\n                     want %+v", i, g, w)
		}
	}

	// The terminal reads what it always read: the tag and the code in the line.
	for _, line := range []string{
		"tippani listening on http://127.0.0.1:8080\n",
		"!! FACTORY RESET requested by alice\n",
		"[warn] TIP-LOCALE-001 [locale] fr.txt and FR.txt both resolve to \"fr\"\n",
		"[error] TIP-STORE-005 wal checkpoint on shutdown failed: disk full\n",
		"[trace] [meta] GET openlibrary.org/search.json -> 200\n",
		"GET /api/books?q=dune 200 3ms 12B 192.0.2.1:1234 alice r1\n",
	} {
		if !strings.Contains(printed.String(), line) {
			t.Errorf("the terminal no longer reads %q:\n%s", line, printed)
		}
	}
}

func TestTheStandardLoggersLinesAreKeptToo(t *testing.T) {
	s := sinkForTest(t)
	var terminal bytes.Buffer
	std := log.New(io.MultiWriter(&terminal, StdWriter()), "", log.LstdFlags)

	std.Printf("tippani %s (%s)", "3.1.0", "ghcr.io/aaronified/tippani")
	std.Printf("[warn] %s the pre-restore copy could not be removed", CodeBackupCleanup)
	std.Printf("[error] the listener stopped: %v", "address in use")

	want := []Entry{
		{Level: "info", Line: "tippani 3.1.0 (ghcr.io/aaronified/tippani)"},
		{Level: "warn", Code: "TIP-BACKUP-006", Line: "the pre-restore copy could not be removed"},
		{Level: "error", Line: "the listener stopped: address in use"},
	}
	got := s.entries()
	if len(got) != len(want) {
		t.Fatalf("the sink was handed %d lines, want %d: %+v", len(got), len(want), got)
	}
	for i, w := range want {
		if g := got[i]; g.Level != w.Level || g.Code != w.Code || g.Line != w.Line {
			t.Errorf("line %d kept as %+v, want %+v (the timestamp prefix goes; the database keeps the time)", i, g, w)
		}
	}
	if strings.Count(terminal.String(), "\n") != 3 {
		t.Fatalf("the terminal half of the tee lost a line:\n%s", terminal.String())
	}

	// With no sink, the tee's second half keeps nothing and costs nothing.
	SetSink(nil)
	std.Printf("unkept")
	if n := len(s.entries()); n != 3 {
		t.Fatalf("a line reached a sink that was removed: %d entries", n)
	}
}
