package metadata

// Picture search — the sources that answer "show me some images of this thing"
// as against "tell me about this record".
//
// EVERY OTHER LOOKUP IN THIS PACKAGE IS A CATALOGUE LOOKUP. Google Books, Open
// Library, TMDB, TheTVDB and IGDB are asked about a WORK and hand back a record
// that happens to carry one piece of art — the publisher's cover, the
// distributor's poster. That is the right shape for adding a book and the wrong
// shape for the two cases readers actually get stuck on: a title the catalogue
// has under different art from the copy on the shelf, and a PERSON, for whom
// there is no keyless portrait API at all. The people console has been sending
// readers out to a web image search in a browser tab and asking them to paste an
// address back — which is the app admitting the gap in the interface.
//
// So these two are picture sources rather than record sources:
//
//	Google Programmable Search (Custom Search JSON API, searchType=image) — an
//	image search with a documented API and a key the reader owns. It needs a key
//	AND a search-engine id, which is why it is off until both are set: there is
//	no keyless mode of it to fall back to.
//
//	Amazon — two different things under one name. The IMAGE CDN is keyless and
//	needs no permission at all: a print ISBN or an ASIN addresses a cover
//	directly (AmazonCoverByISBN), which is why a book with an ISBN can be offered
//	Amazon art with nothing configured. The SEARCH PAGE is a scrape, opt-in
//	behind the same stored cookie FetchAmazonBook already requires, and is the
//	only way to reach a poster or a boxed set that has no ISBN.
//
// BEST-EFFORT THROUGHOUT. Each source's failure is its own: a CAPTCHA from
// Amazon or a spent Google quota returns no hits and never an error that would
// hide the sources that did answer.

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"tippani/internal/olog"
)

// Test seams: real endpoints in production, httptest servers in tests.
var (
	googleCSEBase = "https://www.googleapis.com"
	amazonBase    = "" // "" means "use the marketplace domain the caller passed"
)

// ImageHit is one picture offered to the reader.
//
// TWO URLS, AND THE SECOND IS NOT A CONVENIENCE. `URL` is the full-size image
// and is what gets stored; `Thumb` is what the picker DRAWS. They differ because
// the page's Content-Security-Policy names the hosts an <img> may load from, and
// a web image search returns whatever host the picture lives on — which cannot
// be enumerated in advance. Google's own thumbnail host can be, so the strip
// previews the thumbnail and the server fetches the original, where no CSP
// applies. A source whose full-size host is already allowed (Amazon's CDN)
// leaves Thumb empty and the picker draws the real thing.
type ImageHit struct {
	URL    string `json:"url"`
	Thumb  string `json:"thumb,omitempty"`
	Source string `json:"source"` // google | amazon
}

// maxImageHits caps a strip. A picker is a short list somebody looks at, and the
// twentieth candidate has never been the one.
const maxImageHits = 12

// GoogleImageSearch runs one Custom Search image query. Both halves of the
// credential are required — a key with no engine id searches nothing, and the
// API answers 400 rather than falling back to a default engine.
func GoogleImageSearch(ctx context.Context, key, cx, query string, n int) ([]ImageHit, error) {
	key, cx, query = strings.TrimSpace(key), strings.TrimSpace(cx), strings.TrimSpace(query)
	if key == "" || cx == "" || query == "" {
		return nil, nil
	}
	if n <= 0 || n > 10 {
		n = 10 // the API's own per-request maximum
	}
	u := fmt.Sprintf("%s/customsearch/v1?key=%s&cx=%s&searchType=image&safe=active&num=%d&q=%s",
		googleCSEBase, url.QueryEscape(key), url.QueryEscape(cx), n, url.QueryEscape(query))
	body, status, err := httpGet(ctx, u, "")
	if err != nil {
		return nil, fmt.Errorf("google images: %w", err)
	}
	if status == http.StatusTooManyRequests || status == http.StatusForbidden {
		// The daily free allowance is 100 queries. Named rather than folded into
		// "status 4xx", because it is the failure this source will actually have
		// and the remedy is a different one (wait, or raise the quota).
		return nil, fmt.Errorf("google images: quota or key rejected (status %d)", status)
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("google images: status %d", status)
	}
	var out struct {
		Items []struct {
			Link  string `json:"link"`
			Image struct {
				ThumbnailLink string `json:"thumbnailLink"`
			} `json:"image"`
		} `json:"items"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("google images: %w", err)
	}
	var hits []ImageHit
	for _, it := range out.Items {
		if !strings.HasPrefix(it.Link, "https://") {
			continue // an http image would be blocked on the way in anyway
		}
		hits = append(hits, ImageHit{URL: it.Link, Thumb: it.Image.ThumbnailLink, Source: "google"})
	}
	return hits, nil
}

// amazonImageRe matches the product images Amazon serves from its own CDN. The
// id is what varies; the size modifier is stripped by AmazonFullSizeImage so the
// stored file is the original scan rather than a search-results thumbnail.
var amazonImageRe = regexp.MustCompile(`https://m\.media-amazon\.com/images/I/[A-Za-z0-9%+._-]+\.(?:jpg|png|webp)`)

// AmazonImageSearch scrapes one search-results page for product art.
//
// OPT-IN, and gated on the same stored cookie FetchAmazonBook requires — not
// because the search page always demands one, but because scraping Amazon is a
// thing the reader has to have agreed to once, and the cookie is where that
// agreement is recorded. Fragile by nature: markup rotates, CAPTCHAs happen, and
// a page we cannot read returns no hits rather than an error.
func AmazonImageSearch(ctx context.Context, query, cookie, domain string, n int) ([]ImageHit, error) {
	query = strings.TrimSpace(query)
	if query == "" || strings.TrimSpace(cookie) == "" {
		return nil, nil
	}
	if n <= 0 || n > maxImageHits {
		n = maxImageHits
	}
	base := amazonBase
	if base == "" {
		d := strings.TrimSpace(domain)
		if d == "" {
			d = "www.amazon.com"
		}
		base = "https://" + d
	}
	u := base + "/s?k=" + url.QueryEscape(query)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", browserUA)
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Cookie", cookie)
	resp, err := httpClient.Do(req)
	if err != nil {
		olog.Tracef("[meta] amazon image search failed: %v", err)
		return nil, nil // best-effort: a blocked scrape is not an error worth surfacing
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		olog.Tracef("[meta] amazon image search -> %d", resp.StatusCode)
		return nil, nil
	}
	page, err := io.ReadAll(io.LimitReader(resp.Body, maxHTMLBody))
	if err != nil {
		return nil, nil
	}
	seen := map[string]bool{}
	var hits []ImageHit
	for _, m := range amazonImageRe.FindAllString(string(page), -1) {
		full := AmazonFullSizeImage(m)
		if seen[full] {
			continue
		}
		seen[full] = true
		hits = append(hits, ImageHit{URL: full, Source: "amazon"})
		if len(hits) >= n {
			break
		}
	}
	return hits, nil
}

// ImageIsReal reports whether a URL actually serves an image with bytes in it.
//
// THIS EXISTS FOR ONE SOURCE AND ONE FAILURE. Amazon's image CDN answers 200 for
// an ISBN it has never stocked and serves a placeholder of a few dozen bytes, so
// an unchecked cover-by-ISBN candidate is offered to every book in the library
// and is a blank frame for most of them. The size floor is the same one
// StoreImage applies, checked before the reader is shown the option rather than
// after they have picked it.
func ImageIsReal(ctx context.Context, rawURL string) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, rawURL, nil)
	if err != nil {
		return false
	}
	req.Header.Set("User-Agent", userAgent)
	resp, err := httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false
	}
	if !strings.HasPrefix(resp.Header.Get("Content-Type"), "image/") {
		return false
	}
	// A HEAD with no length is not evidence of a placeholder, so it passes: the
	// store path still applies the floor, and refusing here would drop real art
	// from any host that answers without one.
	if n := resp.ContentLength; n >= 0 && n < minImageBytes {
		return false
	}
	return true
}
