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

// FANDOM AS A RECORD SOURCE, not only a picture one. The same wiki that has a
// character's portrait has an article about the work, and its opening paragraph
// is a description written by people who care about the thing.
//
// WHAT IT REFUSES IS THE POINT. Two fields, honestly — an extract and a page
// image — and nothing else. A wiki article is prose; inventing a director or a
// year out of an infobox would mean reading markup that differs per wiki, which
// is the discipline the rest of this package exists to keep.
func TestFandomSuppliesAnArticleSummaryAndNothingItCannotKnow(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if !strings.Contains(q.Get("prop"), "extracts") {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		title, _ := url.QueryUnescape(q.Get("titles"))
		if title != "V for Vendetta" {
			_, _ = w.Write([]byte(`{"query":{"pages":[{"missing":true}]}}`))
			return
		}
		_, _ = w.Write([]byte(`{"query":{"pages":[{"title":"V for Vendetta",
			"extract":"V for Vendetta is a 2005 dystopian political thriller.",
			"original":{"source":"https://static.wikia.nocookie.net/vfv/poster.jpg"}}]}}`))
	}))
	defer srv.Close()
	SetFandomAndScrapeBasesForTest(t, srv.URL, "")

	d, err := FandomWorkDetails(context.Background(), "V for Vendetta")
	if err != nil || d == nil {
		t.Fatalf("no record: %v / %+v", err, d)
	}
	if !strings.HasPrefix(d.Overview, "V for Vendetta is a 2005") {
		t.Errorf("overview: %q", d.Overview)
	}
	if d.PosterURL != "https://static.wikia.nocookie.net/vfv/poster.jpg" {
		t.Errorf("poster: %q", d.PosterURL)
	}
	if d.Source != "fandom" {
		t.Errorf("the record does not name itself: %q", d.Source)
	}
	// EVERYTHING IT CANNOT KNOW IS EMPTY, so the per-field picker offers it only
	// where it has something. A director invented from an infobox would look
	// exactly like a real one.
	if d.Director != "" || d.ReleaseYear != 0 || len(d.Genres) != 0 || len(d.Cast) != 0 {
		t.Errorf("fandom claimed structure it cannot have: %+v", d)
	}

	// A missing article is silence, not a record.
	if got, _ := FandomWorkDetails(context.Background(), "Nothing At All"); got != nil {
		t.Errorf("a missing article produced a record: %+v", got)
	}
}
