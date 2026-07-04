package metadata

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"syscall"
	"time"
)

// coverHosts is the PLAN §6 allowlist: the only places cover/poster URLs from
// the metadata APIs may point. Checked on the initial URL and every redirect.
var coverHosts = map[string]bool{
	"covers.openlibrary.org":      true,
	"books.google.com":            true,
	"books.googleusercontent.com": true,
	"image.tmdb.org":              true,
}

// fetchAllowAny disables the scheme/allowlist/private-IP guards so tests can
// point FetchImage at plain-http httptest servers on 127.0.0.1. Never set it
// outside tests.
var fetchAllowAny = false

// maxImageBytes is the PLAN §6 cover/poster size cap.
const maxImageBytes = 2 << 20

// imageExt: only these sniffed types are accepted. The stored extension comes
// from the sniff, never from the URL.
var imageExt = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// FetchImage downloads a cover/poster into destDir and returns the stored
// filename (16 hex chars + sniffed extension). Full PLAN §6 SSRF guard:
// https-only allowlisted hosts (re-checked on each redirect, max 2),
// private/loopback IPs blocked at connect time, 2 MB cap, 10 s timeout.
func FetchImage(ctx context.Context, rawURL, destDir string) (string, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("cover fetch: %w", err)
	}
	if err := checkCoverURL(u); err != nil {
		return "", err
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			// Control runs after DNS resolution, on the address actually
			// dialed — a host that re-resolves to something internal between
			// check and connect (DNS rebinding) is still refused.
			DialContext: (&net.Dialer{Control: blockPrivateAddr}).DialContext,
		},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) > 2 {
				return errors.New("cover fetch: stopped after 2 redirects")
			}
			return checkCoverURL(req.URL)
		},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", fmt.Errorf("cover fetch: %w", err)
	}
	req.Header.Set("User-Agent", userAgent)
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("cover fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("cover fetch: status %d", resp.StatusCode)
	}

	// Read one byte past the cap so a too-big body is distinguishable from an
	// exactly-2MB one.
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxImageBytes+1))
	if err != nil {
		return "", fmt.Errorf("cover fetch: %w", err)
	}
	if len(data) > maxImageBytes {
		return "", fmt.Errorf("cover fetch: image exceeds %d bytes", maxImageBytes)
	}
	ext, ok := imageExt[http.DetectContentType(data)]
	if !ok {
		return "", errors.New("cover fetch: not an accepted image type")
	}

	// Server-generated name (PLAN §6) — nothing attacker-controlled touches
	// the filesystem path.
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	name := hex.EncodeToString(b[:]) + ext
	if err := os.WriteFile(filepath.Join(destDir, name), data, 0o644); err != nil {
		return "", err
	}
	return name, nil
}

// checkCoverURL enforces https + host allowlist, on the initial URL and (via
// CheckRedirect) on every redirect target.
func checkCoverURL(u *url.URL) error {
	if fetchAllowAny {
		return nil
	}
	if u.Scheme != "https" {
		return fmt.Errorf("cover fetch: %q: https required", u)
	}
	if !coverHosts[u.Hostname()] {
		return fmt.Errorf("cover fetch: host %q not allowed", u.Hostname())
	}
	return nil
}

// blockPrivateAddr is the net.Dialer.Control hook: refuse connects to
// loopback/private/link-local/unspecified addresses.
func blockPrivateAddr(_, address string, _ syscall.RawConn) error {
	if fetchAllowAny {
		return nil
	}
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return err
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return fmt.Errorf("cover fetch: unexpected dial address %q", address)
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
		return fmt.Errorf("cover fetch: refusing private address %s", ip)
	}
	return nil
}
