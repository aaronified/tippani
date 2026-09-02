package updater

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDockerEndpointResolution(t *testing.T) {
	t.Setenv("TIPPANI_DOCKER_HOST", "")
	t.Setenv("TIPPANI_DOCKER_SOCK", "")
	if got := DockerEndpoint(); got != DefaultDockerSock {
		t.Errorf("default endpoint = %q, want %q", got, DefaultDockerSock)
	}
	t.Setenv("TIPPANI_DOCKER_SOCK", "/run/user/1000/docker.sock")
	if got := DockerEndpoint(); got != "/run/user/1000/docker.sock" {
		t.Errorf("sock endpoint = %q", got)
	}
	// TIPPANI_DOCKER_HOST wins over the sock path.
	t.Setenv("TIPPANI_DOCKER_HOST", "tcp://dockerproxy:2375")
	if got := DockerEndpoint(); got != "tcp://dockerproxy:2375" {
		t.Errorf("host endpoint = %q", got)
	}
}

func TestNewDockerEndpointForms(t *testing.T) {
	if d := NewDocker("/var/run/docker.sock"); d.sock != "/var/run/docker.sock" || d.tcpHost != "" {
		t.Errorf("bare path: %+v", d)
	}
	if d := NewDocker("unix:///run/docker.sock"); d.sock != "/run/docker.sock" || d.tcpHost != "" {
		t.Errorf("unix:// form: %+v", d)
	}
	d := NewDocker("tcp://proxy:2375")
	if d.sock != "" || d.tcpHost != "tcp://proxy:2375" || d.base != "http://proxy:2375" {
		t.Errorf("tcp:// form: %+v", d)
	}
}

// engineFake is a minimal Engine API the tcp path talks to: ping, inspect,
// pull, create, start, network-connect — recording the create body and the set
// of networks the helper was attached to for assertions. The inspect fixture
// deliberately mirrors the documented topology: the target sits on BOTH
// `<proj>_default` and an isolated `<proj>_internal`, and only the latter
// carries the proxy — so a first-alphabetical pick ("_default" sorts first)
// would miss it. The helper must end up on both.
func engineFake(t *testing.T) (*httptest.Server, *map[string]any, *[]string) {
	t.Helper()
	var createBody map[string]any
	var connected []string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/_ping":
			w.WriteHeader(200)
		case strings.HasPrefix(r.URL.Path, "/containers/") && strings.HasSuffix(r.URL.Path, "/json"):
			w.Header().Set("Content-Type", "application/json")
			io.WriteString(w, `{"Id":"abc123","Name":"/tippani","Config":{"Image":"ghcr.io/owner/tippani:latest"},
				"NetworkSettings":{"Networks":{"proj_default":{},"proj_internal":{}}}}`)
		case r.URL.Path == "/images/create" && r.Method == http.MethodPost:
			w.WriteHeader(200)
			io.WriteString(w, `{"status":"ok"}`)
		case r.URL.Path == "/containers/create" && r.Method == http.MethodPost:
			if err := json.NewDecoder(r.Body).Decode(&createBody); err != nil {
				t.Errorf("create body: %v", err)
			}
			w.WriteHeader(201)
			io.WriteString(w, `{"Id":"wt1"}`)
		case strings.HasPrefix(r.URL.Path, "/networks/") && strings.HasSuffix(r.URL.Path, "/connect"):
			net := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/networks/"), "/connect")
			connected = append(connected, net)
			w.WriteHeader(200)
		case r.URL.Path == "/containers/wt1/start" && r.Method == http.MethodPost:
			w.WriteHeader(204)
		default:
			t.Errorf("unexpected engine call: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(500)
		}
	}))
	t.Cleanup(ts.Close)
	return ts, &createBody, &connected
}

func TestDockerOverTCPProxy(t *testing.T) {
	ts, createBody, connected := engineFake(t)
	addr := strings.TrimPrefix(ts.URL, "http://")
	d := NewDocker("tcp://" + addr)
	ctx := context.Background()

	if !d.Available(ctx) {
		t.Fatal("Available() = false over tcp")
	}
	// (Self() keys off the process hostname, so the inspect shape is exercised
	// via targetNetworks inside RunWatchtower instead.)
	if err := d.RunWatchtower(ctx, "tippani"); err != nil {
		t.Fatalf("RunWatchtower: %v", err)
	}
	body := *createBody
	if body == nil {
		t.Fatal("no /containers/create call recorded")
	}
	// The helper must reach the proxy the same way we do: DOCKER_HOST env, no
	// socket bind, attached to EVERY one of the target's networks so whichever
	// carries the proxy is covered.
	env, _ := body["Env"].([]any)
	if len(env) != 1 || env[0] != "DOCKER_HOST=tcp://"+addr {
		t.Errorf("Env = %v, want [DOCKER_HOST=tcp://%s]", env, addr)
	}
	hc, _ := body["HostConfig"].(map[string]any)
	if hc == nil {
		t.Fatal("no HostConfig in create body")
	}
	if _, hasBinds := hc["Binds"]; hasBinds {
		t.Errorf("tcp mode must not bind a socket: %v", hc["Binds"])
	}
	if hc["NetworkMode"] != "proj_default" { // first alphabetically, attached at create
		t.Errorf("NetworkMode = %v, want proj_default", hc["NetworkMode"])
	}
	// The remaining network(s) — critically the isolated proxy net that sorts
	// AFTER _default — must be connected post-create. This is the assertion the
	// old single-network fixture couldn't make.
	if len(*connected) != 1 || (*connected)[0] != "proj_internal" {
		t.Errorf("connected networks = %v, want [proj_internal]", *connected)
	}
	if hc["AutoRemove"] != true {
		t.Errorf("AutoRemove = %v", hc["AutoRemove"])
	}
	cmd, _ := body["Cmd"].([]any)
	if len(cmd) != 3 || cmd[0] != "--run-once" || cmd[1] != "--cleanup" || cmd[2] != "tippani" {
		t.Errorf("Cmd = %v", cmd)
	}
}

func TestRunWatchtowerUnixKeepsBind(t *testing.T) {
	// The unix transport can't reach the httptest TCP server, so drive the
	// same code path by constructing the tcp client and blanking tcpHost —
	// asserting the socket branch builds a bind and no env/network.
	ts, createBody, connected := engineFake(t)
	addr := strings.TrimPrefix(ts.URL, "http://")
	d := NewDocker("tcp://" + addr)
	d.tcpHost = ""
	d.sock = "/var/run/docker.sock"

	if err := d.RunWatchtower(context.Background(), "tippani"); err != nil {
		t.Fatalf("RunWatchtower: %v", err)
	}
	if len(*connected) != 0 {
		t.Errorf("socket mode must not connect networks: %v", *connected)
	}
	body := *createBody
	hc, _ := body["HostConfig"].(map[string]any)
	binds, _ := hc["Binds"].([]any)
	if len(binds) != 1 || binds[0] != "/var/run/docker.sock:/var/run/docker.sock" {
		t.Errorf("Binds = %v", binds)
	}
	if _, hasEnv := body["Env"]; hasEnv {
		t.Errorf("socket mode must not set DOCKER_HOST: %v", body["Env"])
	}
	if _, hasNet := hc["NetworkMode"]; hasNet {
		t.Errorf("socket mode must not set NetworkMode: %v", hc["NetworkMode"])
	}
}

func TestTargetNetworksNone(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"NetworkSettings":{"Networks":{}}}`)
	}))
	defer ts.Close()
	d := NewDocker("tcp://" + strings.TrimPrefix(ts.URL, "http://"))
	nets, err := d.targetNetworks(context.Background(), "tippani")
	if err != nil || len(nets) != 0 {
		t.Errorf("targetNetworks = (%v, %v), want empty and nil", nets, err)
	}
}

// TestRunWatchtowerNoNetworksOmitsNetworkMode: network_mode host/none (empty
// Networks) must not set NetworkMode or connect anything — the helper falls
// back to the daemon default.
func TestRunWatchtowerNoNetworksOmitsNetworkMode(t *testing.T) {
	var createBody map[string]any
	var connected []string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/json"):
			io.WriteString(w, `{"NetworkSettings":{"Networks":{}}}`)
		case r.URL.Path == "/images/create":
			w.WriteHeader(200)
		case r.URL.Path == "/containers/create":
			json.NewDecoder(r.Body).Decode(&createBody)
			w.WriteHeader(201)
			io.WriteString(w, `{"Id":"wt1"}`)
		case strings.HasSuffix(r.URL.Path, "/connect"):
			connected = append(connected, r.URL.Path)
			w.WriteHeader(200)
		case strings.HasSuffix(r.URL.Path, "/start"):
			w.WriteHeader(204)
		default:
			w.WriteHeader(500)
		}
	}))
	defer ts.Close()
	d := NewDocker("tcp://" + strings.TrimPrefix(ts.URL, "http://"))
	if err := d.RunWatchtower(context.Background(), "tippani"); err != nil {
		t.Fatalf("RunWatchtower: %v", err)
	}
	hc, _ := createBody["HostConfig"].(map[string]any)
	if _, has := hc["NetworkMode"]; has {
		t.Errorf("no-networks target must omit NetworkMode: %v", hc["NetworkMode"])
	}
	if len(connected) != 0 {
		t.Errorf("no-networks target must connect nothing: %v", connected)
	}
}

// THE THREE WAYS A SOCKET IS NOT THERE, told apart. The card used to say the
// same sentence for all of them, so an operator with a mounted socket and a
// typo in TIPPANI_DOCKER_SOCK was told to mount the socket.
func TestProbeNamesWhatItLookedFor(t *testing.T) {
	t.Run("missing", func(t *testing.T) {
		_, why := NewDocker(filepath.Join(t.TempDir(), "nope.sock")).Probe(context.Background())
		if !strings.Contains(why, "no socket at") || !strings.Contains(why, "nope.sock") {
			t.Fatalf("why = %q", why)
		}
		if strings.Contains(why, ":ro") {
			t.Fatalf("volunteered a mount-suffix hint for a plain path: %q", why)
		}
	})

	// The one misconfiguration that can be read off the string itself: `:ro`
	// belongs on the volume line, not on the path, and a container started that
	// way is patiently looking for a socket with a colon in its name.
	t.Run("a mount suffix left on the path", func(t *testing.T) {
		_, why := NewDocker("/var/run/docker.sock:ro").Probe(context.Background())
		if !strings.Contains(why, ":ro") || !strings.Contains(why, "volume mount") {
			t.Fatalf("why = %q, want the suffix named", why)
		}
	})

	// THE ONE THE OWNER ACTUALLY HIT: the socket IS mounted, and the container's
	// non-root user is in no group that may open it. It stats fine — stat needs
	// only the directory — and dies on connect, so "mount the socket" was the
	// advice for a socket that was already mounted.
	t.Run("mounted but unreadable", func(t *testing.T) {
		if os.Getuid() == 0 {
			t.Skip("root opens a 0600 socket it does not own")
		}
		dir := t.TempDir()
		p := filepath.Join(dir, "docker.sock")
		l, err := net.Listen("unix", p)
		if err != nil {
			t.Skip("no unix sockets here:", err)
		}
		defer l.Close()
		if err := os.Chmod(p, 0o000); err != nil {
			t.Fatal(err)
		}
		ok, why := NewDocker(p).Probe(context.Background())
		if ok {
			t.Fatal("opened a socket with no permissions")
		}
		if !strings.Contains(why, "may not open it") || !strings.Contains(why, "group_add") {
			t.Fatalf("why = %q, want the group_add fix named", why)
		}
	})

	t.Run("there but not answering", func(t *testing.T) {
		// A real file that is not a socket: it stats, and the dial fails.
		p := filepath.Join(t.TempDir(), "docker.sock")
		if err := os.WriteFile(p, nil, 0o600); err != nil {
			t.Fatal(err)
		}
		ok, why := NewDocker(p).Probe(context.Background())
		if ok {
			t.Fatal("a regular file answered a ping")
		}
		if !strings.Contains(why, "did not answer") {
			t.Fatalf("why = %q", why)
		}
	})
}

// TestDefaultUpdaterImageIsMaintained pins WHICH helper recreates the container,
// because getting that wrong is a silent no-op rather than an error.
//
// containrrr/watchtower was the default until 3.x and on a current Docker host it
// cannot work at all: 1.7.1 is that project's last release (2023), its Engine
// client negotiates API 1.25, and a modern daemon refuses anything below 1.40 —
// after which the helper panics and exits. THE APP CANNOT SEE ANY OF THAT. The
// helper is detached and AutoRemove, so its stderr goes nowhere this process
// reads; the log says "recreater launched", the container is never recreated, and
// the only symptom is a version that does not change.
//
// So the assertion is about the NAME, which is the whole of the fix, and it is
// spelled out rather than compared to a constant: a test that reads
// DefaultUpdaterImage twice would pass whatever it was changed to.
func TestDefaultUpdaterImageIsMaintained(t *testing.T) {
	if DefaultUpdaterImage != "nickfedor/watchtower" {
		t.Fatalf("DefaultUpdaterImage = %q, want the maintained fork", DefaultUpdaterImage)
	}
	if UpdaterImage() != "nickfedor/watchtower" {
		t.Fatalf("UpdaterImage() = %q with no override set", UpdaterImage())
	}
	t.Setenv("TIPPANI_UPDATER_IMAGE", "example/pinned@sha256:deadbeef")
	if UpdaterImage() != "example/pinned@sha256:deadbeef" {
		t.Fatalf("UpdaterImage() ignored TIPPANI_UPDATER_IMAGE: %q", UpdaterImage())
	}
}

// TestRunWatchtowerPullsTheImageItRuns: the create body names the same image the
// pull asked for. They are two calls with one string between them, and a helper
// created from an image that was never pulled is a create that 404s on a host
// that has never seen it.
func TestRunWatchtowerPullsTheImageItRuns(t *testing.T) {
	var pulled string
	var createBody map[string]any
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/images/create" && r.Method == http.MethodPost:
			pulled = r.URL.Query().Get("fromImage") + ":" + r.URL.Query().Get("tag")
			w.WriteHeader(200)
			io.WriteString(w, `{"status":"ok"}`)
		case strings.HasPrefix(r.URL.Path, "/containers/") && strings.HasSuffix(r.URL.Path, "/json"):
			w.Header().Set("Content-Type", "application/json")
			io.WriteString(w, `{"Id":"abc","Name":"/tippani","Config":{"Image":"x"},"NetworkSettings":{"Networks":{}}}`)
		case r.URL.Path == "/containers/create" && r.Method == http.MethodPost:
			json.NewDecoder(r.Body).Decode(&createBody)
			w.WriteHeader(201)
			io.WriteString(w, `{"Id":"wt1"}`)
		case r.URL.Path == "/containers/wt1/start" && r.Method == http.MethodPost:
			w.WriteHeader(204)
		default:
			w.WriteHeader(200)
		}
	}))
	defer ts.Close()

	d := NewDocker("tcp://" + strings.TrimPrefix(ts.URL, "http://"))
	if err := d.RunWatchtower(context.Background(), "tippani"); err != nil {
		t.Fatalf("RunWatchtower: %v", err)
	}
	if createBody == nil {
		t.Fatal("no create recorded")
	}
	if createBody["Image"] != DefaultUpdaterImage {
		t.Errorf("created from %v, want %s", createBody["Image"], DefaultUpdaterImage)
	}
	if !strings.HasPrefix(pulled, DefaultUpdaterImage) {
		t.Errorf("pulled %q, want the image it then runs (%s)", pulled, DefaultUpdaterImage)
	}
}

// ---- identifying self -------------------------------------------------------
//
// THE FAILURE THESE ARE WRITTEN FROM, in the operator's words: "Update didn't
// start", and in the log, `update identify self: inspect self: docker 404`. The
// container was running, the socket was reachable, the ping passed — and the
// very first step of the update asked the daemon to inspect a container by this
// process's HOSTNAME, which under Compose is the service name rather than the
// container name or its id. No container answers to it, so 404, and the message
// named the symptom and none of the cause.
//
// Nothing covered this: engineFake answers every /containers/*/json the same
// way, so the old test suite could not tell which reference had been asked for,
// and the one comment about it said Self() "keys off the process hostname, so the
// inspect shape is exercised via targetNetworks instead" — which is to say it was
// not exercised at all. Every case below asserts the REFERENCE, because that is
// the only thing that was ever wrong.

// engineInspect records which container reference each inspect asked about, and
// answers 404 for anything not in `known`.
func engineInspect(t *testing.T, known map[string]bool) (*httptest.Server, *[]string) {
	t.Helper()
	var asked []string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/containers/") || !strings.HasSuffix(r.URL.Path, "/json") {
			t.Errorf("unexpected engine call: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(500)
			return
		}
		ref := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/containers/"), "/json")
		asked = append(asked, ref)
		if !known[ref] {
			w.WriteHeader(404)
			io.WriteString(w, `{"message":"No such container"}`)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"Id":"`+ref+`","Name":"/tippani","Config":{"Image":"ghcr.io/owner/tippani:v3"}}`)
	}))
	t.Cleanup(ts.Close)
	return ts, &asked
}

const fakeID = "3f1a9c2b7e8d4f6a0b5c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a"

// procFile writes one fake /proc file and points selfIDFromProc at it.
func procFile(t *testing.T, body string) {
	t.Helper()
	p := filepath.Join(t.TempDir(), "procfile")
	if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	old := selfIDFiles
	selfIDFiles = []string{p}
	t.Cleanup(func() { selfIDFiles = old })
}

func TestSelfReadsTheIDFromProcRatherThanTheHostname(t *testing.T) {
	// A real cgroup-v2 mountinfo line: the id is on the SOURCE side of the
	// bind-mount the daemon makes for /etc/hostname.
	procFile(t, "1234 1200 0:64 /containers/"+fakeID+"/hostname /etc/hostname rw,relatime shared:1 - ext4 /dev/sda1 rw\n")
	// The daemon knows the id and knows nothing called "tippani" — which is the
	// operator's case exactly: a compose service named tippani whose container
	// is named something else.
	ts, asked := engineInspect(t, map[string]bool{fakeID: true})
	d := NewDocker("tcp://" + strings.TrimPrefix(ts.URL, "http://"))

	id, name, image, err := d.Self(context.Background())
	if err != nil {
		t.Fatalf("Self: %v", err)
	}
	if id != fakeID {
		t.Errorf("id = %q, want the id from /proc", id)
	}
	if name != "tippani" || image != "ghcr.io/owner/tippani:v3" {
		t.Errorf("name/image = %q / %q", name, image)
	}
	// ONE CALL, and it used the id. Asking the hostname first would have spent a
	// 404 on every update on every host.
	if len(*asked) != 1 || (*asked)[0] != fakeID {
		t.Errorf("inspected %v, want exactly [%s]", *asked, fakeID)
	}
}

func TestSelfReadsCgroupV1Layout(t *testing.T) {
	// The older shape, still what a v1 host prints. Same rule finds it.
	procFile(t, "11:memory:/docker/"+fakeID+"\n10:cpu:/docker/"+fakeID+"\n")
	ts, asked := engineInspect(t, map[string]bool{fakeID: true})
	d := NewDocker("tcp://" + strings.TrimPrefix(ts.URL, "http://"))
	if _, _, _, err := d.Self(context.Background()); err != nil {
		t.Fatalf("Self: %v", err)
	}
	if len(*asked) != 1 || (*asked)[0] != fakeID {
		t.Errorf("inspected %v, want [%s]", *asked, fakeID)
	}
}

func TestSelfFallsBackToTheHostnameWhenProcHasNoID(t *testing.T) {
	// cgroup v2 outside Docker's own layout says this and nothing more, which is
	// why the hostname has to stay as a fallback rather than being replaced.
	procFile(t, "0::/\n")
	host, err := os.Hostname()
	if err != nil {
		t.Skip("no hostname on this machine")
	}
	ts, asked := engineInspect(t, map[string]bool{host: true})
	d := NewDocker("tcp://" + strings.TrimPrefix(ts.URL, "http://"))
	if _, _, _, err := d.Self(context.Background()); err != nil {
		t.Fatalf("Self: %v", err)
	}
	if len(*asked) != 1 || (*asked)[0] != host {
		t.Errorf("inspected %v, want [%s]", *asked, host)
	}
}

func TestSelfTriesBothAndSaysSoWhenNeitherAnswers(t *testing.T) {
	procFile(t, "1234 1200 0:64 /containers/"+fakeID+"/hostname /etc/hostname rw - ext4 /dev/sda1 rw\n")
	host, err := os.Hostname()
	if err != nil {
		t.Skip("no hostname on this machine")
	}
	// The daemon knows neither.
	ts, asked := engineInspect(t, map[string]bool{})
	d := NewDocker("tcp://" + strings.TrimPrefix(ts.URL, "http://"))

	_, _, _, err = d.Self(context.Background())
	if err == nil {
		t.Fatal("Self succeeded against a daemon that knows no container")
	}
	// BOTH ARE TRIED before giving up: the id may be stale in a nested runtime
	// and the hostname may be the answer, or the other way round.
	if len(*asked) != 2 || (*asked)[0] != fakeID || (*asked)[1] != host {
		t.Errorf("inspected %v, want [%s %s]", *asked, fakeID, host)
	}
	// AND THE ERROR NAMES WHAT IT LOOKED FOR. The reported failure was a bare
	// "docker 404", which tells an operator nothing they can act on; the next
	// question is always "404 for what".
	for _, want := range []string{fakeID, host} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not name %q", err, want)
		}
	}
}

func TestSelfIDPatternIgnoresShortHex(t *testing.T) {
	// A short id, a name, a timestamp — none of them 64 hex characters, so none
	// of them is mistaken for an id. This is what keeps the "any 64-hex run"
	// rule honest rather than lucky.
	procFile(t, "0::/system.slice/docker-abc123.scope\n11:name=systemd:/user.slice\n")
	if got := selfIDFromProc(); got != "" {
		t.Errorf("selfIDFromProc() = %q, want empty", got)
	}
}

func TestSelfIDReadsBothProcFilesByDefault(t *testing.T) {
	// Every case above injects its own file, so none of them touches the real
	// list — and dropping /proc/self/cgroup from it survived a mutation run
	// undetected. It matters: mountinfo carries the id on a cgroup-v2 host and
	// /proc/self/cgroup carries it on a v1 one, so a list with only the first
	// works everywhere the author tested and nowhere older.
	want := []string{"/proc/self/mountinfo", "/proc/self/cgroup"}
	if len(selfIDFiles) != len(want) {
		t.Fatalf("selfIDFiles = %v, want %v", selfIDFiles, want)
	}
	for i, w := range want {
		if selfIDFiles[i] != w {
			t.Errorf("selfIDFiles[%d] = %q, want %q", i, selfIDFiles[i], w)
		}
	}
}
