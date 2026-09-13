// TIPPANI_OFFLINE, PROVED AT THIS PACKAGE'S OWN CLIENTS.
//
// internal/outbound's own tests prove the gate refuses. These prove the gate is
// WIRED — which is the half that goes wrong, because the wiring is a field in a
// struct literal and a struct literal without it compiles, builds, ships and
// phones Google.
//
// EVERY CASE COUNTS HANDLER ENTRIES RATHER THAN READING THE ERROR. "It failed"
// is what a request that went out and came back 500 also looks like; "the
// handler was never entered" is the claim the switch actually makes. And every
// case runs with the switch OFF first: a client that cannot reach its stub for
// some unrelated reason would pass the offline half for the wrong reason, and
// that is how a test comes to be about nothing.
//
// TWO CLIENTS, NOT ONE, and that is the point of testing here at all. httpGet
// and httpPost share metadata.go's client; fetchImage builds its own so it can
// carry the SSRF dial guard. A guard written for the shared one alone would
// leave every cover and poster fetch going out.
package metadata

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"tippani/internal/outbound"
)

// countingServer answers anything, and says how many times it was asked.
func countingServer(t *testing.T, body []byte) (*httptest.Server, *atomic.Int64) {
	t.Helper()
	var hits atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits.Add(1)
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv, &hits
}

func TestSharedClientIsOfflineGated(t *testing.T) {
	srv, hits := countingServer(t, []byte(`{"ok":true}`))
	ctx := context.Background()

	t.Setenv(outbound.EnvVar, "")
	if _, status, err := httpGet(ctx, srv.URL, ""); err != nil || status != http.StatusOK {
		t.Fatalf("switch off: httpGet gave status %d, err %v", status, err)
	}
	if _, status, err := httpPost(ctx, srv.URL, "application/json", []byte(`{}`), "", nil); err != nil || status != http.StatusOK {
		t.Fatalf("switch off: httpPost gave status %d, err %v", status, err)
	}
	if got := hits.Load(); got != 2 {
		t.Fatalf("switch off: the stub was asked %d times, want 2", got)
	}

	t.Setenv(outbound.EnvVar, "1")
	if _, _, err := httpGet(ctx, srv.URL, ""); !errors.Is(err, outbound.ErrOffline) {
		t.Fatalf("switch on: httpGet gave %v, which does not unwrap to ErrOffline", err)
	}
	if _, _, err := httpPost(ctx, srv.URL, "application/json", []byte(`{}`), "", nil); !errors.Is(err, outbound.ErrOffline) {
		t.Fatalf("switch on: httpPost gave %v, which does not unwrap to ErrOffline", err)
	}
	if got := hits.Load(); got != 2 {
		t.Fatalf("switch on: the stub was asked %d times — a provider call went out anyway", got)
	}
}

// allowAny lifts the host allowlist so a 127.0.0.1 stub is reachable at all;
// covers_test.go owns it. The offline gate sits OUTSIDE the SSRF guard, so
// lifting one says nothing about the other — which is what this checks.
func TestImageFetchIsOfflineGated(t *testing.T) {
	allowAny(t)
	srv, hits := countingServer(t, pngData)
	ctx := context.Background()

	t.Setenv(outbound.EnvVar, "")
	if _, err := FetchImage(ctx, srv.URL+"/cover.png", t.TempDir()); err != nil {
		t.Fatalf("switch off: %v", err)
	}
	if got := hits.Load(); got != 1 {
		t.Fatalf("switch off: the stub was asked %d times, want 1", got)
	}

	t.Setenv(outbound.EnvVar, "1")
	if _, err := FetchImage(ctx, srv.URL+"/cover.png", t.TempDir()); !errors.Is(err, outbound.ErrOffline) {
		t.Fatalf("switch on: got %v, which does not unwrap to ErrOffline", err)
	}
	if got := hits.Load(); got != 1 {
		t.Fatalf("switch on: the stub was asked %d times — an image fetch went out anyway", got)
	}
}
