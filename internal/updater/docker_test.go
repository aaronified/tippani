package updater

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
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
