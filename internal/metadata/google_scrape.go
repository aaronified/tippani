package metadata

// The last rung: Google's image results read off the page rather than through
// the API.
//
// IT IS THE BOTTOM OF THE LADDER AND SHOULD STAY THERE. Programmable Search is
// the same company's same index with a contract attached — a key, a quota, a
// documented response — and anybody who has configured it never reaches this
// code. This exists for the install that has configured nothing, where the
// alternative is not "a worse picture" but "no picture and a browser tab".
//
// OPT-IN, FOR A REASON THAT IS THE READER'S TO WEIGH. The Amazon scrape is
// gated on a stored cookie, which doubles as the record that somebody agreed to
// it. There is no equivalent credential here — scraping Google needs nothing —
// so the agreement has to be its own setting. It is worth asking for: the
// requests come from the SERVER's address, so being rate-limited or served a
// consent wall is a consequence for the whole household and not for the person
// who pressed the button. A self-hosted app should not spend its owner's IP
// reputation without being told to.
//
// FRAGILE ON PURPOSE, like every scrape here: the markup rotates, a consent
// interstitial is common in the EU, and anything unreadable returns no hits
// rather than an error. The regex takes only the thumbnail host Google serves
// encrypted previews from, which is a far more stable thing than the page around
// it — and it is already an allowed <img> host, because the Custom Search rung
// previews from exactly the same place.

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"tippani/internal/olog"
)

var googleScrapeBase = "https://www.google.com"

// gstaticThumbRe matches the encrypted-thumbnail URLs Google embeds in an image
// results page. Deliberately NOT a match for arbitrary image URLs on the page:
// those are other people's hosts, unenumerable in advance, and a hit whose
// preview cannot be drawn is a blank tile in the strip.
var gstaticThumbRe = regexp.MustCompile(`https://encrypted-tbn\d\.gstatic\.com/images\?[A-Za-z0-9%&;=_:./+-]+`)

// GoogleImageScrape reads one image-results page. `enabled` is the reader's
// explicit opt-in and is checked here rather than at the call site so that
// forgetting it cannot silently turn scraping on.
func GoogleImageScrape(ctx context.Context, query string, enabled bool, n int) []ImageHit {
	query = strings.TrimSpace(query)
	if !enabled || query == "" {
		return nil
	}
	if n <= 0 || n > maxImageHits {
		n = maxImageHits
	}
	u := googleScrapeBase + "/search?tbm=isch&safe=active&q=" + url.QueryEscape(query)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", browserUA)
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	resp, err := httpClient.Do(req)
	if err != nil {
		olog.Tracef("[meta] google image scrape failed: %v", err)
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		olog.Tracef("[meta] google image scrape -> %d", resp.StatusCode)
		return nil
	}
	page, err := io.ReadAll(io.LimitReader(resp.Body, maxHTMLBody))
	if err != nil {
		return nil
	}
	seen := map[string]bool{}
	var hits []ImageHit
	for _, m := range gstaticThumbRe.FindAllString(string(page), -1) {
		m = strings.ReplaceAll(m, "&amp;", "&")
		if seen[m] {
			continue
		}
		seen[m] = true
		// THE SAME URL IN BOTH SLOTS, and that is honest rather than lazy. A
		// results page gives us the thumbnail and not the original — the original
		// lives on whatever host published it, which this deliberately does not
		// scrape — so the picture offered IS the picture stored. Saying so here
		// means the picker draws exactly what it will keep.
		hits = append(hits, ImageHit{URL: m, Thumb: m, Source: "google"})
		if len(hits) >= n {
			break
		}
	}
	return hits
}
