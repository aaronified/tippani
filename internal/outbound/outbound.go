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
// container from reporting itself healthy.
package outbound

import (
	"errors"
	"net/http"
	"os"
	"strings"
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
// is on. A nil base means http.DefaultTransport, so Transport(nil) is the whole
// of what a plain client needs.
func Transport(base http.RoundTripper) http.RoundTripper { return gate{base: base} }

type gate struct{ base http.RoundTripper }

func (g gate) RoundTrip(req *http.Request) (*http.Response, error) {
	if Off() {
		return nil, ErrOffline
	}
	if g.base != nil {
		return g.base.RoundTrip(req)
	}
	return http.DefaultTransport.RoundTrip(req)
}
