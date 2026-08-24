package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"unicode"
	"unicode/utf8"
)

// What each rule would DO about what it found — and the reader's answer to it.
//
// WHY THIS EXISTS, AND WHAT IT REVERSES. cleanup.go shipped with "THIS FINDS AND
// NEVER FIXES, and that is the whole design rather than a first step", on the
// argument that every rule has a false positive that is somebody's real writing
// and that an automatic pass would edit their words on a guess. That argument was
// right about the thing it was arguing against: a "fix all" button behind one
// confirmation, over five hundred finds, with no diff.
//
// It was wrong that the only alternative was to fix nothing. What was missing is
// not a bigger button but a smaller one: **the suggested change, shown, accepted
// or refused one finding at a time — and a refusal that is remembered**. The
// reader asked for exactly that, in those words, and every objection the original
// note raised is answered by the shape rather than waived:
//
//	"an automatic pass"        nothing is automatic; one press is one field, one rule
//	"on the strength of a      the before and the after are both on screen, with the
//	 guess, silently"          matched span marked in both, before anything is written
//	"the one find that was     a false positive is IGNORED, and the ignore is stored
//	 real writing is gone"     (0052) so the same words are never re-offered
//
// So this file adds a fix to each rule and nothing else. The rules themselves —
// what they match, and the false positives they knowingly carry — are untouched.
//
// EVERY FIX IS DEFINED ON THE MATCHED TEXT ALONE. `fix` is a function from the
// substring a rule matched to what that substring should become, and applying a
// rule is replacing each of ITS OWN reported ranges with that. This is not a
// stylistic choice: it makes the rewrite provably confined to the spans the reader
// was shown. A fix that took the whole field could touch anything; one that takes
// the match can only change what was marked.
//
// A RULE MAY NOT EMPTY A FIELD, and cleanupApplyRule enforces it for every rule
// present and future rather than trusting each to be careful. Two of the eight can
// otherwise do it — a quote that is nothing but padding, and one that is nothing
// but a bracketed number — and an accepted suggestion that leaves a card blank is
// the worst outcome this feature could have.

// cleanupFix maps a rule id to what it does about a match. A rule with no entry
// here is REPORTED AND NEVER OFFERED: it can be ignored, so it stops filling the
// list, but there is no accept button, because there is no single right rewrite. No
// rule is in that state today; the table is written so that a future rule can be.
var cleanupFix = map[string]func(string) string{
	// The five that arrive from a page and never from a keyboard. Four of them are
	// nothing and go; U+00A0 IS DOING A SPACE'S JOB, so it becomes one — deleting it
	// would run two words together, which is a worse artefact than the one being
	// repaired.
	"invisible": func(m string) string {
		var b strings.Builder
		for _, r := range m {
			// Written as an escape, for the reason cleanup.go's own class is: a literal
			// no-break space here is unreviewable in a diff and indistinguishable from
			// the ordinary space on the next line.
			if r == '\u00a0' {
				b.WriteRune(' ')
			}
		}
		return b.String()
	},
	// The padding itself, reported as the leading run, the trailing run, or both.
	"edge-space": func(string) string { return "" },
	// A run of spaces or tabs inside a line (never a newline — the pattern excludes
	// it) becomes one space. A tab that was doing layout work in a quoted poem is
	// the false positive the reader is looking at when they decide.
	"double-space": func(string) string { return " " },
	// `\s+` then the punctuation that closes. The whitespace goes and the
	// punctuation stays, which is why this cannot be a constant: the match ends in
	// the character that has to survive.
	//
	// A RUN CONTAINING A NEWLINE IS LEFT ALONE. The rule's `\s+` spans line breaks,
	// so a closing bracket at the start of a line — a quoted poem, a stage
	// direction, a list — matched, and deleting the whitespace JOINED THE TWO LINES.
	// That is not a stray space; it is the shape of the text. Returning the match
	// unchanged makes cleanupApplyRule report "nothing changed", so the finding is
	// still listed and simply cannot be accepted.
	"space-before-punctuation": func(m string) string {
		if m == "" || strings.ContainsAny(m, "\n\r") {
			return m
		}
		_, size := utf8.DecodeLastRuneInString(m)
		return m[len(m)-size:]
	},
	// `reference-mark` AND `pronunciation` ARE DELIBERATELY ABSENT, and that is the
	// most important thing in this file. See cleanupUnfixable below for what they
	// did when they were here.
	// A word split by a line break and rejoined with the hyphen still inside it.
	// Both shapes are handled by dropping everything that is not a letter: `a- b`
	// becomes `ab`, and `a-\n` becomes `a` so the next line joins on.
	"hyphen-break": func(m string) string {
		var b strings.Builder
		for _, r := range m {
			if r != '-' && !unicode.IsSpace(r) {
				b.WriteRune(r)
			}
		}
		return b.String()
	},
	// Doubled punctuation collapses to one of itself. The `..` shape is matched WITH
	// a character either side (see cleanupRepeatedPunct), so those are kept and only
	// the run between them collapses — and a run of four or more dots becomes the
	// three that are a legitimate ellipsis rather than one full stop.
	"repeated-punctuation": func(m string) string {
		var b strings.Builder
		i := 0
		for i < len(m) {
			r, _ := utf8.DecodeRuneInString(m[i:])
			j := i
			for j < len(m) {
				r2, s2 := utf8.DecodeRuneInString(m[j:])
				if r2 != r {
					break
				}
				j += s2
			}
			run := m[i:j]
			switch {
			case len(run) == 1:
				b.WriteString(run)
			case r == '.' && len([]rune(run)) >= 4:
				b.WriteString("...")
			default:
				b.WriteRune(r)
			}
			i = j
		}
		return b.String()
	},
}

// cleanupUnfixable records WHY a rule the scan reports has no rewrite, because the
// absence is a decision and an empty map entry cannot hold a reason.
//
// BOTH OF THESE HAD FIXES FOR ONE AFTERNOON, and both destroyed real text. The
// detectors were written to LIST (cleanup.go says so at length, and says every rule
// has a false positive that is somebody's real writing); what I got wrong was
// assuming a detector implies a safe rewrite. Measured, on text a reader would
// actually keep:
//
//	pronunciation   `/[^/\n]{2,40}/` is "two slashes with something between them",
//	                which is a URL path, a date and a fraction as often as it is IPA:
//	                  "the ratio was 1/2 and then 3/4 of it" → "the ratio was 14 of it"
//	                  "see https://example.com/path"          → "see https:/path"
//	                  "on 12/05/1998 he wrote"                → "on 121998 he wrote"
//	reference-mark  its third form is a letter followed by digits, which is a
//	                footnote index in `conscience12` and a NAME in:
//	                  "Apollo11 lifted off"  → "Apollo lifted off"
//	                  "COVID19 changed it"   → "COVID changed it"
//
// The reader still sees both findings, with the snippet, and can still ignore either
// so it stops filling the list — they simply cannot be accepted in one press,
// because there is no rewrite that is right more often than it is wrong. Fixing
// either by hand, in the quote, is one click away on the row.
//
// A NARROWER RULE WOULD EARN A FIX BACK. `reference-mark` split into
// "bracketed/superscript index" (safe to delete) and "digits welded to a word" (not)
// would give the first half a button. That is a change to cleanup.go's rule set
// rather than to this file, and it is not being made in a patch release.
var cleanupUnfixable = map[string]string{
	"reference-mark": "a letter followed by digits is a footnote index in `conscience12` and a name in `Apollo11`",
	"pronunciation":  "two slashes with text between them is a fraction, a date and a URL path as often as it is IPA",
}

// cleanupFixable is whether this build can offer a rewrite for a rule.
func cleanupFixable(rule string) bool {
	_, ok := cleanupFix[rule]
	return ok
}

// cleanupRuleByID finds a rule's matcher. The rule set is a slice because its
// order is presentation (cleanup.go), so this is the lookup that goes with it.
func cleanupRuleByID(id string) (cleanupRule, bool) {
	for _, r := range cleanupRules {
		if r.ID == id {
			return r, true
		}
	}
	return cleanupRule{}, false
}

// cleanupApplyRule rewrites one field by one rule and reports whether anything
// changed. The result is the text with every one of that rule's matches replaced
// by its fix — nothing else is touched.
//
// THE NO-EMPTY-FIELD GUARD lives here rather than in each fix, so it holds for a
// rule added later by somebody who has not read this file. A quote that is nothing
// but padding, or nothing but a bracketed number, is left exactly as it is: the
// reader can delete a quote they do not want, and an accepted suggestion that
// silently blanks a card is not a correction.
func cleanupApplyRule(text, ruleID string) (string, bool) {
	out, _, changed := cleanupApplyRuleAt(text, ruleID)
	return out, changed
}

// cleanupApplyRuleAt is cleanupApplyRule plus WHERE the first replacement landed in
// the output, as a byte range.
//
// That range is what lets the page mark the change in the after-text as well as in
// the before-text. It has to be computed here, while the rewrite is being built,
// because afterwards it is not recoverable: the fix may delete the span entirely, so
// there is nothing left to search for, and a diff over the two strings would be a
// second opinion about what changed.
//
// The FIRST replacement, matching the snippet convention: cleanupSnippet already
// shows the first match and the count says how many there are.
func cleanupApplyRuleAt(text, ruleID string) (string, []int, bool) {
	rule, ok := cleanupRuleByID(ruleID)
	if !ok {
		return text, nil, false
	}
	fix, ok := cleanupFix[ruleID]
	if !ok {
		return text, nil, false
	}
	hits := rule.find(text)
	if len(hits) == 0 {
		return text, nil, false
	}
	var b strings.Builder
	var first []int
	at := 0
	for _, h := range hits {
		if h[0] < at { // overlapping matches: the first one wins
			continue
		}
		b.WriteString(text[at:h[0]])
		repl := fix(text[h[0]:h[1]])
		if first == nil && repl != text[h[0]:h[1]] {
			// Where this replacement sits in the OUTPUT. A deletion gives an empty
			// range, which is exactly right: the marker then points at the join, which
			// is where the reader's eye has to go.
			first = []int{b.Len(), b.Len() + len(repl)}
		}
		b.WriteString(repl)
		at = h[1]
	}
	b.WriteString(text[at:])
	out := b.String()
	if out == text {
		return text, nil, false
	}
	if strings.TrimSpace(out) == "" && strings.TrimSpace(text) != "" {
		return text, nil, false
	}
	return out, first, true
}

// cleanupMatchHash is the key an ignored finding is stored under: a fold of the
// exact spans this rule matched, in order.
//
// NOT THE RULE ALONE, and not the whole field. Migration 0052's header argues both
// at length; the short version is that the rule alone makes one ignored artefact
// bury its neighbours in the same field, and the whole field makes one ACCEPTED
// suggestion revive every ignored one beside it, because the text changed and so
// did every hash over it.
func cleanupMatchHash(text, ruleID string) string {
	rule, ok := cleanupRuleByID(ruleID)
	if !ok {
		return ""
	}
	h := sha256.New()
	h.Write([]byte(ruleID))
	for _, m := range rule.find(text) {
		h.Write([]byte("\x1f"))
		h.Write([]byte(text[m[0]:m[1]]))
	}
	return hex.EncodeToString(h.Sum(nil))[:32]
}
