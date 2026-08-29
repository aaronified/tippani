package metadata

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// THE OPT-IN IS CHECKED INSIDE THE FUNCTION, not only at the call site, and this
// is the test that says so. Scraping Google spends the SERVER's address — a
// rate-limit or a consent wall lands on everybody in the household, not on the
// person who pressed the button — so "somebody forgot the guard at one call
// site" must not be enough to turn it on.
func TestTheGoogleScrapeDoesNothingUntilItIsTurnedOn(t *testing.T) {
	var hits int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits++
		_, _ = w.Write([]byte(`<img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ABC&amp;s">`))
	}))
	defer srv.Close()
	SetFandomAndScrapeBasesForTest(t, "", srv.URL)

	if got := GoogleImageScrape(context.Background(), "Hugo Weaving portrait", false, 8); len(got) != 0 {
		t.Errorf("scraped while switched off: %+v", got)
	}
	if hits != 0 {
		t.Fatalf("a request went out with the opt-in off (%d)", hits)
	}

	got := GoogleImageScrape(context.Background(), "Hugo Weaving portrait", true, 8)
	if len(got) != 1 {
		t.Fatalf("want the one thumbnail on the page, got %+v", got)
	}
	// THE ENTITY IS DECODED. The page carries &amp; inside the URL, and a hit
	// stored with it is an address that 404s later, in the cover fetcher, long
	// after the reader picked it.
	if got[0].URL != "https://encrypted-tbn0.gstatic.com/images?q=tbn:ABC&s" {
		t.Errorf("the URL was not decoded: %q", got[0].URL)
	}
	// URL and Thumb are the same picture on purpose: a results page has only the
	// thumbnail, so what is drawn IS what is stored.
	if got[0].Thumb != got[0].URL {
		t.Errorf("thumb and url disagree, so the picker would draw what it will not keep: %+v", got[0])
	}
}
