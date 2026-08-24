package metadata

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
)

// IMDb — a cast list for a title IMDb knows and no structured source does.
//
// WHY THIS EXISTS AT ALL, given what igdb_cast.go's header already says. That
// measurement stands: over 24 well-known games, IGDB has no credit endpoint,
// MobyGames exposes none, Giant Bomb returns an unroled list, and Wikidata — the
// one structured free source — had NOTHING for eight of them, including The
// Witcher 3 and Mass Effect 3. IMDb has all of those, with characters. So this is
// not a better source than Wikidata; it is a source for the titles where Wikidata
// is empty, which is most of the games this feature was asked for.
//
// IT IS OFF UNLESS ASKED, EVERY TIME. There is no scheduled use of this file, no
// backfill, and nothing on any read path calls it: a reader presses a control on
// one work and one request goes out. That is a deliberate contract and not an
// implementation detail — see the ONE PASS rule below.
//
// ONE PASS PER TITLE, ONE REQUEST PER PASS. `Cast` performs exactly one GET, of
// the title's own page, and parses what that page already carries. It does not
// follow the "full cast" link, does not page, does not fetch a person page for a
// portrait, and does not search — the caller supplies the title id, because a
// title SEARCH is where a wrong cast gets attached to a right work (igdb_cast.go
// watched a fuzzy search pick *Hades II* for "Hades"). If the page does not carry
// what we need, the answer is "nothing found", not a second request.
//
// WHAT IT READS. The title page embeds its own data as JSON in a
// `__NEXT_DATA__` script — the same JSON the page renders itself from — and the
// top-billed cast sits in it with each actor's characters beside them. That is
// parsed structurally (encoding/json over the embedded document), not scraped out
// of markup with patterns: markup changes every few months and a JSON document's
// field names are the page's own API to itself. A missing or renamed field
// degrades to an empty list, which is the same outcome as a title with no cast.
//
// WHAT IT DELIBERATELY DOES NOT DO. It stores nothing, caches nothing, and knows
// nothing about the database: it returns []CastMember exactly as the TMDB and
// Wikidata paths do, so the row-level provenance rule of 0048 — a refetch never
// overwrites or deletes a row the reader has touched — applies to it unchanged and
// without this file having to know about it.
//
// A NOTE ON TERMS OF USE, recorded here because it belongs with the code rather
// than in a commit message. IMDb publishes no free API and its conditions of use
// prohibit data mining and scraping; it does publish official datasets under a
// non-commercial licence, which include video games and their principals. This
// path is a single on-demand fetch of a page a reader has explicitly asked for, of
// a title they are looking at, for their own private library — but it is their
// call, not mine, which is why nothing here runs unless a control is pressed and
// why the datasets remain the route to prefer for anything bulk.

// ErrNoIMDbTitle means the id was rejected before any request went out, or IMDb
// answered with something that is not a title page. Distinguished from "a title
// with no cast" for the reason ErrNoWikidataGame is: the first is worth an
// operator code, the second is a normal, common answer.
var ErrNoIMDbTitle = errors.New("no imdb title for this id")

// imdbTitleID is the only shape accepted, and it is checked BEFORE a request is
// built. `tt` plus 7 to 9 digits is the whole of IMDb's title-id format, and
// anything else — a name id, a path, a query string, a full URL with a redirect
// in it — is refused here rather than concatenated into a URL. This is the SSRF
// guard for this provider: the host is a constant below and the only variable part
// of the URL is matched against this.
var imdbTitleID = regexp.MustCompile(`^tt[0-9]{7,9}$`)

// nextDataScript finds the embedded JSON document. Anchored on the script tag's
// own id, which is a documented part of the framework rather than a class name
// somebody chose, and non-greedy so a page carrying two scripts yields the first
// rather than everything between the first and the last.
var nextDataScript = regexp.MustCompile(`(?s)<script id="__NEXT_DATA__" type="application/json"[^>]*>(.*?)</script>`)

// imdbHost is a constant, and the reason it is not configurable is the guard
// above: with a fixed host and an id matched against `^tt\d{7,9}$`, the URL this
// file can construct is a finite, inspectable set.
const imdbHost = "https://www.imdb.com"

// IMDbTitleID normalises whatever the reader pasted into a title id, or "" when it
// is not one. A URL is accepted because that is what a reader has in their hand —
// they copied it from the address bar — and the id is extracted from it rather
// than the URL being used: what goes out is built here, from the id.
func IMDbTitleID(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if imdbTitleID.MatchString(s) {
		return s
	}
	// Any `tt…` run inside a longer string — `imdb.com/title/tt1073668/?ref_=x`,
	// or the id with punctuation round it. The FIRST match wins, and it must still
	// satisfy the full-string pattern above once isolated.
	if m := regexp.MustCompile(`tt[0-9]{7,9}`).FindString(s); m != "" && imdbTitleID.MatchString(m) {
		return m
	}
	return ""
}

// imdbCastDoc is the shape read out of the embedded document. Every level is
// optional in the sense that a missing one decodes to a zero value and yields no
// cast — the decode is tolerant by construction, exactly as every other provider
// in this package is.
type imdbCastDoc struct {
	Props struct {
		PageProps struct {
			// The title page's main column carries the top-billed cast.
			MainColumnData struct {
				Cast struct {
					Edges []struct {
						Node struct {
							Name struct {
								ID       string `json:"id"`
								NameText struct {
									Text string `json:"text"`
								} `json:"nameText"`
								PrimaryImage struct {
									URL string `json:"url"`
								} `json:"primaryImage"`
							} `json:"name"`
							Characters []struct {
								Name string `json:"name"`
							} `json:"characters"`
						} `json:"node"`
					} `json:"edges"`
				} `json:"cast"`
				TitleText struct {
					Text string `json:"text"`
				} `json:"titleText"`
				TitleType struct {
					ID string `json:"id"`
				} `json:"titleType"`
			} `json:"mainColumnData"`
		} `json:"pageProps"`
	} `json:"props"`
}

// IMDbTitle is what one pass returns beside the cast: the title as IMDb spells it
// and what kind of thing IMDb thinks it is (`movie`, `tvSeries`, `videoGame`, …).
// Both are for the reader's confirmation — a cast attached to the wrong work is
// the failure mode this whole file is arranged to avoid, and the surest guard is
// showing them the name of what was fetched.
type IMDbTitle struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Kind  string `json:"kind"`
}

// IMDbBaseURL lets a test point this at its own server. Empty means the real host,
// and the id guard applies either way — the same seam every other provider here
// carries.
var IMDbBaseURL string

func imdbBase() string {
	if IMDbBaseURL != "" {
		return IMDbBaseURL
	}
	return imdbHost
}

// IMDbCast performs the single pass: one GET of the title page, one parse, and the
// cast with each actor's characters. The character is the FIRST of the characters
// listed for that actor, because that is the role the line belongs to; the rest are
// dropped rather than joined, since "Geralt / Narrator" as one character name would
// match nothing when a quote's character is typed.
func IMDbCast(ctx context.Context, rawID string) (IMDbTitle, []CastMember, error) {
	id := IMDbTitleID(rawID)
	if id == "" {
		return IMDbTitle{}, nil, ErrNoIMDbTitle
	}
	url := fmt.Sprintf("%s/title/%s/", imdbBase(), id)
	body, status, err := httpGet(ctx, url, "")
	if err != nil {
		return IMDbTitle{}, nil, err
	}
	if status == http.StatusNotFound {
		return IMDbTitle{}, nil, ErrNoIMDbTitle
	}
	if status != http.StatusOK {
		return IMDbTitle{}, nil, fmt.Errorf("imdb: title %s returned %d", id, status)
	}
	m := nextDataScript.FindSubmatch(body)
	if m == nil {
		// The page loaded and does not carry the document. NOT a second request:
		// see the ONE PASS rule. It is an error rather than an empty list because
		// the reader asked for something and got nothing, and the two cases are
		// worth telling apart in a log.
		return IMDbTitle{}, nil, ErrNoIMDbTitle
	}
	var doc imdbCastDoc
	if err := json.Unmarshal(m[1], &doc); err != nil {
		return IMDbTitle{}, nil, err
	}
	main := doc.Props.PageProps.MainColumnData
	title := IMDbTitle{ID: id, Title: strings.TrimSpace(main.TitleText.Text), Kind: main.TitleType.ID}

	out := []CastMember{}
	seen := map[string]bool{}
	for _, e := range main.Cast.Edges {
		actor := strings.TrimSpace(e.Node.Name.NameText.Text)
		character := ""
		if len(e.Node.Characters) > 0 {
			character = strings.TrimSpace(e.Node.Characters[0].Name)
		}
		// A credit with neither name is nothing; a credit with only an actor is
		// still a credit, and the cast table takes a row with an empty character
		// exactly as the TMDB path does.
		if actor == "" && character == "" {
			continue
		}
		// One row per (character, actor). IMDb lists an actor once per role, so a
		// doubled pair is a duplicate on the page rather than two credits.
		key := strings.ToLower(character + "\x1f" + actor)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, CastMember{
			Character: character,
			Actor:     actor,
			PersonID:  strings.TrimSpace(e.Node.Name.ID),
			// The portrait URL is read but NOT fetched here — the cast writer
			// downloads portraits through the SSRF-guarded fetcher when it wants
			// one, which is the same path TMDB's poster takes. m.media-amazon.com is
			// already on the cover allowlist.
			ImageURL: strings.TrimSpace(e.Node.Name.PrimaryImage.URL),
		})
	}
	return title, out, nil
}
