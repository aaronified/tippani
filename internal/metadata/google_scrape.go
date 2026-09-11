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
	"strconv"
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
//
// IT RETURNS A REASON AS WELL AS HITS, AND THAT IS THE WHOLE OF THE SECOND RETURN.
// Every way this can fail used to end at `return nil`: a refused connection, a 429,
// a consent interstitial and an honest miss all produced the same empty slice. So
// the owner's report — "google photo search is yielding zero results, zilch" —
// could not be answered from inside the app at all, by them or by anybody reading
// the code, because the four causes are four different things to do and the app had
// thrown away which one it was.
//
// THE REASON IS SHORT AND IS NOT A TRANSLATED STRING. It is a note for a status
// card, in the same register as the ladder's other notes ("fandom: no wiki for this
// work"): a phrase naming the cause, not a sentence apologising for it. "" means
// there is nothing to say, which includes a search that legitimately found nothing.
//
// THE CONSENT WALL IS DETECTED RATHER THAN INFERRED, because it is the single most
// likely cause in the EU and it arrives as a 200 with a perfectly valid page on it.
// A miss and a wall are the same empty slice and the same status code, and only the
// body tells them apart.
func GoogleImageScrape(ctx context.Context, query string, enabled bool, n int) ([]ImageHit, string) {
	query = strings.TrimSpace(query)
	if !enabled || query == "" {
		return nil, ""
	}
	if n <= 0 || n > maxImageHits {
		n = maxImageHits
	}
	u := googleScrapeBase + "/search?tbm=isch&safe=active&q=" + url.QueryEscape(query)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, "the request could not be built"
	}
	req.Header.Set("User-Agent", browserUA)
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	resp, err := httpClient.Do(req)
	if err != nil {
		olog.Tracef("[meta] google image scrape failed: %v", err)
		return nil, "google could not be reached"
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		olog.Tracef("[meta] google image scrape -> %d", resp.StatusCode)
		// THE NUMBER IS THE USEFUL PART and 429 is the one worth naming: it is
		// this server's address being rate-limited, which is the consequence the
		// opt-in warns about and the one thing the reader can act on by turning
		// the switch back off.
		if resp.StatusCode == http.StatusTooManyRequests {
			return nil, "google is rate-limiting this server"
		}
		return nil, "google answered " + strconv.Itoa(resp.StatusCode)
	}
	page, err := io.ReadAll(io.LimitReader(resp.Body, maxHTMLBody))
	if err != nil {
		return nil, "google's reply could not be read"
	}
	if isGoogleConsentWall(page) {
		return nil, "google is showing a consent page instead of results"
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
	// A PAGE THAT CAME BACK WHOLE AND CARRIES NOT ONE THUMBNAIL IS NOT AN HONEST
	// MISS. Google puts its own preview images on a results page even when the
	// results are poor, so zero matches for a pattern this narrow means the page
	// stopped being the page this regex was written against — a markup rotation,
	// which is the failure mode the header above calls fragile on purpose. Saying
	// so is the difference between "your search found nothing" and "this rung has
	// stopped working", and the reader can act on only one of them.
	if len(hits) == 0 {
		return nil, "google's results page carried no preview images"
	}
	return hits, ""
}

// isGoogleConsentWall reports whether the page is the EU consent interstitial
// rather than results.
//
// TWO MARKERS AND BOTH ARE STRUCTURAL, not copy: the interstitial is served from
// consent.google.com and posts back to /save, and neither of those is language
// dependent — which matters, because the page is served in the reader's own
// language and matching a translated sentence would work in exactly one country.
func isGoogleConsentWall(page []byte) bool {
	s := string(page)
	return strings.Contains(s, "consent.google.com") || strings.Contains(s, "/consent?continue=")
}
