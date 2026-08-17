package httpapi

import "testing"

// normalizePartialDate backs every partial date in the app: the shelf's read log
// (started/finished) and, from §24, a quote's occasion. Its own comment promises
// it rejects "the shapes the regexp lets through but a calendar would not, so a
// stored date is always a real one" — and it used to check only that the day was
// between 1 and 31, which accepted 30 February and 31 April.
func TestNormalizePartialDate(t *testing.T) {
	cases := []struct {
		name  string
		in    string
		valid bool
	}{
		// The three shapes it accepts, plus the leap day and the empty value.
		{"a bare year", "1944", true},
		{"a year and a month", "1944-01", true},
		{"a full date", "1944-01-23", true},
		{"the 2024 leap day", "2024-02-29", true},
		{"an empty value", "", true},

		// The whole point of a partial date is that it can be vague. It cannot be
		// wrong: "1944" is honest, "1944-02-30" is a typo that would sort between
		// two real dates and never resolve to a day.
		{"a date that does not exist: 30 February", "1944-02-30", false},         // February has never had 30 days
		{"a date that does not exist: 31 April", "1944-04-31", false},            // nor April 31
		{"a date that does not exist: 29 February in 2023", "2023-02-29", false}, // 2023 is not a leap year
		{"a date that does not exist: 29 February in 1900", "1900-02-29", false}, // nor 1900 — divisible by 100, not by 400

		// Malformed input: the shapes that are not dates at all.
		{"malformed: a two-digit year", "44", false},
		{"malformed: prose", "not a date", false},
		{"malformed: month 13", "1944-13", false},
		{"malformed: month 00", "1944-00", false},
		{"malformed: day 32", "1944-01-32", false},
		{"malformed: day 00", "1944-01-00", false},
		{"malformed: a year below the accepted range", "0999", false},
		{"malformed: a year above the accepted range", "3001", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			v := tc.in
			msg := normalizePartialDate("date", &v)
			if tc.valid && msg != "" {
				t.Errorf("normalizePartialDate(%q) rejected it: %s", tc.in, msg)
			}
			if !tc.valid && msg == "" {
				t.Errorf("normalizePartialDate(%q) accepted it", tc.in)
			}
		})
	}
}

// The message names the field, because the same validator serves several and
// "must be YYYY..." alone would not say which one to fix.
func TestPartialDateNamesTheField(t *testing.T) {
	v := "nonsense"
	msg := normalizePartialDate("occasion date", &v)
	if msg == "" || msg[:len("occasion date")] != "occasion date" {
		t.Fatalf("message does not lead with the field name: %q", msg)
	}
}

func TestPartialDateTrims(t *testing.T) {
	v := "  1944-01-23  "
	if msg := normalizePartialDate("date", &v); msg != "" {
		t.Fatalf("rejected a padded date: %s", msg)
	}
	if v != "1944-01-23" {
		t.Fatalf("did not trim in place: %q", v)
	}
}
