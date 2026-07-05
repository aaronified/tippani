package search

import "testing"

func TestQuery(t *testing.T) {
	cases := []struct{ in, want string }{
		{"foo bar", `"foo" "bar"`},
		{`he said "hi"`, `"he" "said" """hi"""`},
		{"NEAR(a b)", `"NEAR(a" "b)"`},         // operators neutralized
		{`title:x OR y`, `"title:x" "OR" "y"`}, // column filters neutralized
		{"  spaced   out  ", `"spaced" "out"`},
		{"", `""`},
		{"-excl ^caret star*", `"-excl" "^caret" "star*"`},
	}
	for _, c := range cases {
		if got := Query(c.in); got != c.want {
			t.Errorf("Query(%q) = %s, want %s", c.in, got, c.want)
		}
	}
	prefixCases := []struct{ in, want string }{
		{"fo", `"fo"*`},
		{"shaw red", `"shaw"* "red"*`}, // every token is a prefix -> matches "Shawshank Redemption"
		{"  spaced   out  ", `"spaced"* "out"*`},
		{"", `""`},
		{`a"b`, `"a""b"*`},
	}
	for _, c := range prefixCases {
		if got := PrefixQuery(c.in); got != c.want {
			t.Errorf("PrefixQuery(%q) = %s, want %s", c.in, got, c.want)
		}
	}
}
