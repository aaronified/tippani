package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)

// A DATE IN HISTORY, which this validator refused.
//
// The owner's report: "i am unable to add 399BCE as a date now. this is weird. i
// cannot even add just 399. this was fine before. i have Seneca's quotes from c.
// 40."
//
// Both halves of the app said no. normalizePartialDate demanded four digits and a
// year between 1000 and 3000, so a quote's occasion could not be older than the
// millennium — while timelineYears, twenty files away, already read the same
// column as `substr(occasion_date, 1, 5)` and its comment explained that "a BCE
// year carries a leading '-'". The column's format was never the problem; the
// thing guarding it had simply never allowed the format.
//
// WHAT A TEST WRITER NEEDS TO KNOW: a partial date is stored as TEXT in one of
// three shapes, and it is compared as text and grouped as text, so a year must
// occupy a fixed width. The 1000-3000 window is deliberate for a date about the
// READING — a book finished in the year 40 is a typo — and lifts only for the two
// facts about the world: when a line was said, and when a person lived.

func TestNormalizeHistoricalDate(t *testing.T) {
	cases := []struct {
		name string
		in   string
		out  string // "" means it must be rejected
	}{
		// The report's own dates. Each is stored padded, because the column is
		// sorted as text and a 3-digit year would file itself among the 3000s.
		{"the year the Apology was spoken", "399", "0399"},
		{"the same year before the era", "-399", "-0399"},
		{"Seneca's", "40", "0040"},
		{"and before the era", "-40", "-0040"},
		{"a year already stored padded", "0399", "0399"},
		{"a BCE year already stored padded", "-0399", "-0399"},
		{"a year, month and day before the era", "-0399-03-04", "-0399-03-04"},
		{"a single digit", "4", "0004"},
		{"an empty value", "", ""},

		// It is allowed to be vague and not allowed to be wrong: the guarantee is
		// that a stored date is a real one, on either side of the era.
		{"no year zero, on either side of the era", "0", ""},
		{"nor four zeroes", "0000", ""},
		{"past the far end", "3001", ""},
		{"30 February, BCE included", "-0399-02-30", ""},
		{"31 April", "0399-04-31", ""},
		{"a thirteenth month", "0399-13", ""},
		{"five digits is not a year here", "12345", ""},
		{"prose", "not a date", ""},
		{"an era word is not on the wire", "399 BCE", ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			v := tc.in
			msg := normalizeHistoricalDate("occasion date", &v)
			if tc.out == "" && tc.in != "" {
				if msg == "" {
					t.Fatalf("normalizeHistoricalDate(%q) accepted it, and stored %q", tc.in, v)
				}
				return
			}
			if msg != "" {
				t.Fatalf("normalizeHistoricalDate(%q) rejected it: %s", tc.in, msg)
			}
			if v != tc.out {
				t.Errorf("normalizeHistoricalDate(%q) stored %q, want %q", tc.in, v, tc.out)
			}
		})
	}
}

// The window is the whole difference between the two, so it is asserted as a
// DIFFERENCE: the same string, taken by one and refused by the other. Two
// functions with a shared body are exactly the shape that drifts into one
// behaviour by accident, and this is what would catch that.
func TestTheWindowStillHoldsForADateAboutTheReading(t *testing.T) {
	for _, in := range []string{"399", "0399", "-0399", "40", "-0004"} {
		hist, plain := in, in
		if msg := normalizeHistoricalDate("occasion date", &hist); msg != "" {
			t.Errorf("a historical date rejected %q: %s", in, msg)
		}
		if msg := normalizePartialDate("finished_at", &plain); msg == "" {
			t.Errorf("a read log accepted %q, and stored %q — the year 40 is a typo there", in, plain)
		}
	}
	// And the shapes a read log has always taken are untouched by the split.
	for _, in := range []string{"1944", "1944-01", "1944-01-23", "2024-02-29", ""} {
		v := in
		if msg := normalizePartialDate("finished_at", &v); msg != "" {
			t.Errorf("a read log rejected %q, which it has always taken: %s", in, msg)
		}
		if v != in {
			t.Errorf("a read log rewrote %q to %q", in, v)
		}
	}
}

// The message has to say what to type, because it is the only thing the reader
// gets back from a rejected save.
func TestTheHistoricalMessageNamesTheEra(t *testing.T) {
	v := "nonsense"
	msg := normalizeHistoricalDate("occasion date", &v)
	if !strings.Contains(msg, "occasion date") {
		t.Errorf("the message does not name the field: %q", msg)
	}
	if !strings.Contains(msg, "BCE") {
		t.Errorf("the message does not mention the era it now accepts: %q", msg)
	}
}

// END TO END, because a validator that agrees with itself proves nothing about
// the endpoint: the utterance handler is what the WHEN box posts to, and it was
// the 400 from here that the owner was reading.
func TestAQuoteCanBeSaidBeforeTheEra(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())

	for _, tc := range []struct {
		when  string
		circa bool
		want  string
	}{
		{"399", false, "0399"},
		{"-0399", false, "-0399"},
		{"40", true, "0040"},
	} {
		got := newUtterance(t, c, map[string]any{
			"quote":          "The unexamined life is not worth living.",
			"occasion":       "his trial",
			"occasion_date":  tc.when,
			"occasion_circa": tc.circa,
		})
		if got.OccasionDate != tc.want {
			t.Errorf("occasion_date %q came back as %q, want %q", tc.when, got.OccasionDate, tc.want)
		}
		if got.OccasionCirca != tc.circa {
			t.Errorf("occasion_circa for %q came back %v, want %v", tc.when, got.OccasionCirca, tc.circa)
		}
	}

	// And a read log at the same year is still refused, from the ENDPOINT and not
	// just from the validator: the two windows have to differ in the app, not only
	// in a unit test that calls both functions by hand.
	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Meditations"}, http.StatusCreated))
	c.mustDo("POST", fmt.Sprintf("/books/%d/reads", b.ID),
		map[string]any{"finished_at": "0399"}, http.StatusBadRequest)
}
