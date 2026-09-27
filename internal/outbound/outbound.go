// Package outbound decides whether a request may leave this machine, and it is
// the only thing in the app that decides it.
//
// IT EXISTS BECAUSE THE APP HAD NO WAY TO BE RUN OFFLINE. The only stubs were
// Go-test-only — metadata.SetLetterboxdBaseForTest and its four siblings take a
// *testing.T and unwind through t.Cleanup — so a server booted for a browser run
// went on making real provider lookups. CLAUDE.md records what that cost: the
// control ratchet read 187 three times and 188 on the fourth with no change to
// the app, because the app's own author lookups came back in a different order.
// A measurement that moves on its own is not a measurement.
//
// AND A SELF-HOSTED APP SHOULD BE ABLE TO PHONE NOBODY. That is the half worth
// having outside the test harness: TIPPANI_OFFLINE=1 is a deployment saying this
// box does not talk to Google, TMDB, Fandom or GitHub, answered by the app in
// microseconds instead of by a firewall in a thirty-second timeout.
//
// THE REFUSAL IS AT THE TRANSPORT, NOT AT THE CALL SITES, and that is the whole
// of the package. Guarding httpGet and httpPost was the alternative and was
// rejected: covers.go builds its own client for the SSRF dial guard and goes
// through neither, and internal/updater builds a third for the GitHub releases
// API. Three call-site guards are three things to remember; a transport is a
// thing a client cannot be built without.
//
// WHAT IT DOES NOT COVER, said plainly rather than claimed away. A client built
// with no Transport at all gets http.DefaultTransport and escapes this. Nothing
// in here can see such a client, which is why TestEveryOutboundClientRefuses
// names each one and calls it, and why outbound-clients_test.go fails on a
// fourth that nobody has named.
//
// LOOPBACK IS NOT OUTBOUND AND IS NOT AFFECTED. cmd/tippani's healthcheck probes
// 127.0.0.1/healthz and updater.NewDocker dials a unix socket or a local proxy.
// Neither goes through here, and switching the app offline must not stop a
// container from reporting itself healthy. Neither is observed either (below):
// the log records the app looking outward, and those two are it looking at its
// own machine.
//
// AND IT IS WHERE THE LOG HEARS EVERY CALL THAT LEAVES (SetObserver). The owner's
// ask for 3.1.0 was two hooks and no more — "one in the outbound gate, one in the
// request logger" — and the gate is the one place every outward request already
// passes, refused or not. So the observer is told of each round trip here, after
// it, and of each refusal too: a lookup that did not happen because the box is
// offline is exactly the line a reader looking at a failed job needs. The one
// provider that is not gated, the operator's own sign-in server, goes through
// Observed instead: recorded, never refused.
package outbound

import (
	"errors"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

// EnvVar is the switch's name, exported so a test names it once rather than
// spelling the string in every case.
const EnvVar = "TIPPANI_OFFLINE"

// ErrOffline is what a refused request fails with. net/http wraps a transport
// failure in a *url.Error, which unwraps, so errors.Is(err, ErrOffline) holds
// all the way up at the caller.
var ErrOffline = errors.New("outbound network calls are switched off (" + EnvVar + ")")

// Off reports whether the switch is on. Anything set that is not plainly a
// negation counts as on: a safety switch that a typo silently disarms is worse
// than no switch, because it reads as protection.
//
// READ PER REQUEST RATHER THAN LATCHED AT STARTUP, which is where this departs
// from olog.SetLevel. A latched value needs main to remember to latch it, and a
// client built in a package that never wires up escapes silently — exactly the
// failure the transport shape exists to prevent. This is a map read on a path
// that was about to open a socket.
func Off() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(EnvVar))) {
	case "", "0", "false", "no", "off":
		return false
	}
	return true
}

// Transport wraps base so every request through it is refused while the switch
// is on, and every request through it, refused or not, is told to the observer.
// A nil base means http.DefaultTransport, so Transport(nil) is the whole of what a
// plain client needs.
func Transport(base http.RoundTripper) http.RoundTripper { return gate{base: base} }

// Observed wraps base so every request through it is told to the observer and
// none is ever refused. It is for the one outward client the switch must not
// reach — the operator's own OpenID Connect provider, where switching the app
// offline would lock every account out of sign-in — so that its calls are in the
// log like every other outward call, which is what "observed, not gated" in
// clients_test.go means.
func Observed(base http.RoundTripper) http.RoundTripper { return watch{base: base} }

type gate struct{ base http.RoundTripper }

func (g gate) RoundTrip(req *http.Request) (*http.Response, error) {
	if Off() {
		observe(req, nil, ErrOffline, 0)
		return nil, ErrOffline
	}
	return roundTrip(g.base, req)
}

type watch struct{ base http.RoundTripper }

func (w watch) RoundTrip(req *http.Request) (*http.Response, error) { return roundTrip(w.base, req) }

func roundTrip(base http.RoundTripper, req *http.Request) (*http.Response, error) {
	if base == nil {
		base = http.DefaultTransport
	}
	start := time.Now()
	resp, err := base.RoundTrip(req)
	observe(req, resp, err, time.Since(start))
	return resp, err
}

// Observer is told of one round trip: the request, and either the response (its
// headers arrived; the body is the caller's and unread) or the error. A refusal
// under TIPPANI_OFFLINE is an error that errors.Is ErrOffline, with took 0.
//
// It runs on the caller's goroutine, before the caller sees the response, so it
// must be quick and must not read the body. The request's context is the
// caller's, which is how the log knows whose call it was.
type Observer func(req *http.Request, resp *http.Response, err error, took time.Duration)

var observer atomic.Pointer[Observer]

// SetObserver installs fn as the observer of every gated and observed request, in
// place of any before it; nil removes it. serve() installs the logbook's, once,
// before the server takes its first request; `tippani notify daily` installs its
// own. With none installed, a round trip costs one atomic load more than it did.
func SetObserver(fn Observer) {
	if fn == nil {
		observer.Store(nil)
		return
	}
	observer.Store(&fn)
}

func observe(req *http.Request, resp *http.Response, err error, took time.Duration) {
	if fn := observer.Load(); fn != nil {
		(*fn)(req, resp, err, took)
	}
}
