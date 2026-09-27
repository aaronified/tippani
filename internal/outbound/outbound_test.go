package outbound

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// UNSET IS SPELLED AS EMPTY HERE. t.Setenv cannot unset a variable, and
// os.Getenv cannot tell "" from absent, so the two reach Off through one code
// path and one case covers both.
func TestOffReadsTheSwitch(t *testing.T) {
	for _, c := range []struct {
		val  string
		want bool
	}{
		{"", false}, {"0", false}, {"false", false}, {"no", false}, {"off", false},
		{"OFF", false}, {" 0 ", false}, {"False", false},
		{"1", true}, {"true", true}, {"yes", true}, {"on", true}, {"TRUE", true},
		// ANYTHING SET BUT UNRECOGNISED COUNTS AS ON. A safety switch that a
		// typo silently disarms is worse than no switch at all, because it
		// reads as protection while providing none.
		{"ture", true}, {"please", true}, {"2", true},
	} {
		t.Setenv(EnvVar, c.val)
		if got := Off(); got != c.want {
			t.Errorf("Off() with %s=%q = %v, want %v", EnvVar, c.val, got, c.want)
		}
	}
}

// NOT ATTEMPTED, AND NOT MERELY FAILED. The handler counts its own entries, so
// this can tell a request the gate stopped from a request that went out and
// came back an error — which is the whole claim the package makes.
func TestTransportRefusesWithoutDialling(t *testing.T) {
	var hits atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	client := &http.Client{Transport: Transport(nil)}

	// THE SWITCH OFF CASE RUNS FIRST, ON PURPOSE. A client that cannot reach
	// the server for some unrelated reason would pass the offline case for the
	// wrong reason, and the test would be about nothing. Proving it works
	// first is what stops that.
	t.Setenv(EnvVar, "")
	resp, err := client.Get(srv.URL)
	if err != nil {
		t.Fatalf("switch off: %v", err)
	}
	resp.Body.Close()
	if got := hits.Load(); got != 1 {
		t.Fatalf("switch off: handler entered %d times, want 1", got)
	}

	t.Setenv(EnvVar, "1")
	if _, err := client.Get(srv.URL); err == nil {
		t.Fatal("switch on: the request succeeded")
	} else if !errors.Is(err, ErrOffline) {
		// net/http wraps a transport failure in *url.Error; errors.Is has to
		// find ErrOffline through it or no caller can react to it by name.
		t.Fatalf("switch on: got %v, which does not unwrap to ErrOffline", err)
	}
	if got := hits.Load(); got != 1 {
		t.Fatalf("switch on: handler entered %d times — the request was dialled anyway", got)
	}
}

// A WRAPPED TRANSPORT IS STILL USED. Transport(base) that quietly dropped base
// would take the SSRF dial guard off covers.go's client while looking correct
// at the call site.
func TestTransportKeepsTheBaseItWraps(t *testing.T) {
	t.Setenv(EnvVar, "")
	var used atomic.Int64
	gated := Transport(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		used.Add(1)
		return &http.Response{StatusCode: http.StatusTeapot, Body: http.NoBody, Request: req}, nil
	}))
	resp, err := (&http.Client{Transport: gated}).Get("http://example.invalid/")
	if err != nil {
		t.Fatalf("wrapped base: %v", err)
	}
	resp.Body.Close()
	if used.Load() != 1 {
		t.Fatal("the wrapped transport was never called, so Transport(base) discards base")
	}
	if resp.StatusCode != http.StatusTeapot {
		t.Fatalf("status %d — the response did not come from the wrapped transport", resp.StatusCode)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// THE LOG HEARS EVERY CALL, AND EVERY REFUSAL. The observer is what feeds a job's
// log and the system log (SetObserver's callers are serve() and the daily-deck
// command), so what it is told is what a reader will be able to see: a call that
// went out and what came back, a call the switch refused without dialling, and a
// call to the sign-in server, which is observed and never refused. And the
// request it is handed carries the caller's context, which is how a line finds
// the job it belongs to.
func TestTheObserverHearsEveryCallAndEveryRefusal(t *testing.T) {
	var hits atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusTeapot)
	}))
	defer srv.Close()

	type seen struct {
		path   string
		status int
		err    error
		took   time.Duration
		whose  any
	}
	var mu sync.Mutex
	var got []seen
	SetObserver(func(req *http.Request, resp *http.Response, err error, took time.Duration) {
		s := seen{path: req.URL.Path, err: err, took: took, whose: req.Context().Value(ctxWhose{})}
		if resp != nil {
			s.status = resp.StatusCode
		}
		mu.Lock()
		got = append(got, s)
		mu.Unlock()
	})
	t.Cleanup(func() { SetObserver(nil) })
	last := func(t *testing.T, want int) seen {
		t.Helper()
		mu.Lock()
		defer mu.Unlock()
		if len(got) != want {
			t.Fatalf("the observer was told of %d calls, want %d: %+v", len(got), want, got)
		}
		return got[want-1]
	}
	get := func(t *testing.T, rt http.RoundTripper, path string) error {
		t.Helper()
		ctx := context.WithValue(context.Background(), ctxWhose{}, path)
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+path, nil)
		resp, err := (&http.Client{Transport: rt}).Do(req)
		if err == nil {
			resp.Body.Close()
		}
		return err
	}

	t.Setenv(EnvVar, "")
	if err := get(t, Transport(nil), "/went"); err != nil {
		t.Fatal(err)
	}
	if s := last(t, 1); s.path != "/went" || s.status != http.StatusTeapot || s.err != nil || s.took <= 0 || s.whose != "/went" {
		t.Fatalf("a call that went out was told as %+v", s)
	}

	t.Setenv(EnvVar, "1")
	if err := get(t, Transport(nil), "/refused"); !errors.Is(err, ErrOffline) {
		t.Fatalf("switch on: %v", err)
	}
	if s := last(t, 2); s.path != "/refused" || !errors.Is(s.err, ErrOffline) || s.status != 0 || s.whose != "/refused" {
		t.Fatalf("a refused call was told as %+v", s)
	}
	if hits.Load() != 1 {
		t.Fatalf("the refused call was dialled: %d hits", hits.Load())
	}

	// Observed is never refused, switch or no switch, and is heard all the same.
	if err := get(t, Observed(nil), "/signin"); err != nil {
		t.Fatalf("an observed call with the switch on: %v", err)
	}
	if s := last(t, 3); s.path != "/signin" || s.status != http.StatusTeapot || s.err != nil {
		t.Fatalf("an observed call was told as %+v", s)
	}
	if hits.Load() != 2 {
		t.Fatalf("the observed call did not reach the server: %d hits", hits.Load())
	}

	// With nothing installed, calls go on as before and nobody is told.
	SetObserver(nil)
	if err := get(t, Observed(nil), "/unheard"); err != nil {
		t.Fatal(err)
	}
	last(t, 3)
}

type ctxWhose struct{}
