package metadata

import (
	"strings"
	"testing"
)

func TestNormalizeISBN(t *testing.T) {
	cases := []struct{ in, want string }{
		{"0306406152", "9780306406157"},    // ISBN-10 -> 13
		{"0-306-40615-2", "9780306406157"}, // hyphens stripped
		{"0 306 40615 2", "9780306406157"}, // spaces stripped
		{"097522980X", "9780975229804"},    // X check digit
		{"097522980x", "9780975229804"},    // lowercase x
		{"9780306406157", "9780306406157"}, // ISBN-13 passthrough
		{"978-0-306-40615-7", "9780306406157"},
		{"9791090636071", "9791090636071"}, // 979 prefix
		{"", ""},
		{"12345", ""},         // bad length
		{"0306406153", ""},    // bad ISBN-10 check digit
		{"9780306406158", ""}, // bad ISBN-13 check digit
		{"030640615a", ""},    // junk char
		{"978030640615X", ""}, // X invalid in ISBN-13
		{"03064061520", ""},   // 11 chars
		{"X306406152", ""},    // X only valid in last position
	}
	for _, c := range cases {
		if got := NormalizeISBN(c.in); got != c.want {
			t.Errorf("NormalizeISBN(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// TestISBNProblemNamesTheMistake — every refusal has to say which of four things
// went wrong, because each one has a different fix: count the digits, take out the
// letters, check the number you copied, or realise you pasted an ASIN.
//
// The cases assert a DISTINGUISHING FRAGMENT rather than the whole sentence. A test
// holding the copy verbatim is a test that fails on a comma, and then gets updated
// without being read.
func TestISBNProblemNamesTheMistake(t *testing.T) {
	cases := []struct{ in, want string }{
		// Nothing wrong: the four shapes that already worked, plus empty.
		{"", ""},
		{"0306406152", ""},        // ISBN-10
		{"097522980x", ""},        // lowercase X check digit
		{"9780306406157", ""},     // ISBN-13
		{"978-0-306-40615-7", ""}, // hyphens
		{"9791090636071", ""},     // 979 prefix
		// The length case — the reader's own report, and the one "invalid isbn" hid
		// completely. The message counts what is left after separators come out.
		{"97803064061577", "and this has 14"},
		{"12345", "and this has 5"},
		{"978-0-306-40615-77", "and this has 14"},
		// Letters, split from the check digit because an ASIN in the ISBN box is the
		// usual cause and counting digits is not the fix for it.
		{"B00X4WHP55", "letters"},
		{"978030640615X", "no letters"},
		// A mistyped digit, which is a real ISBN one keystroke away from correct.
		{"0306406153", "does not check out"},
		{"9780306406158", "does not check out"},
	}
	for _, c := range cases {
		got := ISBNProblem(c.in)
		if c.want == "" {
			if got != "" {
				t.Errorf("ISBNProblem(%q) = %q, want no complaint", c.in, got)
			}
			continue
		}
		if got == "" {
			t.Errorf("ISBNProblem(%q) said nothing; want a reason mentioning %q", c.in, c.want)
		} else if !strings.Contains(got, c.want) {
			t.Errorf("ISBNProblem(%q) = %q, want it to mention %q", c.in, got, c.want)
		}
	}
}

// The two functions share an implementation so they cannot disagree about what a
// valid ISBN is — this is the assertion that holds them together. A "" from one and
// a reason from the other, in either direction, is a form that either refuses
// silently or complains about a value it went on to accept.
func TestISBNProblemAndNormalizeAgree(t *testing.T) {
	for _, in := range []string{
		"", "0306406152", "097522980X", "9780306406157", "978-0-306-40615-7",
		"9791090636071", "12345", "0306406153", "9780306406158", "030640615a",
		"978030640615X", "03064061520", "X306406152", "B00X4WHP55", "97803064061577",
	} {
		norm, why := NormalizeISBN(in), ISBNProblem(in)
		if in == "" {
			continue // both empty, and neither means failure
		}
		if (norm == "") != (why != "") {
			t.Errorf("%q: NormalizeISBN = %q but ISBNProblem = %q — exactly one should be set", in, norm, why)
		}
	}
}

func TestISBN13to10(t *testing.T) {
	cases := map[string]string{
		"9780441172719": "0441172717", // Dune (Ace) — recomputed check digit
		"9780306406157": "0306406152", // Fooled by Randomness
		"9791090636071": "",           // 979 prefix has no ISBN-10 form
		"978044117271":  "",           // too short
		"":              "",           // empty
	}
	for in, want := range cases {
		if got := ISBN13to10(in); got != want {
			t.Errorf("ISBN13to10(%q) = %q, want %q", in, got, want)
		}
	}
}
