package metadata

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// wikidataStub serves the three Action API calls GameVoiceCast makes. Routing is
// on the `action`/`list` params, exactly as the real endpoint dispatches.
type wikidataStub struct {
	srv         *httptest.Server
	qid         string            // the item haswbstatement resolves to; "" = no match
	claims      map[string]string // QID -> raw claims JSON object
	labels      map[string]string // QID -> English label
	images      map[string]string // QID -> P18 commons filename
	entityCalls int               // wbgetentities requests (batching assertions)
}

func newWikidataStub(t *testing.T, s *wikidataStub) *wikidataStub {
	t.Helper()
	s.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		switch {
		case q.Get("action") == "query" && q.Get("list") == "search":
			if !strings.HasPrefix(q.Get("srsearch"), "haswbstatement:P5794=") {
				t.Errorf("srsearch = %q, want a P5794 statement search (a title search "+
					"picks the wrong game)", q.Get("srsearch"))
			}
			if s.qid == "" {
				w.Write([]byte(`{"query":{"search":[]}}`))
				return
			}
			fmt.Fprintf(w, `{"query":{"search":[{"title":%q}]}}`, s.qid)

		case q.Get("action") == "wbgetentities":
			s.entityCalls++
			ids := strings.Split(q.Get("ids"), "|")
			if len(ids) > maxWikidataBatch {
				t.Errorf("wbgetentities asked for %d ids, over the %d cap", len(ids), maxWikidataBatch)
			}
			ents := map[string]json.RawMessage{}
			for _, id := range ids {
				parts := []string{}
				if c, ok := s.claims[id]; ok {
					parts = append(parts, `"claims":`+c)
				} else if q.Get("props") != "claims" {
					// labels pass: synthesise a claims object carrying P18 only
					if f, ok := s.images[id]; ok {
						parts = append(parts, fmt.Sprintf(
							`"claims":{"P18":[{"mainsnak":{"datavalue":{"value":%q}}}]}`, f))
					}
				}
				if l, ok := s.labels[id]; ok && q.Get("props") != "claims" {
					parts = append(parts, fmt.Sprintf(`"labels":{"en":{"value":%q}}`, l))
				}
				ents[id] = json.RawMessage("{" + strings.Join(parts, ",") + "}")
			}
			out, _ := json.Marshal(map[string]any{"entities": ents})
			w.Write(out)

		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(s.srv.Close)

	orig := wikidataBase
	wikidataBase = s.srv.URL
	t.Cleanup(func() { wikidataBase = orig })
	return s
}

// TestGameVoiceCastDirectRoute is Elden Ring's real shape: the game's own P725
// statements with a P4633 character-name qualifier.
func TestGameVoiceCastDirectRoute(t *testing.T) {
	newWikidataStub(t, &wikidataStub{
		qid: "Q64826862",
		claims: map[string]string{
			"Q64826862": `{"P725":[
			  {"mainsnak":{"datavalue":{"value":{"id":"Q23751449"}}},
			   "qualifiers":{"P4633":[{"datavalue":{"value":"Melina"}}]}},
			  {"mainsnak":{"datavalue":{"value":{"id":"Q5157993"}}},
			   "qualifiers":{"P4633":[{"datavalue":{"value":"Mohg"}}]}}]}`,
		},
		labels: map[string]string{"Q23751449": "Martha Mackintosh", "Q5157993": "Con O'Neill"},
		images: map[string]string{"Q5157993": "Con ONeill.jpg"},
	})

	cast, err := GameVoiceCast(context.Background(), "elden-ring")
	if err != nil {
		t.Fatal(err)
	}
	if len(cast) != 2 {
		t.Fatalf("got %d credits, want 2: %+v", len(cast), cast)
	}
	// Assert on values, not counts — the whole failure mode here is the right
	// number of credits with the wrong actor against the wrong character.
	if cast[0].Actor != "Martha Mackintosh" || cast[0].Character != "Melina" {
		t.Errorf("credit 0 = %q as %q", cast[0].Actor, cast[0].Character)
	}
	if cast[0].PersonID != "Q23751449" {
		t.Errorf("credit 0 PersonID = %q, want the QID", cast[0].PersonID)
	}
	if cast[1].Actor != "Con O'Neill" || cast[1].Character != "Mohg" {
		t.Errorf("credit 1 = %q as %q", cast[1].Actor, cast[1].Character)
	}
	if !strings.Contains(cast[1].ImageURL, "Special:FilePath/Con%20ONeill.jpg") {
		t.Errorf("credit 1 ImageURL = %q, want a Commons FilePath URL", cast[1].ImageURL)
	}
	// Martha has no P18 — an absent portrait is a blank, not a broken URL.
	if cast[0].ImageURL != "" {
		t.Errorf("credit 0 ImageURL = %q, want empty", cast[0].ImageURL)
	}
}

// TestGameVoiceCastCharacterHop is the second route: credits hang off the
// character entities rather than the game. This is what rescues Half-Life 2,
// Final Fantasy VII and Persona 5.
func TestGameVoiceCastCharacterHop(t *testing.T) {
	newWikidataStub(t, &wikidataStub{
		qid: "Q6934",
		claims: map[string]string{
			// No P725 on the game itself — only P674 characters.
			"Q6934": `{"P674":[{"mainsnak":{"datavalue":{"value":{"id":"Q1058"}}}},
			                   {"mainsnak":{"datavalue":{"value":{"id":"Q2077"}}}}]}`,
			"Q1058": `{"P725":[{"mainsnak":{"datavalue":{"value":{"id":"Q900"}}}}]}`,
			"Q2077": `{"P725":[{"mainsnak":{"datavalue":{"value":{"id":"Q901"}}}}]}`,
		},
		labels: map[string]string{
			"Q900": "Robert Guillaume", "Q901": "Merle Dandridge",
			"Q1058": "Eli Vance", "Q2077": "Alyx Vance",
		},
	})

	cast, err := GameVoiceCast(context.Background(), "half-life-2")
	if err != nil {
		t.Fatal(err)
	}
	if len(cast) != 2 {
		t.Fatalf("got %d credits, want 2: %+v", len(cast), cast)
	}
	// The character name comes from the character entity's LABEL on this route,
	// where route 1 gets it from a qualifier string.
	if cast[0].Actor != "Robert Guillaume" || cast[0].Character != "Eli Vance" {
		t.Errorf("credit 0 = %q as %q", cast[0].Actor, cast[0].Character)
	}
	if cast[1].Actor != "Merle Dandridge" || cast[1].Character != "Alyx Vance" {
		t.Errorf("credit 1 = %q as %q", cast[1].Actor, cast[1].Character)
	}
}

// TestGameVoiceCastNoWikidataItem is The Witcher 3's real shape: no item claims
// the slug at all. The caller needs this distinguishable from "no cast".
func TestGameVoiceCastNoWikidataItem(t *testing.T) {
	newWikidataStub(t, &wikidataStub{qid: ""})
	cast, err := GameVoiceCast(context.Background(), "the-witcher-3-wild-hunt")
	if !errors.Is(err, ErrNoWikidataGame) {
		t.Fatalf("err = %v, want ErrNoWikidataGame", err)
	}
	if cast != nil {
		t.Errorf("cast = %+v, want nil", cast)
	}
}

// TestGameVoiceCastItemWithNoCredits is the OTHER empty case — the item exists,
// nobody has entered voice credits. This is not an error: it is the honest "no
// cast on file" blank the reader can then type into, and returning an error here
// would make the game look unfetchable.
func TestGameVoiceCastItemWithNoCredits(t *testing.T) {
	newWikidataStub(t, &wikidataStub{
		qid:    "Q317323",
		claims: map[string]string{"Q317323": `{"P136":[{"mainsnak":{"datavalue":{"value":{"id":"Q1"}}}}]}`},
	})
	cast, err := GameVoiceCast(context.Background(), "mass-effect-3")
	if err != nil {
		t.Fatalf("err = %v, want nil — an item with no credits is not a failure", err)
	}
	if cast == nil {
		t.Fatal("cast = nil, want an empty non-nil slice so JSON is [] not null")
	}
	if len(cast) != 0 {
		t.Fatalf("cast = %+v, want empty", cast)
	}
}

// TestGameVoiceCastBatchesLabels proves the label/portrait pass is batched
// rather than one request per actor. Skyrim has 66 credits; unbatched that is
// 66 requests, and IGDB/Wikidata politeness is the whole reason this design
// avoids SPARQL.
func TestGameVoiceCastBatchesLabels(t *testing.T) {
	const n = 60 // > maxWikidataBatch, so it must split into exactly two
	var sb strings.Builder
	labels := map[string]string{}
	sb.WriteString(`{"P725":[`)
	for i := 0; i < n; i++ {
		if i > 0 {
			sb.WriteString(",")
		}
		qid := fmt.Sprintf("Q%d", 1000+i)
		fmt.Fprintf(&sb, `{"mainsnak":{"datavalue":{"value":{"id":%q}}},`+
			`"qualifiers":{"P4633":[{"datavalue":{"value":"Char%d"}}]}}`, qid, i)
		labels[qid] = fmt.Sprintf("Actor %d", i)
	}
	sb.WriteString(`]}`)

	s := newWikidataStub(t, &wikidataStub{
		qid:    "Q1888",
		claims: map[string]string{"Q1888": sb.String()},
		labels: labels,
	})

	cast, err := GameVoiceCast(context.Background(), "skyrim")
	if err != nil {
		t.Fatal(err)
	}
	// maxCast trims the stored cast, the same cap TMDB and TVDB already apply.
	if len(cast) != maxCast {
		t.Fatalf("got %d credits, want the maxCast trim of %d", len(cast), maxCast)
	}
	if cast[0].Actor != "Actor 0" || cast[0].Character != "Char0" {
		t.Errorf("credit 0 = %q as %q", cast[0].Actor, cast[0].Character)
	}
	// 1 claims call for the game + 2 batched label calls for 60 actors = 3.
	if s.entityCalls != 3 {
		t.Fatalf("wbgetentities calls = %d, want 3 (1 claims + 2 batches of <=50); "+
			"one per actor would be %d", s.entityCalls, n+1)
	}
}

// TestGameVoiceCastSkipsUnlabelledActor — a QID whose English label cannot be
// read is dropped rather than stored as a credit with a blank name.
func TestGameVoiceCastSkipsUnlabelledActor(t *testing.T) {
	newWikidataStub(t, &wikidataStub{
		qid: "Q1",
		claims: map[string]string{
			"Q1": `{"P725":[
			  {"mainsnak":{"datavalue":{"value":{"id":"Q10"}}},"qualifiers":{"P4633":[{"datavalue":{"value":"Named"}}]}},
			  {"mainsnak":{"datavalue":{"value":{"id":"Q11"}}},"qualifiers":{"P4633":[{"datavalue":{"value":"Nameless"}}]}}]}`,
		},
		labels: map[string]string{"Q10": "Real Actor"}, // Q11 deliberately absent
	})
	cast, err := GameVoiceCast(context.Background(), "x")
	if err != nil {
		t.Fatal(err)
	}
	if len(cast) != 1 || cast[0].Actor != "Real Actor" || cast[0].Character != "Named" {
		t.Fatalf("cast = %+v, want only the labelled credit", cast)
	}
}

// TestGameVoiceCastEmptySlug refuses before spending a request.
func TestGameVoiceCastEmptySlug(t *testing.T) {
	if _, err := GameVoiceCast(context.Background(), "  "); !errors.Is(err, ErrNoWikidataGame) {
		t.Fatalf("err = %v, want ErrNoWikidataGame", err)
	}
}
