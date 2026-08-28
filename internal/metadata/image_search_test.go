package metadata

// The picture sources, against stub servers. What is worth pinning is not that
// the JSON parses — it is the three rules that make a strip usable: the
// thumbnail is kept separate from the image, an http result is dropped, and a
// blocked scrape is silence rather than an error.

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGoogleImageSearchKeepsTheThumbnailBesideTheImage(t *testing.T) {
	var gotQuery string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.Query().Get("q")
		if r.URL.Query().Get("searchType") != "image" {
			t.Errorf("not an image search: %s", r.URL.RawQuery)
		}
		if r.URL.Query().Get("cx") == "" || r.URL.Query().Get("key") == "" {
			t.Errorf("credentials missing from the request: %s", r.URL.RawQuery)
		}
		fmt.Fprint(w, `{"items":[
			{"link":"https://example.test/poster.jpg","image":{"thumbnailLink":"https://encrypted-tbn0.gstatic.com/x"}},
			{"link":"http://insecure.test/poster.jpg","image":{"thumbnailLink":"https://encrypted-tbn0.gstatic.com/y"}}
		]}`)
	}))
	defer srv.Close()
	googleCSEBase = srv.URL
	defer func() { googleCSEBase = "https://www.googleapis.com" }()

	hits, err := GoogleImageSearch(context.Background(), "k", "cx", "Heat movie poster", 10)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	// THE http RESULT IS DROPPED. It would be refused at the fetch, so offering
	// it is offering a candidate that cannot be taken.
	if len(hits) != 1 {
		t.Fatalf("want 1 usable hit, got %+v", hits)
	}
	if hits[0].URL != "https://example.test/poster.jpg" {
		t.Errorf("the stored URL is not the full-size image: %+v", hits[0])
	}
	if !strings.Contains(hits[0].Thumb, "gstatic.com") {
		t.Errorf("the preview is not the allowlisted thumbnail host: %+v", hits[0])
	}
	if hits[0].Source != "google" {
		t.Errorf("hit does not name its source: %+v", hits[0])
	}
	if gotQuery != "Heat movie poster" {
		t.Errorf("query = %q", gotQuery)
	}
}

// Half a credential searches nothing, and says so by answering nothing rather
// than by spending a request that the API refuses with a 400.
func TestGoogleImageSearchNeedsBothHalves(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Error("a request was made without a full credential")
	}))
	defer srv.Close()
	googleCSEBase = srv.URL
	defer func() { googleCSEBase = "https://www.googleapis.com" }()

	for _, c := range [][2]string{{"", "cx"}, {"key", ""}, {"", ""}} {
		hits, err := GoogleImageSearch(context.Background(), c[0], c[1], "anything", 10)
		if err != nil || len(hits) != 0 {
			t.Errorf("key=%q cx=%q returned %v, %v", c[0], c[1], hits, err)
		}
	}
}

// The quota failure is the one this source will actually have, so it is named
// rather than folded into "status 4xx".
func TestGoogleImageSearchNamesTheQuotaFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer srv.Close()
	googleCSEBase = srv.URL
	defer func() { googleCSEBase = "https://www.googleapis.com" }()

	_, err := GoogleImageSearch(context.Background(), "k", "cx", "q", 10)
	if err == nil || !strings.Contains(err.Error(), "quota") {
		t.Fatalf("err = %v, want the quota named", err)
	}
}

func TestAmazonImageSearchStripsTheSizeModifierAndDedupes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Cookie") == "" {
			t.Error("the opt-in cookie was not sent")
		}
		fmt.Fprint(w, `<div>
			<img src="https://m.media-amazon.com/images/I/aaa._AC_SX466_.jpg">
			<img src="https://m.media-amazon.com/images/I/aaa._SY300_.jpg">
			<img src="https://m.media-amazon.com/images/I/bbb.jpg">
			<img src="https://images-na.ssl-images-amazon.com/images/G/sprite.png">
		</div>`)
	}))
	defer srv.Close()
	amazonBase = srv.URL
	defer func() { amazonBase = "" }()

	hits, err := AmazonImageSearch(context.Background(), "Heat blu-ray", "session=1", "www.amazon.com", 8)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	// TWO SIZES OF ONE PICTURE ARE ONE CANDIDATE. Both rows carry the same image
	// id and differ only by the modifier the full-size rewrite strips, so an
	// un-deduped strip would offer the same poster twice.
	if len(hits) != 2 {
		t.Fatalf("want 2 distinct images, got %+v", hits)
	}
	for _, h := range hits {
		if strings.Contains(h.URL, "_AC_") || strings.Contains(h.URL, "_SY") {
			t.Errorf("a size modifier survived: %q", h.URL)
		}
		if h.Source != "amazon" {
			t.Errorf("hit does not name its source: %+v", h)
		}
	}
}

// No cookie is not an error and is not a request: the cookie is where the
// reader's agreement to scrape is recorded.
func TestAmazonImageSearchIsOptIn(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Error("scraped without the opt-in cookie")
	}))
	defer srv.Close()
	amazonBase = srv.URL
	defer func() { amazonBase = "" }()

	hits, err := AmazonImageSearch(context.Background(), "Heat", "", "www.amazon.com", 8)
	if err != nil || len(hits) != 0 {
		t.Fatalf("got %v, %v — want silence", hits, err)
	}
}

// A CAPTCHA answers 200 with a page that has no product art in it, and a 503
// answers nothing. Neither is an error the reader can act on, and surfacing one
// would hide the sources that did answer.
func TestAmazonImageSearchIsSilentWhenBlocked(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()
	amazonBase = srv.URL
	defer func() { amazonBase = "" }()

	hits, err := AmazonImageSearch(context.Background(), "Heat", "session=1", "", 8)
	if err != nil || len(hits) != 0 {
		t.Fatalf("got %v, %v — want silence", hits, err)
	}
}

// The placeholder check, which is the whole reason a cover-by-ISBN candidate is
// verified before it is offered: that CDN answers 200 for a book it has never
// stocked.
func TestImageIsRealRejectsThePlaceholder(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/real.jpg":
			w.Header().Set("Content-Type", "image/jpeg")
			w.Header().Set("Content-Length", "40000")
		case "/placeholder.gif":
			w.Header().Set("Content-Type", "image/gif")
			w.Header().Set("Content-Length", "43")
		case "/notimage":
			w.Header().Set("Content-Type", "text/html")
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	if !ImageIsReal(context.Background(), srv.URL+"/real.jpg") {
		t.Error("a real cover was refused")
	}
	if ImageIsReal(context.Background(), srv.URL+"/placeholder.gif") {
		t.Error("Amazon's no-image placeholder was offered as a candidate")
	}
	if ImageIsReal(context.Background(), srv.URL+"/notimage") {
		t.Error("a page was offered as a picture")
	}
	if ImageIsReal(context.Background(), srv.URL+"/missing.jpg") {
		t.Error("a 404 was offered as a picture")
	}
}
