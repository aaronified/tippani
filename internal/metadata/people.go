package metadata

// Person link resolution (people console): given a free-text author/actor
// name, find their canonical pages on the external references the UI links
// out to — Open Library + Wikipedia for authors; TMDB, IMDb, TheTVDB +
// Wikipedia for actors. Links only, no bio scraping: the app redirects to
// these pages rather than mirroring their content.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// wikidataBase is a var so tests can point the EntityData hop at httptest.
var wikidataBase = "https://www.wikidata.org"

// AuthorLinks resolves an author name via Open Library's author search to the
// OL author page, then follows the author's wikidata remote id to the English
// Wikipedia article. Best-effort: an empty map (no error) means "no match".
func AuthorLinks(ctx context.Context, name string) (map[string]string, error) {
	q := url.Values{"q": {name}, "limit": {"5"}}
	body, status, err := httpGet(ctx, openLibraryBase+"/search/authors.json?"+q.Encode(), "")
	if err != nil {
		return nil, fmt.Errorf("open library: %w", err)
	}
	if status != 200 {
		return nil, fmt.Errorf("open library: status %d", status)
	}
	var r struct {
		Docs []struct {
			Key       string `json:"key"` // "OL23919A" (bare) or "/authors/OL23919A"
			Name      string `json:"name"`
			WorkCount int    `json:"work_count"`
		} `json:"docs"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("open library: %w", err)
	}
	links := map[string]string{}
	// OL relevance ranking puts partial matches ("Frank Herbert Hayward")
	// above the person actually asked for, so pick by exact name first
	// (case-insensitive), most-published record winning ties; fall back to
	// the most-published fuzzy match.
	best := -1
	for i, d := range r.Docs {
		if d.Key == "" {
			continue
		}
		exact := strings.EqualFold(strings.TrimSpace(d.Name), strings.TrimSpace(name))
		if best < 0 {
			best = i
			continue
		}
		bestExact := strings.EqualFold(strings.TrimSpace(r.Docs[best].Name), strings.TrimSpace(name))
		if (exact && !bestExact) || (exact == bestExact && d.WorkCount > r.Docs[best].WorkCount) {
			best = i
		}
	}
	if best < 0 {
		return links, nil
	}
	key := strings.TrimPrefix(r.Docs[best].Key, "/authors/")
	links["openlibrary"] = openLibraryBase + "/authors/" + url.PathEscape(key)
	// The author detail carries remote ids; wikidata is the Wikipedia hop.
	if body, status, err := httpGet(ctx, openLibraryBase+"/authors/"+url.PathEscape(key)+".json", ""); err == nil && status == 200 {
		var a struct {
			RemoteIDs struct {
				Wikidata string `json:"wikidata"`
			} `json:"remote_ids"`
		}
		if json.Unmarshal(body, &a) == nil && a.RemoteIDs.Wikidata != "" {
			if w := wikipediaFromWikidata(ctx, a.RemoteIDs.Wikidata); w != "" {
				links["wikipedia"] = w
			}
		}
	}
	return links, nil
}

// PersonLinks resolves an actor name via TMDB person search + external_ids to
// the TMDB, IMDb, TheTVDB and (via wikidata) Wikipedia pages. Best-effort: an
// empty map (no error) means "no match".
func (t *TMDB) PersonLinks(ctx context.Context, name string) (map[string]string, error) {
	body, err := t.get(ctx, "/search/person", url.Values{"query": {name}})
	if err != nil {
		return nil, err
	}
	var r struct {
		Results []struct {
			ID int64 `json:"id"`
		} `json:"results"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("tmdb: %w", err)
	}
	links := map[string]string{}
	if len(r.Results) == 0 || r.Results[0].ID == 0 {
		return links, nil
	}
	id := strconv.FormatInt(r.Results[0].ID, 10)
	links["tmdb"] = "https://www.themoviedb.org/person/" + id
	if body, err := t.get(ctx, "/person/"+id+"/external_ids", url.Values{}); err == nil {
		var e struct {
			IMDBID     string `json:"imdb_id"`
			TVDBID     int64  `json:"tvdb_id"`
			WikidataID string `json:"wikidata_id"`
		}
		if json.Unmarshal(body, &e) == nil {
			if e.IMDBID != "" {
				links["imdb"] = "https://www.imdb.com/name/" + url.PathEscape(e.IMDBID) + "/"
			}
			if e.TVDBID != 0 {
				links["tvdb"] = "https://thetvdb.com/people/" + strconv.FormatInt(e.TVDBID, 10)
			}
			if e.WikidataID != "" {
				if w := wikipediaFromWikidata(ctx, e.WikidataID); w != "" {
					links["wikipedia"] = w
				}
			}
		}
	}
	return links, nil
}

// wikipediaFromWikidata resolves a wikidata Q-id to its English Wikipedia
// article via the public EntityData JSON (sitelinks.enwiki). Best-effort:
// returns "" when anything is off.
func wikipediaFromWikidata(ctx context.Context, qid string) string {
	qid = strings.TrimSpace(qid)
	if qid == "" || !strings.HasPrefix(qid, "Q") {
		return ""
	}
	body, status, err := httpGet(ctx, wikidataBase+"/wiki/Special:EntityData/"+url.PathEscape(qid)+".json", "")
	if err != nil || status != 200 {
		return ""
	}
	var r struct {
		Entities map[string]struct {
			Sitelinks map[string]struct {
				Title string `json:"title"`
			} `json:"sitelinks"`
		} `json:"entities"`
	}
	if json.Unmarshal(body, &r) != nil {
		return ""
	}
	if e, ok := r.Entities[qid]; ok {
		if s, ok := e.Sitelinks["enwiki"]; ok && s.Title != "" {
			return "https://en.wikipedia.org/wiki/" + url.PathEscape(strings.ReplaceAll(s.Title, " ", "_"))
		}
	}
	return ""
}
