// Package metadata implements the on-demand outbound lookups of PLAN §6:
// Google Books + Open Library for books, TMDB for movies, plus the
// SSRF-guarded local cover/poster fetcher. Plain net/http JSON clients —
// no SDKs, no new deps.
//
// Outbound hygiene, applied to every request: shared descriptive User-Agent,
// 10 s client timeout, io.LimitReader on bodies, typed decoding tolerant of
// missing fields.
package metadata

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"tippani/internal/olog"
)

// userAgent identifies us on all outbound calls; Open Library grants 3 req/s
// (vs 1) to descriptive agents (PLAN §6).
const userAgent = "tippani/1.0 (+https://github.com/aaronified/tippani)"

// maxJSONBody caps metadata responses. TMDB details+credits is ~100 KB;
// 4 MB is generous headroom, not a real payload we expect.
const maxJSONBody = 4 << 20

var httpClient = &http.Client{Timeout: 10 * time.Second}

// httpGet performs one hygienic outbound GET and returns body + HTTP status.
// bearer, when non-empty, is sent as an Authorization: Bearer header (TMDB v4).
func httpGet(ctx context.Context, url, bearer string) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("User-Agent", userAgent)
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		// TIPPANI_LOG_LEVEL=debug surfaces every outbound call and its outcome —
		// this is how "which provider, what status" becomes visible when a lookup
		// 502s. A no-op at normal levels.
		olog.Tracef("[meta] GET %s failed: %v", redactURL(url), err)
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxJSONBody))
	if err != nil {
		olog.Tracef("[meta] GET %s -> %d, body read failed: %v", redactURL(url), resp.StatusCode, err)
		return nil, 0, err
	}
	olog.Tracef("[meta] GET %s -> %d (%d bytes)", redactURL(url), resp.StatusCode, len(body))
	return body, resp.StatusCode, nil
}

// redactURL hides provider secrets before a URL goes into a trace line: the v3
// TMDB key (api_key=) and Google Books key (key=) travel in the query string.
// The v4 TMDB token and TVDB JWT travel in the Authorization header and never
// reach a trace. Best-effort: an unparseable URL is returned as-is.
func redactURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	q := u.Query()
	redacted := false
	for _, k := range []string{"api_key", "key"} {
		if q.Has(k) {
			q.Set(k, "***")
			redacted = true
		}
	}
	if !redacted {
		return raw // leave the URL byte-for-byte when there's nothing to hide
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// leadingYear extracts the year from API dates like "2004-04-14" or "2004".
func leadingYear(s string) int {
	if len(s) < 4 {
		return 0
	}
	y, err := strconv.Atoi(s[:4])
	if err != nil {
		return 0
	}
	return y
}

// httpsURL upgrades http:// links (Google Books thumbnails come plain-http)
// so they pass the https-only cover fetch guard.
func httpsURL(u string) string {
	if rest, ok := strings.CutPrefix(u, "http://"); ok {
		return "https://" + rest
	}
	return u
}
