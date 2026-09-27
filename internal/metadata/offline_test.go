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
	"strings"
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

// A FAILED LOOKUP SAYS WHICH CALL FAILED, AND NOT WITH WHAT KEY. net/http quotes
// the whole URL in the error it returns, and these errors go on up to handlers
// that print them to stdout and stderr, which the log's own redaction never sees.
// Offline, every one of these fails at the gate, so the errors are the real
// clients' own, from the real URLs the providers build: Google Books' key= and
// TMDB v3's api_key=, and a pasted cover address presigned for a private bucket.
func TestAFailedLookupsErrorNamesTheCallButNotItsKey(t *testing.T) {
	t.Setenv(outbound.EnvVar, "1")
	ctx := context.Background()
	const googleKey, tmdbKey, bucketSig = "AIzaGoogleSecret51", "0f1e2d3c4b5a69788796a5b4c3d2e1f0", "bucketsig77"

	_, gErr := SearchBooks(ctx, "", "Dune", "", googleKey)
	_, vErr := FetchGoogleVolume(ctx, "vol42", googleKey)
	_, tErr := (&TMDB{Key: tmdbKey}).Search(ctx, "Dune", 0)
	_, cErr := FetchUserImage(ctx, "https://shelf.s3.amazonaws.com/c.png?X-Amz-Signature="+bucketSig, t.TempDir())
	for _, c := range []struct {
		name  string
		err   error
		call  string // what the error still says, so it is still worth reading
		naked string
	}{
		{"a Google Books search", gErr, "googleapis.com/books/v1/volumes", googleKey},
		{"a pinned Google volume", vErr, "googleapis.com/books/v1/volumes/vol42?key=…", googleKey},
		{"a TMDB v3 search", tErr, "api.themoviedb.org/3/search/movie", tmdbKey},
		{"a pasted presigned cover", cErr, "shelf.s3.amazonaws.com/c.png?X-Amz-Signature=…", bucketSig},
	} {
		if c.err == nil {
			t.Fatalf("%s: offline, and it did not fail", c.name)
		}
		if !errors.Is(c.err, outbound.ErrOffline) {
			t.Errorf("%s: %v no longer unwraps to ErrOffline", c.name, c.err)
		}
		if msg := c.err.Error(); strings.Contains(msg, c.naked) || !strings.Contains(msg, c.call) {
			t.Errorf("%s failed with %q: want the call named (%s) and the secret gone", c.name, msg, c.call)
		}
	}
}
