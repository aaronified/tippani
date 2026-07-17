package httpapi

import (
	"net/http"
	"testing"
)

// TestFuzzySearch covers the zero-hit typo-correction pass (PLAN §4): a
// misspelled query returns corrected results with the `corrected` field set, an
// exact hit omits it, scope is respected, and genuine gibberish stays empty.
func TestFuzzySearch(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Shawshank Redemption", "author": "Stephen King",
	}, http.StatusCreated))
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Casablanca", "director": "Michael Curtiz", "release_year": 1942,
	}, http.StatusCreated))

	// Typo corrected: "shawshenk" → "shawshank", the book comes back, and the
	// response reports the corrected query it actually ran.
	res := decode[searchResp](t, c.mustDo("GET", "/search?q=shawshenk&scope=books", nil, 200))
	if res.Corrected != "shawshank" {
		t.Fatalf("q=shawshenk corrected = %q, want %q", res.Corrected, "shawshank")
	}
	if len(res.Books) != 1 || res.Books[0].ID != book.ID {
		t.Fatalf("q=shawshenk books: %+v", res.Books)
	}

	// Exact hit → no correction field.
	res = decode[searchResp](t, c.mustDo("GET", "/search?q=shawshank&scope=books", nil, 200))
	if res.Corrected != "" || len(res.Books) != 1 {
		t.Fatalf("exact q=shawshank should not be corrected: %+v", res)
	}

	// A live prefix is found by the exact pass, so no fuzzy pass runs.
	res = decode[searchResp](t, c.mustDo("GET", "/search?q=shaw&scope=books", nil, 200))
	if res.Corrected != "" || len(res.Books) != 1 {
		t.Fatalf("prefix q=shaw should not be corrected: %+v", res)
	}

	// Scope respected: a movie-title typo corrects within movies only.
	res = decode[searchResp](t, c.mustDo("GET", "/search?q=casblanca&scope=movies", nil, 200))
	if res.Corrected != "casablanca" || len(res.Movies) != 1 || res.Movies[0].ID != movie.ID {
		t.Fatalf("q=casblanca: corrected=%q movies=%+v", res.Corrected, res.Movies)
	}
	if len(res.Books) != 0 {
		t.Fatalf("scope=movies leaked books: %+v", res.Books)
	}

	// No near neighbour → plain empty result, no correction claimed.
	res = decode[searchResp](t, c.mustDo("GET", "/search?q=xyzzyquux", nil, 200))
	if res.Corrected != "" || len(res.Books)+len(res.Movies)+len(res.Annotations)+len(res.Dialogues) != 0 {
		t.Fatalf("gibberish should stay empty and uncorrected: %+v", res)
	}

	// Typeahead through a typo mid-word: a SHORT token corrects toward a much
	// LONGER indexed term via last-token prefix distance ("shawsq" -> "shawshank",
	// len 6 -> 9). This exercises the unbounded-upper harvest — the exact case a
	// naive [len-budget, len+budget] window would silently drop.
	res = decode[searchResp](t, c.mustDo("GET", "/search?q=shawsq&scope=books", nil, 200))
	if res.Corrected != "shawshank" || len(res.Books) != 1 || res.Books[0].ID != book.ID {
		t.Fatalf("q=shawsq should correct toward the longer term: corrected=%q books=%+v", res.Corrected, res.Books)
	}
}

// TestFuzzySearchCrossUser proves §3.6: the vocab is index-wide, but a user only
// ever sees corrections that surface THEIR OWN rows. Bob's typo near a term that
// exists only in Alice's library returns empty with no `corrected` field — the
// corrected re-run is user-scoped and the field is suppressed on zero own-hits.
func TestFuzzySearchCrossUser(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	// A term that exists only in Alice's library.
	alice.mustDo("POST", "/books", map[string]any{"title": "Xanthophyll", "author": "A. Botanist"}, http.StatusCreated)

	// A substitution typo (not a prefix, so the exact pass misses it): Alice's
	// own "xanthophull" corrects to "xanthophyll" and finds her book.
	res := decode[searchResp](t, alice.mustDo("GET", "/search?q=xanthophull&scope=books", nil, 200))
	if res.Corrected != "xanthophyll" || len(res.Books) != 1 {
		t.Fatalf("alice's own typo should correct: %+v", res)
	}

	// Bob's identical typo must not surface Alice's vocabulary: empty, no field.
	res = decode[searchResp](t, bob.mustDo("GET", "/search?q=xanthophull&scope=books", nil, 200))
	if res.Corrected != "" || len(res.Books) != 0 {
		t.Fatalf("bob must not see alice's vocab: corrected=%q books=%+v", res.Corrected, res.Books)
	}
}

// TestFuzzySearchVocabFailureDegrades proves the best-effort contract: if a
// vocab read fails outright (here the vocab table is dropped and the base-index
// repair can't recreate it), the fuzzy pass is skipped and the plain empty
// result is returned — search never 500s because correction broke.
func TestFuzzySearchVocabFailureDegrades(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{"title": "The Shawshank Redemption"}, http.StatusCreated)

	if _, err := srv.Store.DB.Exec(`DROP TABLE books_fts_vocab`); err != nil {
		t.Fatal(err)
	}
	res := decode[searchResp](t, c.mustDo("GET", "/search?q=shawshenk&scope=books", nil, 200))
	if res.Corrected != "" || len(res.Books) != 0 {
		t.Fatalf("vocab failure should degrade to empty, not correct or 500: %+v", res)
	}
}
