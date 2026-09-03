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

	got := FandomCharacterImages(context.Background(), "V", "vforvendetta")
	if len(got) != 1 || got[0].URL != "https://static.wikia.nocookie.net/v.jpg" {
		t.Fatalf("the wiki answered and the hit was lost: %+v", got)
	}
	if got[0].Source != "fandom" {
		t.Errorf("hit does not name its source: %+v", got[0])
	}
	// A PAGE THAT IS NOT THERE IS NOT AN IMAGE. MediaWiki answers `missing:true`
	// with a 200, so a caller that only checked the status code would offer an
	// empty struct's zero-value URL as a picture.
	if got := FandomCharacterImages(context.Background(), "Nobody", "vforvendetta"); len(got) != 0 {
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

// THE NAME AS STORED IS NOT THE ARTICLE'S TITLE, and that used to end the search.
//
// This rung asked the wiki for `titles=<the name as stored>`, which finds an
// article only when the two agree exactly. A reader's "Agent Smith" against an
// article called "Smith (The Matrix)", a "Prince Myshkin" against "Lev
// Nikolayevich Myshkin", every character billed by a nickname: all missed, and a
// miss was reported as "this wiki has no picture of them". Wikipedia's rung has
// always searched; this one was the one asked to guess the title.
func TestFandomSearchesWhenTheExactTitleMisses(t *testing.T) {
	var paths []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		paths = append(paths, q.Get("list")+":"+q.Get("titles")+q.Get("srsearch"))
		if q.Get("list") == "search" {
			if q.Get("srsearch") == "Agent Smith" {
				_, _ = w.Write([]byte(`{"query":{"search":[{"title":"Smith (The Matrix)"}]}}`))
				return
			}
			_, _ = w.Write([]byte(`{"query":{"search":[]}}`))
			return
		}
		title, _ := url.QueryUnescape(q.Get("titles"))
		if title == "Smith (The Matrix)" {
			_, _ = w.Write([]byte(`{"query":{"pages":[{"original":{"source":"https://static.wikia.nocookie.net/smith.jpg"}}]}}`))
			return
		}
		_, _ = w.Write([]byte(`{"query":{"pages":[{"missing":true}]}}`))
	}))
	defer srv.Close()
	SetFandomAndScrapeBasesForTest(t, srv.URL, "")

	got := FandomCharacterImages(context.Background(), "Agent Smith", "matrix")
	if len(got) != 1 || got[0].URL != "https://static.wikia.nocookie.net/smith.jpg" {
		t.Fatalf("got %+v, want the article the search found", got)
	}
	if got[0].Source != "fandom" {
		t.Errorf("hit does not name its source: %+v", got[0])
	}
	// The exact title is still tried FIRST, because when it hits it is the right
	// article by definition and costs one request instead of two.
	if len(paths) < 2 || paths[0] != ":Agent Smith" {
		t.Errorf("the exact title was not tried first: %v", paths)
	}

	// AND A SEARCH THAT FINDS NOTHING IS STILL NOTHING. The fallback must not turn
	// "no such character" into a picture of whatever the wiki ranked first.
	if got := FandomCharacterImages(context.Background(), "Nobody At All", "matrix"); len(got) != 0 {
		t.Errorf("a search with no results produced a hit: %+v", got)
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

	d, err := FandomWorkDetails(context.Background(), "V for Vendetta", "vfv")
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
	if got, _ := FandomWorkDetails(context.Background(), "Nothing At All", "vfv"); got != nil {
		t.Errorf("a missing article produced a record: %+v", got)
	}
}

// THE WIKI IS NAMED FOR THE FRANCHISE, NOT THE INSTALMENT, and the plain
// title-derived slug misses exactly there.
//
// MEASURED AGAINST THE REAL SITE before this was written: over nine titles the
// plain guess found six wikis, and all three misses were a numbered or subtitled
// entry — witcher3wildhunt (it is `witcher`), masseffect3 (`masseffect`),
// elderscrollsvskyrim (`elderscrolls`). Games and long-running series are
// overwhelmingly that shape, and they are also the works with no other source of
// character art at all.
//
// So the ladder is: full slug, then without the subtitle, then without the
// instalment number, then without a roman numeral. Most specific FIRST, because a
// wiki dedicated to one instalment is a better answer than the franchise's when
// both exist.
func TestTheWikiLadderReachesTheFranchiseWhenTheInstalmentHasNoWiki(t *testing.T) {
	for _, tc := range []struct {
		title string
		want  string // the franchise root the ladder must eventually offer
	}{
		{"The Witcher 3: Wild Hunt", "witcher"},
		{"Mass Effect 3", "masseffect"},
		{"The Elder Scrolls V: Skyrim", "elderscrolls"},
		{"Hades", "hades"},
		{"Death Note", "deathnote"},
	} {
		got := FandomWikiCandidates(tc.title)
		if len(got) == 0 {
			t.Fatalf("%q produced no candidates", tc.title)
		}
		// The most specific guess leads.
		if got[0] != fandomSlug(tc.title) {
			t.Errorf("%q leads with %q, want the full slug %q", tc.title, got[0], fandomSlug(tc.title))
		}
		found := false
		for _, c := range got {
			if c == tc.want {
				found = true
			}
		}
		if !found {
			t.Errorf("%q never offers %q — the ladder does not reach the franchise: %v",
				tc.title, tc.want, got)
		}
	}
	// No duplicates: a standalone title collapses to one candidate rather than
	// probing the same wiki four times.
	if got := FandomWikiCandidates("Hades"); len(got) != 1 {
		t.Errorf("a standalone title produced %v, want one candidate", got)
	}
}

// The resolver stops at the FIRST wiki that answers, and asks no further.
func TestFandomResolveWikiStopsAtTheFirstWikiThatExists(t *testing.T) {
	var asked []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// THE SLUG IS IN THE PATH, NOT THE HOST. In production the wiki is a
		// SUBDOMAIN, and a subdomain of 127.0.0.1 does not resolve — so the seam
		// takes a format string and the test puts %s where it can be read back.
		slug := strings.Trim(strings.TrimSuffix(r.URL.Path, "/api.php"), "/")
		asked = append(asked, slug)
		if slug == "witcher" { // only the franchise wiki exists, as in the real world
			_, _ = w.Write([]byte(`{"batchcomplete":true}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()
	SetFandomAndScrapeBasesForTest(t, srv.URL+"/%s", "")

	got := FandomResolveWiki(context.Background(), "The Witcher 3: Wild Hunt")
	if got != "witcher" {
		t.Fatalf("resolved to %q, want witcher (asked: %v)", got, asked)
	}
	if len(asked) != 3 {
		t.Errorf("asked %d wikis (%v), want three — full, de-subtitled, de-numbered", len(asked), asked)
	}
	// A title with no wiki at all resolves to nothing rather than to a guess.
	if got := FandomResolveWiki(context.Background(), "Something Nobody Wrote About"); got != "" {
		t.Errorf("an unknown work resolved to %q", got)
	}
}
