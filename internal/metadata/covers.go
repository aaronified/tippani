package metadata

import (
	"bytes"
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
	"regexp"
	"syscall"
	"time"
)

// coverHosts is the PLAN §6 allowlist: the only places cover/poster URLs from
// the metadata APIs may point. Checked on the initial URL and every redirect.
var coverHosts = map[string]bool{
	"covers.openlibrary.org":          true,
	"books.google.com":                true,
	"books.googleusercontent.com":     true,
	"image.tmdb.org":                  true, // TMDB posters + actor profile images
	"artworks.thetvdb.com":            true, // TVDB poster/series art + actor headshots
	"images-na.ssl-images-amazon.com": true, // cover-by-ASIN CDN
	"m.media-amazon.com":              true, // og:image host on product pages
	"commons.wikimedia.org":           true, // Wikidata P18 author photo (Special:FilePath entry point)
	"upload.wikimedia.org":            true, // ^ the redirect target that serves the actual image bytes
}

// olArchiveHost matches the Internet Archive node hosts OpenLibrary's cover
// service redirects to (covers.openlibrary.org → archive.org/download →
// iaNNNNNN.us.archive.org). Without them every OL cover fetch dies on the
// redirect hop with "host not allowed" — silently, since cover fetches are
// best-effort.
var olArchiveHost = regexp.MustCompile(`^ia\d+\.us\.archive\.org$`)

// allowedCoverHost is the coverHosts lookup plus the archive.org redirect
// targets OL covers resolve through.
func allowedCoverHost(host string) bool {
	return coverHosts[host] || host == "archive.org" || olArchiveHost.MatchString(host)
}

// fetchAllowAny disables the scheme/allowlist/private-IP guards so tests can
// point FetchImage at plain-http httptest servers on 127.0.0.1. Never set it
// outside tests.
var fetchAllowAny = false

// maxImageBytes is the PLAN §6 cover/poster size cap. 5 MB fits full-size
// provider art (TMDB `original` posters, Amazon unmodified scans) that the old
// 2 MB cap rejected.
const maxImageBytes = 10 << 20

// minImageBytes rejects tracking-pixel placeholders — notably Amazon's "no
// image available" 1×1 GIF (~tens of bytes) served with HTTP 200 for an ASIN
// that has no cover. Real covers are always kilobytes.
const minImageBytes = 512

// imageExt: only these sniffed types are accepted. The stored extension comes
// from the sniff, never from the URL. SVG is included for uploaded stickers —
// http.DetectContentType can't recognise it, so sniffImageType handles it
// separately (and the serve path sandboxes SVG against script execution).
var imageExt = map[string]string{
	"image/jpeg":    ".jpg",
	"image/png":     ".png",
	"image/webp":    ".webp",
	"image/gif":     ".gif",
	"image/svg+xml": ".svg",
}

// minSVGBytes floors SVG uploads well below minImageBytes: a legitimate vector
// sticker (a single path) can be a few hundred bytes, so the raster
// placeholder floor would wrongly reject it. This only rejects empty/blank files.
const minSVGBytes = 48

// sniffImageType classifies image bytes. It trusts http.DetectContentType for
// the raster types, then falls back to a lightweight SVG probe: SVG documents
// sniff as text/xml or text/plain, so DetectContentType never returns
// image/svg+xml on its own. Returns "" if it looks like nothing we accept.
func sniffImageType(data []byte) string {
	switch ct := http.DetectContentType(data); ct {
	case "image/jpeg", "image/png", "image/webp", "image/gif":
		return ct
	}
	if looksLikeSVG(data) {
		return "image/svg+xml"
	}
	return ""
}

// looksLikeSVG reports whether data is an SVG document: after skipping leading
// whitespace, a UTF-8 BOM, an XML prolog, a doctype, and comments, the first
// element must be <svg. Anchoring to the document root (not just "contains
// <svg") stops an HTML page with an inline <svg> from passing as an image.
func looksLikeSVG(data []byte) bool {
	if len(data) > 4096 {
		data = data[:4096]
	}
	s := bytes.TrimPrefix(data, []byte("\xef\xbb\xbf")) // strip a UTF-8 BOM
	s = bytes.TrimLeft(s, " \t\r\n")
	lower := bytes.ToLower(s)
	// Skip any number of leading <?xml ...?>, <!doctype ...>, <!-- ... --> nodes.
	for {
		switch {
		case bytes.HasPrefix(lower, []byte("<?xml")):
			i := bytes.IndexByte(lower, '>')
			if i < 0 {
				return false
			}
			lower = bytes.TrimLeft(lower[i+1:], " \t\r\n")
		case bytes.HasPrefix(lower, []byte("<!--")):
			i := bytes.Index(lower, []byte("-->"))
			if i < 0 {
				return false
			}
			lower = bytes.TrimLeft(lower[i+3:], " \t\r\n")
		case bytes.HasPrefix(lower, []byte("<!doctype")):
			i := bytes.IndexByte(lower, '>')
			if i < 0 {
				return false
			}
			lower = bytes.TrimLeft(lower[i+1:], " \t\r\n")
		default:
			return bytes.HasPrefix(lower, []byte("<svg"))
		}
	}
}

// FetchImage downloads a cover/poster from an API-sourced URL: full PLAN §6
// SSRF guard including the host allowlist. Use this for URLs that came from our
// own metadata lookups (Google/OL/TMDB).
func FetchImage(ctx context.Context, rawURL, destDir string) (string, error) {
	return fetchImage(ctx, rawURL, destDir, false)
}

// FetchUserImage downloads a cover/poster from a URL the user typed. It drops
// the host allowlist (the user may paste any image host) but keeps every other
// guard: private/loopback/link-local IPs are still refused at connect time
// (so cloud-metadata and intranet URLs can't be reached), size cap, image
// sniff, redirect limit. http is permitted here since the IP guard, not the
// scheme, is what stops SSRF.
func FetchUserImage(ctx context.Context, rawURL, destDir string) (string, error) {
	return fetchImage(ctx, rawURL, destDir, true)
}

// fetchImage downloads an image into destDir and returns the stored filename
// (16 hex chars + sniffed extension). anyHost drops only the host allowlist
// (and the https-only rule); the private-IP dial guard, size cap, sniff, and
// redirect limit always apply.
func fetchImage(ctx context.Context, rawURL, destDir string, anyHost bool) (string, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("cover fetch: %w", err)
	}
	if err := checkCoverURL(u, anyHost); err != nil {
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
			return checkCoverURL(req.URL, anyHost)
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

	// Read one byte past the cap so a too-big body is distinguishable from one
	// that is exactly at the cap.
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxImageBytes+1))
	if err != nil {
		return "", fmt.Errorf("cover fetch: %w", err)
	}
	name, err := StoreImage(data, destDir)
	if err != nil {
		return "", fmt.Errorf("cover fetch: %w", err)
	}
	return name, nil
}

// StoreImage validates in-memory image bytes (size cap + content sniff) and
// writes them into destDir under a server-generated name (16 hex chars +
// sniffed extension — nothing caller-controlled touches the path). Used for
// user file uploads, which never hit the network so skip the SSRF guards.
func StoreImage(data []byte, destDir string) (string, error) {
	return StoreImageMax(data, destDir, maxImageBytes)
}

// StoreImageMax is StoreImage with a caller-chosen upper size cap — avatars
// allow a larger upload than covers. destDir and the generated name are still
// server-controlled, so nothing caller-supplied ever touches the path.
func StoreImageMax(data []byte, destDir string, max int) (string, error) {
	if len(data) > max {
		return "", fmt.Errorf("image exceeds %d bytes", max)
	}
	ct := sniffImageType(data)
	ext, ok := imageExt[ct]
	if !ok {
		return "", errors.New("not an accepted image type")
	}
	if ct == "image/svg+xml" {
		if len(data) < minSVGBytes {
			return "", errors.New("image too small (placeholder/blank)")
		}
		// Defence in depth: refuse scripted SVG at rest. The serve path also
		// sandboxes SVG (CSP), but a script-free file can't attack anything even
		// if a future viewer renders it directly.
		if bytes.Contains(bytes.ToLower(data), []byte("<script")) {
			return "", errors.New("scripted SVG is not allowed")
		}
	} else if len(data) < minImageBytes {
		return "", errors.New("image too small (placeholder/blank)")
	}
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

// checkCoverURL enforces the scheme + host allowlist, on the initial URL and
// (via CheckRedirect) on every redirect target. When anyHost is set (user-typed
// URLs) the host allowlist is skipped and http is tolerated — the private-IP
// dial guard remains the real SSRF barrier.
func checkCoverURL(u *url.URL, anyHost bool) error {
	if fetchAllowAny {
		return nil
	}
	if anyHost {
		if u.Scheme != "https" && u.Scheme != "http" {
			return fmt.Errorf("cover fetch: %q: http(s) required", u)
		}
		return nil
	}
	if u.Scheme != "https" {
		return fmt.Errorf("cover fetch: %q: https required", u)
	}
	if !allowedCoverHost(u.Hostname()) {
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
