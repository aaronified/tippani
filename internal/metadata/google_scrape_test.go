package metadata

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// THE OPT-IN IS CHECKED INSIDE THE FUNCTION, not only at the call site, and this
// is the test that says so. Scraping Google spends the SERVER's address — a
// rate-limit or a consent wall lands on everybody in the household, not on the
// person who pressed the button — so "somebody forgot the guard at one call
// site" must not be enough to turn it on.
func TestTheGoogleScrapeDoesNothingUntilItIsTurnedOn(t *testing.T) {
	var hits int
	var sentCookie string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		sentCookie = r.Header.Get("Cookie")
		_, _ = w.Write([]byte(`<img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ABC&amp;s">`))
	}))
	defer srv.Close()
	SetFandomAndScrapeBasesForTest(t, "", srv.URL)

	if got, why := GoogleImageScrape(context.Background(), "Hugo Weaving portrait", false, 8); len(got) != 0 || why != "" {
		t.Errorf("scraped while switched off: %+v (%q)", got, why)
	}
	if hits != 0 {
		t.Fatalf("a request went out with the opt-in off (%d)", hits)
	}

	got, why := GoogleImageScrape(context.Background(), "Hugo Weaving portrait", true, 8)
	if len(got) != 1 {
		t.Fatalf("want the one thumbnail on the page, got %+v", got)
	}
	// AND THE CONSENT COOKIE WENT WITH IT, which is the difference between naming the
	// interstitial and getting past it. Without this the rung is permanently dead in
	// the EU and the app can only explain why — the opt-in IS the reader's consent, so
	// a server that asks for permission and then cannot act on it asked for nothing.
	if !strings.Contains(sentCookie, "CONSENT=") {
		t.Errorf("no consent cookie was sent, so a consent wall stays a wall: %q", sentCookie)
	}
	// A WORKING RUNG SAYS NOTHING. The reason exists for the four ways this can
	// come back empty; a page with a thumbnail on it is not one of them, and a
	// note here would put a fault on the status card for a search that worked.
	if why != "" {
		t.Errorf("a successful scrape reported a reason: %q", why)
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

// AND WHEN IT COMES BACK EMPTY IT SAYS WHICH OF THE FOUR IT WAS.
//
// THE REPORT THIS ANSWERS: "google photo search is yielding zero results, zilch."
// Every branch in here used to `return nil`, so a refused connection, a 429, the EU
// consent interstitial and a genuine miss were one empty slice — four different
// things for a reader to do, and the app had discarded which one applied. The four
// are not equally likely and two of them are not even faults of this app, which is
// exactly why naming them is worth a second return value.
func TestTheGoogleScrapeSaysWhyItFoundNothing(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		body   string
		want   string
	}{
		// THE CONSENT WALL ARRIVES AS A PERFECTLY GOOD 200, which is what makes it
		// the one that must be detected from the body rather than inferred from the
		// status. It is also the likeliest cause in the EU.
		{
			name:   "the consent interstitial",
			status: 200,
			body:   `<form action="https://consent.google.com/save">…</form>`,
			want:   "google is showing a consent page instead of results",
		},
		// THE RATE LIMIT IS THIS SERVER'S ADDRESS being throttled, which is the
		// consequence the opt-in warns about — and the one thing the reader can act
		// on directly, by turning the switch back off.
		{
			name:   "rate limited",
			status: 429,
			body:   "",
			want:   "google is rate-limiting this server",
		},
		{
			name:   "some other refusal",
			status: 503,
			body:   "",
			want:   "google answered 503",
		},
		// A WHOLE PAGE WITH NOT ONE PREVIEW ON IT is a markup rotation rather than
		// an honest miss: Google puts its own thumbnails on a results page even when
		// the results are poor, so zero matches for a pattern this narrow means the
		// page stopped being the page the regex was written against.
		{
			name:   "a page this no longer understands",
			status: 200,
			body:   `<html><body><div>no previews here at all</div></body></html>`,
			want:   "google's results page carried no preview images",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer srv.Close()
			SetFandomAndScrapeBasesForTest(t, "", srv.URL)

			got, why := GoogleImageScrape(context.Background(), "Hugo Weaving portrait", true, 8)
			if len(got) != 0 {
				t.Fatalf("hits came back from a broken page: %+v", got)
			}
			if why != tc.want {
				t.Errorf("the reason is wrong, so the card will report the wrong fault\n got %q\nwant %q", why, tc.want)
			}
		})
	}
}
