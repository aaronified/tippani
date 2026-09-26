package olog

import (
	"bytes"
	"log"
	"sync"
	"testing"
)

// Captured is what the log said during one test: every line olog wrote to either
// stream and every line the standard logger wrote (the access line), merged in
// the order they were written, the way `docker logs` shows them.
type Captured struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (c *Captured) Write(p []byte) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.buf.Write(p)
}

// String is the log so far.
func (c *Captured) String() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.buf.String()
}

// CaptureForTest points both of olog's streams and the standard logger at one
// buffer until the test ends. Exported because httpapi's tests read what an
// operator would read in `docker logs`, and the loggers are this package's.
// Safe only while no test in the calling package runs in parallel, which none do.
func CaptureForTest(t *testing.T) *Captured {
	t.Helper()
	c := &Captured{}
	prevOut, prevErr, prevStd := out.Writer(), err.Writer(), log.Writer()
	out.SetOutput(c)
	err.SetOutput(c)
	log.SetOutput(c)
	t.Cleanup(func() {
		out.SetOutput(prevOut)
		err.SetOutput(prevErr)
		log.SetOutput(prevStd)
	})
	return c
}
