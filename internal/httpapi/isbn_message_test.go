package httpapi

// The ISBN box, from outside.
//
// Two complaints, one field. "It does not say why it fails when I try to save a
// 14-digit or alphanumeric id" — the handler answered `invalid isbn` to four
// different mistakes with four different fixes. "It should also handle 10-digit
// ISBN codes" — it always did, silently converting them to the 13-digit form the
// whole app stores, but the field's own help said "the 13-digit book identifier",
// so the one shape a reader is most likely to have (a pre-2007 book) read as
// unsupported.
//
// These go through the API because that is where the message is decided, and they
// assert the SHAPE of the answer rather than its wording: a fragment that could
// only come from the right branch.

import (
	"net/http"
	"strings"
	"testing"
)

func saveISBN(t *testing.T, c *testClient, isbn string, want int) string {
	t.Helper()
	rec := c.mustDo("POST", "/books", map[string]any{"title": "Fooled by Randomness", "isbn": isbn}, want)
	return rec.Body.String()
}

func TestABadISBNSaysWhichMistakeItWas(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	for _, tc := range []struct{ isbn, want, why string }{
		{"97803064061577", "14", "the count is the whole answer for the commonest mistake"},
		{"B00X4WHP55", "letters", "an ASIN in the ISBN box is a different mistake from a mistyped digit"},
		{"9780306406158", "check out", "a real ISBN one keystroke wrong deserves to be told so"},
	} {
		body := saveISBN(t, c, tc.isbn, http.StatusBadRequest)
		if !strings.Contains(body, tc.want) {
			t.Errorf("saving %q answered %s\n  want it to mention %q — %s", tc.isbn, strings.TrimSpace(body), tc.want, tc.why)
		}
		// The old answer, which is now a bug rather than a message.
		if strings.Contains(body, "invalid isbn") {
			t.Errorf("saving %q still answers with the catch-all: %s", tc.isbn, strings.TrimSpace(body))
		}
	}
}

// TestATenDigitISBNIsAcceptedAndStoredAsThirteen — the second half of the report.
func TestATenDigitISBNIsAcceptedAndStoredAsThirteen(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// Hyphenated, because that is how it is printed on the book somebody is holding.
	got := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Fooled by Randomness", "isbn": "0-306-40615-2"}, http.StatusCreated))
	if got.ISBN != "9780306406157" {
		t.Fatalf("a ten-digit ISBN stored as %q, want its thirteen-digit form", got.ISBN)
	}

	// And the X check digit, which is the one character in an ISBN that is not a
	// digit and the one most likely to be refused by a naive rule.
	x := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Sway", "isbn": "097522980X"}, http.StatusCreated))
	if x.ISBN != "9780975229804" {
		t.Fatalf("an X check digit stored as %q", x.ISBN)
	}
}

// A look-up is the other place an ISBN is typed by hand — off the back of a book,
// which is when a digit is most likely to go astray. It answered with the same
// catch-all, and now gives the same reason the save form does.
func TestALookupByBadISBNSaysWhy(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	body := c.mustDo("POST", "/books/lookup", map[string]any{"isbn": "97803064061577"},
		http.StatusBadRequest).Body.String()
	if !strings.Contains(body, "14") || strings.Contains(body, "invalid isbn") {
		t.Errorf("looking up a 14-digit ISBN answered %s", strings.TrimSpace(body))
	}
}

// And the field is still optional, which every caller assumes. A blank ISBN is not
// a mistake to explain — it is the normal state of most rows in the table.
func TestNoISBNIsNotAProblem(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	for _, blank := range []string{"", "   "} {
		got := decode[bookDetail](t, c.mustDo("POST", "/books",
			map[string]any{"title": "Untitled " + blank + "x", "isbn": blank}, http.StatusCreated))
		if got.ISBN != "" {
			t.Errorf("a blank ISBN (%q) stored as %q", blank, got.ISBN)
		}
	}
}
