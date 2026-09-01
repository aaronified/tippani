package httpapi

// Tests for the in-app update endpoints: the GitHub check (mocked), the
// admin-only guard, the confirm guard, and the socket-present/absent branches
// of apply — all with a fake Docker client so nothing touches a real socket.

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"tippani/internal/buildinfo"
)

// fakeDocker records what apply would do without a real Engine API.
//
// IT HONOURS THE CONTEXT, which is the whole point of three of the tests below:
// a real pull is an HTTP request on that context, so a dead one pulls nothing.
// A fake that ignored it would pass whether or not the handler had detached
// itself from the client's connection, which is the bug being guarded.
type fakeDocker struct {
	mu       sync.Mutex
	avail    bool
	why      string
	name     string
	image    string
	selfErr  error
	pullHook func(context.Context) error // runs inside Pull, before the ctx check
	pulled   []string
	watched  []string
}

func (f *fakeDocker) Available(context.Context) bool       { return f.avail }
func (f *fakeDocker) Probe(context.Context) (bool, string) { return f.avail, f.why }
func (f *fakeDocker) Self(context.Context) (string, string, string, error) {
	return "id123", f.name, f.image, f.selfErr
}
func (f *fakeDocker) Pull(ctx context.Context, ref string) error {
	if f.pullHook != nil {
		if err := f.pullHook(ctx); err != nil {
			return err
		}
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.pulled = append(f.pulled, ref)
	return nil
}
func (f *fakeDocker) RunWatchtower(ctx context.Context, target string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.watched = append(f.watched, target)
	return nil
}

// pulls / watched read the recorded calls under the lock — one apply runs on a
// second goroutine in TestOnlyOneUpdateRunsAtATime.
func (f *fakeDocker) pulls() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.pulled...)
}
func (f *fakeDocker) recreated() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.watched...)
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

// THE BRANCH BUILD THAT WAS TOLD IT WAS CURRENT WITH THREE COMMITS BEHIND IT.
// A push to v3 rebuilds `:v3` and creates no GitHub release, so the pre-release
// channel — which reads the release list — had nothing newer to report, and was
// right: the newest STABLE release is older than a run-up to the next major,
// which is the same arithmetic that stops it being offered as a downgrade. The
// question for a moving tag is whether the branch has moved.
func TestABranchBuildIsComparedAgainstItsBranch(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	srv.newDocker = func() UpdateDocker { return &fakeDocker{} }

	orig := buildinfo.Version
	buildinfo.Version = "3.0.0-edge.f7ddba5"
	t.Cleanup(func() { buildinfo.Version = orig })

	head := "a66ff6c"
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/repos/aaronified/tippani/commits/v3":
			w.Write([]byte(`{"sha":"` + head + `0000000000000000"}`))
		case "/repos/aaronified/tippani/releases":
			// Only stable tags exist, and every one is behind this build.
			w.Write([]byte(`[{"tag_name":"v2.2.9","html_url":"https://x/s"}]`))
		default:
			w.Write([]byte(`{"tag_name":"v2.2.9","html_url":"https://x/s"}`))
		}
	}))
	t.Cleanup(ts.Close)
	srv.GitHubAPI = ts.URL

	res := decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["update_available"] != true {
		t.Fatalf("branch moved and nothing was offered: %v", res)
	}
	if res["latest"] != "v3 @ "+head {
		t.Errorf("latest = %v, want the branch and its head", res["latest"])
	}
	if res["branch"] != "v3" || res["commit"] != "f7ddba5" {
		t.Errorf("did not report what it is running: %v / %v", res["branch"], res["commit"])
	}
	// The link has to go somewhere useful: what changed, not a release page for
	// a release that does not exist.
	if u, _ := res["notes_url"].(string); !strings.Contains(u, "/compare/f7ddba5...a66ff6c") {
		t.Errorf("notes_url = %v, want the compare view", res["notes_url"])
	}

	// AND IT STOPS OFFERING ONCE PULLED. The same check, on the build the branch
	// now points at, is quiet — a check that always says yes is a badge nobody
	// can clear.
	buildinfo.Version = "3.0.0-edge." + head
	res = decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["update_available"] != false {
		t.Fatalf("still offering an update after the branch was pulled: %v", res)
	}
}

// AND main MOVES TOO. `:edge` is rebuilt on every push to the default branch,
// and a build off it is UNORDERABLE by design — a run-up to nothing in
// particular — which used to mean the check offered it the last stable release,
// a downgrade, for want of anything it could compare. It can compare now.
func TestAnEdgeBuildIsComparedAgainstMain(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	srv.newDocker = func() UpdateDocker { return &fakeDocker{} }

	orig := buildinfo.Version
	buildinfo.Version = "edge.main.f7ddba5"
	t.Cleanup(func() { buildinfo.Version = orig })

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/repos/aaronified/tippani/commits/main" {
			w.Write([]byte(`{"sha":"a66ff6c0000000000000000"}`))
			return
		}
		w.Write([]byte(`{"tag_name":"v2.2.9","html_url":"https://x/s"}`))
	}))
	t.Cleanup(ts.Close)
	srv.GitHubAPI = ts.URL

	res := decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["latest"] != "main @ a66ff6c" {
		t.Fatalf("latest = %v, want main's head and not the last stable release", res["latest"])
	}
	if res["update_available"] != true {
		t.Fatal("main moved and nothing was offered")
	}

	// On the head itself: quiet, and NOT offered v2.2.9 as a consolation.
	buildinfo.Version = "edge.main.a66ff6c"
	res = decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["update_available"] != false {
		t.Fatalf("offered %v to a build that is main's head", res["latest"])
	}
}

// A PUBLISHED RELEASE STILL WINS. An rc, or the release itself, is a better
// answer than another commit on the branch it came from.
func TestAReleaseOutranksTheBranchHead(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	srv.newDocker = func() UpdateDocker { return &fakeDocker{} }

	orig := buildinfo.Version
	buildinfo.Version = "3.0.0-edge.f7ddba5"
	t.Cleanup(func() { buildinfo.Version = orig })

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/repos/aaronified/tippani/releases" {
			w.Write([]byte(`[{"tag_name":"v3.0.0-rc.1","prerelease":true,"html_url":"https://x/rc"}]`))
			return
		}
		w.Write([]byte(`{"sha":"a66ff6c0000000000000000"}`))
	}))
	t.Cleanup(ts.Close)
	srv.GitHubAPI = ts.URL

	res := decode[map[string]any](t, c.mustDo("GET", "/admin/update/check", nil, 200))
	if res["latest"] != "v3.0.0-rc.1" {
		t.Fatalf("latest = %v, want the rc rather than a commit on the branch", res["latest"])
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

// ---- the update has to survive the connection it was asked over --------------
//
// THE REPORT THIS WAS WRITTEN FOR: "I still cannot update from settings.
// Sometimes it works if I do it in a browser on the server itself, but almost
// never from a different device." Apply pulls two images and creates a container
// before it writes a byte — minutes on a slow line — and two separate mechanisms
// cut that off, both of them far likelier over a network than over loopback.

// A long apply outlives the server's WriteTimeout, so its answer still arrives.
//
// This drives the REAL handler chain over a REAL connection on purpose. A
// recorder cannot have a write deadline, and the deadline is cleared through
// http.ResponseController, which reaches the connection only if every wrapper in
// that chain implements Unwrap — so a test that bypassed the chain would have
// passed for the entire time the clearing did nothing at all.
func TestAnUpdateOutlivesTheServersWriteTimeout(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	fake := &fakeDocker{
		avail: true, name: "tippani", image: "ghcr.io/aaronified/tippani:latest",
		// Longer than the deadline below: this is the pull that used to make the
		// final JSON undeliverable.
		pullHook: func(context.Context) error { time.Sleep(250 * time.Millisecond); return nil },
	}
	srv.newDocker = func() UpdateDocker { return fake }

	ts := httptest.NewUnstartedServer(h)
	ts.Config.WriteTimeout = 100 * time.Millisecond
	ts.Start()
	defer ts.Close()

	req, err := http.NewRequest("POST", ts.URL+"/api/admin/update/apply",
		strings.NewReader(`{"confirm":"UPDATE"}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(c.cookie)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("the apply's answer never arrived — the write deadline still applies: %v", err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("the apply's answer was cut off mid-body: %v", err)
	}
	if res.StatusCode != 200 || !strings.Contains(string(body), `"ok":true`) {
		t.Fatalf("apply over a short WriteTimeout: %d %s", res.StatusCode, body)
	}
	if got := fake.recreated(); len(got) != 1 || got[0] != "tippani" {
		t.Fatalf("did not launch the recreater: %v", got)
	}
}

// The client going away does not abandon an update already under way.
//
// A request that sends nothing for minutes is exactly the one an intermediary
// gives up on — a sleeping phone, a Wi-Fi roam, a reverse proxy's read timeout, a
// closed tab — and r.Context() dies with the connection. Tied to it, the pull was
// simply dropped and nothing was updated. A cancelled request context stands in
// for all of those here.
func TestAnUpdateSurvivesTheClientGoingAway(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	fake := &fakeDocker{avail: true, name: "tippani", image: "ghcr.io/aaronified/tippani:latest"}
	srv.newDocker = func() UpdateDocker { return fake }

	req := httptest.NewRequest("POST", "/api/admin/update/apply",
		strings.NewReader(`{"confirm":"UPDATE"}`))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(c.cookie)
	ctx, cancel := context.WithCancel(req.Context())
	cancel() // the connection is already gone by the time the pull would start
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req.WithContext(ctx))

	// One pull here, not two: the fake stands in for RunWatchtower, and it is the
	// REAL one that pulls the updater image as its first act.
	if got := fake.pulls(); len(got) != 1 || got[0] != "ghcr.io/aaronified/tippani:latest" {
		t.Fatalf("the pull was abandoned with the client: %v", got)
	}
	if rec.Code != 200 {
		t.Fatalf("apply after the client left: %d %s", rec.Code, rec.Body)
	}
	if got := fake.recreated(); len(got) != 1 || got[0] != "tippani" {
		t.Fatalf("the recreater never launched: %v", got)
	}
}

// A second apply while one is running is refused rather than raced.
//
// Two one-shot recreaters aimed at the same container is not a theoretical
// concurrency worry: pressing the button again is the natural response to an
// update that appears to have done nothing, which is precisely how this used to
// look from the outside.
func TestOnlyOneUpdateRunsAtATime(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	inside, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	fake := &fakeDocker{
		avail: true, name: "tippani", image: "ghcr.io/aaronified/tippani:latest",
		pullHook: func(context.Context) error {
			once.Do(func() { close(inside); <-release })
			return nil
		},
	}
	srv.newDocker = func() UpdateDocker { return fake }

	done := make(chan int, 1)
	go func() {
		rec := c.do("POST", "/admin/update/apply", map[string]any{"confirm": "UPDATE"})
		done <- rec.Code
	}()
	<-inside // the first apply is holding the lock, inside its first pull

	second := c.do("POST", "/admin/update/apply", map[string]any{"confirm": "UPDATE"})
	if second.Code != http.StatusConflict {
		t.Fatalf("a second apply was allowed to run alongside the first: %d %s", second.Code, second.Body)
	}
	close(release)
	if code := <-done; code != 200 {
		t.Fatalf("the first apply: %d", code)
	}
	if got := fake.recreated(); len(got) != 1 {
		t.Fatalf("more than one recreater was launched: %v", got)
	}
}
