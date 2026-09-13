package outbound

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
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
