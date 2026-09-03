package metadata

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// A stub standing in for both halves of Wikipedia: the search that ranks
// articles and the pageimages call that returns a lead image.
func stubWikipedia(t *testing.T, results map[string][]string, images map[string]string) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		switch q.Get("list") {
		case "search":
			var hits []string
			for _, title := range results[q.Get("srsearch")] {
				hits = append(hits, `{"title":`+jsonStr(title)+`}`)
			}
			_, _ = w.Write([]byte(`{"query":{"search":[` + strings.Join(hits, ",") + `]}}`))
			return
		}
		if q.Get("prop") == "pageimages" {
			title, _ := url.QueryUnescape(q.Get("titles"))
			// MediaWiki treats an underscore and a space as the same character in
			// a title. articleURL emits underscores; the fixtures below are prose.
			title = strings.ReplaceAll(title, "_", " ")
			if src := images[title]; src != "" {
				_, _ = w.Write([]byte(`{"query":{"pages":[{"original":{"source":` + jsonStr(src) + `}}]}}`))
				return
			}
			_, _ = w.Write([]byte(`{"query":{"pages":[{}]}}`))
			return
		}
		http.NotFound(w, r)
	}))
	t.Cleanup(srv.Close)
	SetWikipediaBaseForTest(t, srv.URL)
}

func jsonStr(s string) string { return `"` + strings.ReplaceAll(s, `"`, `\"`) + `"` }

// THE ROLE'S ARTICLE, AND THE TWO ARTICLES THAT MUST NOT BE MISTAKEN FOR IT.
//
// A search engine always answers, so the interesting cases are the confident
// wrong ones. Returning the FILM's article yields the poster — a picture, of the
// right work, that is not the character and looks entirely plausible in a strip.
// Returning some unrelated subject that merely shares a word is the other.
func TestTheWikimediaCharacterRungTakesTheRoleAndRefusesTheWork(t *testing.T) {
	stubWikipedia(t,
		map[string][]string{
			"V V for Vendetta":            {"V (V for Vendetta)"},
			"Evey Hammond V for Vendetta": {"Evey Hammond"},
			// The search ranking the FILM first, which is what happens when a role
			// has no article of its own.
			"Creedy V for Vendetta": {"V for Vendetta"},
			// A namesake: the article is about something else entirely.
			"Trinity The Matrix": {"Trinity (nuclear test)"},
		},
		map[string]string{
			"V (V for Vendetta)":     "https://upload.wikimedia.org/v-mask.jpg",
			"Evey Hammond":           "https://upload.wikimedia.org/evey.jpg",
			"V for Vendetta":         "https://upload.wikimedia.org/POSTER.jpg",
			"Trinity (nuclear test)": "https://upload.wikimedia.org/bomb.jpg",
		})

	for _, tc := range []struct {
		character, work, want, why string
	}{
		{"V", "V for Vendetta", "https://upload.wikimedia.org/v-mask.jpg",
			"a one-letter role with its own article, found via the work as context"},
		{"Evey Hammond", "V for Vendetta", "https://upload.wikimedia.org/evey.jpg",
			"an ordinary role"},
		{"Creedy", "V for Vendetta", "",
			"the work's own article is the poster, not the character — it must be refused"},
		{"Trinity", "The Matrix", "",
			"an article that does not name the character is a different subject"},
	} {
		got := WikimediaCharacterImages(context.Background(), tc.character, tc.work)
		switch {
		case tc.want == "" && len(got) != 0:
			t.Errorf("%s: got %+v, want nothing — %s", tc.character, got, tc.why)
		case tc.want != "" && (len(got) != 1 || got[0].URL != tc.want):
			t.Errorf("%s: got %+v, want %q — %s", tc.character, got, tc.want, tc.why)
		case tc.want != "" && got[0].Source != "wikimedia":
			t.Errorf("%s: hit does not name its source: %+v", tc.character, got[0])
		}
	}
}

// THE WORK RANKS ABOVE THE CHARACTER, AND THE CHARACTER IS STILL THERE.
//
// This is the shape the real API returns and the one the fixtures above never
// had: every query in that test resolves to exactly ONE article, so a caller
// that read only the first result passed every case. Wikipedia ranks "Woland
// The Master and Margarita" with the NOVEL on top — it matches more of the query
// than the character's article does — and the character second. The rung is
// right to refuse the novel, whose lead image is a book cover; it was wrong to
// stop there, and stopping there is why no character search ever returned
// anything for a work that has an article of its own.
//
// The second half is the same failure with the work absent from the results
// entirely: three unrelated hits under the qualified query, and the character's
// own article reachable only by searching the bare name.
func TestTheCharacterRungReadsPastTheWorksOwnArticle(t *testing.T) {
	stubWikipedia(t,
		map[string][]string{
			// The novel first, the character second — the real ranking.
			"Woland The Master and Margarita": {"The Master and Margarita", "Woland", "Behemoth (cat)"},
			// Nothing usable under the qualified query; the bare name finds them.
			"Behemoth The Master and Margarita": {"The Master and Margarita"},
			"Behemoth":                          {"Behemoth (The Master and Margarita)"},
		},
		map[string]string{
			"The Master and Margarita":            "https://upload.wikimedia.org/COVER.jpg",
			"Woland":                              "https://upload.wikimedia.org/woland.jpg",
			"Behemoth (The Master and Margarita)": "https://upload.wikimedia.org/behemoth-cat.jpg",
		})

	for _, tc := range []struct {
		character, work, want, why string
	}{
		{"Woland", "The Master and Margarita", "https://upload.wikimedia.org/woland.jpg",
			"the novel ranks first and is refused; the character is the next result and must be used"},
		{"Behemoth", "The Master and Margarita", "https://upload.wikimedia.org/behemoth-cat.jpg",
			"no candidate under the qualified query survives, so the bare name is tried and its qualifier fits the work"},
	} {
		got := WikimediaCharacterImages(context.Background(), tc.character, tc.work)
		if len(got) != 1 || got[0].URL != tc.want {
			t.Errorf("%s: got %+v, want %q — %s", tc.character, got, tc.want, tc.why)
		}
	}
}

// A PORTRAIT SEARCH READS PAST A DISAMBIGUATION PAGE for the same reason: the
// top hit for a common name is often the page that lists the people rather than
// one of them, and it carries no image at all.
func TestAPortraitSearchReadsPastAPageWithNoImage(t *testing.T) {
	stubWikipedia(t,
		map[string][]string{
			"Anna Kavan": {"Anna Kavan (disambiguation)", "Anna Kavan"},
		},
		map[string]string{
			// The disambiguation page has no lead image, which is the usual case.
			"Anna Kavan": "https://upload.wikimedia.org/kavan.jpg",
		})
	got := WikimediaPortraitImages(context.Background(), "Anna Kavan", "", "")
	if len(got) != 1 || got[0].URL != "https://upload.wikimedia.org/kavan.jpg" {
		t.Fatalf("got %+v, want the article under the disambiguation page", got)
	}
}

// THE STORED ARTICLE SHORT-CIRCUITS THE SEARCH, which is the whole reason this
// rung is trustworthy for an author: their record already carries the exact
// article, so no name is ever handed to a search engine and the namesake problem
// does not arise. The stub answers no searches at all, so a search would fail.
func TestAPortraitPrefersTheStoredArticleOverSearchingTheName(t *testing.T) {
	stubWikipedia(t, map[string][]string{}, map[string]string{
		"Anna Kavan": "https://upload.wikimedia.org/kavan.jpg",
	})
	// THE STUB'S OWN ADDRESS, not a real en.wikipedia.org one. Written the real
	// way first, this test fetched the live article and passed on a photograph
	// downloaded from Wikimedia during the run — green, offline-hostile, and
	// measuring their servers rather than this code.
	got := WikimediaPortraitImages(context.Background(), "Anna Kavan",
		wikipediaBase+"/wiki/Anna_Kavan", "")
	if len(got) != 1 || got[0].URL != "https://upload.wikimedia.org/kavan.jpg" {
		t.Fatalf("the stored article was not used: %+v", got)
	}
}

// And with no stored article the name IS searched — but the answer still has to
// be about that person. A search returning somebody else is refused rather than
// offered, because a portrait strip full of the wrong face is worse than an
// empty one: the reader cannot tell.
func TestAPortraitSearchRefusesAnArticleAboutSomebodyElse(t *testing.T) {
	stubWikipedia(t,
		map[string][]string{
			"Hugo Weaving": {"Hugo Weaving"},
			"Anna Kavan":   {"Kavan (disambiguation)"},
		},
		map[string]string{
			"Hugo Weaving":           "https://upload.wikimedia.org/hugo.jpg",
			"Kavan (disambiguation)": "https://upload.wikimedia.org/other.jpg",
		})
	if got := WikimediaPortraitImages(context.Background(), "Hugo Weaving", "", ""); len(got) != 1 ||
		got[0].URL != "https://upload.wikimedia.org/hugo.jpg" {
		t.Errorf("a matching article was not taken: %+v", got)
	}
	if got := WikimediaPortraitImages(context.Background(), "Anna Kavan", "", ""); len(got) != 0 {
		t.Errorf("an article naming somebody else was offered as a portrait: %+v", got)
	}
}
