package metadata

import (
	"regexp"
	"strings"
	"unicode"
)

// Multi-author separation (ROADMAP §11): a credit is stored as one free-text
// string ("Gaiman & Pratchett"), so everywhere PEOPLE are derived from credits
// the string is split into individual names at read time — the stored
// books.author / dialogues.actor stays verbatim. Which separators are active
// is a per-user preference (creditSeparators); the JS mirror lives in
// web/frontend/src/people.jsx (splitCredits/parseCreditSeps) — keep the two in
// lockstep, with the table in credits_test.go as the source of truth.

// CreditSeps selects which separators split a joined credit. All four on is
// the default; libraries that store authors as "Last, First" turn Comma off
// (Settings → Multi-author credits).
type CreditSeps struct {
	Comma, Semicolon, Amp, And bool
}

// DefaultCreditSeps enables the full roadmap separator set: , · ; · & · and.
var DefaultCreditSeps = CreditSeps{Comma: true, Semicolon: true, Amp: true, And: true}

func (c CreditSeps) any() bool { return c.Comma || c.Semicolon || c.Amp || c.And }

// ParseCreditSeps reads the stored creditSeparators preference: a comma-
// separated token list from {comma, semicolon, amp, and}, or "none" for
// splitting disabled. Empty/unknown-only input falls back to the default set
// (older rows never stored the key).
func ParseCreditSeps(pref string) CreditSeps {
	pref = strings.TrimSpace(pref)
	if pref == "" {
		return DefaultCreditSeps
	}
	if strings.EqualFold(pref, "none") {
		return CreditSeps{}
	}
	var c CreditSeps
	seen := false
	for _, tok := range strings.Split(pref, ",") {
		switch strings.ToLower(strings.TrimSpace(tok)) {
		case "comma":
			c.Comma, seen = true, true
		case "semicolon":
			c.Semicolon, seen = true, true
		case "amp":
			c.Amp, seen = true, true
		case "and":
			c.And, seen = true, true
		}
	}
	if !seen {
		return DefaultCreditSeps
	}
	return c
}

// creditSuffixes are tokens that belong to the PREVIOUS component when a comma
// split isolates them ("Martin Luther King, Jr." must stay one person).
var creditSuffixes = map[string]bool{
	"jr": true, "jr.": true, "sr": true, "sr.": true,
	"ii": true, "iii": true, "iv": true, "v": true,
	"inc": true, "inc.": true, "ltd": true, "ltd.": true,
	"llc": true, "llc.": true, "co": true, "co.": true,
}

var (
	creditAndRe = regexp.MustCompile(`(?i)\s+and\s+`)
	// creditLeadingAndRe strips the Oxford-comma "and" off a token a hard
	// separator produced: "Smith, Jones, and Lee" comma-splits into a
	// leading-"and" token ("and Lee") that the infix regex above can't reach.
	creditLeadingAndRe = regexp.MustCompile(`(?i)^and\s+`)
)

const maxCreditComponents = 8 // degenerate-input guard

// SplitCredits splits a joined credit string ("Gaiman & Pratchett",
// "Smith, Jones and Lee") into individual person names using the enabled
// separators. A verbatim single name passes through as a one-element slice;
// empty input yields nil. Guards: " and " only splits in list context (the
// credit also carried , ; or &) or when both immediate sides look like full
// names (≥ 2 words) — so "Daniels and Sons" and "William and Mary" stay
// whole; suffix tokens (Jr./Sr./III/Inc.…) re-attach to the previous name;
// "et al" is dropped; components dedupe case-insensitively. Whitespace is
// normalized first (any Unicode whitespace run → one space) so the JS mirror,
// whose \s is Unicode-aware, can't disagree about a non-breaking space.
func SplitCredits(s string, seps CreditSeps) []string {
	t := strings.Join(strings.Fields(s), " ")
	if t == "" {
		return nil
	}
	if !seps.any() {
		return []string{t}
	}

	// listCtx: a hard separator was present, so trailing " and " reads as the
	// last comma of a list ("Smith, Jones and Lee").
	listCtx := false
	parts := []string{t}
	splitOn := func(list []string, sep string) []string {
		out := make([]string, 0, len(list))
		for _, p := range list {
			out = append(out, strings.Split(p, sep)...)
		}
		return out
	}
	if seps.Comma && strings.Contains(t, ",") {
		listCtx = true
		parts = splitOn(parts, ",")
	}
	if seps.Semicolon && strings.Contains(t, ";") {
		listCtx = true
		parts = splitOn(parts, ";")
	}
	if seps.Amp && strings.Contains(t, "&") {
		listCtx = true
		parts = splitOn(parts, "&")
	}
	if seps.And {
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			out = append(out, splitCreditAnd(p, listCtx)...)
		}
		parts = out
	}

	// Suffix merge + "et al" drop.
	merged := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		low := strings.ToLower(p)
		if low == "et al" || low == "et al." {
			continue
		}
		if creditSuffixes[low] && len(merged) > 0 {
			merged[len(merged)-1] += ", " + p
			continue
		}
		merged = append(merged, p)
	}

	// Case-insensitive dedupe, first spelling wins, capped.
	seen := make(map[string]bool, len(merged))
	out := make([]string, 0, len(merged))
	for _, p := range merged {
		k := strings.ToLower(p)
		if seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, p)
		if len(out) == maxCreditComponents {
			break
		}
	}
	if len(out) == 0 {
		return []string{t}
	}
	return out
}

// splitCreditAnd splits one token on the word "and". Outside list context both
// sides must be ≥ 2 words — a conservative guard so a single name that merely
// contains "and" is never shattered. In list context (the token came out of a
// comma/semicolon/& split) a LEADING "and" is the Oxford-comma joiner
// (", and Lee") and is stripped before splitting.
func splitCreditAnd(p string, listCtx bool) []string {
	p = strings.TrimSpace(p)
	if p == "" {
		return nil
	}
	if listCtx {
		p = strings.TrimSpace(creditLeadingAndRe.ReplaceAllString(p, ""))
		if p == "" {
			return nil
		}
	}
	parts := creditAndRe.Split(p, -1)
	if len(parts) < 2 {
		return []string{p}
	}
	if !listCtx {
		for _, q := range parts {
			if len(strings.Fields(strings.TrimSpace(q))) < 2 {
				return []string{p}
			}
		}
	}
	return parts
}

// creditSpan is one component's location inside the ORIGINAL credit string,
// so a rename can splice in place instead of re-serializing a lossy split.
type creditSpan struct {
	start, end int    // half-open byte range in the original string
	text       string // trimmed component text
	skip       bool   // "et al" markers etc. — never a rename target
}

// creditSpans mirrors SplitCredits' separator rules but keeps positions and
// drops NOTHING: no component cap, no "et al" removal, no dedupe — every byte
// of the original string stays accounted for, which is what makes ReplaceCredit
// below safe against silent data loss.
func creditSpans(s string, seps CreditSeps) []creditSpan {
	// Hard-separator cuts: byte ranges to remove between components.
	type cut struct{ start, end int }
	var cuts []cut
	if seps.any() {
		for i := 0; i < len(s); i++ {
			switch {
			case seps.Comma && s[i] == ',',
				seps.Semicolon && s[i] == ';',
				seps.Amp && s[i] == '&':
				cuts = append(cuts, cut{i, i + 1})
			}
		}
	}
	listCtx := len(cuts) > 0
	// " and " cuts, segment by segment so the SplitCredits guards apply the
	// same way: outside list context both sides must be ≥ 2 words.
	if seps.And {
		segStart := 0
		var andCuts []cut
		segments := append(append([]cut{}, cuts...), cut{len(s), len(s)})
		for _, c := range segments {
			seg := s[segStart:c.start]
			base := segStart
			if listCtx {
				// Oxford comma: a leading "and " after a hard cut is joiner text.
				if m := creditLeadingAndRe.FindStringIndex(strings.TrimLeft(seg, " ")); m != nil {
					lead := len(seg) - len(strings.TrimLeft(seg, " "))
					andCuts = append(andCuts, cut{base + lead + m[0], base + lead + m[1]})
				}
			}
			locs := creditAndRe.FindAllStringIndex(seg, -1)
			if locs != nil {
				ok := listCtx
				if !ok {
					parts := creditAndRe.Split(seg, -1)
					ok = len(parts) >= 2
					for _, q := range parts {
						if len(strings.Fields(q)) < 2 {
							ok = false
							break
						}
					}
				}
				if ok {
					for _, m := range locs {
						andCuts = append(andCuts, cut{base + m[0], base + m[1]})
					}
				}
			}
			segStart = c.end
		}
		cuts = append(cuts, andCuts...)
	}
	// Order cuts and slice the string into spans.
	for i := 1; i < len(cuts); i++ { // insertion sort — cut lists are tiny
		for j := i; j > 0 && cuts[j].start < cuts[j-1].start; j-- {
			cuts[j], cuts[j-1] = cuts[j-1], cuts[j]
		}
	}
	var spans []creditSpan
	pos := 0
	for _, c := range append(cuts, cut{len(s), len(s)}) {
		if c.start < pos {
			continue // overlapping cut (leading-"and" inside a segment already cut)
		}
		raw := s[pos:c.start]
		text := strings.TrimSpace(raw)
		if text != "" {
			// Tighten to the trimmed extents so the whitespace around a
			// component stays part of the separator gap (and survives a splice).
			lead := len(raw) - len(strings.TrimLeftFunc(raw, unicode.IsSpace))
			trail := len(raw) - len(strings.TrimRightFunc(raw, unicode.IsSpace))
			spans = append(spans, creditSpan{start: pos + lead, end: c.start - trail, text: text})
		}
		pos = c.end
	}
	// Suffix merge ("Martin Luther King, Jr.") + mark "et al" unmatchable.
	var merged []creditSpan
	for _, sp := range spans {
		low := strings.ToLower(sp.text)
		if creditSuffixes[low] && len(merged) > 0 {
			prev := &merged[len(merged)-1]
			prev.end = sp.end
			prev.text = strings.TrimSpace(s[prev.start:prev.end])
			continue
		}
		if low == "et al" || low == "et al." {
			sp.skip = true
		}
		merged = append(merged, sp)
	}
	return merged
}

// ReplaceCredit rewrites one component (case-insensitive whole-component
// match) inside a joined credit, or the whole credit when it matches whole.
// The replacement is spliced IN PLACE — separators, "et al." markers and
// every co-credit stay byte-for-byte as stored (no lossy re-serialization,
// no component cap). When the rename makes a component collide with an
// existing spelling of `to`, the later duplicate is dropped with its
// separator (renaming "Sons" to "Daniels" inside "Daniels, Sons" yields just
// "Daniels") — which is what lets the dedupe/merge tools recombine a bad
// split. Returns the rewritten credit and whether anything matched.
func ReplaceCredit(joined, from, to string, seps CreditSeps) (string, bool) {
	t := strings.TrimSpace(joined)
	from = strings.TrimSpace(from)
	to = strings.TrimSpace(to)
	if t == "" || from == "" {
		return joined, false
	}
	if strings.EqualFold(t, from) {
		return to, true
	}
	spans := creditSpans(t, seps)
	if len(spans) < 2 {
		return joined, false
	}
	matched := false
	for _, sp := range spans {
		if !sp.skip && strings.EqualFold(sp.text, from) {
			matched = true
			break
		}
	}
	if !matched {
		return joined, false
	}
	// Rebuild: separators come from the original string (the bytes between
	// spans); matched components become `to`; occurrences of `to` after its
	// first appearance (renamed or pre-existing) drop with their separator.
	var b strings.Builder
	pos := 0
	seenTo := false
	for _, sp := range spans {
		isFrom := !sp.skip && strings.EqualFold(sp.text, from)
		isTo := !sp.skip && strings.EqualFold(sp.text, to)
		if (isFrom || isTo) && seenTo {
			pos = sp.end // duplicate of `to` — drop the component and its joiner
			continue
		}
		b.WriteString(t[pos:sp.start]) // the separator/whitespace before it
		if isFrom {
			b.WriteString(to)
			seenTo = true
		} else {
			b.WriteString(t[sp.start:sp.end])
			if isTo {
				seenTo = true
			}
		}
		pos = sp.end
	}
	b.WriteString(t[pos:]) // trailing bytes after the last span
	out := strings.TrimSpace(b.String())
	out = strings.TrimRight(out, ",;& ")
	return out, true
}
