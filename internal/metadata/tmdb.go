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
)

const (
	tmdbBase = "https://api.themoviedb.org/3"
	// Two image sizes for two jobs: w342 thumbnails for the lookup picker,
	// `original` for the poster that gets downloaded and stored (typically
	// 2000×3000; the 5 MB fetch cap in covers.go accommodates it).
	tmdbImageBase      = "https://image.tmdb.org/t/p/w342"
	tmdbImageFetchBase = "https://image.tmdb.org/t/p/original"

	maxMovieCandidates = 8
	maxCast            = 20 // trimmed top-billed cast stored in cast_json (PLAN §3b)
)

// TMDBPosterURL builds the full-size poster URL for a TMDB poster_path — the
// variant meant for download + storage, not the picker thumbnail. Shared with
// httpapi's covers-refetch so the size lives in exactly one place.
func TMDBPosterURL(path string) string {
	if path == "" {
		return ""
	}
	return tmdbImageFetchBase + path
}

// TMDBProfileURL builds the full-size actor-profile image URL for a TMDB
// profile_path — the download+store variant, same image host/size family as the
// poster. Empty in, empty out (a cast member with no headshot).
func TMDBProfileURL(path string) string {
	if path == "" {
		return ""
	}
	return tmdbImageFetchBase + path
}

// PersonMeta is TMDB's person record — the headshot, biography and birth year we
// enrich an actor with. bio/born aren't in the movie credits payload, so this is
// a dedicated /person call (the actor portrait path's one live lookup).
type PersonMeta struct {
	Name     string
	ImageURL string // full profile image URL ("" if the person has no headshot)
	Bio      string
	Born     string // 4-digit birth year
	Died     string // 4-digit death year ("" if living / unknown)
}

// PersonDetails fetches /person/{id} for an actor's headshot, biography and
// birthday. A hard API error (auth/network) is returned; a person with empty
// fields is not an error.
func (t *TMDB) PersonDetails(ctx context.Context, id string) (*PersonMeta, error) {
	body, err := t.get(ctx, "/person/"+url.PathEscape(id), url.Values{})
	if err != nil {
		return nil, err
	}
	var r struct {
		Name        string `json:"name"`
		Biography   string `json:"biography"`
		Birthday    string `json:"birthday"`
		Deathday    string `json:"deathday"`
		ProfilePath string `json:"profile_path"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("tmdb: %w", err)
	}
	return &PersonMeta{
		Name:     r.Name,
		ImageURL: TMDBProfileURL(r.ProfilePath),
		Bio:      strings.TrimSpace(r.Biography),
		Born:     birthYear(r.Birthday),
		Died:     birthYear(r.Deathday),
	}, nil
}

// PersonSearchID returns TMDB's top person-search hit id for a name ("" when
// none). Namesake-prone, so callers prefer a person id pinned from a film's
// stored cast and fall back to this only for actors that have none.
func (t *TMDB) PersonSearchID(ctx context.Context, name string) string {
	body, err := t.get(ctx, "/search/person", url.Values{"query": {name}})
	if err != nil {
		return ""
	}
	var r struct {
		Results []struct {
			ID int64 `json:"id"`
		} `json:"results"`
	}
	if json.Unmarshal(body, &r) != nil || len(r.Results) == 0 || r.Results[0].ID == 0 {
		return ""
	}
	return strconv.FormatInt(r.Results[0].ID, 10)
}

// CastMember is one billed actor, stored per movie in movies.cast_json. Beyond
// the display pair (character/actor) it carries the source-agnostic identity we
// harvest from the SAME credits call the details fetch already makes — the
// supplier's person id and a ready-to-fetch headshot URL — so resolving an
// actor to a portrait later needs NO extra API call. PersonID's namespace is the
// movie's own source (TMDB person id / TVDB peopleId). The extra fields are
// omitempty so pre-existing cast_json (character/actor only) round-trips
// unchanged and old rows simply carry no portrait until re-synced.
type CastMember struct {
	Character string `json:"character"`
	Actor     string `json:"actor"`
	PersonID  string `json:"person_id,omitempty"` // id within the movie's source
	ImageURL  string `json:"image_url,omitempty"` // full portrait URL when the source gives one
}

// MovieCandidate is one search hit from any supplier. Source/SourceID/MediaType
// identify it generically (both TMDB and TVDB, movies and shows); TMDBID is kept
// populated for TMDB movie hits so older callers keep working.
type MovieCandidate struct {
	Source      string `json:"source"`     // "tmdb" | "tvdb" | "igdb"
	SourceID    string `json:"source_id"`  // id within the source (TMDB int as string, TVDB id, IGDB id)
	MediaType   string `json:"media_type"` // "movie" | "show" | "game"
	TMDBID      int64  `json:"tmdb_id"`
	Title       string `json:"title"`
	ReleaseYear int    `json:"release_year"`
	Overview    string `json:"overview"`
	PosterURL   string `json:"poster_url"` // thumbnail for the lookup picker; "" when the hit has no art
}

type MovieDetails struct {
	Source    string // "tmdb" | "tvdb" | "igdb"
	SourceID  string
	MediaType string // "movie" | "show" | "game"
	TMDBID    int64
	TVDBID    int64
	IGDBID    int64
	// Slug is IGDB's URL slug, and it is carried for one reason: it is the join
	// key to Wikidata. Wikidata's P5794 holds the IGDB SLUG rather than the id,
	// so `haswbstatement:P5794=elden-ring` names one entity exactly where a title
	// search does not — during the research for this feature a fuzzy title search
	// picked Hades II for "Hades". Empty for every other supplier.
	Slug string
	// IMDbID is a STRING because an IMDb id is `tt0111161` — the leading zeros
	// are part of it, and storing the number would give back a URL that 404s.
	// Nothing fetches WITH it (IMDb has no public API); it is carried because it
	// is the id a reader is most likely to have to hand, and because it names a
	// title unambiguously when quoting dialogue.
	IMDbID   string
	Title    string
	Director string // "creator" for shows, "studio" for games; stored in the director column
	// Publisher is who PUT IT OUT, and it is a different company from the one
	// that made it (0042). Empty for every media type but games, and never a
	// stand-in for a missing Director: the two fields collapsing into one is the
	// bug 0042 exists to end — Mass Effect Legendary Edition arrived crediting
	// Electronic Arts as its studio, which published it, where BioWare made it.
	Publisher string
	// StudioLogoURL is the DEVELOPER's logo, and is empty for every other media
	// type. It is separate from PosterURL because it is not the work's own art:
	// it becomes the portrait on a `people` row of kind 'studio', which is what
	// puts a studio icon where a film shows its director. A publisher gets no
	// logo here, because it gets no people row — see 0042.
	StudioLogoURL string
	ReleaseYear   int
	Overview      string
	Genres        []string
	Series        string       // franchise/collection name, where the source has it
	Cast          []CastMember // top 20 in billing order
	PosterURL     string
	// PosterThumbURL is the same art at picker size. A details fetch is normally
	// on its way to storage and so wants PosterURL (full size), but a lookup
	// pinned to a supplier id shows its record in the same grid of thumbnails as
	// the title hits — and paying for a 2000×3000 poster to draw it at 90px wide
	// is the kind of waste this app is supposed to not do.
	PosterThumbURL string
	Raw            json.RawMessage // raw details payload, cached in movies.source_metadata
}

// Candidate reduces a fetched details record to the search-result shape, so a
// lookup pinned to a supplier id can sit in the same picker list as the hits a
// title search returned.
func (d *MovieDetails) Candidate() MovieCandidate {
	poster := d.PosterThumbURL
	if poster == "" {
		poster = d.PosterURL
	}
	return MovieCandidate{
		Source:      d.Source,
		SourceID:    d.SourceID,
		MediaType:   d.MediaType,
		TMDBID:      d.TMDBID,
		Title:       d.Title,
		ReleaseYear: d.ReleaseYear,
		Overview:    d.Overview,
		PosterURL:   poster,
	}
}

// TMDB is the api.themoviedb.org/3 client (PLAN §6). Key is auto-detected:
// a v4 read token (a JWT, starts with "ey") is sent as Authorization: Bearer,
// a v3 API key as ?api_key=. BaseURL defaults to the real API; tests override.
type TMDB struct {
	Key     string
	BaseURL string
}

func (t *TMDB) get(ctx context.Context, path string, q url.Values) ([]byte, error) {
	base := t.BaseURL
	if base == "" {
		base = tmdbBase
	}
	var bearer string
	if strings.HasPrefix(t.Key, "ey") {
		bearer = t.Key
	} else {
		q.Set("api_key", t.Key)
	}
	body, status, err := httpGet(ctx, base+path+"?"+q.Encode(), bearer)
	if err != nil {
		return nil, fmt.Errorf("tmdb: %w", err)
	}
	switch status {
	case http.StatusOK:
		return body, nil
	case http.StatusUnauthorized:
		return nil, fmt.Errorf("tmdb: %w", ErrTMDBAuth)
	default:
		return nil, fmt.Errorf("tmdb: status %d", status)
	}
}

// ErrTMDBAuth signals TMDB rejected the key (HTTP 401) — usually a v3 key
// pasted where a v4 token was expected (or vice-versa), or a typo. The handler
// turns it into a "TMDB rejected the key" hint rather than a generic failure.
var ErrTMDBAuth = errors.New("tmdb rejected the API key (401)")

func (t *TMDB) Search(ctx context.Context, query string, year int) ([]MovieCandidate, error) {
	q := url.Values{"query": {query}}
	if year > 0 {
		q.Set("year", strconv.Itoa(year))
	}
	body, err := t.get(ctx, "/search/movie", q)
	if err != nil {
		return nil, err
	}
	var r struct {
		Results []struct {
			ID          int64  `json:"id"`
			Title       string `json:"title"`
			ReleaseDate string `json:"release_date"`
			Overview    string `json:"overview"`
			PosterPath  string `json:"poster_path"`
		} `json:"results"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("tmdb: %w", err)
	}
	var out []MovieCandidate
	for _, m := range r.Results {
		out = append(out, MovieCandidate{
			Source:      "tmdb",
			SourceID:    strconv.FormatInt(m.ID, 10),
			MediaType:   "movie",
			TMDBID:      m.ID,
			Title:       m.Title,
			ReleaseYear: leadingYear(m.ReleaseDate),
			Overview:    m.Overview,
			PosterURL:   tmdbPoster(m.PosterPath),
		})
		if len(out) == maxMovieCandidates {
			break
		}
	}
	return out, nil
}

// tmdbPoster builds a poster thumbnail URL from a TMDB poster_path, or "" when
// the hit carries no art.
func tmdbPoster(path string) string {
	if path == "" {
		return ""
	}
	return tmdbImageBase + path
}

// SearchTV mirrors Search for television (/search/tv). TMDB TV uses name +
// first_air_date instead of title + release_date.
func (t *TMDB) SearchTV(ctx context.Context, query string, year int) ([]MovieCandidate, error) {
	q := url.Values{"query": {query}}
	if year > 0 {
		q.Set("first_air_date_year", strconv.Itoa(year))
	}
	body, err := t.get(ctx, "/search/tv", q)
	if err != nil {
		return nil, err
	}
	var r struct {
		Results []struct {
			ID           int64  `json:"id"`
			Name         string `json:"name"`
			FirstAirDate string `json:"first_air_date"`
			Overview     string `json:"overview"`
			PosterPath   string `json:"poster_path"`
		} `json:"results"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("tmdb: %w", err)
	}
	var out []MovieCandidate
	for _, m := range r.Results {
		out = append(out, MovieCandidate{
			Source:      "tmdb",
			SourceID:    strconv.FormatInt(m.ID, 10),
			MediaType:   "show",
			TMDBID:      m.ID,
			Title:       m.Name,
			ReleaseYear: leadingYear(m.FirstAirDate),
			Overview:    m.Overview,
			PosterURL:   tmdbPoster(m.PosterPath),
		})
		if len(out) == maxMovieCandidates {
			break
		}
	}
	return out, nil
}

// firstNonEmpty is for the film path, where TMDB reports imdb_id twice — once at
// the top level and once in the appendix — and has been known to leave one of
// them blank on sparse records.
func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// Details fetches movie details with append_to_response=credits — one call
// for details + cast + crew (PLAN §6).
func (t *TMDB) Details(ctx context.Context, id int64) (*MovieDetails, error) {
	// external_ids rides along on the SAME call the credits already needed, so
	// the IMDb id costs no extra request. A film carries imdb_id at the top
	// level as well, but asking for the appendix keeps this identical to the
	// show path below, where it is the only place it appears.
	body, err := t.get(ctx, "/movie/"+strconv.FormatInt(id, 10),
		url.Values{"append_to_response": {"credits,external_ids"}})
	if err != nil {
		return nil, err
	}
	var r struct {
		ID          int64  `json:"id"`
		Title       string `json:"title"`
		Overview    string `json:"overview"`
		ReleaseDate string `json:"release_date"`
		PosterPath  string `json:"poster_path"`
		IMDbID      string `json:"imdb_id"`
		ExternalIDs struct {
			IMDbID string `json:"imdb_id"`
		} `json:"external_ids"`
		Collection *struct {
			Name string `json:"name"`
		} `json:"belongs_to_collection"`
		Genres []struct {
			Name string `json:"name"`
		} `json:"genres"`
		Credits struct {
			Cast []struct { // TMDB returns cast pre-sorted by billing order
				ID          int64  `json:"id"`
				Character   string `json:"character"`
				Name        string `json:"name"`
				ProfilePath string `json:"profile_path"`
			} `json:"cast"`
			Crew []struct {
				Job  string `json:"job"`
				Name string `json:"name"`
			} `json:"crew"`
		} `json:"credits"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("tmdb: %w", err)
	}
	d := &MovieDetails{
		Source:      "tmdb",
		SourceID:    strconv.FormatInt(r.ID, 10),
		MediaType:   "movie",
		TMDBID:      r.ID,
		Title:       r.Title,
		Overview:    r.Overview,
		ReleaseYear: leadingYear(r.ReleaseDate),
		IMDbID:      firstNonEmpty(r.IMDbID, r.ExternalIDs.IMDbID),
		Raw:         body,
	}
	if r.Collection != nil {
		d.Series = r.Collection.Name // e.g. "The Matrix Collection"
	}
	for _, g := range r.Genres {
		d.Genres = append(d.Genres, g.Name)
	}
	for _, c := range r.Credits.Cast {
		// The person id + headshot ride in on this same credits payload, so the
		// actor→portrait resolver later spends no extra API call.
		cm := CastMember{Character: c.Character, Actor: c.Name}
		if c.ID != 0 {
			cm.PersonID = strconv.FormatInt(c.ID, 10)
		}
		cm.ImageURL = TMDBProfileURL(c.ProfilePath)
		d.Cast = append(d.Cast, cm)
		if len(d.Cast) == maxCast {
			break
		}
	}
	for _, c := range r.Credits.Crew {
		if c.Job == "Director" {
			d.Director = c.Name
			break
		}
	}
	if r.PosterPath != "" {
		d.PosterURL = TMDBPosterURL(r.PosterPath)
		d.PosterThumbURL = tmdbPoster(r.PosterPath)
	}
	return d, nil
}

// DetailsTV fetches TV details + aggregate credits (/tv/{id}). TMDB TV uses
// name/first_air_date and created_by for the "director" (creator) slot;
// aggregate_credits groups an actor's episode roles, so we take the first role's
// character. TMDB has no franchise/collection for TV, so Series is left empty.
func (t *TMDB) DetailsTV(ctx context.Context, id int64) (*MovieDetails, error) {
	// A SHOW HAS NO imdb_id AT THE TOP LEVEL — unlike a film — so external_ids
	// is not a convenience here, it is the only place the id exists.
	body, err := t.get(ctx, "/tv/"+strconv.FormatInt(id, 10),
		url.Values{"append_to_response": {"aggregate_credits,external_ids"}})
	if err != nil {
		return nil, err
	}
	var r struct {
		ID           int64  `json:"id"`
		Name         string `json:"name"`
		Overview     string `json:"overview"`
		FirstAirDate string `json:"first_air_date"`
		PosterPath   string `json:"poster_path"`
		ExternalIDs  struct {
			IMDbID string `json:"imdb_id"`
		} `json:"external_ids"`
		CreatedBy []struct {
			Name string `json:"name"`
		} `json:"created_by"`
		Genres []struct {
			Name string `json:"name"`
		} `json:"genres"`
		Credits struct {
			Cast []struct {
				ID          int64  `json:"id"`
				Name        string `json:"name"`
				ProfilePath string `json:"profile_path"`
				Roles       []struct {
					Character string `json:"character"`
				} `json:"roles"`
			} `json:"cast"`
		} `json:"aggregate_credits"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("tmdb: %w", err)
	}
	d := &MovieDetails{
		Source:      "tmdb",
		SourceID:    strconv.FormatInt(r.ID, 10),
		MediaType:   "show",
		TMDBID:      r.ID,
		Title:       r.Name,
		Overview:    r.Overview,
		ReleaseYear: leadingYear(r.FirstAirDate),
		IMDbID:      r.ExternalIDs.IMDbID,
		Raw:         body,
	}
	if len(r.CreatedBy) > 0 {
		d.Director = r.CreatedBy[0].Name
	}
	for _, g := range r.Genres {
		d.Genres = append(d.Genres, g.Name)
	}
	for _, c := range r.Credits.Cast {
		ch := ""
		if len(c.Roles) > 0 {
			ch = c.Roles[0].Character
		}
		cm := CastMember{Character: ch, Actor: c.Name}
		if c.ID != 0 {
			cm.PersonID = strconv.FormatInt(c.ID, 10)
		}
		cm.ImageURL = TMDBProfileURL(c.ProfilePath)
		d.Cast = append(d.Cast, cm)
		if len(d.Cast) == maxCast {
			break
		}
	}
	if r.PosterPath != "" {
		d.PosterURL = TMDBPosterURL(r.PosterPath)
		d.PosterThumbURL = tmdbPoster(r.PosterPath)
	}
	return d, nil
}
