package metadata

import (
	"fmt"
	"strings"
)

// NormalizeISBN strips hyphens/spaces and converts ISBN-10 to ISBN-13
// (978 prefix + recomputed check digit). Everything is stored/deduped as
// ISBN-13 so cross-source matches align (PLAN §3). Returns "" if input is
// not a plausible ISBN-10/13 — wrong length, junk characters, or bad
// check digit.
//
// Callers that need to TELL somebody why it failed use ISBNProblem, which shares
// this implementation rather than re-deriving the rules. Two functions that decide
// what a valid ISBN is would eventually disagree, and the one that disagreed would
// be the one printing the reason.
func NormalizeISBN(s string) string {
	n, _ := checkISBN(s)
	return n
}

// ISBNProblem says what is wrong with an ISBN, in words meant for the person who
// typed it, and returns "" when there is nothing wrong.
//
// WHY THIS EXISTS. The only answer a reader used to get was "invalid isbn", which
// is true of a 14-digit number, a mistyped digit, a stray letter and an ASIN pasted
// into the wrong box — four different mistakes with four different fixes. The form
// refused, said nothing about which, and the field's own help said "the 13-digit
// book identifier", so a perfectly good ISBN-10 read as unsupported rather than as
// something the app converts for you.
//
// AN EMPTY STRING IS NOT A PROBLEM. Every caller treats a missing ISBN as fine —
// nothing in the app needs one — so "required" is a decision for the caller, not a
// property of the value.
func ISBNProblem(s string) string {
	_, why := checkISBN(s)
	return why
}

// checkISBN is the one implementation: it returns the normalised ISBN-13 and, when
// it cannot produce one, the reason in plain words. Exactly one of the two is ever
// non-empty for a non-empty input.
func checkISBN(s string) (norm, why string) {
	s = strings.ToUpper(strings.Map(func(r rune) rune {
		if r == '-' || r == ' ' {
			return -1
		}
		return r
	}, s))
	if s == "" {
		return "", ""
	}
	switch len(s) {
	case 10:
		if !allDigits(s[:9]) {
			// Named separately from the check-digit case because the fix is
			// different: this is usually an ASIN in the ISBN box (Amazon's start
			// with B0), and telling somebody their check digit is wrong when they
			// have pasted the wrong identifier sends them counting digits.
			return "", "an ISBN-10 is nine digits and then a digit or an X — this has letters in it"
		}
		if !validISBN10(s) {
			return "", "this is ten characters but its last one does not check out — one of the others is probably mistyped"
		}
		core := "978" + s[:9]
		return core + isbn13Check(core), ""
	case 13:
		if !allDigits(s) {
			return "", "an ISBN-13 is thirteen digits with no letters in it"
		}
		if isbn13Check(s[:12]) != s[12:] {
			return "", "this is thirteen digits but the last one does not check out — one of the others is probably mistyped"
		}
		return s, ""
	}
	// The commonest failure, and the one the old message hid completely. The count
	// is of what is left after hyphens and spaces come out, which is why it can
	// disagree with what somebody sees in the box.
	return "", fmt.Sprintf("an ISBN has ten or thirteen digits, and this has %d — hyphens and spaces are fine, anything else is not", len(s))
}

// ISBN13to10 converts a 978-prefixed ISBN-13 back to its ISBN-10 — the form
// Amazon's image CDN indexes print-book covers by (an ISBN-10 doubles as the
// print ASIN). Returns "" for 979-prefixed or malformed input. Input should be
// a normalized 13-digit ISBN (see NormalizeISBN).
func ISBN13to10(isbn13 string) string {
	if len(isbn13) != 13 || !allDigits(isbn13) || isbn13[:3] != "978" {
		return ""
	}
	core := isbn13[3:12] // the 9 significant digits
	sum := 0
	for i := 0; i < 9; i++ {
		sum += int(core[i]-'0') * (10 - i)
	}
	check := (11 - sum%11) % 11
	if check == 10 {
		return core + "X"
	}
	return core + string(rune('0'+check))
}

func allDigits(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// validISBN10 checks the mod-11 digit; the last position may be 'X' (=10).
func validISBN10(s string) bool {
	if !allDigits(s[:9]) {
		return false
	}
	sum := 0
	for i := 0; i < 9; i++ {
		sum += int(s[i]-'0') * (10 - i)
	}
	switch c := s[9]; {
	case c == 'X':
		sum += 10
	case c >= '0' && c <= '9':
		sum += int(c - '0')
	default:
		return false
	}
	return sum%11 == 0
}

// isbn13Check returns the EAN-13 check digit for a 12-digit prefix.
func isbn13Check(core string) string {
	sum := 0
	for i := 0; i < 12; i++ {
		d := int(core[i] - '0')
		if i%2 == 1 {
			d *= 3
		}
		sum += d
	}
	return string(rune('0' + (10-sum%10)%10))
}
