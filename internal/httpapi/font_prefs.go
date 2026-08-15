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
