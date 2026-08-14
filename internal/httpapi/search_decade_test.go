package httpapi

import "testing"

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
