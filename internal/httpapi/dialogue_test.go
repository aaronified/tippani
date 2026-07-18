package httpapi

import "testing"

// autofillActor maps the character(s) a line credits to who plays them in the
// movie's stored cast. A line can name several characters (comma-joined
// tokens), so the resolver splits, matches each case-insensitively, and joins
// the unique actors in order — only when no actor was supplied.
func TestAutofillActor(t *testing.T) {
	cast := `[{"character":"Mark Wallace","actor":"Albert Finney"},
	          {"character":"Joanna Wallace","actor":"Audrey Hepburn"},
	          {"character":"Narrator","actor":""}]`

	cases := []struct {
		name      string
		character string
		actor     string
		want      string
	}{
		{"single character", "Mark Wallace", "", "Albert Finney"},
		{"case-insensitive", "mark wallace", "", "Albert Finney"},
		{"multiple characters", "Mark Wallace, Joanna Wallace", "", "Albert Finney, Audrey Hepburn"},
		{"order preserved", "Joanna Wallace, Mark Wallace", "", "Audrey Hepburn, Albert Finney"},
		{"dupe actors collapse", "Mark Wallace, Mark Wallace", "", "Albert Finney"},
		{"unmatched character drops", "Mark Wallace, Nobody", "", "Albert Finney"},
		{"cast member without actor", "Narrator", "", ""},
		{"no match at all", "Nobody", "", ""},
		{"explicit actor is preserved", "Mark Wallace", "Someone Else", "Someone Else"},
		{"empty character", "", "", ""},
		{"whitespace character", "  ", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := autofillActor(cast, tc.character, tc.actor); got != tc.want {
				t.Errorf("autofillActor(%q, %q) = %q, want %q", tc.character, tc.actor, got, tc.want)
			}
		})
	}

	// Malformed cast JSON falls back to the supplied actor (empty here).
	if got := autofillActor("not json", "Mark Wallace", ""); got != "" {
		t.Errorf("bad cast JSON = %q, want empty", got)
	}
}
