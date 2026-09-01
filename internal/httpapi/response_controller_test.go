package httpapi

// Every deadline this package clears has to actually reach the connection.
//
// THE BUG THIS EXISTS FOR was silent in the most complete sense: three handlers
// carried a comment saying they had cleared the server's 60s WriteTimeout or its
// 30s ReadTimeout for a long operation, `http.NewResponseController` returned
// `http.ErrNotSupported` to all three, and every call site discarded that error
// with `_ =` because there is nothing useful to do with it. So a restore of a
// large library could not report its own success, a multi-GB upload died at 30
// seconds, and the update endpoint — which pulls two images before it writes a
// byte — had never been given the call at all.
//
// The cause is that ResponseController walks the writer chain by calling
// `Unwrap()`, and a wrapper without that method ends the walk. This package wraps
// every response twice (logRequests -> statusRecorder, gzipResponses ->
// gzipResponseWriter), and neither had it.

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// The shape ResponseController looks for, on both wrappers, returning what each
// was handed. A compile-time assertion cannot stand in for this: the method is
// found by shape at runtime, so dropping it breaks nothing that builds.
func TestEveryResponseWrapperCanBeUnwrapped(t *testing.T) {
	base := httptest.NewRecorder()
	for _, tc := range []struct {
		name string
		w    http.ResponseWriter
	}{
		{"statusRecorder", &statusRecorder{ResponseWriter: base}},
		{"gzipResponseWriter", &gzipResponseWriter{ResponseWriter: base}},
	} {
		u, ok := tc.w.(interface{ Unwrap() http.ResponseWriter })
		if !ok {
			t.Fatalf("%s has no Unwrap: http.ResponseController cannot reach the connection "+
				"through it, so every SetWriteDeadline/SetReadDeadline in this package "+
				"silently becomes a no-op", tc.name)
		}
		if u.Unwrap() != http.ResponseWriter(base) {
			t.Fatalf("%s.Unwrap returned something other than the writer it wraps", tc.name)
		}
	}
}

// And end to end, over a real connection, through the chain the app actually
// builds. A recorder cannot have a deadline at all, so this is the only place the
// question can be asked honestly.
func TestTheWriteDeadlineReachesTheConnection(t *testing.T) {
	var got string
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		err := http.NewResponseController(w).SetWriteDeadline(time.Time{})
		got = fmt.Sprintf("%v", err)
		w.Write([]byte("ok"))
	})
	ts := httptest.NewServer(logRequests(gzipResponses(securityHeaders(h))))
	defer ts.Close()

	// Both ways round: the gzip wrapper is only in the chain for a client that
	// accepts it, so a fix to one wrapper and not the other would pass half the
	// time — which is to say, for browsers and not for curl, or the reverse.
	for _, ae := range []string{"gzip", ""} {
		req, err := http.NewRequest("GET", ts.URL+"/", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Accept-Encoding", ae)
		res, err := http.DefaultTransport.RoundTrip(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if got != "<nil>" {
			t.Fatalf("Accept-Encoding=%q: SetWriteDeadline through the real chain returned %q — "+
				"a wrapper in it is missing Unwrap, and every deadline in this package is a no-op",
				ae, got)
		}
	}
	if !strings.Contains(ts.URL, "127.0.0.1") {
		t.Fatalf("the test server is not local: %s", ts.URL)
	}
}
