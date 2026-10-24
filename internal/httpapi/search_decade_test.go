package httpapi

import (
	"net/http"
	"net/url"
	"testing"
)

// A DECADE FACET THAT COULD NOT FIND A QUOTE.
//
// searchDecadeFacet took two booleans — books and movies — so the one kind of row
// that carries a date OF ITS OWN was the one kind it never looked at. A standalone
// quote is dated by `occasion_date`; a book highlight and a film line borrow their
// work's year and arrive here inside that work.
//
// THIS IS NOT A HYPOTHETICAL GAP. timelineYears counts those quotes into its bars
// — its UNION has a branch reading `substr(occasion_date, 1, 5)` for exactly them
// — and the timeline's ticks are doors into this facet. So a library holding one
// quote from 399 BCE drew a bar over that decade, and the door under the bar
// opened an empty page.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `occasion_date` is TEXT holding a partial date
// with a four-digit zero-padded year and a leading '-' for BCE. A decade query
// gives a year RANGE, and for a BCE decade the range is negative and runs from the
// higher absolute year — the 380s BCE is [-389, -380].
func TestADecadeFindsAStandaloneQuote(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())

	// One line per decade, so a hit proves the range and not merely the column.
	said := map[string]string{
		"-0399": "The unexamined life is not worth living.",
		"-0380": "The 380s BCE, at the far end of the decade.",
		"-0389": "The 380s BCE, at the near end of it.",
		"0040":  "A line from the first century, written for this test.",
		"1944":  "Give me blood, and I will give you freedom",
		"":      "A line with no date at all.",
	}
	for date, quote := range said {
		body := bose()
		body["quote"] = quote
		body["occasion_date"] = date
		newUtterance(t, c, body)
	}

	for _, tc := range []struct {
		q    string
		want []string
	}{
		{"390s BCE", []string{"-0399"}},
		// Both ends of one decade, and in chronological order rather than the
		// order the padded text would give: 389 BCE is earlier than 380 BCE.
		{"380s BCE", []string{"-0389", "-0380"}},
		// THE PADDED FORM for a year under 1000, because "40s" is the documented
		// shorthand for the 1940s — see TestParseDecade above. It is also the form
		// the stats timeline links with, which is the case that matters here.
		{"0040s", []string{"0040"}},
		{"1940s", []string{"1944"}},
		// THE UNDATED QUOTE MUST NOT ANSWER THIS. CAST('' AS INTEGER) is 0 and
		// "0s" is a legal query whose range is 0-9, so without the emptiness
		// guard this one search returns every undated quote in the library.
		{"0s", nil},
		{"1950s", nil},
	} {
		res := decode[searchResults](t, c.mustDo("GET", "/search?q="+url.QueryEscape(tc.q), nil, http.StatusOK))
		if tc.want == nil {
			if res.Decade != nil && len(res.Decade.Quotes) > 0 {
				t.Errorf("%q returned %d quote(s), want none: %+v", tc.q, len(res.Decade.Quotes), res.Decade.Quotes)
			}
			continue
		}
		if res.Decade == nil {
			t.Fatalf("%q returned no decade facet at all", tc.q)
		}
		if len(res.Decade.Quotes) != len(tc.want) {
			t.Fatalf("%q returned %d quote(s), want %d", tc.q, len(res.Decade.Quotes), len(tc.want))
		}
		for i, date := range tc.want {
			if got := res.Decade.Quotes[i].OccasionDate; got != date {
				t.Errorf("%q quote %d is dated %q, want %q", tc.q, i, got, date)
			}
		}
	}
}

// THE FACET ANSWERS TO THE SCOPE, which is what replacing the two booleans bought
// beyond the new kind: a books-only search must not return a quote, and a
// quotes-only one must not return a book.
func TestADecadeFacetRespectsTheScope(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	body := bose()
	body["occasion_date"] = "1944"
	newUtterance(t, c, body)
	c.mustDo("POST", "/books", map[string]any{"title": "A 1944 Book", "published_year": 1944}, http.StatusCreated)

	for _, tc := range []struct {
		scope  string
		books  int
		quotes int
	}{
		{"all", 1, 1},
		{"books", 1, 0},
		{"quotes", 0, 1},
	} {
		res := decode[searchResults](t, c.mustDo("GET", "/search?q=1940s&scope="+tc.scope, nil, http.StatusOK))
		if res.Decade == nil {
			t.Fatalf("scope %q returned no decade facet", tc.scope)
		}
		if len(res.Decade.Books) != tc.books || len(res.Decade.Quotes) != tc.quotes {
			t.Errorf("scope %q: %d book(s) and %d quote(s), want %d and %d",
				tc.scope, len(res.Decade.Books), len(res.Decade.Quotes), tc.books, tc.quotes)
		}
	}
}
