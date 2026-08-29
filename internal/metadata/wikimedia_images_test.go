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
