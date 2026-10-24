package httpapi

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"tippani/internal/metadata"
)

// POST /images/search — the picture strip behind a cover, a poster and a
// portrait picker.
//
// What is worth pinning is not that a stub server's JSON survives the trip. It
// is the four rules that decide whether the strip is USEFUL: nothing configured
// still answers (and says so), one source failing does not take the others with
// it, the query names what is being looked for, and no candidate is offered
// without something behind it.

type imageSearchResp struct {
	Images []struct {
		URL    string `json:"url"`
		Thumb  string `json:"thumb"`
		Source string `json:"source"`
	} `json:"images"`
	Sources struct {
		Google    bool `json:"google"`
		Amazon    bool `json:"amazon"`
		TVDB      bool `json:"tvdb"`
		TMDB      bool `json:"tmdb"`
		Wikimedia bool `json:"wikimedia"`
	} `json:"sources"`
}

// A PORTRAIT IS NOT NARROWED BY A YEAR even when one is sent. Two films share a
// title constantly; two people sharing a name is rare, and "Le Guin 1974" finds
// that person in that year rather than that person.
func TestAYearNarrowsAWorkAndNeverAFace(t *testing.T) {
	var asked string
	cse := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked = r.URL.Query().Get("q")
		fmt.Fprint(w, `<html><body>no pictures here</body></html>`)
	}))
	defer cse.Close()
	srv := newTestServer(t)
	// AFTER newTestServer, NOT BEFORE: the helper pins the scrape base at a silent
	// stub so no test can reach the real Google, and the later call wins.
	metadata.SetFandomAndScrapeBasesForTest(t, "", cse.URL)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/admin/metadata-keys", map[string]any{"google_scrape": true}, 200)

	c.mustDo("POST", "/images/search", map[string]any{"kind": "portrait", "name": "Ursula K. Le Guin", "year": 1974}, 200)
	if strings.Contains(asked, "1974") {
		t.Errorf("a portrait search was narrowed by a year: %q", asked)
	}
	c.mustDo("POST", "/images/search", map[string]any{"kind": "poster", "title": "Persuasion", "year": 1995}, 200)
	if !strings.Contains(asked, "1995") {
		t.Errorf("a poster search dropped the year that tells two films apart: %q", asked)
	}
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
		// A ROLE IS A SENTENCE AND NOT A LIST OF NAMES. "Viola Davis" finds the
		// actor on a red carpet, "Suicide Squad" finds the poster, and only
		// "X as Y in Z" finds the character in costume — which is the picture
		// TheTVDB has for a handful of rows and nobody has for the rest.
		{"character", "Viola Davis as Amanda Waller in Suicide Squad movie 2016", map[string]any{
			"kind": "character", "name": "Amanda Waller", "actor": "Viola Davis",
			"title": "Suicide Squad", "year": 2016,
		}},
		// Nobody is credited with playing a book's character, so the sentence
		// loses its subject and the role is named as a role instead.
		{"character in a book", "Elizabeth Bennet character in Pride and Prejudice book", map[string]any{
			"kind": "character", "name": "Elizabeth Bennet",
			"title": "Pride and Prejudice", "media_type": "book",
		}},
		{"character in a game", "Kratos character in God of War game", map[string]any{
			"kind": "character", "name": "Kratos", "title": "God of War", "media_type": "game",
		}},
	}
	for _, tc := range cases {
		t.Run(tc.kind, func(t *testing.T) {
			var asked string
			cse := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				asked = r.URL.Query().Get("q")
				fmt.Fprint(w, `<html><body>no pictures here</body></html>`)
			}))
			defer cse.Close()

			srv := newTestServer(t)
			// AFTER newTestServer: the helper pins the scrape base at a silent stub so no
			// test can reach the real Google, and the later call wins.
			metadata.SetFandomAndScrapeBasesForTest(t, "", cse.URL)
			c := signupAdmin(t, srv.Handler())
			c.mustDo("PUT", "/admin/metadata-keys", map[string]any{"google_scrape": true}, 200)
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

	srv := newTestServer(t)
	// AFTER newTestServer: the helper pins the scrape base at a silent stub so no
	// test can reach the real Google, and the later call wins.
	metadata.SetFandomAndScrapeBasesForTest(t, "", cse.URL)
	metadata.SetAmazonBaseForTest(t, amazon.URL)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/admin/metadata-keys", map[string]any{
		"google_scrape": true, "amazon_cookie": "session=1",
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
		fmt.Fprint(w, `<img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:LEGUIN">`)
	}))
	defer cse.Close()

	srv := newTestServer(t)
	// AFTER newTestServer: the helper pins the scrape base at a silent stub so no
	// test can reach the real Google, and the later call wins.
	metadata.SetFandomAndScrapeBasesForTest(t, "", cse.URL)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("PUT", "/admin/metadata-keys", map[string]any{"google_scrape": true}, 200)
	bob := addUser(t, h, admin, "bob")

	got := decode[imageSearchResp](t, bob.mustDo("POST", "/images/search",
		map[string]any{"kind": "portrait", "name": "Ursula K. Le Guin"}, 200))
	if len(got.Images) != 1 {
		t.Fatalf("a reader who is not an admin got no strip: %+v", got)
	}
	// THE STRIP MUST HAVE SOMETHING IT IS ALLOWED TO DRAW, which is what this
	// assertion has always been about — img-src names the hosts and a web image
	// lives anywhere.
	//
	// It used to say the two URLs must DIFFER, because the Custom Search API
	// returned an original on an unknowable host plus a gstatic thumbnail. Reading
	// the results page returns only the thumbnail, so URL and Thumb are the same
	// value on purpose: the picture offered IS the picture stored, and saying so
	// is what makes the picker draw exactly what it will keep. What still has to
	// hold is that the drawable URL is on the one host the CSP allows.
	if got.Images[0].Thumb == "" {
		t.Errorf("the strip has nothing it is allowed to draw: %+v", got.Images[0])
	}
	if !strings.Contains(got.Images[0].Thumb, "gstatic.com") {
		t.Errorf("the preview is not on an allowlisted host: %+v", got.Images[0])
	}
	// And the reader can tell there is a search behind the button.
	st := decode[struct {
		ImageSearch bool `json:"image_search"`
	}](t, bob.mustDo("GET", "/metadata/status", nil, 200))
	if !st.ImageSearch {
		t.Error("metadata status does not report the picture search as available")
	}
}

// GOOGLE'S CUSTOM SEARCH CREDENTIALS USED TO BE TESTED HERE — a write-only key
// beside a visible engine id, the same split the Amazon cookie and domain make.
// Both fields are gone: Google closed that API to new customers and set it to
// retire on 1 January 2027, so the app was asking readers to register for
// something they could not get. The surviving Google path needs no credential at
// all, which is why its opt-in is a setting and is tested as one in
// TestTheGoogleScrapeDoesNothingUntilItIsTurnedOn.

func TestAmazonIsNotConsultedForFaces(t *testing.T) {
	var amazonHits int
	amazon := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		amazonHits++
		fmt.Fprint(w, `<img src="https://m.media-amazon.com/images/I/shop._SY300_.jpg">`)
	}))
	defer amazon.Close()
	cse := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, `<html><body>no pictures here</body></html>`)
	}))
	defer cse.Close()

	srv := newTestServer(t)
	// AFTER newTestServer: the helper pins the scrape base at a silent stub so no
	// test can reach the real Google, and the later call wins.
	metadata.SetFandomAndScrapeBasesForTest(t, "", cse.URL)
	metadata.SetAmazonBaseForTest(t, amazon.URL)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/admin/metadata-keys", map[string]any{
		"google_scrape": true, "amazon_cookie": "session=1",
	}, 200)

	for _, tc := range []struct {
		kind string
		body map[string]any
		want bool // may Amazon answer this kind?
	}{
		{"portrait", map[string]any{"kind": "portrait", "name": "Hugo Weaving"}, false},
		{"character", map[string]any{"kind": "character", "name": "V",
			"actor": "Hugo Weaving", "title": "V for Vendetta", "media_type": "movie"}, false},
		// The two it is right for, asserted in the same table so that a change
		// which silences Amazon everywhere fails here rather than passing quietly.
		{"cover", map[string]any{"kind": "cover", "title": "Dune", "author": "Frank Herbert"}, true},
		{"poster", map[string]any{"kind": "poster", "title": "Heat", "media_type": "movie"}, true},
	} {
		t.Run(tc.kind, func(t *testing.T) {
			amazonHits = 0
			got := decode[imageSearchResp](t, c.mustDo("POST", "/images/search", tc.body, 200))
			if (amazonHits > 0) != tc.want {
				t.Errorf("amazon consulted = %t for kind %q, want %t",
					amazonHits > 0, tc.kind, tc.want)
			}
			if got.Sources.Amazon != tc.want {
				t.Errorf("sources.amazon = %t for kind %q, want %t — the client cannot "+
					"tell an unasked supplier from an empty one",
					got.Sources.Amazon, tc.kind, tc.want)
			}
		})
	}
}

// A PICTURE CHOSEN FROM A SEARCH CAN BE FRAMED BEFORE THE FORM IS SAVED.
//
// What a person would say: I picked a cover from the strip, and I can move it about in
// its frame straight away — nothing is saved until I say so, and looking at pictures I
// then do not use leaves nothing behind.
//
// What the test knows, declared: the route is POST /images/preview {url} -> {image}, and
// srv.fetchUserImage is the server's own seam for the download, because a test may not
// reach a supplier. The reply is a data: URL because that is the only form the page may
// draw and read back (its img-src is 'self' and data:).

func stubUserImage(srv *Server, calls *[]string, payload []byte) {
	srv.fetchUserImage = func(_ context.Context, rawURL, dir string) (string, error) {
		*calls = append(*calls, rawURL)
		// The real fetcher names a file by what it recognised the bytes as.
		name := "00000000000000aa.png"
		if bytes.Contains(payload, []byte("<svg")) {
			name = "00000000000000aa.svg"
		}
		return name, os.WriteFile(filepath.Join(dir, name), payload, 0o600)
	}
}

func TestAChosenPictureComesBackAsBytesThePageCanFrame(t *testing.T) {
	srv := newTestServer(t)
	png := append([]byte("\x89PNG\r\n\x1a\n"), []byte("the-rest-of-a-picture")...)
	var asked []string
	stubUserImage(srv, &asked, png)
	c := signupAdmin(t, srv.Handler())

	rec := c.mustDo("POST", "/images/preview", map[string]string{"url": "https://pics.example/cover.png"}, http.StatusOK)

	var got struct {
		Image string `json:"image"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	const prefix = "data:image/png;base64,"
	if !strings.HasPrefix(got.Image, prefix) {
		t.Fatalf("the reply is %.40q, want a PNG data: URL", got.Image)
	}
	back, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(got.Image, prefix))
	if err != nil || string(back) != string(png) {
		t.Errorf("the bytes that came back are not the picture that was fetched (err %v)", err)
	}
	if len(asked) != 1 || asked[0] != "https://pics.example/cover.png" {
		t.Errorf("the server fetched %v, want exactly the address that was chosen", asked)
	}
}

func TestLookingAtAPictureLeavesNothingStored(t *testing.T) {
	srv := newTestServer(t)
	var asked []string
	stubUserImage(srv, &asked, append([]byte("\x89PNG\r\n\x1a\n"), 'x'))
	c := signupAdmin(t, srv.Handler())

	for i := 0; i < 3; i++ {
		c.mustDo("POST", "/images/preview", map[string]string{"url": "https://pics.example/a.png"}, http.StatusOK)
	}
	if n := filesIn(t, srv.coversDir()); n != 0 {
		t.Errorf("covers dir holds %d files after three previews, want none", n)
	}
}

func TestAPreviewNeedsAnAddressAndASignedInReader(t *testing.T) {
	srv := newTestServer(t)
	var asked []string
	stubUserImage(srv, &asked, []byte("x"))
	c := signupAdmin(t, srv.Handler())

	c.mustDo("POST", "/images/preview", map[string]string{"url": "  "}, http.StatusBadRequest)

	anon := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/images/preview", strings.NewReader(`{"url":"https://pics.example/a.png"}`))
	req.Header.Set("Content-Type", "application/json")
	srv.Handler().ServeHTTP(anon, req)
	if anon.Code != http.StatusUnauthorized {
		t.Errorf("a signed-out reader got %d, want 401", anon.Code)
	}
	if len(asked) != 0 {
		t.Errorf("a refused request still made the server fetch %v", asked)
	}
}

// THE SENTENCE A PICTURE SEARCH IS SENT, and the case that made it worth pinning.
//
// The owner: "WHY DOES ITKOVIAN YIELD ZERO HITS? Google image is turned on in my
// settings." It was on, and the rung ran, and it searched for something that does
// not exist. Itkovian is a character in a BOOK, and `mediaNoun` answered "movie"
// for everything it did not recognise — so a caller with nothing to say about the
// medium got a film appended to its query. "Itkovian character movie" is a
// correct search for a film that was never made, and it correctly returns
// nothing.
//
// A WRONG NOUN IS WORSE THAN NO NOUN, which is the rule these cases hold. Two of
// the words narrow a search usefully; the default narrowed it to fiction.
//
// THE MUTATION: put the `default: return "movie"` back and the unknown-medium
// case fails, reading "Itkovian character in Memories of Ice movie" — which is
// verbatim what the app was sending. And delete the actor inference in the
// character branch and the last case fails, losing the "movie" that names what
// kind of still to look for.
func TestAPictureSearchNamesTheRightMedium(t *testing.T) {
	for _, c := range []struct {
		what                              string
		kind, subject, actor, title, mtyp string
		want                              string
	}{
		{
			what: "a book's character says book, not movie",
			kind: imageKindCharacter, subject: "Itkovian", title: "Memories of Ice", mtyp: "book",
			want: "Itkovian character in Memories of Ice book",
		},
		{
			// The defect itself: a caller that knows nothing about the medium.
			what: "an unknown medium adds no noun at all",
			kind: imageKindCharacter, subject: "Itkovian", title: "Memories of Ice",
			want: "Itkovian character in Memories of Ice",
		},
		{
			// And with no work either — the state the character sheet used to send.
			// Thin, but honestly thin: it no longer claims a medium.
			what: "a bare name stays a bare name",
			kind: imageKindCharacter, subject: "Itkovian",
			want: "Itkovian character",
		},
		{
			what: "a film's role keeps the sentence that finds a still",
			kind: imageKindCharacter, subject: "Roy Batty", actor: "Rutger Hauer",
			title: "Blade Runner", mtyp: "movie",
			want: "Rutger Hauer as Roy Batty in Blade Runner movie",
		},
		{
			what: "a show says so",
			kind: imageKindCharacter, subject: "Saul Goodman", title: "Better Call Saul", mtyp: "show",
			want: "Saul Goodman character in Better Call Saul tv series",
		},
		{
			// A CREDITED PERFORMER IS ITSELF A MEDIUM. Nobody is credited with
			// playing a novel's character, so a role naming one is a screen role
			// even where the caller said nothing — and that is what separates
			// this from the unknown-medium case two rows up, which has no actor.
			// Deleting the noun in a first cut broke exactly this, and the older
			// suite caught it.
			what: "a role with a performer and no medium is still a screen role",
			kind: imageKindCharacter, subject: "Amanda Waller", actor: "Viola Davis",
			title: "Suicide Squad",
			want:  "Viola Davis as Amanda Waller in Suicide Squad movie",
		},
	} {
		got := imageSearchQuery(c.kind, c.subject, "", c.actor, c.title, c.mtyp, 0)
		if got != c.want {
			t.Errorf("%s:\n  got  %q\n  want %q", c.what, got, c.want)
		}
	}
}
