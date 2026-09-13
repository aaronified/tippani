// TIPPANI_OFFLINE REACHES THE UPDATE CHECK TOO.
//
// CLAUDE.md says internal/metadata is the only package allowed an outbound HTTP
// call. It is one package short: getJSON here asks api.github.com what the
// latest release is. The claim was never load-bearing until now — a switch that
// silences every provider and leaves the app asking GitHub for news is a switch
// whose name is a lie.
//
// NOT AFFECTED, AND DELIBERATELY: docker.go's client, which dials a unix socket
// or a local proxy to talk to the Docker daemon. That is local infrastructure,
// not the internet, and a box switched offline must still be able to see its
// own daemon.
//
// Counts handler entries rather than reading the error, and runs the switch-off
// case first — same reasoning as internal/metadata/offline_test.go.
package updater

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"tippani/internal/outbound"
)

func TestReleaseCheckIsOfflineGated(t *testing.T) {
	var hits atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits.Add(1)
		_, _ = w.Write([]byte(`{"tag_name":"v9.9.9"}`))
	}))
	defer srv.Close()

	var rel struct {
		TagName string `json:"tag_name"`
	}
	ctx := context.Background()

	t.Setenv(outbound.EnvVar, "")
	if err := getJSON(ctx, srv.URL, &rel); err != nil {
		t.Fatalf("switch off: %v", err)
	}
	if rel.TagName != "v9.9.9" {
		t.Fatalf("switch off: decoded %q — the stub was not what answered", rel.TagName)
	}
	if got := hits.Load(); got != 1 {
		t.Fatalf("switch off: the stub was asked %d times, want 1", got)
	}

	t.Setenv(outbound.EnvVar, "1")
	if err := getJSON(ctx, srv.URL, &rel); !errors.Is(err, outbound.ErrOffline) {
		t.Fatalf("switch on: got %v, which does not unwrap to ErrOffline", err)
	}
	if got := hits.Load(); got != 1 {
		t.Fatalf("switch on: the stub was asked %d times — the update check went out anyway", got)
	}
}
