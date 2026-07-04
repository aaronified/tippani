package metadata

import "testing"

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
