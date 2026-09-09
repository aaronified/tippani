package httpapi

import (
	"net/http"
	"net/url"
	"testing"
)

// The decade facet's parser, which is now load-bearing in a way it was not when it
// only served somebody typing "90s" into the box: the stats timeline's ticks are
// doors into this facet, so every label that chart can draw has to be a query this
// can read. A form the app produces itself and cannot parse is a control that
// leads to an empty page.
//
// The 90s → 1990s shorthand is the trap in here. It is right for a person typing,
// and it is why the chart does NOT link with a two-digit query — see bucketQuery in
// StatsPage.jsx. These cases pin both halves: the shorthand still applies to what a
// person types, and a zero-padded year is taken literally.
func TestParseDecade(t *testing.T) {
	cases := []struct {
		q     string
		label string
		from  int
		to    int
		ok    bool
	}{
		// What a person types.
		{"1990s", "1990s", 1990, 1999, true},
		{"90s", "1990s", 1990, 1999, true},
		{"90's", "1990s", 1990, 1999, true},
		{"90’s", "1990s", 1990, 1999, true},
		{" 1990S ", "1990s", 1990, 1999, true},
		// 00s–20s read forwards, not back to the 1900s.
		{"20s", "2020s", 2020, 2029, true},
		{"00s", "2000s", 2000, 2009, true},
		{"30s", "1930s", 1930, 1939, true},
		// Not on a decade boundary: floored, never rounded up.
		{"1994s", "1990s", 1990, 1999, true},
		// THE PADDED FORM, which is what the timeline links with. Four digits are
		// never a shorthand, so a column for the 50s CE reaches the 50s CE — the
		// 1950s is what "50s" would have given it.
		{"0050s", "50s", 50, 59, true},
		{"0800s", "800s", 800, 809, true},
		{"380s", "380s", 380, 389, true},
		// BCE, which the timeline draws for anything old enough. The decade is
		// spoken by its higher absolute year: the 380s BCE ran 389 to 380.
		{"380s BCE", "380s BCE", -389, -380, true},
		{"380s bce", "380s BCE", -389, -380, true},
		{"380sBCE", "380s BCE", -389, -380, true},
		{"380s bc", "380s BCE", -389, -380, true},
		// The era suppresses the shorthand: "80s BCE" is the 80s BCE, and could
		// not be the 1980s without meaning two things at once.
		{"80s BCE", "80s BCE", -89, -80, true},
		{"0s BCE", "", 0, 0, false},
		// Not a decade at all. "1984" especially: it is a book people own, and
		// reading a bare year as a span would take that search away.
		{"1984", "", 0, 0, false},
		{"", "", 0, 0, false},
		{"s", "", 0, 0, false},
		{"90ss", "", 0, 0, false},
		{"the 90s", "", 0, 0, false},
		{"12345s", "", 0, 0, false},
		{"nineties", "", 0, 0, false},
	}
	for _, c := range cases {
		label, from, to, ok := parseDecade(c.q)
		if ok != c.ok {
			t.Errorf("parseDecade(%q) ok = %v, want %v", c.q, ok, c.ok)
			continue
		}
		if !ok {
			continue
		}
		if label != c.label || from != c.from || to != c.to {
			t.Errorf("parseDecade(%q) = %q [%d,%d], want %q [%d,%d]",
				c.q, label, from, to, c.label, c.from, c.to)
		}
	}
}

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
		"0040":  "It is not that we have a short time to live, but that we waste a lot of it.",
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
