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
	if got := PrefixQuery("fo"); got != `"fo"*` {
		t.Errorf("PrefixQuery = %s", got)
	}
}
