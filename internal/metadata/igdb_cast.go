package metadata

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
)

// ErrNoWikidataGame means no Wikidata item claims this IGDB slug. It is
// distinguished from "an item with no cast" on purpose: the first is a lookup
// that found nothing to read, the second is a game whose voice credits nobody
// has entered. Only the first is worth an operator code, and neither is worth an
// error shown to the reader — see the note on coverage below.
var ErrNoWikidataGame = errors.New("no wikidata item for this igdb slug")

// maxWikidataBatch is the wbgetentities id cap. Fifty is the API's documented
// limit for anonymous callers, and it is the whole reason this works without
// SPARQL: Skyrim's 66 credits resolve in two batched requests rather than 132
// individual ones.
const maxWikidataBatch = 50

// GameVoiceCast resolves an IGDB slug to a game's voice cast through Wikidata.
//
// WHY WIKIDATA, AND WHY IT IS THE ONLY OPTION. Measured against live APIs on
// 2026-08-16 over 24 well-known games: IGDB v4 has no person endpoint and no
// credit endpoint at all — its `characters` endpoint carries akas, gender,
// mug_shot, species, description and games, with no actor link. MobyGames
// exposes no credits endpoint. Giant Bomb returns an unroled flat `people` list.
// IMDb has the data and no API. So this is not a choice between sources; it is
// the only structured, free source that exists, and it is thin:
//
//	Skyrim          66 credits, 66 with a character role, 38 with a portrait
//	Baldur's Gate 3 23 credits, 22 with a role
//	Cyberpunk 2077  17 credits
//	Elden Ring       9 credits, 9 with a role
//	Witcher 3 · Mass Effect 3 · Persona 5 · Disco Elysium · BioShock  → ZERO
//
// Two of the four games this feature was requested for have no cast here at all.
// That is why an empty result is a normal outcome rather than a failure, and why
// the stored cast stays hand-editable: the honest answer is a blank the reader
// can fill, not a lookup that reports success and shows nothing.
//
// THE GAME IS PINNED EXACTLY, NOT MATCHED BY TITLE. P5794 holds the IGDB slug,
// so haswbstatement:P5794=elden-ring returns Q64826862 and nothing else. This
// matters more than it looks: during the research a fuzzy title search picked
// *Hades II* for "Hades", and a wrong cast attached to a right game is a defect
// that reads as correct.
//
// Three requests, all to www.wikidata.org's plain Action API, which people.go
// already uses and covers.go already allowlists. No SPARQL and no new host.
func GameVoiceCast(ctx context.Context, slug string) ([]CastMember, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return nil, ErrNoWikidataGame
	}
	qid, err := wikidataGameQID(ctx, slug)
	if err != nil {
		return nil, err
	}
	claims, err := wikidataClaims(ctx, []string{qid})
	if err != nil {
		return nil, err
	}
	game := claims[qid]

	// Route 1 — the game's own P725 (voice actor) statements, whose P4633
	// qualifier is the character name as a plain string. This is the shape
	// cast_json already wants, so nothing is reformatted:
	//   Q23751449 "Martha Mackintosh"  P4633 "Melina"
	type pending struct {
		actorQID  string
		character string // set when route 1 gave a P4633 qualifier
		charQID   string // set when route 2 came through a character entity
	}
	var rows []pending
	seen := map[string]bool{} // actorQID|character, so the two routes cannot double up

	add := func(p pending) {
		key := p.actorQID + "|" + p.character + "|" + p.charQID
		if p.actorQID == "" || seen[key] {
			return
		}
		seen[key] = true
		rows = append(rows, p)
	}

	for _, st := range game["P725"] {
		add(pending{actorQID: st.entityID(), character: st.qualifierString("P4633")})
	}

	// Route 2 — the character hop. P674 lists the game's characters; each
	// character entity may carry its own P725. This is what rescues Half-Life 2,
	// Final Fantasy VII and Persona 5, whose credits are attached to the
	// characters rather than to the game.
	var charQIDs []string
	for _, st := range game["P674"] {
		if id := st.entityID(); id != "" {
			charQIDs = append(charQIDs, id)
		}
	}
	if len(charQIDs) > 0 {
		charClaims, err := wikidataClaims(ctx, charQIDs)
		if err != nil {
			return nil, err
		}
		for _, cq := range charQIDs {
			for _, st := range charClaims[cq]["P725"] {
				add(pending{actorQID: st.entityID(), charQID: cq})
			}
		}
	}
	if len(rows) == 0 {
		return []CastMember{}, nil
	}

	// One batched pass for every label and portrait at once — actors and the
	// characters route 2 needs names for. Doing this per row is what makes the
	// naive version 130 requests; doing it batched is what makes three enough.
	need := []string{}
	for _, r := range rows {
		need = append(need, r.actorQID)
		if r.charQID != "" {
			need = append(need, r.charQID)
		}
	}
	labels, images, err := wikidataLabelsAndImages(ctx, need)
	if err != nil {
		return nil, err
	}

	out := []CastMember{}
	for _, r := range rows {
		actor := labels[r.actorQID]
		if actor == "" {
			continue // an actor whose label we cannot read is not a credit worth storing
		}
		character := r.character
		if character == "" && r.charQID != "" {
			character = labels[r.charQID]
		}
		out = append(out, CastMember{
			Character: character,
			Actor:     actor,
			// PersonID is the QID, and ImageURL the Commons portrait, so the
			// actor→portrait resolver spends no extra call — exactly as the TMDB
			// and TVDB paths already document. The namespace differs per source,
			// which is what PersonID's contract already says.
			PersonID: r.actorQID,
			ImageURL: images[r.actorQID],
		})
		if len(out) == maxCast {
			break
		}
	}
	return out, nil
}

// wikidataGameQID resolves an IGDB slug to the one Wikidata item claiming it.
func wikidataGameQID(ctx context.Context, slug string) (string, error) {
	q := url.Values{
		"action":   {"query"},
		"list":     {"search"},
		"srsearch": {"haswbstatement:P5794=" + slug},
		"srlimit":  {"1"},
		"format":   {"json"},
	}
	body, status, err := httpGet(ctx, wikidataBase+"/w/api.php?"+q.Encode(), "")
	if err != nil {
		return "", fmt.Errorf("wikidata: %w", err)
	}
	if status != 200 {
		return "", fmt.Errorf("wikidata: search status %d", status)
	}
	var r struct {
		Query struct {
			Search []struct {
				Title string `json:"title"`
			} `json:"search"`
		} `json:"query"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return "", fmt.Errorf("wikidata: %w", err)
	}
	if len(r.Query.Search) == 0 || !strings.HasPrefix(r.Query.Search[0].Title, "Q") {
		return "", ErrNoWikidataGame
	}
	return r.Query.Search[0].Title, nil
}

// wdStatement is one Wikidata claim, reduced to the two things read here: the
// entity the mainsnak points at, and the string qualifiers hanging off it.
type wdStatement struct {
	Mainsnak struct {
		DataValue struct {
			Value json.RawMessage `json:"value"`
		} `json:"datavalue"`
	} `json:"mainsnak"`
	Qualifiers map[string][]struct {
		DataValue struct {
			Value json.RawMessage `json:"value"`
		} `json:"datavalue"`
	} `json:"qualifiers"`
}

// entityID reads a wikibase-entityid mainsnak's Q-id.
func (s wdStatement) entityID() string {
	var v struct {
		ID string `json:"id"`
	}
	if json.Unmarshal(s.Mainsnak.DataValue.Value, &v) != nil {
		return ""
	}
	return v.ID
}

// qualifierString reads a plain-string qualifier (P4633 is the character name).
func (s wdStatement) qualifierString(prop string) string {
	for _, q := range s.Qualifiers[prop] {
		var str string
		if json.Unmarshal(q.DataValue.Value, &str) == nil && strings.TrimSpace(str) != "" {
			return strings.TrimSpace(str)
		}
	}
	return ""
}

// wikidataClaims batches wbgetentities&props=claims over any number of QIDs.
func wikidataClaims(ctx context.Context, qids []string) (map[string]map[string][]wdStatement, error) {
	out := map[string]map[string][]wdStatement{}
	for _, batch := range chunk(qids, maxWikidataBatch) {
		q := url.Values{
			"action": {"wbgetentities"},
			"ids":    {strings.Join(batch, "|")},
			"props":  {"claims"},
			"format": {"json"},
		}
		body, status, err := httpGet(ctx, wikidataBase+"/w/api.php?"+q.Encode(), "")
		if err != nil {
			return nil, fmt.Errorf("wikidata: %w", err)
		}
		if status != 200 {
			return nil, fmt.Errorf("wikidata: entities status %d", status)
		}
		var r struct {
			Entities map[string]struct {
				Claims map[string][]wdStatement `json:"claims"`
			} `json:"entities"`
		}
		if err := json.Unmarshal(body, &r); err != nil {
			return nil, fmt.Errorf("wikidata: %w", err)
		}
		for id, e := range r.Entities {
			out[id] = e.Claims
		}
	}
	return out, nil
}

// wikidataLabelsAndImages batches labels and P18 portraits in ONE pass. Asking
// for both props together is the difference between three requests and four.
func wikidataLabelsAndImages(ctx context.Context, qids []string) (labels, images map[string]string, err error) {
	labels, images = map[string]string{}, map[string]string{}
	for _, batch := range chunk(dedupeStrings(qids), maxWikidataBatch) {
		q := url.Values{
			"action":    {"wbgetentities"},
			"ids":       {strings.Join(batch, "|")},
			"props":     {"labels|claims"},
			"languages": {"en"},
			"format":    {"json"},
		}
		body, status, e := httpGet(ctx, wikidataBase+"/w/api.php?"+q.Encode(), "")
		if e != nil {
			return nil, nil, fmt.Errorf("wikidata: %w", e)
		}
		if status != 200 {
			return nil, nil, fmt.Errorf("wikidata: entities status %d", status)
		}
		var r struct {
			Entities map[string]struct {
				Labels map[string]struct {
					Value string `json:"value"`
				} `json:"labels"`
				Claims map[string][]wdStatement `json:"claims"`
			} `json:"entities"`
		}
		if e := json.Unmarshal(body, &r); e != nil {
			return nil, nil, fmt.Errorf("wikidata: %w", e)
		}
		for id, ent := range r.Entities {
			if l, ok := ent.Labels["en"]; ok {
				labels[id] = strings.TrimSpace(l.Value)
			}
			for _, st := range ent.Claims["P18"] {
				var file string
				if json.Unmarshal(st.Mainsnak.DataValue.Value, &file) == nil && strings.TrimSpace(file) != "" {
					// Same Commons entry point people.go already uses, so the SSRF
					// allowlist and its redirect target need no new host.
					images[id] = "https://commons.wikimedia.org/wiki/Special:FilePath/" +
						url.PathEscape(strings.TrimSpace(file)) + "?width=600"
					break
				}
			}
		}
	}
	return labels, images, nil
}

func chunk(s []string, n int) [][]string {
	var out [][]string
	for len(s) > n {
		out = append(out, s[:n])
		s = s[n:]
	}
	if len(s) > 0 {
		out = append(out, s)
	}
	return out
}

func dedupeStrings(s []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(s))
	for _, v := range s {
		if v != "" && !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	return out
}
