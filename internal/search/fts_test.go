package search

import (
	"strings"
	"testing"
)

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
	columnCases := []struct{ cols, in, want string }{
		{"author", "shaw red", `{author} : ("shaw"* "red"*)`},
		{"title series", "dune", `{title series} : ("dune"*)`},
		// FTS operators/quotes stay neutralized inside the filtered expression.
		{"quote", `x" OR "y`, `{quote} : ("x"""* "OR"* """y"*)`},
	}
	for _, c := range columnCases {
		if got := ColumnPrefixQuery(c.cols, c.in); got != c.want {
			t.Errorf("ColumnPrefixQuery(%q, %q) = %s, want %s", c.cols, c.in, got, c.want)
		}
	}
}

// Exact phrases (roadmap §3).
//
// For a library MADE of phrases there was no way to ask for one: every token
// became an independent prefix term, so `to be or not to be` matched any quote
// containing all six words in any order. That is right for browsing and leaves
// a precise question nowhere to go.
func TestPhraseQueryKeepsAQuotedRunWhole(t *testing.T) {
	for _, tc := range []struct{ in, want string }{
		// The whole query is one phrase: no prefix term is added, because
		// `"to be"*` asks for a phrase ending in a word beginning "be" — a
		// different question from the one that was typed.
		{`"to be or not to be"`, `"to be or not to be"`},
		// A phrase and a loose word: the loose one keeps the typeahead star.
		{`"to be" hamlet`, `"to be" "hamlet"*`},
		{`hamlet "to be"`, `"to be" "hamlet"*`},
		// Two phrases.
		{`"to be" "not to be"`, `"to be" "not to be"`},
		// No quotes at all is exactly PrefixQuery — every existing caller and
		// test depends on that being unchanged.
		{`shaw red`, `"shaw"* "red"*`},
		// An empty phrase is not a phrase.
		{`"" hamlet`, `"hamlet"*`},
	} {
		if got := PhraseQuery(tc.in); got != tc.want {
			t.Errorf("PhraseQuery(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

// AN UNBALANCED QUOTE IS NOT AN ERROR. Somebody typing a quotation mark
// mid-search should get results rather than a red box, so an unclosed quote is
// an ordinary character and the words search loosely.
func TestPhraseQueryForgivesAnUnclosedQuote(t *testing.T) {
	got := PhraseQuery(`he said "to be`)
	// Every word searchable, nothing swallowed, and no stray quote reaching MATCH
	// where it would be parsed as query syntax.
	for _, w := range []string{"he", "said", "be"} {
		if !strings.Contains(got, `"`+w+`"*`) {
			t.Fatalf("PhraseQuery(unbalanced) = %q, lost %q", got, w)
		}
	}
}

// NOTHING REACHES MATCH UNESCAPED, which is the invariant the whole package
// exists for: FTS5 parses its input as query syntax even when parameter-bound,
// so a stray quote is not a bad search, it is a syntax error or a different
// query. Whatever a reader types, the output has balanced quotes.
func TestPhraseQueryNeverEmitsAStrayQuote(t *testing.T) {
	for _, in := range []string{
		`he said "to be`, `""`, `"`, `a " b " c " d`, `"" ""`, `"a"b"`,
	} {
		got := PhraseQuery(in)
		if strings.Count(got, `"`)%2 != 0 {
			t.Errorf("PhraseQuery(%q) = %q — unbalanced quotes reach MATCH as syntax", in, got)
		}
	}
}

func TestColumnPhraseQueryScopesThePhrase(t *testing.T) {
	if got := ColumnPhraseQuery("quote", `"to be"`); got != `{quote} : ("to be")` {
		t.Errorf("ColumnPhraseQuery = %q", got)
	}
}
