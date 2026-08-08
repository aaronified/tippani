package httpapi

import (
	"fmt"
	"net/http"
	"testing"
)

// A MIXED library — books and films and standalone quotes together — is the one
// every real library actually is, and the one nothing tested. Every existing
// deck test seeds a single medium, so "the deck serves standalone quotes" was
// only ever asserted for a library that contains nothing else.
//
// The failure this guards against is not an error. A quote that never reaches
// the deck is a quote you stop being asked about, and the only symptom is a
// quiz that feels like it is about books — which is indistinguishable from a
// quiz that is about books because that is most of what you saved.

// seedMixedLibrary builds a library that leans heavily on books, in the
// proportion a real one does: a shelf of book highlights, a couple of films, and
// a handful of standalone quotes.
func seedMixedLibrary(t *testing.T, srv *Server, c *testClient) {
	t.Helper()
	for i := 0; i < 6; i++ {
		seedReviewBook(t, c, fmt.Sprintf("Book %d", i), 5)
	}
	for i := 0; i < 2; i++ {
		m := decode[movieDetail](t, c.mustDo("POST", "/movies",
			map[string]any{"title": fmt.Sprintf("Film %d", i)}, http.StatusCreated))
		for j := 0; j < 4; j++ {
			c.mustDo("POST", "/dialogues", map[string]any{
				"movie_id": m.ID, "quote": fmt.Sprintf("film %d line %d", i, j),
			}, http.StatusCreated)
		}
	}
	seedReviewQuotes(t, c, "Subhas Chandra Bose", "Burma Radio broadcast", 3)
	seedReviewQuotes(t, c, "Franklin D. Roosevelt", "first inaugural address", 3)
	ageSeededItems(t, srv)
}

// kindsIn reports which media a deck actually served.
func kindsIn(items []reviewCard) map[string]int {
	out := map[string]int{}
	for _, it := range items {
		out[it.Kind]++
	}
	return out
}

// The default scope is the one nobody chose, so it is the one that has to be
// right. Thirty book highlights against six standalone quotes is a five-to-one
// lean, and a deck of eight drawn fairly still has to find the quotes.
func TestDailyDeckServesEveryMediumFromAMixedLibrary(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedMixedLibrary(t, srv, c)

	// Several days, because one deck of eight is a small sample against a
	// library of forty-two and a single empty draw proves nothing either way.
	// Different seeds are what a different day gives you.
	seen := map[string]int{}
	for day := 0; day < 12; day++ {
		deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
		for k, n := range kindsIn(deck.Items) {
			seen[k] += n
		}
	}
	for _, kind := range []string{kindBook, kindScreen, kindUtterance} {
		if seen[kind] == 0 {
			t.Errorf("no %s card in twelve draws from a mixed library: %v", kind, seen)
		}
	}
}

// The scope preference is what decides which pools the deck draws from, and it
// is stored as one string. Every value the server accepts must actually work,
// including the two the Settings screen has never been able to send.
func TestEveryAcceptedScopeDrawsWhatItNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedMixedLibrary(t, srv, c)

	for _, tc := range []struct {
		scope string
		want  []string
	}{
		{"books", []string{kindBook}},
		{"movies", []string{kindScreen}},
		{"quotes", []string{kindUtterance}},
		{"both", []string{kindBook, kindScreen, kindUtterance}},
	} {
		t.Run(tc.scope, func(t *testing.T) {
			c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": tc.scope}, 200)
			seen := map[string]int{}
			for day := 0; day < 12; day++ {
				deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
				for k, n := range kindsIn(deck.Items) {
					seen[k] += n
				}
			}
			for _, want := range tc.want {
				if seen[want] == 0 {
					t.Errorf("scope %q served no %s: %v", tc.scope, want, seen)
				}
			}
			for k := range seen {
				found := false
				for _, want := range tc.want {
					if k == want {
						found = true
					}
				}
				if !found {
					t.Errorf("scope %q served %s, which it does not name: %v", tc.scope, k, seen)
				}
			}
		})
	}
}


// The three media are independent choices, so every combination of them has to
// work — including the two that were unsayable until the preference learned to
// hold a list. "books,quotes" is the case that motivated it: a reader who does
// not want film lines in the deck should not have to give up standalone quotes
// to say so.
func TestScopeAcceptsAnyCombination(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedMixedLibrary(t, srv, c)

	for _, tc := range []struct {
		scope string
		want  []string
	}{
		{"books,quotes", []string{kindBook, kindUtterance}},
		{"movies,quotes", []string{kindScreen, kindUtterance}},
		{"books,movies", []string{kindBook, kindScreen}},
		{"books,movies,quotes", []string{kindBook, kindScreen, kindUtterance}},
		{"quotes,books", []string{kindBook, kindUtterance}}, // order is not meaning
		{"Books, Quotes", []string{kindBook, kindUtterance}}, // spacing and case are not meaning
	} {
		t.Run(tc.scope, func(t *testing.T) {
			c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": tc.scope}, 200)
			seen := map[string]int{}
			for day := 0; day < 12; day++ {
				deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
				for k, n := range kindsIn(deck.Items) {
					seen[k] += n
				}
			}
			for _, want := range tc.want {
				if seen[want] == 0 {
					t.Errorf("scope %q served no %s: %v", tc.scope, want, seen)
				}
			}
			for k := range seen {
				ok := false
				for _, want := range tc.want {
					if k == want {
						ok = true
					}
				}
				if !ok {
					t.Errorf("scope %q served %s, which it does not name: %v", tc.scope, k, seen)
				}
			}
		})
	}
}

// A list with one bad token is rejected whole, not silently narrowed. Dropping
// the token it did not understand is how a scope quietly becomes a different
// scope, and the only symptom would be a medium that stopped appearing.
func TestScopeRejectsAListWithRubbishInIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	for _, bad := range []string{"books,poems", "poems", "books,,quotes", ","} {
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": bad}, http.StatusBadRequest)
	}

	// An EMPTY string is the exception, and not a special case for this field:
	// every string preference treats "" as "not sending this one", which is what
	// lets the client PUT a partial object. So it leaves the stored scope alone
	// rather than being rejected — asserted here because the line above would
	// otherwise read as if it covered every falsy input.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": "quotes"}, 200)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": ""}, 200)
	prefs := decode[struct {
		Preferences struct {
			SRReviewScope string `json:"srReviewScope"`
		} `json:"preferences"`
	}](t, c.mustDo("GET", "/auth/me", nil, 200))
	if prefs.Preferences.SRReviewScope != "quotes" {
		t.Fatalf("an empty scope overwrote the stored one: %q", prefs.Preferences.SRReviewScope)
	}
}

// A preference that cannot be parsed means EVERYTHING, never nothing. A deck
// serving no cards because a stored string went bad is indistinguishable from a
// deck you have finished for the day, and nothing would ever say otherwise.
func TestAnUnparseableScopeFallsBackToEverything(t *testing.T) {
	for _, scope := range []string{"", "  ", "nonsense", ",,,"} {
		sc := scopeFlags(scope)
		if !sc.books || !sc.screen || !sc.utterance {
			t.Errorf("scopeFlags(%q) = %+v, want everything", scope, sc)
		}
	}
}
