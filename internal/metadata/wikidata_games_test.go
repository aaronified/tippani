package metadata

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// The Wikidata game fallback — what a game lookup does when IGDB cannot answer.
//
// THE RULE THIS FILE PINS is that the fallback is a floor and not a second
// opinion. It has to find a game by TITLE, which is the exact thing
// GameVoiceCast refuses to do (a fuzzy title search picked Hades II for "Hades"
// during that feature's research) — so the constraint that keeps it honest is
// P31=Q7889: a search for "Alan Wake" must not return the novel, the film or the
// character, and a hit whose claims do not say "video game" must be dropped even
// when the search index ranked it first.

// wdGameStub serves the two Action API calls the fallback makes: one CirrusSearch
// and the batched wbgetentities behind it.
type wdGameStub struct {
	srv      *httptest.Server
	hits     []string          // QIDs the search returns, in order
	claims   map[string]string // QID -> raw claims JSON object
	labels   map[string]string // QID -> English label
	images   map[string]string // QID -> P18 commons filename
	lastSrch string            // the srsearch actually sent
}

func newWDGameStub(t *testing.T, s *wdGameStub) *wdGameStub {
	t.Helper()
	s.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		switch {
		case q.Get("action") == "query" && q.Get("list") == "search":
			s.lastSrch = q.Get("srsearch")
			out := []map[string]string{}
			for _, id := range s.hits {
				out = append(out, map[string]string{"title": id, "snippet": "a <span>video</span> game"})
			}
			b, _ := json.Marshal(map[string]any{"query": map[string]any{"search": out}})
			w.Write(b)

		case q.Get("action") == "wbgetentities":
			ids := strings.Split(q.Get("ids"), "|")
			ents := map[string]json.RawMessage{}
			for _, id := range ids {
				parts := []string{}
				if q.Get("props") == "claims" {
					if c, ok := s.claims[id]; ok {
						parts = append(parts, `"claims":`+c)
					}
				} else {
					if l, ok := s.labels[id]; ok {
						parts = append(parts, fmt.Sprintf(`"labels":{"en":{"value":%q}}`, l))
					}
					if f, ok := s.images[id]; ok {
						parts = append(parts, fmt.Sprintf(
							`"claims":{"P18":[{"mainsnak":{"datavalue":{"value":%q}}}]}`, f))
					}
				}
				ents[id] = json.RawMessage("{" + strings.Join(parts, ",") + "}")
			}
			b, _ := json.Marshal(map[string]any{"entities": ents})
			w.Write(b)

		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(s.srv.Close)
	orig := wikidataBase
	wikidataBase = s.srv.URL
	t.Cleanup(func() { wikidataBase = orig })
	return s
}

// gameClaims builds the claims object for a video game with a publication year.
func gameClaims(year int, extra string) string {
	c := fmt.Sprintf(`{"P31":[{"mainsnak":{"datavalue":{"value":{"id":"Q7889"}}}}],`+
		`"P577":[{"mainsnak":{"datavalue":{"value":{"time":"+%d-01-01T00:00:00Z"}}}}]`, year)
	if extra != "" {
		c += "," + extra
	}
	return c + "}"
}

func TestWikidataGameSearchConstrainsToVideoGames(t *testing.T) {
	s := newWDGameStub(t, &wdGameStub{
		hits:   []string{"Q1"},
		claims: map[string]string{"Q1": gameClaims(2010, "")},
		labels: map[string]string{"Q1": "Alan Wake"},
	})
	got, err := SearchGamesWikidata(context.Background(), "Alan Wake", 0)
	if err != nil {
		t.Fatal(err)
	}
	// The constraint is the whole defence against the novel and the film.
	if !strings.Contains(s.lastSrch, "haswbstatement:P31=Q7889") {
		t.Fatalf("srsearch = %q, want it constrained to P31=Q7889", s.lastSrch)
	}
	if !strings.Contains(s.lastSrch, "Alan Wake") {
		t.Fatalf("srsearch = %q, want the title in it", s.lastSrch)
	}
	if len(got) != 1 || got[0].Title != "Alan Wake" || got[0].ReleaseYear != 2010 {
		t.Fatalf("candidates = %+v", got)
	}
	if got[0].Source != "wikidata" || got[0].MediaType != "game" || got[0].SourceID != "Q1" {
		t.Fatalf("a fallback candidate must be tagged so the picker can say where it came from: %+v", got[0])
	}
}

// The search index ranks on TEXT as well as on the statement filter, so a hit
// that is not actually a video game can come back. Trusting the index would put
// the novel in a games picker.
func TestWikidataGameSearchDropsAnythingThatIsNotAGame(t *testing.T) {
	newWDGameStub(t, &wdGameStub{
		hits: []string{"Q_novel", "Q_game"},
		claims: map[string]string{
			// A novel: P31 says written work, not video game.
			"Q_novel": `{"P31":[{"mainsnak":{"datavalue":{"value":{"id":"Q47461344"}}}}]}`,
			"Q_game":  gameClaims(2010, ""),
		},
		labels: map[string]string{"Q_novel": "Alan Wake", "Q_game": "Alan Wake"},
	})
	got, err := SearchGamesWikidata(context.Background(), "Alan Wake", 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].SourceID != "Q_game" {
		t.Fatalf("the novel survived a games search: %+v", got)
	}
}

func TestWikidataGameSearchFiltersByYear(t *testing.T) {
	newWDGameStub(t, &wdGameStub{
		hits: []string{"Q1", "Q2"},
		claims: map[string]string{
			"Q1": gameClaims(2010, ""),
			"Q2": gameClaims(2023, ""),
		},
		labels: map[string]string{"Q1": "Alan Wake", "Q2": "Alan Wake II"},
	})
	got, _ := SearchGamesWikidata(context.Background(), "Alan Wake", 2023)
	if len(got) != 1 || got[0].SourceID != "Q2" {
		t.Fatalf("year filter: %+v", got)
	}
}

// A re-release carries a publication statement per platform. The year a reader
// means is the one it came out, so the EARLIEST wins.
func TestWikidataGameYearTakesTheEarliestRelease(t *testing.T) {
	newWDGameStub(t, &wdGameStub{
		hits: []string{"Q1"},
		claims: map[string]string{"Q1": `{"P31":[{"mainsnak":{"datavalue":{"value":{"id":"Q7889"}}}}],` +
			`"P577":[{"mainsnak":{"datavalue":{"value":{"time":"+2021-06-01T00:00:00Z"}}}},` +
			`{"mainsnak":{"datavalue":{"value":{"time":"+2011-11-11T00:00:00Z"}}}}]}`},
		labels: map[string]string{"Q1": "Skyrim"},
	})
	got, _ := SearchGamesWikidata(context.Background(), "Skyrim", 0)
	if len(got) != 1 || got[0].ReleaseYear != 2011 {
		t.Fatalf("want the original 2011 release, got %+v", got)
	}
}

func TestWikidataGameSearchIsEmptyRatherThanAnError(t *testing.T) {
	// Plenty of games are not in Wikidata at all, and that is a normal outcome
	// rather than a failure — the caller falls through to manual entry.
	newWDGameStub(t, &wdGameStub{hits: nil})
	got, err := SearchGamesWikidata(context.Background(), "A Game Nobody Catalogued", 0)
	if err != nil || len(got) != 0 {
		t.Fatalf("got %v, %v — an unknown game is empty, not an error", got, err)
	}
}

// The developer is the studio, and lands in Director — the same column a show's
// creator uses (0040). The publisher lands in Publisher (0042); there is no
// longer any fallback between the two.
func TestWikidataGameDetailsMapsStudioAndFranchise(t *testing.T) {
	newWDGameStub(t, &wdGameStub{
		claims: map[string]string{"Q1": gameClaims(2011,
			`"P178":[{"mainsnak":{"datavalue":{"value":{"id":"Q_dev"}}}}],`+
				`"P179":[{"mainsnak":{"datavalue":{"value":{"id":"Q_series"}}}}],`+
				`"P136":[{"mainsnak":{"datavalue":{"value":{"id":"Q_genre"}}}}],`+
				`"P5794":[{"mainsnak":{"datavalue":{"value":"skyrim"}}}]`)},
		labels: map[string]string{
			"Q1": "The Elder Scrolls V: Skyrim", "Q_dev": "Bethesda Game Studios",
			"Q_series": "The Elder Scrolls", "Q_genre": "action role-playing game",
		},
		images: map[string]string{"Q_dev": "Bethesda.svg"},
	})
	d, err := GameDetailsWikidata(context.Background(), "Q1")
	if err != nil {
		t.Fatal(err)
	}
	if d.Director != "Bethesda Game Studios" {
		t.Fatalf("studio must land in Director (the column a show's creator uses): %q", d.Director)
	}
	if d.Publisher != "" {
		t.Errorf("Publisher = %q — this record states no P123, so the field is empty", d.Publisher)
	}
	if d.Series != "The Elder Scrolls" || d.ReleaseYear != 2011 {
		t.Fatalf("details = %+v", d)
	}
	if len(d.Genres) != 1 || d.Genres[0] != "action role-playing game" {
		t.Fatalf("genres = %v", d.Genres)
	}
	if !strings.Contains(d.StudioLogoURL, "Bethesda.svg") {
		t.Fatalf("studio logo = %q — it becomes the portrait on a 'studio' people row", d.StudioLogoURL)
	}
	// The IGDB slug is carried even here, because it is the join key the voice
	// cast needs — so a cast can arrive through the fallback too.
	if d.Slug != "skyrim" {
		t.Fatalf("slug = %q, want it carried for the cast join", d.Slug)
	}
	if d.MediaType != "game" || d.Source != "wikidata" {
		t.Fatalf("details = %+v", d)
	}
}

// TestWikidataGameDetailsDoesNotPassThePublisherOffAsTheStudio replaces
// TestWikidataGameDetailsFallsBackToThePublisher. Same reasoning as the IGDB
// side: with a column of its own, the publisher no longer has to borrow the
// studio's label to be shown at all.
func TestWikidataGameDetailsDoesNotPassThePublisherOffAsTheStudio(t *testing.T) {
	newWDGameStub(t, &wdGameStub{
		claims: map[string]string{"Q1": gameClaims(2015,
			`"P123":[{"mainsnak":{"datavalue":{"value":{"id":"Q_pub"}}}}]`)},
		labels: map[string]string{"Q1": "A Game", "Q_pub": "Some Publisher"},
	})
	d, err := GameDetailsWikidata(context.Background(), "Q1")
	if err != nil {
		t.Fatal(err)
	}
	if d.Director != "" {
		t.Errorf("Director = %q — with no P178 the studio is unknown, not the publisher", d.Director)
	}
	if d.Publisher != "Some Publisher" {
		t.Errorf("Publisher = %q, want Some Publisher", d.Publisher)
	}
}

// The Mass Effect shape on the Wikidata side: a company stated as BOTH developer
// and publisher is passed over while a developer-only company exists, and the
// LOGO follows the name rather than the first P178 statement — otherwise the icon
// and the credit beside it would describe two different companies.
func TestWikidataGameDetailsPrefersTheDeveloperThatOnlyDevelops(t *testing.T) {
	newWDGameStub(t, &wdGameStub{
		claims: map[string]string{"Q1": gameClaims(2021,
			`"P178":[{"mainsnak":{"datavalue":{"value":{"id":"Q_ea"}}}},` +
				`{"mainsnak":{"datavalue":{"value":{"id":"Q_bioware"}}}}],` +
				`"P123":[{"mainsnak":{"datavalue":{"value":{"id":"Q_ea"}}}}]`)},
		labels: map[string]string{
			"Q1": "Mass Effect Legendary Edition", "Q_ea": "Electronic Arts", "Q_bioware": "BioWare",
		},
		images: map[string]string{"Q_ea": "EA.svg", "Q_bioware": "BioWare.svg"},
	})
	d, err := GameDetailsWikidata(context.Background(), "Q1")
	if err != nil {
		t.Fatal(err)
	}
	if d.Director != "BioWare" {
		t.Errorf("Director (studio) = %q, want BioWare", d.Director)
	}
	if d.Publisher != "Electronic Arts" {
		t.Errorf("Publisher = %q, want Electronic Arts", d.Publisher)
	}
	if !strings.Contains(d.StudioLogoURL, "BioWare.svg") {
		t.Errorf("studio logo = %q — it must be the logo of the company named as the studio", d.StudioLogoURL)
	}
}

// Narrowing must never blank: a studio that publishes its own game is still the
// studio, and is named in both fields because both are true of it.
func TestWikidataGameDetailsKeepsASelfPublishingStudio(t *testing.T) {
	newWDGameStub(t, &wdGameStub{
		claims: map[string]string{"Q1": gameClaims(2019,
			`"P178":[{"mainsnak":{"datavalue":{"value":{"id":"Q_lw"}}}}],` +
				`"P123":[{"mainsnak":{"datavalue":{"value":{"id":"Q_lw"}}}}]`)},
		labels: map[string]string{"Q1": "Hollow Reach", "Q_lw": "Lantern Works"},
		images: map[string]string{"Q_lw": "Lantern.svg"},
	})
	d, err := GameDetailsWikidata(context.Background(), "Q1")
	if err != nil {
		t.Fatal(err)
	}
	if d.Director != "Lantern Works" || d.Publisher != "Lantern Works" {
		t.Fatalf("studio/publisher = %q / %q — both, because both are true", d.Director, d.Publisher)
	}
	if !strings.Contains(d.StudioLogoURL, "Lantern.svg") {
		t.Errorf("studio logo = %q", d.StudioLogoURL)
	}
}

func TestWikidataGameDetailsRefusesSomethingThatIsNotAQID(t *testing.T) {
	newWDGameStub(t, &wdGameStub{})
	if _, err := GameDetailsWikidata(context.Background(), "12345"); err == nil {
		t.Fatal("a non-Q id must not reach the API")
	}
}

// The snippet is the only one-line description this path has, and CirrusSearch
// wraps the matched words in markup. It is shown in a picker, not parsed.
func TestStripHTMLFlattensASearchSnippet(t *testing.T) {
	got := stripHTML(`a <span class="searchmatch">video</span> game  by &quot;someone&quot;`)
	if got != `a video game by "someone"` {
		t.Fatalf("stripHTML = %q", got)
	}
}
