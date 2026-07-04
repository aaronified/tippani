package metadata

import "strings"

// NormalizeISBN strips hyphens/spaces and converts ISBN-10 to ISBN-13
// (978 prefix + recomputed check digit). Everything is stored/deduped as
// ISBN-13 so cross-source matches align (PLAN §3). Returns "" if input is
// not a plausible ISBN-10/13 — wrong length, junk characters, or bad
// check digit.
func NormalizeISBN(s string) string {
	s = strings.ToUpper(strings.Map(func(r rune) rune {
		if r == '-' || r == ' ' {
			return -1
		}
		return r
	}, s))
	switch len(s) {
	case 10:
		if !validISBN10(s) {
			return ""
		}
		core := "978" + s[:9]
		return core + isbn13Check(core)
	case 13:
		if !allDigits(s) || isbn13Check(s[:12]) != s[12:] {
			return ""
		}
		return s
	}
	return ""
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
