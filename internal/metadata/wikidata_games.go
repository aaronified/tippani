package metadata

// Games from Wikidata, for when IGDB cannot answer.
//
// WHY THERE IS A FALLBACK AT ALL. IGDB is the only real games database this app
// can reach, and it is the only supplier in the whole application that needs a
// credential PAIR the reader has to go and register for — a Twitch application,
// a client id and a secret. Every other medium degrades gracefully: books need
// no key, films run on a shared built-in TMDB key. Games alone went from "works"
// to "503, type it in yourself" the moment a key was missing or Twitch was down,
// which made the one medium with the highest setup cost also the one with no
// floor under it.
//
// So this is the floor. It is deliberately NOT a second opinion — IGDB is better
// at games than Wikidata is, at everything except being free — and it is never
// consulted while IGDB is answering. It runs when IGDB is unconfigured, when
// Twitch refuses the credentials, and when the query errors.
//
// WHAT IT CAN AND CANNOT DO, stated plainly because the gap matters more than
// the feature:
//
//	studio     P178 developer, falling back to P123 publisher   usually present
//	year       P577 publication date                            usually present
//	genre      P136 genre                                       often present
//	franchise  P179 part of the series                          sometimes
//	cover art  P18 image                                        RARELY — Wikidata
//	           holds few game covers, because the art is not freely licensed
//	summary    the search result's own description, one line    always short
//
// A game found here will therefore usually arrive without a poster and with a
// one-line description where IGDB gives a paragraph. That is the honest shape of
// the source and it is why the candidate is tagged `wikidata`: the picker says
// where a record came from, and "this one is thinner" is a thing the reader
// should be able to see before choosing it.
//
// NO SPARQL AND NO NEW HOST. Same plain Action API on www.wikidata.org that
// people.go and igdb_cast.go already use, so the SSRF allowlist, the timeouts
// and the user agent are the ones already in place. Three requests for a search.
//
// THE TITLE MATCH IS THE WEAK POINT, and it is bounded rather than hidden.
// GameVoiceCast pins a game by IGDB slug precisely because a fuzzy title search
// picked *Hades II* for "Hades" during that feature's research. Here there is no
// slug to pin with — that is the whole situation — so the search is constrained
// to items that are instance-of a video game, and the results are handed to the
// reader as CANDIDATES to choose from rather than auto-applied. The picker is
// the disambiguator, which is what it is for.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	// Q7889 is "video game". P31 (instance of) is what keeps a search for
	// "Alan Wake" off the novel, the film adaptation and the character.
	wdVideoGame = "Q7889"

	wdPropInstanceOf  = "P31"
	wdPropDeveloper   = "P178"
	wdPropPublisher   = "P123"
	wdPropPublication = "P577"
	wdPropGenre       = "P136"
	wdPropSeries      = "P179"
	wdPropImage       = "P18"
	wdPropIGDBSlug    = "P5794"
)

// wikidataGameHit is one search result before its claims are read.
type wikidataGameHit struct {
	QID         string
	Title       string
	Description string
}

// SearchGamesWikidata finds video games by title. Best-effort: an empty slice
// and a nil error is a normal outcome, because plenty of games are not in
// Wikidata at all.
func SearchGamesWikidata(ctx context.Context, title string, year int) ([]MovieCandidate, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return nil, nil
	}
	hits, err := wikidataGameSearch(ctx, title)
	if err != nil {
		return nil, err
	}
	if len(hits) == 0 {
		return []MovieCandidate{}, nil
	}
	qids := make([]string, 0, len(hits))
	for _, h := range hits {
		qids = append(qids, h.QID)
	}
	claims, err := wikidataClaims(ctx, qids)
	if err != nil {
		return nil, err
	}
	// Every entity referenced by a developer/publisher/genre/series statement,
	// resolved to a label in ONE more batched request rather than one per hit.
	refs := []string{}
	for _, h := range hits {
		for _, p := range []string{wdPropDeveloper, wdPropPublisher} {
			for _, st := range claims[h.QID][p] {
				if id := st.entityID(); id != "" {
					refs = append(refs, id)
				}
			}
		}
	}
	labels := map[string]string{}
	if len(refs) > 0 {
		labels, _, err = wikidataLabelsAndImages(ctx, dedupeStrings(refs))
		if err != nil {
			// A missing label costs a studio name, not the whole result: the
			// candidate is still a real game with a real title and year.
			labels = map[string]string{}
		}
	}

	out := []MovieCandidate{}
	for _, h := range hits {
		c := claims[h.QID]
		// A hit whose P31 does not include a video game is dropped here rather
		// than trusted from the search index, which ranks on text as well as on
		// the statement filter.
		if !wikidataIsGame(c) {
			continue
		}
		y := wikidataYear(c)
		if year > 0 && y != 0 && y != year {
			continue
		}
		out = append(out, MovieCandidate{
			Source:      "wikidata",
			SourceID:    h.QID,
			MediaType:   "game",
			Title:       h.Title,
			ReleaseYear: y,
			Overview:    strings.TrimSpace(h.Description),
			PosterURL:   wikidataImage(c),
		})
		if len(out) == maxMovieCandidates {
			break
		}
	}
	_ = labels // labels are read by GameDetailsWikidata; the search shows no studio
	return out, nil
}

// GameDetailsWikidata fills out one game by its Q-id, for the reader who picked
// it from the candidate list.
//
// The developer lands in Director, which is the same vocabulary stretch the IGDB
// path makes and for the same reason: a show stores its CREATOR in that column
// and a game stores its STUDIO (0040). The publisher is the fallback, because a
// game with no developer statement and a publisher is far commoner than the
// reverse, and a named company beats a blank.
func GameDetailsWikidata(ctx context.Context, qid string) (*MovieDetails, error) {
	qid = strings.TrimSpace(qid)
	if !strings.HasPrefix(qid, "Q") {
		return nil, fmt.Errorf("wikidata: %q is not a Q-id", qid)
	}
	claims, err := wikidataClaims(ctx, []string{qid})
	if err != nil {
		return nil, err
	}
	c := claims[qid]
	if len(c) == 0 {
		return nil, ErrNoWikidataGame
	}
	refs := []string{}
	for _, p := range []string{wdPropDeveloper, wdPropPublisher, wdPropGenre, wdPropSeries} {
		for _, st := range c[p] {
			if id := st.entityID(); id != "" {
				refs = append(refs, id)
			}
		}
	}
	labels, images, err := wikidataLabelsAndImages(ctx, dedupeStrings(append(refs, qid)))
	if err != nil {
		labels, images = map[string]string{}, map[string]string{}
	}

	studio := wikidataFirstLabel(c, wdPropDeveloper, labels)
	if studio == "" {
		studio = wikidataFirstLabel(c, wdPropPublisher, labels)
	}
	genres := []string{}
	for _, st := range c[wdPropGenre] {
		if l := labels[st.entityID()]; l != "" {
			genres = append(genres, l)
		}
	}
	// Five, matching the cap the metadata fetcher applies everywhere else so a
	// source cannot bury a work in low-quality tags.
	if len(genres) > 5 {
		genres = genres[:5]
	}
	poster := wikidataImage(c)
	// The studio's own logo, where it has one — this is what puts a studio icon
	// where a film shows its director's face.
	logo := ""
	for _, st := range c[wdPropDeveloper] {
		if u := images[st.entityID()]; u != "" {
			logo = u
			break
		}
	}
	d := &MovieDetails{
		Source:        "wikidata",
		SourceID:      qid,
		MediaType:     "game",
		Slug:          wikidataString(c, wdPropIGDBSlug),
		Title:         labels[qid],
		Director:      studio,
		StudioLogoURL: logo,
		ReleaseYear:   wikidataYear(c),
		Genres:        genres,
		Series:        wikidataFirstLabel(c, wdPropSeries, labels),
		PosterURL:     poster,
		// The same art at both sizes: Special:FilePath already serves a scaled
		// copy through ?width=, so there is no second URL to build.
		PosterThumbURL: poster,
	}
	// A Wikidata game may still carry an IGDB slug even when IGDB itself is
	// unreachable, and that slug is the join key the voice cast needs — so the
	// cast can arrive through the fallback too, which is the one place this path
	// is not thinner than the real thing.
	if d.Slug != "" {
		if cast, err := GameVoiceCast(ctx, d.Slug); err == nil {
			d.Cast = cast
		}
	}
	return d, nil
}

// wikidataGameSearch runs one CirrusSearch query constrained to video games.
func wikidataGameSearch(ctx context.Context, title string) ([]wikidataGameHit, error) {
	q := url.Values{
		"action": {"query"},
		"list":   {"search"},
		// haswbstatement pins the TYPE and the free text ranks within it, which
		// is the combination that keeps a novel of the same name out.
		"srsearch": {"haswbstatement:" + wdPropInstanceOf + "=" + wdVideoGame + " " + title},
		"srlimit":  {strconv.Itoa(maxMovieCandidates * 2)},
		"format":   {"json"},
	}
	body, status, err := httpGet(ctx, wikidataBase+"/w/api.php?"+q.Encode(), "")
	if err != nil {
		return nil, fmt.Errorf("wikidata: %w", err)
	}
	if status != 200 {
		return nil, fmt.Errorf("wikidata: search status %d", status)
	}
	var r struct {
		Query struct {
			Search []struct {
				Title   string `json:"title"`
				Snippet string `json:"snippet"`
			} `json:"search"`
		} `json:"query"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("wikidata: %w", err)
	}
	out := []wikidataGameHit{}
	for _, h := range r.Query.Search {
		if !strings.HasPrefix(h.Title, "Q") {
			continue
		}
		out = append(out, wikidataGameHit{QID: h.Title, Description: stripHTML(h.Snippet)})
	}
	if len(out) == 0 {
		return out, nil
	}
	// The search returns Q-ids and a snippet; the readable name is a label.
	ids := make([]string, 0, len(out))
	for _, h := range out {
		ids = append(ids, h.QID)
	}
	labels, _, err := wikidataLabelsAndImages(ctx, ids)
	if err != nil {
		return nil, err
	}
	named := out[:0]
	for _, h := range out {
		if l := labels[h.QID]; l != "" {
			h.Title = l
			named = append(named, h)
		}
	}
	return named, nil
}

func wikidataIsGame(claims map[string][]wdStatement) bool {
	for _, st := range claims[wdPropInstanceOf] {
		if st.entityID() == wdVideoGame {
			return true
		}
	}
	return false
}

// wikidataYear reads the earliest P577 publication date. EARLIEST, because a
// game re-released on a later platform carries a statement per release and the
// year a reader means is the one it came out.
func wikidataYear(claims map[string][]wdStatement) int {
	best := 0
	for _, st := range claims[wdPropPublication] {
		var v struct {
			Time string `json:"time"`
		}
		if json.Unmarshal(st.Mainsnak.DataValue.Value, &v) != nil {
			continue
		}
		// "+2011-11-11T00:00:00Z" — the leading sign is Wikidata's, not RFC3339's.
		t := strings.TrimPrefix(v.Time, "+")
		parsed, err := time.Parse(time.RFC3339, t)
		if err != nil {
			if len(t) >= 4 {
				if y, e := strconv.Atoi(t[:4]); e == nil && y > 0 && (best == 0 || y < best) {
					best = y
				}
			}
			continue
		}
		if y := parsed.Year(); y > 0 && (best == 0 || y < best) {
			best = y
		}
	}
	return best
}

func wikidataImage(claims map[string][]wdStatement) string {
	for _, st := range claims[wdPropImage] {
		var file string
		if json.Unmarshal(st.Mainsnak.DataValue.Value, &file) == nil && strings.TrimSpace(file) != "" {
			// The same Commons entry point people.go uses, so the allowlist and
			// its redirect target need no new host.
			return "https://commons.wikimedia.org/wiki/Special:FilePath/" +
				url.PathEscape(strings.TrimSpace(file)) + "?width=600"
		}
	}
	return ""
}

func wikidataString(claims map[string][]wdStatement, prop string) string {
	for _, st := range claims[prop] {
		var s string
		if json.Unmarshal(st.Mainsnak.DataValue.Value, &s) == nil && strings.TrimSpace(s) != "" {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

func wikidataFirstLabel(claims map[string][]wdStatement, prop string, labels map[string]string) string {
	for _, st := range claims[prop] {
		if l := labels[st.entityID()]; l != "" {
			return l
		}
	}
	return ""
}

// stripHTML flattens the <span class="searchmatch"> markup CirrusSearch puts in
// a snippet. The snippet is the only one-line description this path has, and it
// is shown in a picker rather than parsed, so a crude strip is the right size of
// tool — the alternative is a second request per hit for the real description.
func stripHTML(s string) string {
	var b strings.Builder
	depth := 0
	for _, r := range s {
		switch {
		case r == '<':
			depth++
		case r == '>':
			if depth > 0 {
				depth--
			}
		case depth == 0:
			b.WriteRune(r)
		}
	}
	return strings.Join(strings.Fields(strings.ReplaceAll(b.String(), "&quot;", `"`)), " ")
}
