package httpapi

// The type preferences.
//
// Six roles, each with a face and a set of style modifiers, stored as twelve
// flat string fields. FLAT AND REPETITIVE ON PURPOSE: prefs is compared with
// `!=` in ui_test.go, which only compiles while every field is comparable, so a
// map or a slice would not build. CatName1..6 is the same shape for the same
// reason.
//
// THE SERVER KNOWS THE TOKENS AND NOT THE FONTS. It validates that a value is a
// short, plausible token and nothing else — which face `literata` names, what it
// looks like, and whether it can set Bengali are all questions for the browser
// that has to draw it. A server-side allowlist of family names would be a second
// copy of fonts.js that goes stale the first time a face is added, and the
// failure would be a preference the client offers and the server refuses.
//
// The client falls back to the built-in for any token it does not recognise, so
// the worst an unknown value can do is render as the default.

import (
	"sort"
	"strings"
)

const (
	// A face token is a slug: "source-serif-4", "upload:12". Long enough for the
	// longest bundled name and for an upload reference, short enough that the
	// field cannot become storage.
	fontTokenMaxLen = 48
	// The style list is a handful of short words. Five modifiers, comma joined,
	// is well under this.
	fontStyleMaxLen = 96
)

// fontStyleTokens is the set of modifiers the client offers, mirrored here so a
// typo cannot be stored. It is a SET AND NOT AN ORDER — the canonical order is
// the client's, and normalizeFontStyles sorts to a stable one so the same
// selection always serialises the same way.
//
// "monospace" is deliberately absent, and its absence is a decision rather than
// an omission: no CSS makes a proportional face monospaced, so a modifier by
// that name could only lie. "figures" is what shipped instead — tabular figures,
// which is the real thing behind the request.
var fontStyleTokens = map[string]bool{
	"bold": true, "italic": true, "smallcaps": true, "allcaps": true, "figures": true,
}

// normalizeFontToken accepts a face token: lower-case slug characters, or an
// "upload:N" reference. Returns ok=false for anything a client should be told
// about rather than have silently dropped.
func normalizeFontToken(raw string) (string, bool) {
	s := strings.ToLower(strings.TrimSpace(raw))
	if s == "" {
		return "", true // unset: the client's built-in
	}
	if len(s) > fontTokenMaxLen {
		return "", false
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-', r == ':':
		default:
			return "", false
		}
	}
	return s, true
}

// normalizeFontStyles cleans a comma-separated modifier list. Unknown tokens are
// REFUSED rather than dropped: unlike a face token, which the client can fall
// back on, a silently discarded modifier is a switch that flips itself off with
// no message.
func normalizeFontStyles(raw string) (string, bool) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "", true
	}
	if len(s) > fontStyleMaxLen {
		return "", false
	}
	seen := map[string]bool{}
	for _, tok := range strings.Split(s, ",") {
		t := strings.ToLower(strings.TrimSpace(tok))
		if t == "" {
			continue
		}
		if !fontStyleTokens[t] {
			return "", false
		}
		seen[t] = true
	}
	out := make([]string, 0, len(seen))
	for t := range seen {
		out = append(out, t)
	}
	// Sorted so one selection has one spelling. Without this "bold,italic" and
	// "italic,bold" are the same setting stored two ways, and every save that
	// round-trips them looks like a change.
	sort.Strings(out)
	return strings.Join(out, ","), true
}

// sizeFactors are the positions the text-size dials offer, as percentages of the
// designed size. The same list as TYPE_FACTORS in type.js, and it has to be: the
// client renders the arithmetic and the server refuses anything it cannot.
//
// 0 IS ACCEPTED AND IS NOT A POSITION. It means "not chosen" and renders at 100 —
// the zero value of the struct, so a reader who has never touched a dial stores
// nothing, and an upgrade that changed the designed sizes still reaches them.
//
// 200 WENT IN 3.1.0 — see TYPE_FACTORS for why (the rail could not honour it) —
// and a stored 200 is moved to 175 by the one-time pass rather than being
// refused here, because refusing it would leave a reader's saved preference
// unwritable without them knowing which field the server was rejecting.
var sizeFactors = []int{0, 75, 100, 125, 150, 175}

func validSizeFactor(n int) bool { return intIn(sizeFactors, n) }

// The quote's own two reading-comfort dials (§6 access), and CLOSED SETS for the
// reason sizeFactors is one: the value is arithmetic the client and the server
// both have to agree about, and a leading of 1.37 is not a position the dial has.
//
// LEADING IS IN HUNDREDTHS because a line-height is a ratio and this struct is
// flat integers — 155 is 1.55, which is the value the stylesheet has drawn since
// before the dial existed. MEASURE IS IN `ch`, characters of the quote's OWN
// face, because that is the unit the 45–75 rule is stated in and the repo forbids
// measuring a box that holds text in px.
//
// 0 IS "NOT CHOSEN" IN BOTH. For leading it renders at 155; for measure it is
// also the only spelling of "as wide as the box", which is what every screen has
// always done — so the zero value of prefs is still exactly what the app drew
// before these existed. QUOTE_LEADINGS and QUOTE_MEASURES in type.js are the
// client's copy, and quote-dials.test.js walks the two against each other.
var quoteLeadings = []int{0, 130, 145, 155, 170, 190}

var quoteMeasures = []int{0, 45, 55, 66, 80}

func validQuoteLeading(n int) bool { return intIn(quoteLeadings, n) }

func validQuoteMeasure(n int) bool { return intIn(quoteMeasures, n) }

// intIn is the membership test the three closed sets above share. Three copies of
// a four-line loop is how one of them quietly stops matching the others, which is
// the repo's own directive about controls read as a rule about code.
func intIn(list []int, n int) bool {
	for _, ok := range list {
		if n == ok {
			return true
		}
	}
	return false
}

// sizeFactorPtrs is the four dials in the same role order as fontFacePtrs, so the
// two walks read alike.
func sizeFactorPtrs(p *prefs) []*int {
	return []*int{&p.SizeDisplay, &p.SizeUI, &p.SizeMono, &p.SizeHand}
}

// fontPrefPtrs is the twelve fields in role order, so the merge and the
// validation walk one list instead of naming each field twice. The order matches
// FONT_ROLES in fonts.js; nothing depends on it beyond readability, because each
// pointer is paired with its own input.
func fontFacePtrs(p *prefs) []*string {
	return []*string{&p.FontDisplay, &p.FontUI, &p.FontMono, &p.FontHand, &p.FontBengali, &p.FontDevanagari}
}

func fontStylePtrs(p *prefs) []*string {
	return []*string{
		&p.FontDisplayStyle, &p.FontUIStyle, &p.FontMonoStyle,
		&p.FontHandStyle, &p.FontBengaliStyle, &p.FontDevanagariStyle,
	}
}

// normalizeFonts cleans what is already stored. A bad value in the database
// reads as unset — the built-in — rather than failing a login; the PUT is where
// a client's mistake is refused.
func normalizeFonts(p *prefs) {
	for _, f := range fontFacePtrs(p) {
		if v, ok := normalizeFontToken(*f); ok {
			*f = v
		} else {
			*f = ""
		}
	}
	for _, f := range fontStylePtrs(p) {
		if v, ok := normalizeFontStyles(*f); ok {
			*f = v
		} else {
			*f = ""
		}
	}
}
