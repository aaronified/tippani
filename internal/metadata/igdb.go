package metadata

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	igdbBase     = "https://api.igdb.com/v4"
	igdbTokenURL = "https://id.twitch.tv/oauth2/token"

	// Two cover sizes for two jobs, mirroring the TMDB pair: t_cover_small for
	// the lookup picker, t_cover_big_2x for the image that gets downloaded and
	// stored. IGDB serves these as path segments rather than query params.
	igdbImageBase      = "https://images.igdb.com/igdb/image/upload/t_cover_small/"
	igdbImageFetchBase = "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/"
)

// ErrIGDBAuth signals Twitch rejected the client credentials at the token
// exchange, or returned a token IGDB then refused. It mirrors ErrTVDBAuth so the
// handler can say "IGDB rejected the key" rather than a generic failure — the
// distinction matters because the two IGDB settings are a client id AND a
// secret, and "one of your two keys is wrong" is the only actionable message.
var ErrIGDBAuth = errors.New("igdb rejected the client credentials")

// IGDBCoverURL builds the full-size cover URL for an IGDB image_id — the
// download+store variant, not the picker thumbnail. Shared with httpapi's
// covers-refetch so the size lives in exactly one place, as TMDBPosterURL is.
func IGDBCoverURL(imageID string) string {
	if imageID == "" {
		return ""
	}
	return igdbImageFetchBase + imageID + ".jpg"
}

// IGDB is the api.igdb.com/v4 client (PLAN §6, the games supplier).
//
// Two things make it unlike the other providers here. Its queries are POSTs
// carrying an Apicalypse body rather than GETs with a query string; and its auth
// is a Twitch OAuth client-credentials exchange, so it needs BOTH a client id
// (sent as a Client-ID header on every call) and a secret (spent once for a
// bearer token). The token lasts ~60 days, is cached in memory, and is
// re-fetched on a 401 — the same shape TVDB's login exchange already uses.
type IGDB struct {
	ClientID     string
	ClientSecret string
	BaseURL      string // tests override
	TokenURL     string // tests override

	mu    sync.Mutex
	token string
	exp   time.Time
}

func (g *IGDB) base() string {
	if g.BaseURL != "" {
		return g.BaseURL
	}
	return igdbBase
}

func (g *IGDB) tokenURL() string {
	if g.TokenURL != "" {
		return g.TokenURL
	}
	return igdbTokenURL
}

// authenticate exchanges the client credentials for a bearer token and caches it
// with its expiry.
func (g *IGDB) authenticate(ctx context.Context) error {
	form := url.Values{
		"client_id":     {g.ClientID},
		"client_secret": {g.ClientSecret},
		"grant_type":    {"client_credentials"},
	}
	body, status, err := httpPost(ctx, g.tokenURL(), "application/x-www-form-urlencoded", []byte(form.Encode()), "", nil)
	if err != nil {
		return fmt.Errorf("igdb: %w", err)
	}
	if status == http.StatusUnauthorized || status == http.StatusForbidden || status == http.StatusBadRequest {
		// Twitch answers a wrong id or secret with 400 + {"message":"invalid client"},
		// not 401 — so 400 has to count as an auth failure here or the reader is
		// told the lookup broke rather than that the key is wrong.
		return fmt.Errorf("igdb: %w", ErrIGDBAuth)
	}
	if status != http.StatusOK {
		return fmt.Errorf("igdb: token status %d", status)
	}
	var r struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return fmt.Errorf("igdb: %w", err)
	}
	if r.AccessToken == "" {
		return fmt.Errorf("igdb: %w", ErrIGDBAuth)
	}
	g.mu.Lock()
	g.token = r.AccessToken
	// Expire a minute early so a token that dies mid-flight is refreshed before
	// the call rather than after it 401s. ExpiresIn is absent in some test
	// fixtures and from a cached-token replay; treat 0 as "no expiry known" and
	// let the 401 retry be the guard.
	if r.ExpiresIn > 0 {
		g.exp = time.Now().Add(time.Duration(r.ExpiresIn)*time.Second - time.Minute)
	} else {
		g.exp = time.Time{}
	}
	g.mu.Unlock()
	return nil
}

// query POSTs one Apicalypse body to an IGDB endpoint, authenticating first (or
// again on a 401) as needed.
func (g *IGDB) query(ctx context.Context, endpoint, apicalypse string) ([]byte, error) {
	if g.ClientID == "" || g.ClientSecret == "" {
		return nil, fmt.Errorf("igdb: %w", ErrIGDBAuth)
	}
	g.mu.Lock()
	tok, exp := g.token, g.exp
	g.mu.Unlock()
	if tok == "" || (!exp.IsZero() && time.Now().After(exp)) {
		if err := g.authenticate(ctx); err != nil {
			return nil, err
		}
	}
	body, status, err := g.doQuery(ctx, endpoint, apicalypse)
	if err != nil {
		return nil, err
	}
	if status == http.StatusUnauthorized { // token expired or revoked — one re-auth + retry
		if err := g.authenticate(ctx); err != nil {
			return nil, err
		}
		if body, status, err = g.doQuery(ctx, endpoint, apicalypse); err != nil {
			return nil, err
		}
	}
	if status == http.StatusUnauthorized || status == http.StatusForbidden {
		return nil, fmt.Errorf("igdb: %w", ErrIGDBAuth)
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("igdb: status %d", status)
	}
	return body, nil
}

func (g *IGDB) doQuery(ctx context.Context, endpoint, apicalypse string) ([]byte, int, error) {
	g.mu.Lock()
	tok, id := g.token, g.ClientID
	g.mu.Unlock()
	return httpPost(ctx, g.base()+endpoint, "text/plain", []byte(apicalypse), tok, map[string]string{"Client-ID": id})
}

// igdbGame is the shape of the games payload — only the fields mapped. IGDB
// returns expanded sub-objects when a field path is dotted, which is what lets
// the whole details fetch be ONE request.
type igdbGame struct {
	ID                int64  `json:"id"`
	Name              string `json:"name"`
	Slug              string `json:"slug"`
	Summary           string `json:"summary"`
	FirstReleaseDate  int64  `json:"first_release_date"` // unix seconds
	Cover             *igdbImage
	Genres            []igdbNamed `json:"genres"`
	Collection        *igdbNamed  `json:"collection"`
	Franchises        []igdbNamed `json:"franchises"`
	InvolvedCompanies []struct {
		Developer bool `json:"developer"`
		Publisher bool `json:"publisher"`
		Company   struct {
			Name string     `json:"name"`
			Logo *igdbImage `json:"logo"`
		} `json:"company"`
	} `json:"involved_companies"`
}

type igdbNamed struct {
	Name string `json:"name"`
}

type igdbImage struct {
	ImageID string `json:"image_id"`
}

// UnmarshalJSON is hand-written only to keep the Cover field's json tag beside
// the others; encoding/json needs the tag on the struct field and the embedded
// pointer above carries none.
func (g *igdbGame) UnmarshalJSON(b []byte) error {
	type alias igdbGame
	var v struct {
		alias
		Cover *igdbImage `json:"cover"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	*g = igdbGame(v.alias)
	g.Cover = v.Cover
	return nil
}

// searchFields is the field list a picker row needs. Deliberately smaller than
// the details list: a search returns up to eight rows and paying for every
// company logo to draw eight thumbnails is the kind of waste this app avoids.
const igdbSearchFields = `fields name,slug,summary,first_release_date,cover.image_id;`

// detailFields is one request for everything a stored game needs.
const igdbDetailFields = `fields name,slug,summary,first_release_date,cover.image_id,genres.name,` +
	`collection.name,franchises.name,involved_companies.developer,involved_companies.publisher,` +
	`involved_companies.company.name,involved_companies.company.logo.image_id;`

// Search queries /games by title. Results are tagged Source="igdb",
// MediaType="game".
func (g *IGDB) Search(ctx context.Context, query string, year int) ([]MovieCandidate, error) {
	// Apicalypse `search` does its own relevance ranking and cannot be combined
	// with a `where` on the same call in a way that survives an empty match, so
	// the year is applied after the fetch rather than in the query.
	q := fmt.Sprintf("search %s; %s limit %d;", apicalypseString(query), igdbSearchFields, maxMovieCandidates*2)
	body, err := g.query(ctx, "/games", q)
	if err != nil {
		return nil, err
	}
	var games []igdbGame
	if err := json.Unmarshal(body, &games); err != nil {
		return nil, fmt.Errorf("igdb: %w", err)
	}
	out := []MovieCandidate{}
	for _, gm := range games {
		if gm.ID == 0 || gm.Name == "" {
			continue
		}
		y := igdbYear(gm.FirstReleaseDate)
		if year > 0 && y != 0 && y != year {
			continue
		}
		out = append(out, MovieCandidate{
			Source:      "igdb",
			SourceID:    strconv.FormatInt(gm.ID, 10),
			MediaType:   "game",
			Title:       gm.Name,
			ReleaseYear: y,
			Overview:    strings.TrimSpace(gm.Summary),
			PosterURL:   igdbThumb(gm.Cover),
		})
		if len(out) == maxMovieCandidates {
			break
		}
	}
	return out, nil
}

// Details fetches the full record for one IGDB game id.
//
// The developer company lands in Director, which is the deliberate vocabulary
// stretch this feature rests on: a show already stores its CREATOR in that
// column, and a game stores its STUDIO. The frontend relabels it; the schema
// does not need to know.
func (g *IGDB) Details(ctx context.Context, id string) (*MovieDetails, error) {
	n, err := strconv.ParseInt(strings.TrimSpace(id), 10, 64)
	if err != nil || n <= 0 {
		return nil, fmt.Errorf("igdb: bad game id %q", id)
	}
	q := fmt.Sprintf("%s where id = %d; limit 1;", igdbDetailFields, n)
	body, err := g.query(ctx, "/games", q)
	if err != nil {
		return nil, err
	}
	var games []igdbGame
	if err := json.Unmarshal(body, &games); err != nil {
		return nil, fmt.Errorf("igdb: %w", err)
	}
	if len(games) == 0 {
		return nil, fmt.Errorf("igdb: game %s not found", id)
	}
	gm := games[0]
	d := &MovieDetails{
		Source:         "igdb",
		SourceID:       strconv.FormatInt(gm.ID, 10),
		MediaType:      "game",
		IGDBID:         gm.ID,
		Slug:           gm.Slug,
		Title:          gm.Name,
		Overview:       strings.TrimSpace(gm.Summary),
		ReleaseYear:    igdbYear(gm.FirstReleaseDate),
		PosterURL:      IGDBCoverURL(coverID(gm.Cover)),
		PosterThumbURL: igdbThumb(gm.Cover),
		Raw:            body,
	}
	for _, gn := range gm.Genres {
		if gn.Name != "" {
			d.Genres = append(d.Genres, gn.Name)
		}
	}
	// Franchise: IGDB has two overlapping notions and they are not
	// interchangeable. `collection` is the tighter one ("Mass Effect"), and
	// `franchises` is the looser umbrella that can be a publisher's whole label.
	// Prefer the collection and fall back, because the tighter name is the one a
	// reader would have typed.
	if gm.Collection != nil && gm.Collection.Name != "" {
		d.Series = gm.Collection.Name
	} else if len(gm.Franchises) > 0 {
		d.Series = gm.Franchises[0].Name
	}
	d.Director, d.StudioLogoURL, d.Publisher = igdbCredits(gm)
	return d, nil
}

// igdbCredits splits the two company credits a game has, which until 0042 were
// one field pretending to be one fact.
//
// THERE IS NO FALLBACK BETWEEN THEM ANY MORE. The old igdbStudio took the
// publisher when no company was flagged developer, reasoning that "a blank studio
// is worse than a slightly wrong one" — true while there was a single column to
// put a name in, and false now the publisher has its own. A game whose record
// names only a publisher comes back with a publisher and an empty studio, which
// is what IGDB actually said.
//
// THE DEVELOPER THAT IS *ONLY* A DEVELOPER WINS, and that tie-break is the
// reported bug rather than a refinement. involved_companies is a set of flag
// pairs and a company may carry both: a label that owns the studio it published
// through is routinely entered as developer AND publisher, so "the first row
// flagged developer" resolved to Electronic Arts on Mass Effect Legendary
// Edition while BioWare sat further down the same array, flagged developer and
// nothing else. Array order is IGDB's and carries no meaning, so preferring the
// company with the narrower claim is the only signal in the payload. A record
// where every developer is also a publisher still yields one — the tie-break
// picks a better answer where there is one and never turns an answer into a
// blank.
func igdbCredits(gm igdbGame) (studio, logo, publisher string) {
	// anyDev is the first developer whatever else it claims; soleDev is the first
	// developer that claims nothing else. soleDev wins where it exists.
	var anyDevName, anyDevLogo string
	var soleDevName, soleDevLogo string
	for _, c := range gm.InvolvedCompanies {
		if c.Company.Name == "" {
			continue
		}
		companyLogo := ""
		if c.Company.Logo != nil {
			companyLogo = IGDBCoverURL(c.Company.Logo.ImageID)
		}
		if c.Developer {
			if anyDevName == "" {
				anyDevName, anyDevLogo = c.Company.Name, companyLogo
			}
			if !c.Publisher && soleDevName == "" {
				soleDevName, soleDevLogo = c.Company.Name, companyLogo
			}
		}
		if c.Publisher && publisher == "" {
			publisher = c.Company.Name
		}
	}
	if soleDevName != "" {
		return soleDevName, soleDevLogo, publisher
	}
	return anyDevName, anyDevLogo, publisher
}

func coverID(c *igdbImage) string {
	if c == nil {
		return ""
	}
	return c.ImageID
}

func igdbThumb(c *igdbImage) string {
	if id := coverID(c); id != "" {
		return igdbImageBase + id + ".jpg"
	}
	return ""
}

// igdbYear converts IGDB's unix release timestamp to a year. UTC deliberately:
// a release date is a calendar fact about the game, not about the reader's zone,
// and letting the local zone decide would move a 1 January release into the
// previous year for anyone west of Greenwich.
func igdbYear(ts int64) int {
	if ts <= 0 {
		return 0
	}
	return time.Unix(ts, 0).UTC().Year()
}

// apicalypseString quotes a user-supplied search term for an Apicalypse body.
//
// This is the FTS5 rule applied to a different query language: user input never
// reaches the query raw. Apicalypse has no parameter binding, so a title
// containing a quote would otherwise terminate the string and the rest of the
// term would be parsed as syntax. Backslash-escape the two characters that can
// end or continue a string literal, and strip the newline that would let a term
// open a second clause.
// igdbCompany is one row of the /companies endpoint — a studio or a publisher.
type igdbCompany struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	URL      string `json:"url"`
	Logo     *struct{ ImageID string `json:"image_id"` } `json:"logo"`
	Websites []struct {
		Category int    `json:"category"`
		URL      string `json:"url"`
	} `json:"websites"`
}

// CompanyLinks resolves a studio name to its reference pages and a logo.
//
// A STUDIO IS NOT A PERSON, and that is the whole reason this exists. Every
// other credit in this app is somebody with a life: an author goes to Open
// Library, an actor and a director go to TMDB. A game studio sent to either
// answers with whatever human happens to share the name, or with nothing —
// Electronic Arts came back as an Open Library AUTHOR page, which is not wrong
// about the string and is completely wrong about the thing.
//
// Games are IGDB's from end to end (0040), and companies are one of its
// endpoints, so this is the same key answering the same question about the same
// catalogue. Returns the links and the logo image id; the caller builds the URL,
// because IGDBCoverURL is where the size lives.
func (g *IGDB) CompanyLinks(ctx context.Context, name string) (map[string]string, string, int64, error) {
	if strings.TrimSpace(name) == "" {
		return map[string]string{}, "", 0, nil
	}
	q := fmt.Sprintf("search %s; fields id,name,url,logo.image_id,websites.category,websites.url; limit 5;",
		apicalypseString(name))
	body, err := g.query(ctx, "/companies", q)
	if err != nil {
		return nil, "", 0, err
	}
	var cos []igdbCompany
	if err := json.Unmarshal(body, &cos); err != nil {
		return nil, "", 0, fmt.Errorf("igdb: %w", err)
	}
	links := map[string]string{}
	logo := ""
	var id int64
	for _, c := range cos {
		// EXACT NAME ONLY, case-insensitively. `search` ranks rather than filters,
		// so "Electronic Arts" happily returns "Electronic Arts Seattle" — and a
		// near-miss here is a wrong logo and a wrong link presented as fact.
		if !strings.EqualFold(strings.TrimSpace(c.Name), strings.TrimSpace(name)) {
			continue
		}
		if c.URL != "" {
			links["igdb"] = c.URL
		}
		for _, w := range c.Websites {
			// 1 is the company's own site in IGDB's website categories; 4 is
			// Wikipedia. Anything else here is a storefront or a social account,
			// which is not a reference page.
			switch w.Category {
			case 1:
				if w.URL != "" && links["official"] == "" {
					links["official"] = w.URL
				}
			case 4:
				if w.URL != "" && links["wikipedia"] == "" {
					links["wikipedia"] = w.URL
				}
			}
		}
		if c.Logo != nil && c.Logo.ImageID != "" {
			logo = c.Logo.ImageID
		}
		id = c.ID
		break
	}
	return links, logo, id, nil
}

func apicalypseString(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", " ", "\r", " ")
	return `"` + r.Replace(strings.TrimSpace(s)) + `"`
}
