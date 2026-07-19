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

	"tippani/internal/olog"
)

// browserUA is sent on Amazon requests — Amazon serves a bot wall to obvious
// non-browser agents. Still no guarantee: CAPTCHAs happen, which is why every
// Amazon call is strictly best-effort.
const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/122.0 Safari/537.36"

// maxHTMLBody caps a scraped product page (Amazon pages run ~1–2 MB).
const maxHTMLBody = 3 << 20

// AmazonCoverURL returns Amazon's public image-CDN URL for a book/Kindle cover
// keyed by ASIN (or a print ISBN-10). No auth needed — this host serves cover
// art openly. The `_SCLZZZZZZZ_` modifier asks for the LARGEST available scan:
// the bare `.01.jpg` hands back a small ~4 KB thumbnail, while `_SCLZZZZZZZ_`
// returns the full-size cover (typically 5× the bytes). A book Amazon doesn't
// stock comes back as a small "image unavailable" placeholder, so callers should
// prefer the widest candidate / let the user confirm before storing. Mirrored by
// amazonCoverURL in CoverPicker.jsx — keep the two in sync.
func AmazonCoverURL(asin string) string {
	asin = strings.TrimSpace(asin)
	if asin == "" {
		return ""
	}
	return "https://images-na.ssl-images-amazon.com/images/P/" + asin + ".01._SCLZZZZZZZ_.jpg"
}

// AmazonCoverByISBN returns Amazon's keyless, full-size cover URL for a print
// book by converting its ISBN-13 to the ISBN-10 that Amazon's image CDN indexes
// covers by — the trick book apps use for a hi-res cover when Google/OpenLibrary
// only offer a thumbnail. "" for a non-978 ISBN. A book Amazon doesn't stock
// comes back as a tiny placeholder the size floor rejects, so this is a
// high-quality source to TRY, not a guaranteed hit.
func AmazonCoverByISBN(isbn13 string) string {
	return AmazonCoverURL(ISBN13to10(isbn13))
}

var (
	ogTitleRe = regexp.MustCompile(`<meta\s+property="og:title"\s+content="([^"]*)"`)
	ogImageRe = regexp.MustCompile(`<meta\s+property="og:image"\s+content="([^"]*)"`)
	ogDescRe  = regexp.MustCompile(`<meta\s+property="og:description"\s+content="([^"]*)"`)

	// amazonSizeModRe matches the inline size modifier Amazon embeds in image
	// URLs (e.g. "._SY300_.jpg", "._AC_SX466_.jpg") so it can be stripped —
	// the modifier-less URL serves the original full-size scan.
	amazonSizeModRe = regexp.MustCompile(`\._[A-Za-z0-9,_]+_(\.[a-zA-Z]+)$`)
)

// AmazonFullSizeImage strips the size modifier from an Amazon image URL so the
// stored cover is the full-resolution original, not a ~300-500px variant.
// URLs without a modifier (and non-Amazon URLs) pass through unchanged.
// Exported so covers-refetch can upgrade cached add-time URLs too.
func AmazonFullSizeImage(u string) string {
	return amazonSizeModRe.ReplaceAllString(u, "$1")
}

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
		// Amazon errors are swallowed by the caller (best-effort source), so a
		// DEBUG trace is the only place they surface.
		olog.Tracef("[meta] amazon GET %s failed: %v", target, err)
		return nil, fmt.Errorf("amazon: %w", err)
	}
	defer resp.Body.Close()
	olog.Tracef("[meta] amazon GET %s -> %d", target, resp.StatusCode)
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
		CoverURL:    AmazonFullSizeImage(firstGroup(ogImageRe, page)),
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
