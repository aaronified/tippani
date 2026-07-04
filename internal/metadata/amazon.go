package metadata

import (
	"context"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
)

// browserUA is sent on Amazon requests — Amazon serves a bot wall to obvious
// non-browser agents. Still no guarantee: CAPTCHAs happen, which is why every
// Amazon call is strictly best-effort.
const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/122.0 Safari/537.36"

// maxHTMLBody caps a scraped product page (Amazon pages run ~1–2 MB).
const maxHTMLBody = 3 << 20

// AmazonCoverURL returns Amazon's public image-CDN URL for a book/Kindle cover
// keyed by ASIN. No auth needed — this host serves cover art openly. A missing
// image comes back as a tiny placeholder, so callers should let the user
// visually confirm the cover before storing it.
func AmazonCoverURL(asin string) string {
	asin = strings.TrimSpace(asin)
	if asin == "" {
		return ""
	}
	return "https://images-na.ssl-images-amazon.com/images/P/" + asin + ".01._SCLZZZZZZZ_.jpg"
}

var (
	ogTitleRe = regexp.MustCompile(`<meta\s+property="og:title"\s+content="([^"]*)"`)
	ogImageRe = regexp.MustCompile(`<meta\s+property="og:image"\s+content="([^"]*)"`)
	ogDescRe  = regexp.MustCompile(`<meta\s+property="og:description"\s+content="([^"]*)"`)
)

// FetchAmazonBook scrapes an Amazon product page for a book/Kindle ASIN using
// the user's own session cookie. It is deliberately minimal and fragile-proof:
// it reads only the stable og: meta tags (title, cover, description) with a
// regex, no HTML-parser dependency. Amazon rotates markup and serves CAPTCHAs,
// so this is strictly best-effort — an unreadable page returns an explanatory
// error rather than partial garbage. domain is the marketplace host, e.g.
// "www.amazon.com" or "www.amazon.de". Only ever called on explicit admin
// opt-in with a stored cookie (PLAN §6 / Settings).
func FetchAmazonBook(ctx context.Context, asin, cookie, domain string) (*BookCandidate, error) {
	asin = strings.TrimSpace(asin)
	if asin == "" {
		return nil, fmt.Errorf("amazon: asin required")
	}
	if domain == "" {
		domain = "www.amazon.com"
	}
	target := "https://" + domain + "/dp/" + url.PathEscape(asin)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, fmt.Errorf("amazon: %w", err)
	}
	req.Header.Set("Cookie", cookie)
	req.Header.Set("User-Agent", browserUA)
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("amazon: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("amazon: status %d (cookie may be expired)", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxHTMLBody))
	if err != nil {
		return nil, fmt.Errorf("amazon: %w", err)
	}
	page := string(body)

	title := firstGroup(ogTitleRe, page)
	if title == "" {
		// No product og:title => almost certainly a login/CAPTCHA interstitial.
		return nil, fmt.Errorf("amazon: couldn't read the product page — the cookie may be expired or Amazon served a CAPTCHA")
	}
	return &BookCandidate{
		Source:      "amazon",
		SourceID:    asin,
		Title:       title,
		Description: firstGroup(ogDescRe, page),
		CoverURL:    firstGroup(ogImageRe, page),
	}, nil
}

// firstGroup returns the unescaped first capture group, trimmed, or "".
func firstGroup(re *regexp.Regexp, s string) string {
	m := re.FindStringSubmatch(s)
	if len(m) < 2 {
		return ""
	}
	return strings.TrimSpace(html.UnescapeString(m[1]))
}
