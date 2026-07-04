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
	tmdbBase      = "https://api.themoviedb.org/3"
	tmdbImageBase = "https://image.tmdb.org/t/p/w342"

	maxMovieCandidates = 8
	maxCast            = 20 // trimmed top-billed cast stored in cast_json (PLAN §3b)
)

type CastMember struct {
	Character string `json:"character"`
	Actor     string `json:"actor"`
}

type MovieCandidate struct {
	TMDBID      int64  `json:"tmdb_id"`
	Title       string `json:"title"`
	ReleaseYear int    `json:"release_year"`
	Overview    string `json:"overview"`
}

type MovieDetails struct {
	TMDBID      int64
	Title       string
	Director    string
	ReleaseYear int
	Overview    string
	Genres      []string
	Cast        []CastMember // top 20 in billing order
	PosterURL   string
	Raw         json.RawMessage // raw details payload, cached in movies.source_metadata
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
		} `json:"results"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("tmdb: %w", err)
	}
	var out []MovieCandidate
	for _, m := range r.Results {
		out = append(out, MovieCandidate{
			TMDBID:      m.ID,
			Title:       m.Title,
			ReleaseYear: leadingYear(m.ReleaseDate),
			Overview:    m.Overview,
		})
		if len(out) == maxMovieCandidates {
			break
		}
	}
	return out, nil
}

// Details fetches movie details with append_to_response=credits — one call
// for details + cast + crew (PLAN §6).
func (t *TMDB) Details(ctx context.Context, id int64) (*MovieDetails, error) {
	body, err := t.get(ctx, "/movie/"+strconv.FormatInt(id, 10),
		url.Values{"append_to_response": {"credits"}})
	if err != nil {
		return nil, err
	}
	var r struct {
		ID          int64  `json:"id"`
		Title       string `json:"title"`
		Overview    string `json:"overview"`
		ReleaseDate string `json:"release_date"`
		PosterPath  string `json:"poster_path"`
		Genres      []struct {
			Name string `json:"name"`
		} `json:"genres"`
		Credits struct {
			Cast []struct { // TMDB returns cast pre-sorted by billing order
				Character string `json:"character"`
				Name      string `json:"name"`
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
		TMDBID:      r.ID,
		Title:       r.Title,
		Overview:    r.Overview,
		ReleaseYear: leadingYear(r.ReleaseDate),
		Raw:         body,
	}
	for _, g := range r.Genres {
		d.Genres = append(d.Genres, g.Name)
	}
	for _, c := range r.Credits.Cast {
		d.Cast = append(d.Cast, CastMember{Character: c.Character, Actor: c.Name})
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
		d.PosterURL = tmdbImageBase + r.PosterPath
	}
	return d, nil
}
