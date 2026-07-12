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

// AuthorResolution is the outcome of pinning a free-text author name to a
// single Open Library author — the identity we persist (people.source_id = Key)
// so a portrait/link fetch never re-drifts to a namesake, plus the portrait URL
// and reference links resolved from that identity. A zero Key means "no
// confident match" (leave the person unresolved, fall back to manual entry).
type AuthorResolution struct {
	Key         string            // OL author key, e.g. "OL23919A" (bare, no "/authors/")
	Name        string            // OL's canonical display name for the match
	ImageURL    string            // portrait URL (OL photo, else Wikidata P18); "" if none exists
	WikidataQID string            // "" when the author has no wikidata link
	Links       map[string]string // openlibrary + wikipedia reference pages
}

// authorCandidate is one Open Library author-search hit, kept lean for
// disambiguation.
type authorCandidate struct {
	key       string
	name      string
	workCount int
}

// ResolveAuthor pins an author name to one Open Library author, disambiguating
// namesakes by the books the person actually wrote in the caller's library.
// This is the fix for "there are several David Reichs": Open Library's own
// relevance order can surface the wrong one, so when more than one candidate
// carries the queried name we cross-check each candidate's works against
// bookTitles and prefer the author whose catalogue contains one of them; only
// if nothing matches do we fall back to the most-published namesake. With a
// single candidate (or none) there is nothing to disambiguate. Best-effort: a
// zero-Key result (no error) means "no confident match".
func ResolveAuthor(ctx context.Context, name string, bookTitles []string) (AuthorResolution, error) {
	cands, err := searchAuthors(ctx, name)
	if err != nil {
		return AuthorResolution{}, err
	}
	best := disambiguateAuthor(ctx, name, cands, bookTitles)
	if best == nil {
		return AuthorResolution{}, nil
	}
	res := AuthorResolution{
		Key:   best.key,
		Name:  best.name,
		Links: map[string]string{"openlibrary": openLibraryBase + "/authors/" + url.PathEscape(best.key)},
	}
	// The author detail carries the photo ids + the wikidata remote id (the hop
	// to both the Wikipedia link and the P18 fallback portrait).
	photoID, qid := authorDetail(ctx, best.key)
	res.WikidataQID = qid
	if photoID > 0 {
		res.ImageURL = fmt.Sprintf("https://covers.openlibrary.org/a/id/%d-L.jpg", photoID)
	}
	if qid != "" {
		if w := wikipediaFromWikidata(ctx, qid); w != "" {
			res.Links["wikipedia"] = w
		}
		if res.ImageURL == "" { // no OL photo — try the richer Wikidata image
			res.ImageURL = WikidataImageURL(ctx, qid)
		}
	}
	// Sparse Open Library record (no wikidata link → no Wikipedia link and no P18
	// photo, e.g. David Reich): anchor on the book to find the author's Wikidata
	// identity directly. A bare name search would risk a namesake; the work's
	// author (P50) is unambiguous.
	if res.WikidataQID == "" {
		if wqid, wiki, img := authorWikidataViaBook(ctx, name, bookTitles); wqid != "" {
			res.WikidataQID = wqid
			if wiki != "" {
				res.Links["wikipedia"] = wiki
			}
			if res.ImageURL == "" {
				res.ImageURL = img
			}
		}
	}
	return res, nil
}

// authorWikidataViaBook resolves an author's Wikidata identity by anchoring on a
// book they wrote — the reliable path when Open Library is sparse and a bare
// name search would hit a namesake (there are several "David Reich"s). It
// searches Wikidata for a book title, reads the work's author (P50), and accepts
// that author only when its label carries the queried surname. Returns the QID,
// English Wikipedia URL and P18 image URL (any may be ""). Best-effort.
func authorWikidataViaBook(ctx context.Context, name string, bookTitles []string) (qid, wiki, imageURL string) {
	surname := normalizeWork(lastWord(name))
	for i, bt := range bookTitles {
		if i >= 2 { // bound the fan-out
			break
		}
		for j, bookQ := range wikidataSearchItems(ctx, bt) {
			if j >= 4 {
				break
			}
			aq := wikidataItemClaim(ctx, bookQ, "P50") // work → author
			if aq == "" {
				continue
			}
			label, w := wikidataLabelWiki(ctx, aq)
			if label == "" {
				continue
			}
			if surname != "" && strings.Contains(normalizeWork(label), surname) {
				return aq, w, WikidataImageURL(ctx, aq)
			}
		}
	}
	return "", "", ""
}

func lastWord(s string) string {
	f := strings.Fields(strings.TrimSpace(s))
	if len(f) == 0 {
		return ""
	}
	return f[len(f)-1]
}

// wikidataSearchItems returns candidate item QIDs for a free-text query.
func wikidataSearchItems(ctx context.Context, query string) []string {
	q := url.Values{"action": {"wbsearchentities"}, "search": {query}, "language": {"en"}, "type": {"item"}, "limit": {"5"}, "format": {"json"}}
	body, status, err := httpGet(ctx, wikidataBase+"/w/api.php?"+q.Encode(), "")
	if err != nil || status != 200 {
		return nil
	}
	var r struct {
		Search []struct {
			ID string `json:"id"`
		} `json:"search"`
	}
	if json.Unmarshal(body, &r) != nil {
		return nil
	}
	out := make([]string, 0, len(r.Search))
	for _, s := range r.Search {
		if s.ID != "" {
			out = append(out, s.ID)
		}
	}
	return out
}

// wikidataItemClaim returns the first item-id value of a wikibase-item property
// (e.g. P50 author) on an entity, or "".
func wikidataItemClaim(ctx context.Context, entity, property string) string {
	q := url.Values{"action": {"wbgetclaims"}, "entity": {entity}, "property": {property}, "format": {"json"}}
	body, status, err := httpGet(ctx, wikidataBase+"/w/api.php?"+q.Encode(), "")
	if err != nil || status != 200 {
		return ""
	}
	var r struct {
		Claims map[string][]struct {
			Mainsnak struct {
				DataValue struct {
					Value struct {
						ID string `json:"id"`
					} `json:"value"`
				} `json:"datavalue"`
			} `json:"mainsnak"`
		} `json:"claims"`
	}
	if json.Unmarshal(body, &r) != nil {
		return ""
	}
	if cs, ok := r.Claims[property]; ok && len(cs) > 0 {
		return cs[0].Mainsnak.DataValue.Value.ID
	}
	return ""
}

// wikidataLabelWiki returns an entity's English label and English Wikipedia URL
// (either may be "") from the EntityData JSON.
func wikidataLabelWiki(ctx context.Context, qid string) (label, wiki string) {
	body, status, err := httpGet(ctx, wikidataBase+"/wiki/Special:EntityData/"+url.PathEscape(qid)+".json", "")
	if err != nil || status != 200 {
		return "", ""
	}
	var r struct {
		Entities map[string]struct {
			Labels map[string]struct {
				Value string `json:"value"`
			} `json:"labels"`
			Sitelinks map[string]struct {
				Title string `json:"title"`
			} `json:"sitelinks"`
		} `json:"entities"`
	}
	if json.Unmarshal(body, &r) != nil {
		return "", ""
	}
	e, ok := r.Entities[qid]
	if !ok {
		return "", ""
	}
	if l, ok := e.Labels["en"]; ok {
		label = l.Value
	}
	if s, ok := e.Sitelinks["enwiki"]; ok && s.Title != "" {
		wiki = "https://en.wikipedia.org/wiki/" + url.PathEscape(strings.ReplaceAll(s.Title, " ", "_"))
	}
	return label, wiki
}

// searchAuthors returns Open Library author-search candidates for a name.
func searchAuthors(ctx context.Context, name string) ([]authorCandidate, error) {
	q := url.Values{"q": {name}, "limit": {"10"}}
	body, status, err := httpGet(ctx, openLibraryBase+"/search/authors.json?"+q.Encode(), "")
	if err != nil {
		return nil, fmt.Errorf("open library: %w", err)
	}
	if status != 200 {
		return nil, fmt.Errorf("open library: status %d", status)
	}
	var r struct {
		Docs []struct {
			Key       string `json:"key"`
			Name      string `json:"name"`
			WorkCount int    `json:"work_count"`
		} `json:"docs"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("open library: %w", err)
	}
	var out []authorCandidate
	for _, d := range r.Docs {
		if d.Key == "" {
			continue
		}
		out = append(out, authorCandidate{
			key:       strings.TrimPrefix(d.Key, "/authors/"),
			name:      d.Name,
			workCount: d.WorkCount,
		})
	}
	return out, nil
}

// disambiguateAuthor picks the candidate. Exact-name matches (case-insensitive)
// are preferred over fuzzy ones. When two or more exact matches exist — the
// namesake problem — each is cross-checked against the caller's book titles and
// the one whose Open Library works include one of them wins; failing any work
// match, the most-published exact match is the safest guess. Returns nil when
// there are no candidates at all.
func disambiguateAuthor(ctx context.Context, name string, cands []authorCandidate, bookTitles []string) *authorCandidate {
	if len(cands) == 0 {
		return nil
	}
	var exact []int
	for i := range cands {
		if strings.EqualFold(strings.TrimSpace(cands[i].name), strings.TrimSpace(name)) {
			exact = append(exact, i)
		}
	}
	// No exact-name hit: fall back to the most-published candidate overall.
	if len(exact) == 0 {
		best := 0
		for i := range cands {
			if cands[i].workCount > cands[best].workCount {
				best = i
			}
		}
		return &cands[best]
	}
	// A single namesake — nothing to disambiguate.
	if len(exact) == 1 {
		return &cands[exact[0]]
	}
	// Several namesakes: the book the author actually wrote decides it.
	if len(bookTitles) > 0 {
		for _, i := range exact {
			works, err := authorWorks(ctx, cands[i].key)
			if err != nil {
				continue
			}
			for _, w := range works {
				for _, bt := range bookTitles {
					if normalizeWork(w) != "" && normalizeWork(w) == normalizeWork(bt) {
						return &cands[i]
					}
				}
			}
		}
	}
	// Nothing matched a library book — the most-published namesake is the guess.
	best := exact[0]
	for _, i := range exact {
		if cands[i].workCount > cands[best].workCount {
			best = i
		}
	}
	return &cands[best]
}

// authorWorks returns an OL author's work titles (first page, newest first),
// for cross-checking a namesake against a library book.
func authorWorks(ctx context.Context, key string) ([]string, error) {
	body, status, err := httpGet(ctx, openLibraryBase+"/authors/"+url.PathEscape(key)+"/works.json?limit=50", "")
	if err != nil {
		return nil, fmt.Errorf("open library: %w", err)
	}
	if status != 200 {
		return nil, fmt.Errorf("open library: status %d", status)
	}
	var r struct {
		Entries []struct {
			Title string `json:"title"`
		} `json:"entries"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("open library: %w", err)
	}
	out := make([]string, 0, len(r.Entries))
	for _, e := range r.Entries {
		if e.Title != "" {
			out = append(out, e.Title)
		}
	}
	return out, nil
}

// authorDetail reads the OL author record for a positive photo id (photos may be
// absent or [-1] when none) and the wikidata remote id. Best-effort zero values.
func authorDetail(ctx context.Context, key string) (photoID int64, wikidataQID string) {
	body, status, err := httpGet(ctx, openLibraryBase+"/authors/"+url.PathEscape(key)+".json", "")
	if err != nil || status != 200 {
		return 0, ""
	}
	var a struct {
		Photos    []int64 `json:"photos"`
		RemoteIDs struct {
			Wikidata string `json:"wikidata"`
		} `json:"remote_ids"`
	}
	if json.Unmarshal(body, &a) != nil {
		return 0, ""
	}
	for _, p := range a.Photos {
		if p > 0 {
			photoID = p
			break
		}
	}
	return photoID, a.RemoteIDs.Wikidata
}

// normalizeWork folds a title for equality-matching a library book against an
// author's OL works: lowercased, subtitle after a colon dropped, non-alphanumue
// stripped, whitespace collapsed. Deliberately mirrors httpapi's normalizeTitle
// (kept here so the metadata package stays import-independent).
func normalizeWork(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if i := strings.IndexAny(s, ":—–"); i > 0 {
		s = s[:i]
	}
	var b strings.Builder
	prevSpace := false
	for _, r := range s {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			b.WriteRune(r)
			prevSpace = false
		case r == ' ' || r == '\t':
			if !prevSpace {
				b.WriteByte(' ')
				prevSpace = true
			}
		}
	}
	return strings.TrimSpace(b.String())
}

// WikidataImageURL resolves a wikidata Q-id to a portrait URL via the P18
// (image) claim, using the wbgetclaims API filtered to P18 (so every value in
// the response is a plain filename string). The Commons Special:FilePath entry
// point 302-redirects to the real upload.wikimedia.org bytes; both hosts are on
// the cover allowlist. Best-effort: "" when there is no image or anything is off.
func WikidataImageURL(ctx context.Context, qid string) string {
	qid = strings.TrimSpace(qid)
	if qid == "" || !strings.HasPrefix(qid, "Q") {
		return ""
	}
	q := url.Values{"action": {"wbgetclaims"}, "property": {"P18"}, "entity": {qid}, "format": {"json"}}
	body, status, err := httpGet(ctx, wikidataBase+"/w/api.php?"+q.Encode(), "")
	if err != nil || status != 200 {
		return ""
	}
	var r struct {
		Claims struct {
			P18 []struct {
				Mainsnak struct {
					DataValue struct {
						Value string `json:"value"`
					} `json:"datavalue"`
				} `json:"mainsnak"`
			} `json:"P18"`
		} `json:"claims"`
	}
	if json.Unmarshal(body, &r) != nil || len(r.Claims.P18) == 0 {
		return ""
	}
	file := strings.TrimSpace(r.Claims.P18[0].Mainsnak.DataValue.Value)
	if file == "" {
		return ""
	}
	return "https://commons.wikimedia.org/wiki/Special:FilePath/" + url.PathEscape(file) + "?width=600"
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
