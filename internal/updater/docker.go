package updater

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"syscall"
	"time"
)

// DefaultDockerSock is the Engine-API unix socket; override with
// TIPPANI_DOCKER_SOCK. DefaultUpdaterImage is the one-shot recreater; override
// with TIPPANI_UPDATER_IMAGE (e.g. to pin a digest).
//
// ---- WHY NOT containrrr/watchtower ANY MORE ---------------------------------
//
// It was the default until this release, and on a current Docker host it cannot
// work at all. Watchtower 1.7.1 is the last release of that project (2023) and
// its Engine client negotiates API 1.25; Docker Engine's own floor has since
// risen, and a modern daemon answers:
//
//	client version 1.25 is too old. Minimum supported API version is 1.40
//
// after which the helper panics on a nil metric and exits. THE FAILURE IS
// INVISIBLE FROM HERE. The helper is detached and AutoRemove, so its stderr goes
// nowhere this process reads — the app logs "recreater launched", the container
// is never recreated, and the only symptom is the version failing to change,
// which reads as "the update did nothing" rather than as "the updater is broken".
// That is exactly what it looked like to the operator who reported it: four
// applies in an hour, four successful pulls, and a container still on the image
// it started on.
//
// nickfedor/watchtower is the maintained continuation of the same project — same
// flags, same behaviour, same one-shot contract — and negotiates the daemon's own
// API version. Nothing else in this file changes.
const (
	DefaultDockerSock   = "/var/run/docker.sock"
	DefaultUpdaterImage = "nickfedor/watchtower"
)

func DockerSock() string   { return envOr("TIPPANI_DOCKER_SOCK", DefaultDockerSock) }
func UpdaterImage() string { return envOr("TIPPANI_UPDATER_IMAGE", DefaultUpdaterImage) }

// DockerEndpoint resolves the Engine-API endpoint the update path talks to.
// TIPPANI_DOCKER_HOST wins when set — `tcp://host:port` reaches a
// docker-socket-proxy (no socket file in this container at all), and
// `unix:///path` is accepted for symmetry. Otherwise the TIPPANI_DOCKER_SOCK
// path, otherwise the default socket. Kept as its own env rather than the
// conventional DOCKER_HOST so an unrelated variable in the operator's stack
// can never silently redirect Tippani's updates.
func DockerEndpoint() string {
	if v := os.Getenv("TIPPANI_DOCKER_HOST"); v != "" {
		return v
	}
	return DockerSock()
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// Docker is a minimal Engine-API client — only the calls a self-update needs
// (ping, identify self, pull, run a one-shot updater). We deliberately avoid
// the heavy Docker SDK: the app stays CGO-free and dependency-light, and this
// speaks a handful of documented HTTP endpoints. Two transports, same API:
// the classic mounted unix socket, or plain TCP to a docker-socket-proxy.
type Docker struct {
	sock    string // unix-socket path ("" in tcp mode)
	tcpHost string // "tcp://host:port" in proxy mode — also handed to Watchtower as DOCKER_HOST
	base    string // URL base requests are built on
	http    *http.Client
}

// NewDocker accepts a unix-socket path (the historical form), a
// "unix:///path" URL, or a "tcp://host:port" proxy endpoint.
func NewDocker(endpoint string) *Docker {
	if hostport, ok := strings.CutPrefix(endpoint, "tcp://"); ok {
		return &Docker{
			tcpHost: endpoint,
			base:    "http://" + strings.TrimSuffix(hostport, "/"),
			http:    &http.Client{Timeout: 10 * time.Minute}, // image pulls can be slow on a small box
		}
	}
	sock := strings.TrimPrefix(endpoint, "unix://")
	return &Docker{
		sock: sock,
		base: "http://docker",
		http: &http.Client{
			Timeout: 10 * time.Minute,
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
					return (&net.Dialer{}).DialContext(ctx, "unix", sock)
				},
			},
		},
	}
}

func (d *Docker) do(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, d.base+path, body)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return d.http.Do(req)
}

// Available reports whether the Engine API answers. False when the socket
// isn't mounted / the proxy isn't reachable (the common case) — either way,
// self-update isn't possible and the caller falls back to the guided command.
// In proxy mode a reachable proxy can still deny specific endpoints (it needs
// CONTAINERS=1, IMAGES=1, POST=1); that surfaces as a coded error at apply
// time rather than here — _ping is allowed by every proxy default.
func (d *Docker) Available(ctx context.Context) bool {
	ok, _ := d.Probe(ctx)
	return ok
}

// Probe is Available with the reason attached. A one-click update that is simply
// missing tells the operator nothing about WHY — and the two commonest causes
// look identical from the outside: the socket was never mounted, or it was
// mounted and the non-root user cannot open it. A third, which cost this
// project's own owner an evening, is a TIPPANI_DOCKER_SOCK carrying a `:ro`
// suffix that belongs on the volume and not on the path, so the app is patiently
// looking for a socket named "/var/run/docker.sock:ro".
//
// The reason names what was tried, and never carries anything the operator did
// not type: it is a path or a host they configured, plus the OS's own words.
func (d *Docker) Probe(ctx context.Context) (bool, string) {
	where := d.tcpHost
	if d.sock != "" {
		where = d.sock
		if _, err := os.Stat(d.sock); err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				hint := ""
				if strings.Contains(d.sock, ":") {
					// The one misconfiguration that is diagnosable from the string.
					hint = ` — a ":ro" or ":rw" suffix belongs on the volume mount, not on this path`
				}
				return false, fmt.Sprintf("no socket at %s%s", d.sock, hint)
			}
			if errors.Is(err, fs.ErrPermission) {
				return false, fmt.Sprintf("%s is not readable by the user tippani runs as (uid %d) — add its group to group_add", d.sock, os.Getuid())
			}
			return false, fmt.Sprintf("%s: %v", d.sock, err)
		}
	}
	resp, err := d.do(ctx, http.MethodGet, "/_ping", nil)
	if err != nil {
		// THE COMMONEST FAILURE ONCE THE SOCKET IS ACTUALLY MOUNTED, and the one
		// that looks least like what it is. The socket is root:docker 0660 on the
		// host; this process is uid 65532 in the container and belongs to no
		// group that can open it — so it STATS fine (stat needs only the
		// directory) and dies on connect with "permission denied". "Mount the
		// socket" is the wrong advice at that point, because it is mounted.
		//
		// The group id is read off the socket rather than assumed, because it is
		// the number the operator has to type and it is different on every host.
		if errors.Is(err, fs.ErrPermission) || errors.Is(err, syscall.EACCES) {
			if gid, ok := socketGID(d.sock); ok {
				return false, fmt.Sprintf(
					"%s is mounted but this process (uid %d) may not open it — add `group_add: [\"%d\"]` to the service in compose and recreate it",
					d.sock, os.Getuid(), gid)
			}
			return false, fmt.Sprintf("%s is mounted but this process (uid %d) may not open it — it needs the socket's group", d.sock, os.Getuid())
		}
		return false, fmt.Sprintf("%s did not answer: %v", where, err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Sprintf("%s answered %d to a ping", where, resp.StatusCode)
	}
	return true, ""
}

// selfIDFiles are where a container's own 64-hex id can be read out of /proc.
// Overridden in tests; nothing else should touch them.
var selfIDFiles = []string{"/proc/self/mountinfo", "/proc/self/cgroup"}

var containerIDPat = regexp.MustCompile(`[0-9a-f]{64}`)

// selfIDFromProc reads this container's own id out of /proc, which is where it
// is regardless of what anybody set the hostname to.
//
// TWO FILES, BECAUSE ONE OF THEM STOPPED CARRYING IT. Under cgroup v1 the id was
// the last path segment in /proc/self/cgroup; under cgroup v2 that file says
// `0::/` and nothing else, which is why the hostname was ever used at all. What
// survives both is /proc/self/mountinfo: the daemon bind-mounts /etc/hostname,
// /etc/hosts and /etc/resolv.conf out of /var/lib/docker/containers/<id>/, and
// mountinfo prints the SOURCE side of every mount — so the id is in there on any
// host that has those three files, which is every Docker host.
//
// A 64-hex run is the id. Nothing else in either file is 64 hex characters, and
// requiring the surrounding path would tie this to one storage driver's layout.
func selfIDFromProc() string {
	for _, f := range selfIDFiles {
		b, err := os.ReadFile(f)
		if err != nil {
			continue
		}
		if m := containerIDPat.Find(b); m != nil {
			return string(m)
		}
	}
	return ""
}

// Self identifies this container and returns its id, name (no leading slash) and
// current image reference.
//
// IT ASKS /proc FIRST AND THE HOSTNAME SECOND, and that order is the fix for a
// reported failure rather than a preference. The comment here used to say Docker
// sets the hostname to the short container id "unless overridden" — and Compose
// overrides it: a compose service gets its SERVICE NAME as its hostname, which is
// only also a container name when `container_name` happens to match the service.
// Where it does not, `GET /containers/<hostname>/json` is a 404 and the whole
// update fails at the first step with `inspect self: docker 404`, which names the
// symptom and none of the cause.
//
// The id in /proc is not a guess about anybody's configuration, so it goes first.
// The hostname stays as the fallback for the one case /proc cannot answer — a
// process that is not in a container at all, or a runtime that lays out neither
// file the way Docker does — and both are named in the error when neither works,
// because the operator's next question is "what did it look for".
func (d *Docker) Self(ctx context.Context) (id, name, image string, err error) {
	host, _ := os.Hostname()
	tried := make([]string, 0, 2)
	var resp *http.Response
	for _, ref := range []string{selfIDFromProc(), host} {
		if ref == "" {
			continue
		}
		tried = append(tried, ref)
		r, err := d.do(ctx, http.MethodGet, "/containers/"+url.PathEscape(ref)+"/json", nil)
		if err != nil {
			return "", "", "", err
		}
		if r.StatusCode == http.StatusOK {
			resp = r
			break
		}
		r.Body.Close()
	}
	if resp == nil {
		if len(tried) == 0 {
			return "", "", "", errors.New("inspect self: no container id in /proc and no hostname")
		}
		return "", "", "", fmt.Errorf("inspect self: docker 404 for %s — is this process in a container the daemon can see?", strings.Join(tried, " and "))
	}
	defer resp.Body.Close()
	var c struct {
		ID     string `json:"Id"`
		Name   string `json:"Name"`
		Config struct {
			Image string `json:"Image"`
		} `json:"Config"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&c); err != nil {
		return "", "", "", err
	}
	return c.ID, strings.TrimPrefix(c.Name, "/"), c.Config.Image, nil
}

// Pull fetches a full image reference (e.g. ghcr.io/owner/tippani:latest),
// draining the progress stream so the pull is complete on return.
func (d *Docker) Pull(ctx context.Context, ref string) error {
	image, tag := splitRef(ref)
	q := url.Values{"fromImage": {image}, "tag": {tag}}
	resp, err := d.do(ctx, http.MethodPost, "/images/create?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("pull %s: docker %d %s", ref, resp.StatusCode, strings.TrimSpace(string(b)))
	}
	io.Copy(io.Discard, resp.Body) //nolint:errcheck — draining to completion
	return nil
}

// RunWatchtower launches a detached one-shot Watchtower that recreates the
// `target` container with the freshly pulled image and then removes itself.
// Watchtower copies the target's existing config, so its volume, ports, env and
// restart policy survive the recreate — which is why we lean on it rather than
// hand-rolling a container swap that could strand the deployment. The helper is
// short-lived and auto-removed.
//
// Socket mode binds the socket into the helper, exactly as an operator would.
// Proxy mode has no socket file to bind: the helper gets DOCKER_HOST pointed at
// the same proxy instead, and must sit on a network from which the proxy's
// address resolves. We attach it to ALL of the target's networks, not a guessed
// one: Tippani can only reach the proxy because they already share a network, so
// every network the target is on is a candidate, and joining all of them is the
// only choice that is correct regardless of which one carries the proxy or how
// the names happen to sort. (An earlier version joined the first-alphabetical
// network, which silently missed the proxy in the documented topology — the
// proxy on an isolated `*-internal` net while the target also sits on
// `*_default`, which sorts first.) The helper does NOT share the target's
// network *namespace* — Watchtower restarts the target, which would yank a
// shared namespace out from under the helper mid-swap.
func (d *Docker) RunWatchtower(ctx context.Context, target string) error {
	image := UpdaterImage()
	if err := d.Pull(ctx, image); err != nil {
		return fmt.Errorf("pull updater image %s: %w", image, err)
	}
	hostConfig := map[string]any{"AutoRemove": true}
	create := map[string]any{
		"Image":      image,
		"Cmd":        []string{"--run-once", "--cleanup", target},
		"HostConfig": hostConfig,
	}
	var extraNetworks []string
	if d.tcpHost != "" {
		create["Env"] = []string{"DOCKER_HOST=" + d.tcpHost}
		networks, err := d.targetNetworks(ctx, target)
		if err != nil {
			return fmt.Errorf("resolve networks for %s: %w", target, err)
		}
		// First network at create time; the rest are connected after create
		// (the Engine only attaches one network per create request reliably
		// across API versions). None (network_mode: none/host handled by the
		// caller's reachability) → helper lands on the default network.
		if len(networks) > 0 {
			hostConfig["NetworkMode"] = networks[0]
			extraNetworks = networks[1:]
		}
	} else {
		hostConfig["Binds"] = []string{d.sock + ":/var/run/docker.sock"}
	}
	body, _ := json.Marshal(create)
	resp, err := d.do(ctx, http.MethodPost, "/containers/create", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("create updater: docker %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	var created struct {
		ID string `json:"Id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		return err
	}
	// From here the helper exists but hasn't run, so AutoRemove (which fires
	// after a run) won't reclaim it — remove it best-effort on any failure so a
	// rejected connect/start doesn't strand a dead container on the host.
	for _, network := range extraNetworks {
		if err := d.connectNetwork(ctx, network, created.ID); err != nil {
			d.removeContainer(ctx, created.ID)
			return fmt.Errorf("attach updater to network %s: %w", network, err)
		}
	}
	start, err := d.do(ctx, http.MethodPost, "/containers/"+created.ID+"/start", nil)
	if err != nil {
		d.removeContainer(ctx, created.ID)
		return err
	}
	defer start.Body.Close()
	if start.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(io.LimitReader(start.Body, 2048))
		d.removeContainer(ctx, created.ID)
		return fmt.Errorf("start updater: docker %d %s", start.StatusCode, strings.TrimSpace(string(b)))
	}
	return nil
}

// removeContainer force-removes a container, best-effort (used to reclaim a
// created-but-never-started helper; a failure here is only a stray container,
// not something to surface over the original error).
func (d *Docker) removeContainer(ctx context.Context, id string) {
	resp, err := d.do(ctx, http.MethodDelete, "/containers/"+id+"?force=1", nil)
	if err != nil {
		return
	}
	resp.Body.Close()
}

// targetNetworks returns all of the target's Docker networks, sorted for a
// deterministic NetworkMode pick. Empty for network_mode host/none (the helper
// then lands on the daemon default). Proxy mode attaches the helper to every
// one so it shares whichever network carries the proxy.
func (d *Docker) targetNetworks(ctx context.Context, target string) ([]string, error) {
	resp, err := d.do(ctx, http.MethodGet, "/containers/"+url.PathEscape(target)+"/json", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("inspect %s: docker %d", target, resp.StatusCode)
	}
	var c struct {
		NetworkSettings struct {
			Networks map[string]json.RawMessage `json:"Networks"`
		} `json:"NetworkSettings"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&c); err != nil {
		return nil, err
	}
	names := make([]string, 0, len(c.NetworkSettings.Networks))
	for name := range c.NetworkSettings.Networks {
		names = append(names, name)
	}
	sort.Strings(names)
	return names, nil
}

// connectNetwork attaches an existing container to another network by name.
func (d *Docker) connectNetwork(ctx context.Context, network, containerID string) error {
	body, _ := json.Marshal(map[string]any{"Container": containerID})
	resp, err := d.do(ctx, http.MethodPost, "/networks/"+url.PathEscape(network)+"/connect", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("docker %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return nil
}

// splitRef splits "repo/name:tag" into image + tag, defaulting the tag to
// "latest". A digest ("@sha256:…") counts as the tag.
func splitRef(ref string) (image, tag string) {
	if i := strings.LastIndex(ref, "@"); i >= 0 {
		return ref[:i], ref[i+1:]
	}
	// A ':' after the last '/' is the tag (ports in a registry host have a '/'
	// after them, so only the final path segment's colon is a tag separator).
	if i := strings.LastIndex(ref, ":"); i > strings.LastIndex(ref, "/") {
		return ref[:i], ref[i+1:]
	}
	return ref, "latest"
}
