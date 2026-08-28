package httpapi

// POST /images/search — the picture strip behind a cover, a poster and a
// portrait picker.
//
// What is worth pinning is not that a stub server's JSON survives the trip. It
// is the four rules that decide whether the strip is USEFUL: nothing configured
// still answers (and says so), one source failing does not take the others with
// it, the query names what is being looked for, and no candidate is offered
// without something behind it.

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tippani/internal/metadata"
)

type imageSearchResp struct {
	Images []struct {
		URL    string `json:"url"`
		Thumb  string `json:"thumb"`
		Source string `json:"source"`
	} `json:"images"`
	Sources struct {
		Google bool `json:"google"`
		Amazon bool `json:"amazon"`
	} `json:"sources"`
}

// A reader who has configured nothing gets an empty strip and a 200 — and the
// `sources` block is what lets the picker say "nothing is set up" rather than
// "nothing was found", which are different answers and only one of them is the
// reader's to fix.
func TestImageSearchWithNothingConfiguredSaysSoRatherThanFailing(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	rec := c.mustDo("POST", "/images/search", map[string]any{"kind": "portrait", "name": "Ursula K. Le Guin"}, 200)
	got := decode[imageSearchResp](t, rec)
	if len(got.Images) != 0 {
		t.Fatalf("images from nowhere: %+v", got.Images)
	}
	if got.Sources.Google || got.Sources.Amazon {
		t.Fatalf("sources claim a supplier that is not configured: %+v", got.Sources)
	}
}

func TestImageSearchRefusesAKindItCannotPicture(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("POST", "/images/search", map[string]any{"kind": "sticker", "title": "x"}, http.StatusBadRequest)
	// And a request with nothing to search for.
	c.mustDo("POST", "/images/search", map[string]any{"kind": "cover"}, http.StatusBadRequest)
}

// THE QUERY IS THE FEATURE. "Heat" finds a thermodynamics diagram; "Heat movie
// poster 1995" finds the poster. Each kind names the noun it is after, and the
// author or the year goes in for the same reason a catalogue search takes them.
func TestImageSearchAsksForTheRightKindOfPicture(t *testing.T) {
	cases := []struct {
		kind, want string
		body       map[string]any
	}{
		{"cover", "Dune Frank Herbert book cover", map[string]any{"kind": "cover", "title": "Dune", "author": "Frank Herbert"}},
		{"poster", "Heat movie poster 1995", map[string]any{"kind": "poster", "title": "Heat", "year": 1995}},
		{"show", "Severance tv series poster", map[string]any{"kind": "poster", "title": "Severance", "media_type": "show"}},
		{"game", "Hades game cover art", map[string]any{"kind": "poster", "title": "Hades", "media_type": "game"}},
		{"portrait", "Ursula K. Le Guin portrait photo", map[string]any{"kind": "portrait", "name": "Ursula K. Le Guin"}},
	}
	for _, tc := range cases {
		t.Run(tc.kind, func(t *testing.T) {
			var asked string
			cse := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				asked = r.URL.Query().Get("q")
				fmt.Fprint(w, `{"items":[]}`)
			}))
			defer cse.Close()
			metadata.SetImageSearchBasesForTest(t, cse.URL, "")

			srv := newTestServer(t)
			c := signupAdmin(t, srv.Handler())
			c.mustDo("PUT", "/admin/metadata-keys", map[string]any{"google_cse_key": "k", "google_cse_cx": "cx"}, 200)
			c.mustDo("POST", "/images/search", tc.body, 200)
			if asked != tc.want {
				t.Errorf("query = %q, want %q", asked, tc.want)
			}
		})
	}
}

// One supplier failing must not take the others with it — the whole reason
// these are separate sources rather than a merged lookup.
func TestImageSearchSurvivesOneSupplierFailing(t *testing.T) {
	cse := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests) // the quota, which is what will actually happen
	}))
	defer cse.Close()
	amazon := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, `<img src="https://m.media-amazon.com/images/I/zzz._SY300_.jpg">`)
	}))
	defer amazon.Close()
	metadata.SetImageSearchBasesForTest(t, cse.URL, amazon.URL)

	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/admin/metadata-keys", map[string]any{
		"google_cse_key": "k", "google_cse_cx": "cx", "amazon_cookie": "session=1",
	}, 200)

	got := decode[imageSearchResp](t, c.mustDo("POST", "/images/search",
		map[string]any{"kind": "poster", "title": "Heat"}, 200))
	if len(got.Images) != 1 || got.Images[0].Source != "amazon" {
		t.Fatalf("the surviving supplier's hits did not come through: %+v", got.Images)
	}
	if strings.Contains(got.Images[0].URL, "_SY300_") {
		t.Errorf("a search-results thumbnail was offered for storage: %q", got.Images[0].URL)
	}
	// Both are configured — one of them merely failed today, which is not the
	// same fact and must not be reported as one.
	if !got.Sources.Google || !got.Sources.Amazon {
		t.Errorf("a failing supplier was reported as unconfigured: %+v", got.Sources)
	}
}

// The keyless half of Amazon: a print ISBN addresses a cover on the image CDN
// with nothing configured at all. And the placeholder that CDN serves for a book
// it has never stocked is not offered — checked before the reader is shown it,
// not after they have picked it.
func TestImageSearchOffersAmazonByISBNWithNoKeysAndSkipsThePlaceholder(t *testing.T) {
	var asked []string
	cdn := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked = append(asked, r.URL.Path)
		w.Header().Set("Content-Type", "image/jpeg")
		if strings.Contains(r.URL.Path, "0441013597") {
			w.Header().Set("Content-Length", "40000") // a real cover
			return
		}
		w.Header().Set("Content-Length", "43") // Amazon's "no image available"
	}))
	defer cdn.Close()
	metadata.SetAmazonCDNBaseForTest(t, cdn.URL)

	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	got := decode[imageSearchResp](t, c.mustDo("POST", "/images/search",
		map[string]any{"kind": "cover", "title": "Dune", "isbn": "9780441013593", "asin": "B000FBJCJE"}, 200))
	if len(asked) != 2 {
		t.Fatalf("both the ASIN and the ISBN should have been probed: %v", asked)
	}
	if len(got.Images) != 1 {
		t.Fatalf("want the one real cover, got %+v", got.Images)
	}
	if !strings.Contains(got.Images[0].URL, "0441013597") {
		t.Errorf("the offered cover is not the ISBN-10 one: %+v", got.Images[0])
	}
	if got.Images[0].Source != "amazon" {
		t.Errorf("the hit does not name its source: %+v", got.Images[0])
	}
}

// A portrait strip is the case the people console had no answer for at all, and
// the one that has to work for a NON-admin: keys are an admin's business, and
// every reader has a people console.
func TestImageSearchIsAvailableToEveryReader(t *testing.T) {
	cse := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, `{"items":[{"link":"https://pics.test/leguin.jpg","image":{"thumbnailLink":"https://encrypted-tbn0.gstatic.com/t"}}]}`)
	}))
	defer cse.Close()
	metadata.SetImageSearchBasesForTest(t, cse.URL, "")

	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("PUT", "/admin/metadata-keys", map[string]any{"google_cse_key": "k", "google_cse_cx": "cx"}, 200)
	bob := addUser(t, h, admin, "bob")

	got := decode[imageSearchResp](t, bob.mustDo("POST", "/images/search",
		map[string]any{"kind": "portrait", "name": "Ursula K. Le Guin"}, 200))
	if len(got.Images) != 1 {
		t.Fatalf("a reader who is not an admin got no strip: %+v", got)
	}
	// THE PREVIEW AND THE FILE ARE DIFFERENT URLS, and the page can only draw
	// one of them: img-src names the hosts, and a web image lives anywhere.
	if got.Images[0].Thumb == "" || got.Images[0].URL == got.Images[0].Thumb {
		t.Errorf("the strip has nothing it is allowed to draw: %+v", got.Images[0])
	}
	// And the reader can tell there is a search behind the button.
	st := decode[struct {
		ImageSearch bool `json:"image_search"`
	}](t, bob.mustDo("GET", "/metadata/status", nil, 200))
	if !st.ImageSearch {
		t.Error("metadata status does not report the picture search as available")
	}
}

// The key is a secret and the engine id is not — the same split the Amazon
// cookie and domain already make, for the same reason: one of them has to be
// visible to be checked for a typo.
func TestGoogleCSECredentialsAreStoredWriteOnlyExceptTheEngineID(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/admin/metadata-keys", map[string]any{"google_cse_key": "sekrit", "google_cse_cx": "abc123"}, 200)

	body := c.mustDo("GET", "/admin/metadata-keys", nil, 200).Body.String()
	if strings.Contains(body, "sekrit") {
		t.Fatalf("the key was echoed back: %s", body)
	}
	if !strings.Contains(body, `"google_cse_key_set":true`) || !strings.Contains(body, `"google_cse_cx":"abc123"`) {
		t.Fatalf("the pair is not reported: %s", body)
	}
	// A partial save leaves the other half alone — correcting a mistyped key must
	// not mean re-entering the engine id.
	c.mustDo("PUT", "/admin/metadata-keys", map[string]any{"google_cse_key": "sekrit2"}, 200)
	if !strings.Contains(c.mustDo("GET", "/admin/metadata-keys", nil, 200).Body.String(), `"google_cse_cx":"abc123"`) {
		t.Fatal("saving one half cleared the other")
	}
}
