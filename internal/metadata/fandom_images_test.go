package metadata

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// THE SLUG IS THE WHOLE RISK, so it is tested on its own before anything is
// fetched. A wrong slug is a 404 and costs nothing; a slug that drops the wrong
// thing turns a wiki that exists into one that does not.
func TestTheFandomSlugIsGuessedFromTheWorkTitle(t *testing.T) {
	for _, tc := range []struct{ title, want string }{
		{"V for Vendetta", "vforvendetta"},
		{"The Expanse", "expanse"}, // a leading article is dropped: Fandom's wiki is `expanse`
		{"A Song of Ice and Fire", "songoficeandfire"},
		{"Death Note", "deathnote"},
		{"Star Wars: A New Hope", "starwarsanewhope"}, // punctuation is not part of a slug
		{"1Q84", "1q84"},                              // digits survive
		{"", ""},                                      // nothing in, nothing out — the tier is skipped
	} {
		if got := fandomSlug(tc.title); got != tc.want {
			t.Errorf("fandomSlug(%q) = %q, want %q", tc.title, got, tc.want)
		}
	}
}

// The wiki that exists answers; the wiki that does not is silence rather than an
// error, which is what lets this rung sit in a ladder without being able to fail
// the request.
func TestFandomAsksTheWorksOwnWikiAndIsSilentWhenThereIsNone(t *testing.T) {
	var asked []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked = append(asked, r.Host+r.URL.Path)
		title, _ := url.QueryUnescape(r.URL.Query().Get("titles"))
		if strings.Contains(r.URL.RawQuery, "vforvendetta-marker") || title == "V" {
			_, _ = w.Write([]byte(`{"query":{"pages":[{"original":{"source":"https://static.wikia.nocookie.net/v.jpg"}}]}}`))
			return
		}
		// MediaWiki's own shape for "no such page", which is not a 404.
		_, _ = w.Write([]byte(`{"query":{"pages":[{"missing":true}]}}`))
	}))
	defer srv.Close()
	SetFandomAndScrapeBasesForTest(t, srv.URL, "")

	got := FandomCharacterImages(context.Background(), "V", "V for Vendetta")
	if len(got) != 1 || got[0].URL != "https://static.wikia.nocookie.net/v.jpg" {
		t.Fatalf("the wiki answered and the hit was lost: %+v", got)
	}
	if got[0].Source != "fandom" {
		t.Errorf("hit does not name its source: %+v", got[0])
	}
	// A PAGE THAT IS NOT THERE IS NOT AN IMAGE. MediaWiki answers `missing:true`
	// with a 200, so a caller that only checked the status code would offer an
	// empty struct's zero-value URL as a picture.
	if got := FandomCharacterImages(context.Background(), "Nobody", "V for Vendetta"); len(got) != 0 {
		t.Errorf("a missing page produced a hit: %+v", got)
	}
	// No work title means no wiki to guess, so nothing is fetched at all.
	before := len(asked)
	if got := FandomCharacterImages(context.Background(), "V", ""); len(got) != 0 {
		t.Errorf("a character with no work produced a hit: %+v", got)
	}
	if len(asked) != before {
		t.Error("a request went out with no wiki to send it to")
	}
}
