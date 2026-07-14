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
	name    string
	image   string
	selfErr error
	pulled  []string
	watched []string
}

func (f *fakeDocker) Available(context.Context) bool { return f.avail }
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
