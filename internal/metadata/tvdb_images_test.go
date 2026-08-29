package metadata

import "testing"

// THE ONE-LETTER CHARACTER, WHICH IS WHY THIS IS NOT A SUBSTRING COMPARE.
//
// Found by running the real thing rather than by reading it: asking V for
// Vendetta for a picture of "V" answered with V's mask AND Evey Hammond,
// because "evey hammond" contains the letter v. Every substring rule has this
// hole and short character names are a convention, not an edge case — V, M, Q,
// Neo — so the fix is to compare whole words and the test is the name that
// broke it.
func TestRoleMatchingIsWordWiseSoAOneLetterRoleDoesNotMatchEverything(t *testing.T) {
	words := func(s string) []string { return splitRoleWords(s) }
	for _, tc := range []struct {
		a, b string
		want bool
		why  string
	}{
		{"V", "Evey Hammond", false, "a one-letter role must not match a name that merely contains the letter"},
		{"V", "V", true, "the same role"},
		{"Smith", "Agent Smith", true, "a surname is a whole word of the full role name"},
		{"Agent Smith", "Smith", true, "and the compare is symmetric"},
		{"Amanda Waller", "Harley Quinn", false, "two unrelated roles"},
		{"amanda  WALLER", "Amanda Waller", true, "case and spacing are folded"},
		{"", "V", false, "an empty name matches nothing, not everything"},
		{"Neo", "Neo Anderson", true, "a short name that IS a word still matches"},
		{"Q", "Quentin", false, "a prefix is not a word"},
	} {
		if got := roleWordsMatch(words(tc.a), words(tc.b)); got != tc.want {
			t.Errorf("roleWordsMatch(%q, %q) = %t, want %t — %s", tc.a, tc.b, got, tc.want, tc.why)
		}
	}
}
