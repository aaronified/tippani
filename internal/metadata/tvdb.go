package metadata

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"

	"tippani/internal/olog"
)

const tvdbBase = "https://api4.thetvdb.com/v4"

// ErrTVDBAuth signals TheTVDB rejected the key at login (or a token that won't
// refresh). The handler turns it into a "TVDB rejected the key" hint.
var ErrTVDBAuth = errors.New("tvdb rejected the API key")

// TVDB is the api4.thetvdb.com/v4 client (PLAN §6, second movie/show supplier).
// Unlike TMDB it uses a login exchange: POST /login {apikey} → a bearer JWT
// (valid ~1 month) cached in-memory per client and re-fetched on a 401. Key is
// the TheTVDB v4 API key; BaseURL defaults to the real API (tests override).
type TVDB struct {
	Key     string
	BaseURL string

	mu    sync.Mutex
	token string
}

func (t *TVDB) base() string {
	if t.BaseURL != "" {
		return t.BaseURL
	}
	return tvdbBase
}

// login exchanges the API key for a bearer token and caches it.
func (t *TVDB) login(ctx context.Context) error {
	body, _ := json.Marshal(map[string]string{"apikey": t.Key})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, t.base()+"/login", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("tvdb: %w", err)
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		olog.Tracef("[meta] tvdb POST /login failed: %v", err)
		return fmt.Errorf("tvdb: %w", err)
	}
	defer resp.Body.Close()
	olog.Tracef("[meta] tvdb POST /login -> %d", resp.StatusCode)
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("tvdb: %w", ErrTVDBAuth)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("tvdb: login status %d", resp.StatusCode)
	}
	var r struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return fmt.Errorf("tvdb: %w", err)
	}
	if r.Data.Token == "" {
		return fmt.Errorf("tvdb: %w", ErrTVDBAuth)
	}
	t.mu.Lock()
	t.token = r.Data.Token
	t.mu.Unlock()
	return nil
}

// authGet performs a bearer GET, logging in first (or again on a 401) as needed.
func (t *TVDB) authGet(ctx context.Context, path string, q url.Values) ([]byte, error) {
	t.mu.Lock()
	tok := t.token
	t.mu.Unlock()
	if tok == "" {
		if err := t.login(ctx); err != nil {
			return nil, err
		}
	}
	full := t.base() + path
	if len(q) > 0 {
		full += "?" + q.Encode()
	}
	body, status, err := t.doGet(ctx, full)
	if err != nil {
		return nil, err
	}
	if status == http.StatusUnauthorized { // token expired — one re-login + retry
		if err := t.login(ctx); err != nil {
			return nil, err
		}
		if body, status, err = t.doGet(ctx, full); err != nil {
			return nil, err
		}
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("tvdb: status %d", status)
	}
	return body, nil
}

func (t *TVDB) doGet(ctx context.Context, full string) ([]byte, int, error) {
	t.mu.Lock()
	tok := t.token
	t.mu.Unlock()
	return httpGet(ctx, full, tok)
}

// Search queries /search for the given media type ("movie"|"show"). year 0 skips
// the year filter. Results are tagged Source="tvdb".
func (t *TVDB) Search(ctx context.Context, query string, year int, mediaType string) ([]MovieCandidate, error) {
	q := url.Values{"query": {query}}
	q.Set("type", tvdbType(mediaType))
	if year > 0 {
		q.Set("year", strconv.Itoa(year))
	}
	body, err := t.authGet(ctx, "/search", q)
	if err != nil {
		return nil, err
	}
	var r struct {
		Data []struct {
			TVDBID   string `json:"tvdb_id"`
			Name     string `json:"name"`
			Year     string `json:"year"`
			Type     string `json:"type"` // "movie" | "series"
			Overview string `json:"overview"`
			ImageURL string `json:"image_url"` // full artworks.thetvdb.com URL, or ""
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("tvdb: %w", err)
	}
	var out []MovieCandidate
	for _, m := range r.Data {
		if m.TVDBID == "" {
			continue
		}
		out = append(out, MovieCandidate{
			Source:      "tvdb",
			SourceID:    m.TVDBID,
			MediaType:   mediaFromTVDBType(m.Type),
			Title:       m.Name,
			ReleaseYear: atoiSafe(m.Year),
			Overview:    m.Overview,
			PosterURL:   m.ImageURL,
		})
		if len(out) == maxMovieCandidates {
			break
		}
	}
	return out, nil
}

// MovieDetails / SeriesDetails fetch the extended record for one id.
func (t *TVDB) MovieDetails(ctx context.Context, id string) (*MovieDetails, error) {
	return t.details(ctx, "/movies/"+id+"/extended", "movie", id)
}
func (t *TVDB) SeriesDetails(ctx context.Context, id string) (*MovieDetails, error) {
	return t.details(ctx, "/series/"+id+"/extended", "show", id)
}

// tvdbExtended is the shared shape of the movies/series extended payloads (only
// the fields we map). Characters carry both the role (name) and actor
// (personName), tagged by peopleType.
type tvdbExtended struct {
	Data struct {
		ID         int64  `json:"id"`
		Name       string `json:"name"`
		Year       string `json:"year"`
		FirstAired string `json:"firstAired"`
		Overview   string `json:"overview"`
		Image      string `json:"image"`
		Genres     []struct {
			Name string `json:"name"`
		} `json:"genres"`
		Characters []struct {
			Name         string `json:"name"`         // role/character name
			PersonName   string `json:"personName"`   // actor name
			PeopleType   string `json:"peopleType"`   // "Actor" | "Director" | "Writer" | …
			PeopleID     int64  `json:"peopleId"`     // stable TheTVDB person id
			PersonImgURL string `json:"personImgURL"` // actor headshot (full artworks.thetvdb.com URL), or ""
		} `json:"characters"`
	} `json:"data"`
}

func (t *TVDB) details(ctx context.Context, path, mediaType, id string) (*MovieDetails, error) {
	body, err := t.authGet(ctx, path, nil)
	if err != nil {
		return nil, err
	}
	var r tvdbExtended
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("tvdb: %w", err)
	}
	d := &MovieDetails{
		Source:      "tvdb",
		SourceID:    id,
		MediaType:   mediaType,
		TVDBID:      r.Data.ID,
		Title:       r.Data.Name,
		Overview:    r.Data.Overview,
		ReleaseYear: firstNonZero(atoiSafe(r.Data.Year), leadingYear(r.Data.FirstAired)),
		PosterURL:   r.Data.Image, // already a full artworks.thetvdb.com URL
		Raw:         body,
	}
	for _, g := range r.Data.Genres {
		d.Genres = append(d.Genres, g.Name)
	}
	for _, c := range r.Data.Characters {
		switch c.PeopleType {
		case "Director", "Creator":
			if d.Director == "" {
				d.Director = c.PersonName
			}
		case "Actor":
			if len(d.Cast) < maxCast {
				// peopleId + personImgURL arrive on this same extended payload, so
				// the actor→portrait resolver later needs no extra API call.
				cm := CastMember{Character: c.Name, Actor: c.PersonName, ImageURL: c.PersonImgURL}
				if c.PeopleID != 0 {
					cm.PersonID = strconv.FormatInt(c.PeopleID, 10)
				}
				d.Cast = append(d.Cast, cm)
			}
		}
	}
	return d, nil
}

// tvdbType maps our media_type to TheTVDB's search type param.
func tvdbType(mediaType string) string {
	if mediaType == "show" {
		return "series"
	}
	return "movie"
}

// mediaFromTVDBType maps TheTVDB's result type back to our media_type.
func mediaFromTVDBType(t string) string {
	if strings.EqualFold(t, "series") {
		return "show"
	}
	return "movie"
}

func atoiSafe(s string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(s))
	return n
}

func firstNonZero(a, b int) int {
	if a != 0 {
		return a
	}
	return b
}
