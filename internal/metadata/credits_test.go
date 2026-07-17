package metadata

import (
	"reflect"
	"testing"
)

// This table is the source of truth for credit splitting — the JS mirror in
// web/frontend/src/people.jsx must behave identically.
func TestSplitCredits(t *testing.T) {
	def := DefaultCreditSeps
	cases := []struct {
		in   string
		seps CreditSeps
		want []string
	}{
		// The roadmap separators.
		{"Gaiman & Pratchett", def, []string{"Gaiman", "Pratchett"}},
		{"Neil Gaiman and Terry Pratchett", def, []string{"Neil Gaiman", "Terry Pratchett"}},
		{"Smith, Jones and Lee", def, []string{"Smith", "Jones", "Lee"}},
		// Oxford comma: the ", and " compound separator must not leave a junk
		// "and Lee" component.
		{"Smith, Jones, and Lee", def, []string{"Smith", "Jones", "Lee"}},
		{"Neil Gaiman, and Terry Pratchett", def, []string{"Neil Gaiman", "Terry Pratchett"}},
		{"A; B", def, []string{"A", "B"}},
		{"A , B ;C& D", def, []string{"A", "B", "C", "D"}},
		// Guards: a single name containing "and" is never shattered.
		{"Daniels and Sons", def, []string{"Daniels and Sons"}},
		{"William and Mary", def, []string{"William and Mary"}},
		// ...but list context unlocks the "and" ("Smith, Jones and Lee" above).
		// Suffixes re-attach to the previous component.
		{"Martin Luther King, Jr.", def, []string{"Martin Luther King, Jr."}},
		{"Sammy Davis, Jr. and Frank Sinatra", def, []string{"Sammy Davis, Jr.", "Frank Sinatra"}},
		{"O'Reilly Media, Inc.", def, []string{"O'Reilly Media, Inc."}},
		// "et al" is dropped.
		{"John Smith et al.", def, []string{"John Smith et al."}}, // no separator → verbatim
		{"John Smith, et al.", def, []string{"John Smith"}},
		// Dedupe (first spelling wins) + whitespace hygiene.
		{"A, a", def, []string{"A"}},
		{"  Ursula K. Le Guin  ", def, []string{"Ursula K. Le Guin"}},
		{"", def, nil},
		{"   ", def, nil},
		// Separator configuration: comma off keeps "Last, First" whole...
		{"Tolkien, J.R.R.", CreditSeps{Amp: true, And: true}, []string{"Tolkien, J.R.R."}},
		// ...while & still splits.
		{"Gaiman & Pratchett", CreditSeps{Amp: true}, []string{"Gaiman", "Pratchett"}},
		// "and" disabled leaves full names joined by and alone.
		{"Neil Gaiman and Terry Pratchett", CreditSeps{Comma: true, Semicolon: true, Amp: true}, []string{"Neil Gaiman and Terry Pratchett"}},
		// Everything disabled = verbatim single component.
		{"Gaiman & Pratchett", CreditSeps{}, []string{"Gaiman & Pratchett"}},
		// Degenerate input is capped at 8 components.
		{"a1,b2,c3,d4,e5,f6,g7,h8,i9,j10", def, []string{"a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"}},
	}
	for _, c := range cases {
		if got := SplitCredits(c.in, c.seps); !reflect.DeepEqual(got, c.want) {
			t.Errorf("SplitCredits(%q, %+v) = %#v, want %#v", c.in, c.seps, got, c.want)
		}
	}
}

func TestReplaceCredit(t *testing.T) {
	def := DefaultCreditSeps
	cases := []struct {
		joined, from, to string
		seps             CreditSeps
		want             string
		ok               bool
	}{
		// Whole-string rename (the single-author case).
		{"Dostoevsky", "dostoevsky", "Dostoyevsky", def, "Dostoyevsky", true},
		// A component rename splices in place — separators and co-authors stay
		// byte-for-byte as stored.
		{"Neil Gaiman & Terry Pratchett", "Neil Gaiman", "N. Gaiman", def, "N. Gaiman & Terry Pratchett", true},
		{"Smith, Jones and Lee", "jones", "R. Jones", def, "Smith, R. Jones and Lee", true},
		// Renaming onto an existing co-author dedupes (recombining a bad split).
		{"Daniels, Sons", "Sons", "Daniels", def, "Daniels", true},
		{"Sons, Daniels", "Sons", "Daniels", def, "Daniels", true},
		// NOTHING beyond the rename target is lost: "et al." markers and
		// components past the display cap survive a rename verbatim.
		{"A Smith, B Jones, et al.", "A Smith", "X Smith", def, "X Smith, B Jones, et al.", true},
		{"John Smith, et al.", "John Smith", "J. Smith", def, "J. Smith, et al.", true},
		{
			"a1, b2, c3, d4, e5, f6, g7, h8, i9, j10", "a1", "Z", def,
			"Z, b2, c3, d4, e5, f6, g7, h8, i9, j10", true,
		},
		// Suffix-merged components rename as one unit.
		{"Sammy Davis, Jr. and Frank Sinatra", "Sammy Davis, Jr.", "S. Davis, Jr.", def, "S. Davis, Jr. and Frank Sinatra", true},
		// No match → untouched.
		{"Neil Gaiman & Terry Pratchett", "Gaiman", "X", def, "Neil Gaiman & Terry Pratchett", false},
		{"", "A", "B", def, "", false},
		// Separator config is honoured — and the result re-splits identically.
		{"A & B", "A", "C", CreditSeps{Amp: true}, "C & B", true},
		{"Neil Gaiman and Terry Pratchett", "Neil Gaiman", "N. Gaiman", CreditSeps{And: true}, "N. Gaiman and Terry Pratchett", true},
		// Splitting disabled → only whole-string renames apply.
		{"A & B", "A", "C", CreditSeps{}, "A & B", false},
	}
	for _, c := range cases {
		got, ok := ReplaceCredit(c.joined, c.from, c.to, c.seps)
		if got != c.want || ok != c.ok {
			t.Errorf("ReplaceCredit(%q, %q, %q, %+v) = (%q, %v), want (%q, %v)",
				c.joined, c.from, c.to, c.seps, got, ok, c.want, c.ok)
		}
	}
	// The splice must re-split identically under the same config (the invariant
	// the old rejoin approach broke for an and-only config).
	out, _ := ReplaceCredit("Neil Gaiman and Terry Pratchett", "Neil Gaiman", "N. Gaiman", CreditSeps{And: true})
	if got := SplitCredits(out, CreditSeps{And: true}); len(got) != 2 {
		t.Errorf("re-split invariant: SplitCredits(%q) = %#v", out, got)
	}
}
