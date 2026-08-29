package httpapi

// Tests for the in-app update endpoints: the GitHub check (mocked), the
// admin-only guard, the confirm guard, and the socket-present/absent branches
// of apply — all with a fake Docker client so nothing touches a real socket.

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"tippani/internal/buildinfo"
)

// fakeDocker records what apply would do without a real Engine API.
type fakeDocker struct {
	avail   bool
	why     string
	name    string
	image   string
	selfErr error
	pulled  []string
	watched []string
}

func (f *fakeDocker) Available(context.Context) bool       { return f.avail }
func (f *fakeDocker) Probe(context.Context) (bool, string) { return f.avail, f.why }
func (f *fakeDocker) Self(context.Context) (string, string, string, error) {
	return "id123", f.name, f.image, f.selfErr
}
func (f *fakeDocker) Pull(_ context.Context, ref string) error {
	f.pulled = append(f.pulled, ref)
	return nil
}
func (f *fakeDocker) RunWatchtower(_ context.Context, target string) error {
	f.watched = append(f.watched, target)
	return nil
}

func mockGitHub(t *testing.T, tag string) *httptest.Server {
	t.Helper()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"tag_name":"` + tag + `","name":"` + tag + `","html_url":"https://x/` + tag + `","published_at":"2026-07-13T00:00:00Z"}`))
	}))
	t.Cleanup(ts.Close)
	return ts
}

func TestUpdateCheck(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	srv.GitHubAPI = mockGitHub(t, "v99.0.0").URL
	fake := &fakeDocker{avail: true, name: "tippani", image: "ghcr.io/aaronified/tippani:latest"}
	srv.newDocker = func() UpdateDocker { return fake }

	res := decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["current"] != buildinfo.Version {
		t.Fatalf("current = %v, want %v", res["current"], buildinfo.Version)
	}
	if res["latest"] != "v99.0.0" || res["update_available"] != true {
		t.Fatalf("check: %+v", res)
	}
	if res["socket"] != true || res["can_self_update"] != true {
		t.Fatalf("socket flags: %+v", res)
	}

	// A GitHub failure is soft: still 200, current present, with check_error.
	srv.GitHubAPI = "http://127.0.0.1:0" // unreachable
	res = decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["check_error"] == nil || res["update_available"] != false {
		t.Fatalf("soft GH failure: %+v", res)
	}

	// No socket → can't self-update.
	srv.GitHubAPI = mockGitHub(t, "v99.0.0").URL
	fake.avail = false
	res = decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["socket"] != false || res["can_self_update"] != false {
		t.Fatalf("no-socket flags: %+v", res)
	}
}

// A CARD WITH NO BUTTON HAS TO SAY WHY. "One-click needs the Docker socket
// mounted" is the same sentence whether it was never mounted, was mounted
// somewhere this user cannot read, or is being looked for under a path with a
// ":ro" suffix left on it by a compose file — and the operator has to guess
// which. The reason travels with the refusal.
func TestUpdateCheckSaysWhyThereIsNoButton(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	srv.GitHubAPI = mockGitHub(t, "v99.0.0").URL
	srv.newDocker = func() UpdateDocker {
		return &fakeDocker{avail: false, why: `no socket at /var/run/docker.sock:ro`}
	}

	res := decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["can_self_update"] != false {
		t.Fatal("offered a one-click update with no socket")
	}
	if res["socket_error"] != "no socket at /var/run/docker.sock:ro" {
		t.Fatalf("socket_error = %v, want the probe's reason", res["socket_error"])
	}

	// And a working socket carries no reason at all — an empty string in the
	// payload would draw an empty line under a card that is working.
	srv.newDocker = func() UpdateDocker { return &fakeDocker{avail: true} }
	res = decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if _, ok := res["socket_error"]; ok {
		t.Fatalf("a working socket reported %v", res["socket_error"])
	}
}

func TestUpdateApply(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	fake := &fakeDocker{avail: true, name: "tippani", image: "ghcr.io/aaronified/tippani:latest"}
	srv.newDocker = func() UpdateDocker { return fake }

	// Missing confirmation → 400, no Docker calls.
	c.mustDo("POST", "/admin/update/apply", map[string]any{}, http.StatusBadRequest)
	c.mustDo("POST", "/admin/update/apply", map[string]any{"confirm": "yes"}, http.StatusBadRequest)
	if len(fake.pulled) != 0 || len(fake.watched) != 0 {
		t.Fatalf("apply acted without confirmation: %+v", fake)
	}

	// Confirmed + socket present → pulls the image and launches the recreater.
	res := decode[map[string]any](t, c.mustDo("POST", "/admin/update/apply", map[string]any{"confirm": "UPDATE"}, 200))
	if res["ok"] != true {
		t.Fatalf("apply: %+v", res)
	}
	if len(fake.pulled) != 1 || fake.pulled[0] != "ghcr.io/aaronified/tippani:latest" {
		t.Fatalf("did not pull self image: %+v", fake.pulled)
	}
	if len(fake.watched) != 1 || fake.watched[0] != "tippani" {
		t.Fatalf("did not target self for recreate: %+v", fake.watched)
	}

	// Confirmed but no socket → 409 with the guided command, no Docker calls.
	fake.avail = false
	fake.pulled, fake.watched = nil, nil
	r := c.mustDo("POST", "/admin/update/apply", map[string]any{"confirm": "UPDATE"}, http.StatusConflict)
	body := decode[map[string]any](t, r)
	if body["guided_command"] == nil || body["socket"] != false {
		t.Fatalf("no-socket apply: %+v", body)
	}
	if len(fake.pulled) != 0 || len(fake.watched) != 0 {
		t.Fatalf("apply acted without socket: %+v", fake)
	}
}

func TestUpdateAdminOnly(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	srv.newDocker = func() UpdateDocker { return &fakeDocker{avail: false} }
	bob := addUser(t, h, admin, "bob")

	// A non-admin can't reach either endpoint.
	bob.mustDo("GET", "/admin/update/check", nil, http.StatusForbidden)
	bob.mustDo("POST", "/admin/update/apply", map[string]any{"confirm": "UPDATE"}, http.StatusForbidden)
}

// mockGitHubChannels answers both endpoints the two channels use, and records
// which one was asked — the point of the channel is WHICH URL gets called, and
// a test that only checked the tag would pass with the switch wired backwards.
func mockGitHubChannels(t *testing.T, stableTag, preTag string) (*httptest.Server, *[]string) {
	t.Helper()
	var seen []string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/repos/aaronified/tippani/releases" {
			w.Write([]byte(`[{"tag_name":"` + preTag + `","prerelease":true,"html_url":"https://x/p"},` +
				`{"tag_name":"` + stableTag + `","html_url":"https://x/s"}]`))
			return
		}
		w.Write([]byte(`{"tag_name":"` + stableTag + `","name":"` + stableTag + `","html_url":"https://x/s"}`))
	}))
	t.Cleanup(ts.Close)
	return ts, &seen
}

// A BRANCH BUILD IS NOT OFFERED THE LAST STABLE RELEASE. It is a run-up to a
// version none of them has reached, so every stable tag is behind it — and the
// card used to present the newest of them as "an update", which would have
// walked a v3 tester back onto 2.x.
func TestABranchBuildFollowsThePrereleaseLineByDefault(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	srv.newDocker = func() UpdateDocker { return &fakeDocker{} }

	orig := buildinfo.Version
	buildinfo.Version = "3.0.0-edge.f7ddba5"
	t.Cleanup(func() { buildinfo.Version = orig })

	ts, seen := mockGitHubChannels(t, "v2.9.9", "v3.0.0-rc.1")
	srv.GitHubAPI = ts.URL

	res := decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["channel"] != "prerelease" || res["channel_explicit"] != false {
		t.Fatalf("channel = %v (explicit %v), want prerelease by implication", res["channel"], res["channel_explicit"])
	}
	if res["latest"] != "v3.0.0-rc.1" {
		t.Fatalf("latest = %v, want the rc — the stable tag is behind this build", res["latest"])
	}
	if res["update_available"] != true {
		t.Fatal("an rc ahead of the branch build is an update")
	}
	if len(*seen) == 0 || (*seen)[0] != "/repos/aaronified/tippani/releases" {
		t.Fatalf("asked GitHub for %v, want the release LIST — /releases/latest skips pre-releases", *seen)
	}
}

// And the stored preference overrides the implication in both directions: a
// tester who wants off the rc line can say so without reinstalling, and a
// stable install can opt on to it without one either.
func TestTheUpdateChannelCanBeSetBothWays(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	srv.newDocker = func() UpdateDocker { return &fakeDocker{} }

	orig := buildinfo.Version
	buildinfo.Version = "3.0.0-edge.f7ddba5"
	t.Cleanup(func() { buildinfo.Version = orig })

	ts, _ := mockGitHubChannels(t, "v2.9.9", "v3.0.0-rc.1")
	srv.GitHubAPI = ts.URL

	set := decode[map[string]any](t, c.mustDo("POST", "/admin/update/channel", map[string]any{"channel": "stable"}, 200))
	if set["channel"] != "stable" || set["channel_explicit"] != true {
		t.Fatalf("after opting out: %v", set)
	}
	res := decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["latest"] != "v2.9.9" || res["channel"] != "stable" {
		t.Fatalf("opted out of pre-releases but got %v on %v", res["latest"], res["channel"])
	}

	// "" is the way back to the default, not a third channel.
	c.mustDo("POST", "/admin/update/channel", map[string]any{"channel": ""}, 200)
	res = decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["channel"] != "prerelease" || res["channel_explicit"] != false {
		t.Fatalf("clearing should restore the implied channel, got %v", res)
	}

	c.mustDo("POST", "/admin/update/channel", map[string]any{"channel": "nightly"}, 400)
}

// A stable install is NOT quietly moved onto the rc line by this feature.
func TestAReleaseBuildStaysOnStableUnlessAsked(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	srv.newDocker = func() UpdateDocker { return &fakeDocker{} }

	orig := buildinfo.Version
	buildinfo.Version = "2.2.9"
	t.Cleanup(func() { buildinfo.Version = orig })

	ts, seen := mockGitHubChannels(t, "v2.9.9", "v3.0.0-rc.1")
	srv.GitHubAPI = ts.URL

	res := decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["channel"] != "stable" || res["latest"] != "v2.9.9" {
		t.Fatalf("a release build should see the stable line, got %v", res)
	}
	for _, p := range *seen {
		if p == "/repos/aaronified/tippani/releases" {
			t.Fatal("stable channel must not read the pre-release list")
		}
	}
}
