// Package updater backs the in-app "check for updates / update now" button
// (Settings, admin). Two concerns, kept small and dependency-free:
//
//   - the GitHub side (this file): fetch the latest release and compare it to
//     the running version with a lenient semver compare;
//   - the Docker side (docker.go): a tiny Engine-API client — over the mounted
//     unix socket or a docker-socket-proxy (TIPPANI_DOCKER_HOST=tcp://…) — that
//     pulls the new image and runs a one-shot Watchtower to recreate this
//     container.
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
	Prerelease  bool   `json:"prerelease"`
	Draft       bool   `json:"draft"`
}

// LatestRelease fetches the newest published release of owner/repo. Short
// timeout; a non-200 (rate limit, no releases yet, offline) is surfaced as an
// error the caller reports without failing the whole request.
//
// includePre switches CHANNEL. Off, this asks GitHub for /releases/latest,
// which by GitHub's own definition skips pre-releases — the stable line. On, it
// reads the release LIST and takes the highest-ranked entry, pre-release or
// not, because somebody testing a run-up wants the next run-up. The list is
// ranked by version and not by publication date: back-dated tags and
// out-of-order publishing are both real, and on 2026-08-09 a late-finishing
// v1.3.0 build already cost this project a `:latest` that meant 1.3.0 (see
// docker-publish.yml). Draft releases are skipped — they are not published.
func LatestRelease(ctx context.Context, apiBase, repo string, includePre bool) (*Release, error) {
	if includePre {
		return latestOfAny(ctx, apiBase, repo)
	}
	var r Release
	if err := getJSON(ctx, fmt.Sprintf("%s/repos/%s/releases/latest", strings.TrimRight(apiBase, "/"), repo), &r); err != nil {
		return nil, err
	}
	if r.TagName == "" {
		return nil, fmt.Errorf("release has no tag")
	}
	return &r, nil
}

// latestOfAny ranks every published release and returns the highest. A tag
// nothing here can parse (a date stamp, a code name) cannot be ranked, so it
// only wins when NOTHING ranked — otherwise one unparseable tag would outrank
// the whole list or be silently dropped from it, and both have been bugs
// elsewhere in this file.
func latestOfAny(ctx context.Context, apiBase, repo string) (*Release, error) {
	var list []Release
	if err := getJSON(ctx, fmt.Sprintf("%s/repos/%s/releases?per_page=30", strings.TrimRight(apiBase, "/"), repo), &list); err != nil {
		return nil, err
	}
	var best, firstAny *Release
	for i := range list {
		rel := &list[i]
		if rel.Draft || rel.TagName == "" {
			continue
		}
		if firstAny == nil {
			firstAny = rel
		}
		if _, _, ok := parseSemver(rel.TagName); !ok {
			continue
		}
		if best == nil {
			best = rel
			continue
		}
		if cmp, ok := Compare(best.TagName, rel.TagName); ok && cmp < 0 {
			best = rel
		}
	}
	if best == nil {
		best = firstAny
	}
	if best == nil {
		return nil, fmt.Errorf("no published releases")
	}
	return best, nil
}

func getJSON(ctx context.Context, url string, into any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "tippani-update-check")
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("github returned %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(into)
}

// parseSemver turns "v1.2.3" / "1.2" / "v3.0.0-rc.1" into a 3-tuple plus the
// dot-separated pre-release identifiers; ok=false for a non-semver version
// string (dev, edge, edge-v3, a short sha) so the caller won't assert on it.
// Build metadata after "+" is ignored, as semver says it must be.
func parseSemver(s string) (nums [3]int, pre []string, ok bool) {
	s = strings.TrimPrefix(strings.TrimSpace(s), "v")
	if i := strings.IndexByte(s, '+'); i >= 0 { // build metadata never orders
		s = s[:i]
	}
	if i := strings.IndexByte(s, '-'); i >= 0 {
		if rest := s[i+1:]; rest != "" {
			pre = strings.Split(rest, ".")
		}
		s = s[:i]
	}
	if s == "" {
		return [3]int{}, nil, false
	}
	parts := strings.Split(s, ".")
	if len(parts) > 3 {
		return [3]int{}, nil, false
	}
	var out [3]int
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil {
			return [3]int{}, nil, false
		}
		out[i] = n
	}
	return out, pre, true
}

// comparePre orders the pre-release part of two equal version numbers by
// semver's rule: HAVING one makes you older, since 3.0.0-rc.1 is a run-up to
// 3.0.0 and not a successor to it. Within two pre-releases the identifiers are
// compared left to right — numeric ones numerically (so rc.10 follows rc.9,
// which a string compare gets backwards), numeric before alphanumeric, and a
// shorter run of identifiers before a longer one that starts the same.
func comparePre(a, b []string) int {
	switch {
	case len(a) == 0 && len(b) == 0:
		return 0
	case len(a) == 0: // a is the release, b a run-up to it
		return 1
	case len(b) == 0:
		return -1
	}
	for i := 0; i < len(a) && i < len(b); i++ {
		x, xerr := strconv.Atoi(a[i])
		y, yerr := strconv.Atoi(b[i])
		switch {
		case xerr == nil && yerr == nil:
			if x != y {
				return sign(x - y)
			}
		case xerr == nil: // numeric identifiers rank below alphanumeric ones
			return -1
		case yerr == nil:
			return 1
		default:
			if a[i] != b[i] {
				return sign(strings.Compare(a[i], b[i]))
			}
		}
	}
	return sign(len(a) - len(b))
}

func sign(n int) int {
	switch {
	case n < 0:
		return -1
	case n > 0:
		return 1
	}
	return 0
}

// Compare returns -1/0/1 for current vs latest and ok=true only when both are
// semver. A "dev"/"edge" current (ok=false) means "can't assert up-to-date" —
// the caller offers the update if a released latest exists.
func Compare(current, latest string) (cmp int, ok bool) {
	a, apre, oka := parseSemver(current)
	b, bpre, okb := parseSemver(latest)
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
	return comparePre(apre, bpre), true
}

// IsPrerelease reports whether a version string is a semver pre-release —
// "3.0.0-edge.f7ddba5", "3.0.0-rc.1". Used to decide the DEFAULT channel: a
// build that is itself a run-up is already on the pre-release line, and asking
// somebody who deliberately installed :v3 to go and tick a box before the
// update card can see the rc they are waiting for is a step with no decision
// in it. "dev" and "edge" are not pre-releases: they are unplaceable, which is
// a different thing and stays on the stable channel.
func IsPrerelease(version string) bool {
	_, pre, ok := parseSemver(version)
	return ok && len(pre) > 0
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
