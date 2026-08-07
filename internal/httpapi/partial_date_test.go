package httpapi

import "testing"

// normalizePartialDate backs every partial date in the app: the shelf's read log
// (started/finished) and, from §24, a quote's occasion. Its own comment promises
// it rejects "the shapes the regexp lets through but a calendar would not, so a
// stored date is always a real one" — and it used to check only that the day was
// between 1 and 31, which accepted 30 February and 31 April.
func TestPartialDateAcceptsTheThreeShapes(t *testing.T) {
	for _, good := range []string{"1944", "1944-01", "1944-01-23", "2024-02-29", ""} {
		v := good
		if msg := normalizePartialDate("date", &v); msg != "" {
			t.Errorf("normalizePartialDate(%q) rejected it: %s", good, msg)
		}
	}
}

func TestPartialDateRejectsDatesThatDoNotExist(t *testing.T) {
	// The whole point of a partial date is that it can be vague. It cannot be
	// wrong: "1944" is honest, "1944-02-30" is a typo that would sort between
	// two real dates and never resolve to a day.
	for _, bad := range []string{
		"1944-02-30", // February has never had 30 days
		"1944-04-31", // nor April 31
		"2023-02-29", // 2023 is not a leap year
		"1900-02-29", // nor 1900 — divisible by 100, not by 400
	} {
		v := bad
		if msg := normalizePartialDate("date", &v); msg == "" {
			t.Errorf("normalizePartialDate(%q) accepted a date that does not exist", bad)
		}
	}
}

func TestPartialDateRejectsMalformedInput(t *testing.T) {
	for _, bad := range []string{"44", "not a date", "1944-13", "1944-00", "1944-01-32", "1944-01-00", "0999", "3001"} {
		v := bad
		if msg := normalizePartialDate("date", &v); msg == "" {
			t.Errorf("normalizePartialDate(%q) accepted it", bad)
		}
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
