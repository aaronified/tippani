package metadata

// Letterboxd — a film's own page, read for the fields its community curates.
//
// WHY IT IS WORTH A SUPPLIER. TMDB and TheTVDB are catalogues: they hold what a
// distributor filed. Letterboxd is a film site, and the thing it is better at is
// the SYNOPSIS — written to tell somebody what a film is like rather than to fill
// a database column — and the poster, which is chosen by people who care which
// poster it is. It is not better at structure: it has no episode model, no
// per-role art, and no ids anybody else uses. So it belongs where this app now
// puts suppliers that are better at some fields and worse at others: as another
// column in the per-field picker, never as the record's owner.
//
// NO API, SO THE PAGE. Letterboxd publishes no public API — there has been a
// "coming soon" for years — so this reads the film's own page. That makes it a
// scrape, and it is held to the discipline PLAN already records for the Amazon
// and Hardcover ones: read the STRUCTURED thing on the page rather than the
// markup around it, and return silence rather than partial garbage.
//
// AND THE STRUCTURED THING IS REAL. Every film page embeds a schema.org Movie as
// JSON-LD — name, description, image, director, genre, actor — which is the same
// bargain imdb.go strikes with __NEXT_DATA__ and for the same reason: markup
// rotates every few months, a published JSON document does not, because other
// people's crawlers depend on it. The one field NOT in the JSON-LD is the release
// year, which is read from the page's own year link; if that ever moves, the year
// is dropped and every other field still arrives.
//
// THE SLUG IS A GUESS, exactly as Fandom's wiki name is, and costs a 404 when it
// is wrong. Letterboxd slugs are the title lowercased and hyphenated, which is
// right far more often than not and is checkable in one request. There is no
// search step because a title search is where a wrong film gets attached to a
// right record — the mistake igdb_cast.go watched happen with Hades.

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"unicode"

	"tippani/internal/olog"
)

const defaultLetterboxdBase = "https://letterboxd.com"

var letterboxdBase = defaultLetterboxdBase

var (
	ldJSONRe = regexp.MustCompile(`(?s)<script type="application/ld\+json">(.*?)</script>`)
	// The year lives on a link to that year's films rather than in the JSON-LD.
	lbYearRe = regexp.MustCompile(`/films/year/(\d{4})/`)
	// JSON-LD on these pages is wrapped in a CDATA-style comment pair.
	ldCommentRe = regexp.MustCompile(`(?s)/\*.*?\*/`)
)

// LetterboxdSlug turns a title into the page slug Letterboxd is most likely to
// use: lowercase, alphanumerics, single hyphens. "V for Vendetta" ->
// v-for-vendetta.
//
// NO LEADING ARTICLE IS DROPPED, unlike a Fandom wiki name — Letterboxd keeps
// them ("the-matrix"), which is the opposite convention and worth stating so the
// two guesses are not "improved" into agreement later.
func LetterboxdSlug(title string) string {
	var b strings.Builder
	prevDash := false
	for _, r := range strings.ToLower(strings.TrimSpace(title)) {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(r)
			prevDash = false
		case !prevDash && b.Len() > 0:
			b.WriteRune('-')
			prevDash = true
		}
	}
	return strings.TrimRight(b.String(), "-")
}

// letterboxdLD is the schema.org Movie the page publishes.
type namedThing struct {
	Name string `json:"name"`
}

type letterboxdLD struct {
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Image       string       `json:"image"`
	Genre       []string     `json:"genre"`
	Director    []namedThing `json:"director"`
	Actor       []namedThing `json:"actor"`
	// DateCreated is the release date, and it is the STRUCTURED answer for the
	// year — the page's year link is a fallback for when this is absent.
	DateCreated string `json:"dateCreated"`
	// ProductionCompany maps to `publisher`, which 0042 defines as who PUT IT OUT
	// as against who made it. Letterboxd lists several; the first is the lead.
	ProductionCompany []namedThing `json:"productionCompany"`
}

// LetterboxdDetails fetches one film page and returns what it publishes about
// itself. Empty title in, nothing out; a page that is not there, or not readable,
// is nothing rather than an error — a rung that cannot answer must not be able to
// fail the request it is one of.
func LetterboxdDetails(ctx context.Context, title string) (*MovieDetails, error) {
	slug := LetterboxdSlug(title)
	if slug == "" {
		return nil, nil
	}
	u := letterboxdBase + "/film/" + slug + "/"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, nil
	}
	// A BROWSER STRING, for the reason amazon.go gives: a site that serves a bot
	// wall to obvious non-browser agents cannot be read by one.
	req.Header.Set("User-Agent", browserUA)
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	resp, err := httpClient.Do(req)
	if err != nil {
		olog.Tracef("[meta] letterboxd %s: %v", slug, err)
		return nil, nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		// A WRONG SLUG IS A 404 AND IS THE ORDINARY CASE. Not logged above trace:
		// this rung guesses, and a guess that missed is not a fault to report.
		olog.Tracef("[meta] letterboxd %s -> %d", slug, resp.StatusCode)
		return nil, nil
	}
	page, err := io.ReadAll(io.LimitReader(resp.Body, maxHTMLBody))
	if err != nil {
		return nil, nil
	}
	return parseLetterboxd(page, slug)
}

// parseLetterboxd is the whole of the reading, separated so it can be tested
// against a fixture without a server.
func parseLetterboxd(page []byte, slug string) (*MovieDetails, error) {
	m := ldJSONRe.FindSubmatch(page)
	if m == nil {
		return nil, fmt.Errorf("letterboxd: no structured record on the page")
	}
	raw := strings.TrimSpace(ldCommentRe.ReplaceAllString(string(m[1]), ""))
	var ld letterboxdLD
	if err := json.Unmarshal([]byte(raw), &ld); err != nil {
		return nil, fmt.Errorf("letterboxd: %w", err)
	}
	if strings.TrimSpace(ld.Name) == "" {
		return nil, fmt.Errorf("letterboxd: the record has no title")
	}
	d := &MovieDetails{
		Source:    "letterboxd",
		SourceID:  slug,
		MediaType: "movie",
		Title:     strings.TrimSpace(ld.Name),
		Overview:  strings.TrimSpace(ld.Description),
		PosterURL: strings.TrimSpace(ld.Image),
		Genres:    ld.Genre,
	}
	// One art URL, so the picker thumbnail and the stored poster are the same
	// image — the same note tvdb.go makes about TheTVDB.
	d.PosterThumbURL = d.PosterURL
	// EVERY DIRECTOR, NOT THE FIRST. A film with two of them has two, and the
	// Wachowskis are the reason this is not a detail: taking [0] credits one
	// sibling and silently drops the other. Joined the way the app's own credit
	// separators expect, so the people console splits them back apart.
	d.Director = joinNames(ld.Director)
	// The lead production company. `publisher` is who put it out rather than who
	// made it (0042), and Letterboxd lists them in that order.
	if len(ld.ProductionCompany) > 0 {
		d.Publisher = strings.TrimSpace(ld.ProductionCompany[0].Name)
	}
	// THE RELEASE YEAR, FROM THE DOCUMENT FIRST. dateCreated is inside the record
	// other people's crawlers depend on; the year link is markup on the page
	// around it. Reading the structured one first is the same preference this
	// whole file is built on, and the fallback means a film whose record omits the
	// date still gets a year.
	if len(ld.DateCreated) >= 4 {
		d.ReleaseYear, _ = strconv.Atoi(ld.DateCreated[:4])
	}
	if d.ReleaseYear == 0 {
		if y := lbYearRe.FindSubmatch(page); y != nil {
			d.ReleaseYear, _ = strconv.Atoi(string(y[1]))
		}
	}
	// CAST WITHOUT CHARACTERS, which is what the page publishes: schema.org's
	// `actor` is a list of people and carries no role. Offered anyway because an
	// actor list is worth having and the merge tolerates a row with no character —
	// but capped like every other supplier's, and deliberately NOT dressed up with
	// invented character names.
	for _, a := range ld.Actor {
		if len(d.Cast) >= maxCast {
			break
		}
		if n := strings.TrimSpace(a.Name); n != "" {
			d.Cast = append(d.Cast, CastMember{Actor: n})
		}
	}
	d.Raw = json.RawMessage(raw)
	return d, nil
}

// joinNames renders a list of people as one credit string, using the separator
// the app's own credit splitter treats as canonical — so "the Wachowskis" arrive
// as two people rather than as one person with an ampersand in their name.
func joinNames(in []namedThing) string {
	out := make([]string, 0, len(in))
	for _, n := range in {
		if v := strings.TrimSpace(n.Name); v != "" {
			out = append(out, v)
		}
	}
	return strings.Join(out, ", ")
}
