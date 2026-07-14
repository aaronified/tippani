package updater

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// DefaultDockerSock is the Engine-API unix socket; override with
// TIPPANI_DOCKER_SOCK. DefaultUpdaterImage is the one-shot recreater; override
// with TIPPANI_UPDATER_IMAGE (e.g. to pin a digest).
const (
	DefaultDockerSock   = "/var/run/docker.sock"
	DefaultUpdaterImage = "containrrr/watchtower"
)

func DockerSock() string    { return envOr("TIPPANI_DOCKER_SOCK", DefaultDockerSock) }
func UpdaterImage() string  { return envOr("TIPPANI_UPDATER_IMAGE", DefaultUpdaterImage) }
func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// Docker is a minimal Engine-API client over the unix socket — only the calls a
// self-update needs (ping, identify self, pull, run a one-shot updater). We
// deliberately avoid the heavy Docker SDK: the app stays CGO-free and
// dependency-light, and this speaks a handful of documented HTTP endpoints.
type Docker struct {
	sock string
	http *http.Client
}

func NewDocker(sock string) *Docker {
	return &Docker{
		sock: sock,
		http: &http.Client{
			Timeout: 10 * time.Minute, // image pulls can be slow on a small box
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
					return (&net.Dialer{}).DialContext(ctx, "unix", sock)
				},
			},
		},
	}
}

func (d *Docker) do(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, "http://docker"+path, body)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return d.http.Do(req)
}

// Available reports whether the Engine API answers on the socket. False when the
// socket isn't mounted (the common case) or isn't reachable by our uid — either
// way, self-update isn't possible and the caller falls back to the guided
// command.
func (d *Docker) Available(ctx context.Context) bool {
	if _, err := os.Stat(d.sock); err != nil {
		return false
	}
	resp, err := d.do(ctx, http.MethodGet, "/_ping", nil)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// Self identifies this container from the process hostname (Docker sets it to
// the short container id unless overridden) and returns its id, name (no leading
// slash) and current image reference.
func (d *Docker) Self(ctx context.Context) (id, name, image string, err error) {
	host, err := os.Hostname()
	if err != nil {
		return "", "", "", err
	}
	resp, err := d.do(ctx, http.MethodGet, "/containers/"+url.PathEscape(host)+"/json", nil)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", "", "", fmt.Errorf("inspect self: docker %d", resp.StatusCode)
	}
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
func (d *Docker) RunWatchtower(ctx context.Context, target string) error {
	image := UpdaterImage()
	if err := d.Pull(ctx, image); err != nil {
		return fmt.Errorf("pull updater image %s: %w", image, err)
	}
	body, _ := json.Marshal(map[string]any{
		"Image": image,
		"Cmd":   []string{"--run-once", "--cleanup", target},
		"HostConfig": map[string]any{
			"Binds":      []string{d.sock + ":/var/run/docker.sock"},
			"AutoRemove": true,
		},
	})
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
	start, err := d.do(ctx, http.MethodPost, "/containers/"+created.ID+"/start", nil)
	if err != nil {
		return err
	}
	defer start.Body.Close()
	if start.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(io.LimitReader(start.Body, 2048))
		return fmt.Errorf("start updater: docker %d %s", start.StatusCode, strings.TrimSpace(string(b)))
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
