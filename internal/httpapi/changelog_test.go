package httpapi

import (
	"net/http"
	"testing"

	"tippani/internal/changelog"
)

// The changelog endpoint.
//
// The parser has its own tests in internal/changelog; these are about the two
// things only the handler decides — who may read it, and whether it can tell you
// which build you are on.

func TestTheChangelogArrivesNewestFirst(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	got := decode[struct {
		Current       string              `json:"current"`
		CurrentListed bool                `json:"current_listed"`
		Releases      []changelog.Release `json:"releases"`
	}](t, c.mustDo("GET", "/changelog", nil, http.StatusOK))

	if len(got.Releases) < 10 {
		t.Fatalf("expected the real history, got %d releases", len(got.Releases))
	}
	// Document order, which is the file's order. Not sorted here, because sorting
	// semantic versions is a second opinion that could disagree with the changelog
	// itself — and the changelog is the thing being shown.
	if got.Releases[0].Version != changelog.Latest() {
		t.Errorf("the first release is not the latest: %q", got.Releases[0].Version)
	}
	if len(got.Releases[0].Sections) == 0 {
		t.Errorf("the newest release arrived with no sections")
	}
}

func TestTheChangelogSaysWhichBuildIsRunning(t *testing.T) {
	// The one thing a link to the releases page cannot do, and therefore the one
	// thing worth checking about the payload.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	got := decode[struct {
		Current       string `json:"current"`
		CurrentListed bool   `json:"current_listed"`
	}](t, c.mustDo("GET", "/changelog", nil, http.StatusOK))

	if got.Current == "" {
		t.Error("no current version reported")
	}
	// The test binary is built without ldflags, so buildinfo.Version is "dev" and
	// is deliberately NOT in the history. That is the state the dialog explains
	// rather than papers over, so it is worth pinning.
	if got.Current == "dev" && got.CurrentListed {
		t.Errorf("a dev build should not claim to be a listed release")
	}
}

// NOT ADMIN-ONLY, though the button that opens it sits on the admin-only Updates
// card. Release history is published on the internet; gating the endpoint would
// mean a second user on the same instance could never be shown what changed, even
// if a future screen wanted to. Written down because "it hangs off an admin card,
// so make it requireAdmin" is the obvious change somebody will make later.
func TestAnyoneSignedInCanReadTheChangelog(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	bob.mustDo("GET", "/changelog", nil, http.StatusOK)
	// And the update check beside it stays admin-only, which is the contrast that
	// makes the choice above a decision rather than an oversight.
	bob.mustDo("GET", "/admin/update/check", nil, http.StatusForbidden)
}

func TestTheChangelogNeedsASession(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	anon := &testClient{t: t, h: h}
	anon.mustDo("GET", "/changelog", nil, http.StatusUnauthorized)
}
