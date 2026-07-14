// Package updater backs the in-app "check for updates / update now" button
// (Settings, admin). Two concerns, kept small and dependency-free:
//
//   - the GitHub side (this file): fetch the latest release and compare it to
//     the running version with a lenient semver compare;
//   - the Docker side (docker.go): a tiny Engine-API client over the unix
//     socket that pulls the new image and runs a one-shot Watchtower to
//     recreate this container.
//
// The update check is strictly on demand (a click) — Tippani never phones home
// on its own.
package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// DefaultGitHubAPI is the public API base; the handler passes it in (and tests
// point it at an httptest server) so nothing here reaches the network implicitly.
const DefaultGitHubAPI = "https://api.github.com"

// Release is the subset of a GitHub release we surface.
type Release struct {
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	HTMLURL     string `json:"html_url"`
	PublishedAt string `json:"published_at"`
}

// LatestRelease fetches the newest published release of owner/repo. Short
// timeout; a non-200 (rate limit, no releases yet, offline) is surfaced as an
// error the caller reports without failing the whole request.
func LatestRelease(ctx context.Context, apiBase, repo string) (*Release, error) {
	url := fmt.Sprintf("%s/repos/%s/releases/latest", strings.TrimRight(apiBase, "/"), repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "tippani-update-check")
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github returned %d", resp.StatusCode)
	}
	var r Release
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, err
	}
	if r.TagName == "" {
		return nil, fmt.Errorf("release has no tag")
	}
	return &r, nil
}

// parseSemver turns "v1.2.3" / "1.2" into a 3-tuple; ok=false for a non-semver
// version string (dev, edge, a short sha) so the caller won't assert on it.
func parseSemver(s string) ([3]int, bool) {
	s = strings.TrimPrefix(strings.TrimSpace(s), "v")
	if i := strings.IndexAny(s, "-+"); i >= 0 { // drop prerelease/build metadata
		s = s[:i]
	}
	if s == "" {
		return [3]int{}, false
	}
	parts := strings.Split(s, ".")
	if len(parts) > 3 {
		return [3]int{}, false
	}
	var out [3]int
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil {
			return [3]int{}, false
		}
		out[i] = n
	}
	return out, true
}

// Compare returns -1/0/1 for current vs latest and ok=true only when both are
// semver. A "dev"/"edge" current (ok=false) means "can't assert up-to-date" —
// the caller offers the update if a released latest exists.
func Compare(current, latest string) (cmp int, ok bool) {
	a, oka := parseSemver(current)
	b, okb := parseSemver(latest)
	if !oka || !okb {
		return 0, false
	}
	for i := 0; i < 3; i++ {
		switch {
		case a[i] < b[i]:
			return -1, true
		case a[i] > b[i]:
			return 1, true
		}
	}
	return 0, true
}

// UpdateAvailable decides whether to offer an update given the running version
// and the latest release tag. A semver current older than latest → yes. A
// non-semver current (dev/edge) → yes whenever a released latest exists, since
// we can't prove it's current.
func UpdateAvailable(current, latestTag string) bool {
	if cmp, ok := Compare(current, latestTag); ok {
		return cmp < 0
	}
	return latestTag != ""
}
