package metadata

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"tippani/internal/outbound"
)

// Reachable reports whether a supplier's host answers at all, for the five rungs
// that say nothing when it does not.
//
// THOSE RUNGS SWALLOW THEIR TRANSPORT ERRORS ON PURPOSE. Amazon's keyless cover
// address, Letterboxd, Wikipedia, Fandom and Google's image results are each one
// guess among several (the last says why in a note, and still returns), and
// a guess that cannot answer must not fail the lookup it is part of — so each
// returns "nothing" for a refused connection exactly as for a page with no image
// on it. That is right for a lookup and wrong for a Test, which exists to tell
// those two apart: offline, each said "answered · found nothing".
//
// SO A TEST THAT FOUND NOTHING ASKS THIS SECOND, never instead. It is one HEAD to
// the same host through the same client, and so through the same offline switch.
// Any answer below 500 means the host is there and the empty result stands; a
// transport error or a 5xx is returned as the reason.
//
// wiki names the Fandom wiki, whose host is per-wiki; the others ignore it.
func Reachable(ctx context.Context, supplier, wiki string) error {
	var base string
	switch supplier {
	case "amazon":
		base = amazonCDNBase
	case "letterboxd":
		base = letterboxdBase
	case "wikimedia":
		base = wikipediaBase
	case "fandom":
		base = strings.Replace(fandomHostFmt, "%s", wiki, 1)
	case "google-images":
		base = googleScrapeBase
	default:
		return fmt.Errorf("no host on record for %q", supplier)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, base+"/", nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", userAgent)
	resp, err := httpClient.Do(req)
	if err != nil {
		return outbound.RedactError(err)
	}
	resp.Body.Close()
	if resp.StatusCode >= http.StatusInternalServerError {
		return fmt.Errorf("%s answered HTTP %d", supplier, resp.StatusCode)
	}
	return nil
}
