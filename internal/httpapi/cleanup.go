package httpapi

import (
	"regexp"
	"strings"
)

// What a quote picks up on its way in, and how to find it again.
//
// THE PROBLEM IS THE SOURCE, NOT THE READER. A quote typed by hand is clean. A
// quote that arrived by selecting text in an ebook, a PDF or a browser brings the
// page's furniture with it: the footnote index that sat after the last word, the
// pronunciation gloss a dictionary printed beside a headword, the double space a
// justified line left behind, the soft hyphen that broke a word across two lines
// and is now sitting inside it. None of it is visible in a card, all of it is in
// the FTS index, and it is why a search for a phrase you can see fails.
//
// THIS FINDS AND NEVER FIXES, and that is the whole design rather than a first
// step. Every rule below has a false positive that is somebody's real text: a
// sentence may genuinely end in a numeral, a quote may genuinely contain a
// bracketed aside, a language may genuinely use a character another one calls
// invisible. An automatic pass would edit the reader's own words on the strength
// of a guess, silently, in a library whose whole point is that the words are
// theirs. So this reports, with enough of the line to judge by, and the reader
// decides one case at a time.
//
// WHY THE RULES ARE PURE FUNCTIONS OVER A STRING. They are the part worth
// testing, and testing them through a database and an HTTP handler would make the
// interesting cases — a Bengali dāṛi, a hyphen that belongs, three dots that are
// an ellipsis — expensive to write and easy to leave out.

// cleanupRule is one thing worth looking at. `ID` is a machine value: the client
// maps it to a name and a description in the reader's language, because a rule
// named in English is a rule half the interface cannot explain.
type cleanupRule struct {
	ID string
	// find returns the byte ranges worth showing. Empty means the text is clean by
	// this rule.
	find func(string) [][]int
}

// The invisible characters, named individually rather than caught by a category.
//
// A CATEGORY WOULD SWEEP UP WORKING TEXT. \p{Cf} (format) includes the
// zero-width joiner, which Bengali and Devanagari conjuncts NEED — ক্ষ is built
// with one — so a rule that flagged every format character would flag correct
// Bengali on every line. These five are the ones that arrive from a page and
// never from a keyboard: a non-breaking space from HTML, a zero-width space from
// a justified PDF, a soft hyphen from a line break, a BOM from a file, and a
// word joiner from a copy-paste.
//
// The zero-width joiner (U+200D) is deliberately absent. It is load-bearing in
// the two scripts this app ships in.
// WRITTEN AS ESCAPES, NOT AS THE CHARACTERS THEMSELVES. A literal non-breaking
// space in this file would be unreadable, unreviewable in a diff, and — the part
// that settles it — Go refuses a literal BOM mid-file outright. Spelling out the
// codepoints also documents which five they are, which the characters could not.
// A RAW literal, like every pattern below: \x{...} is regex syntax and Go's
// interpreted strings reject it outright.
//
//	00a0 no-break space · 200b zero-width space · 00ad soft hyphen
//	feff BOM / zero-width no-break space · 2060 word joiner
var cleanupInvisible = regexp.MustCompile(`[\x{00a0}\x{200b}\x{00ad}\x{feff}\x{2060}]`)

var (
	// Two or more spaces inside a line. Justified text and double-spaced
	// sentences both land here.
	cleanupDoubleSpace = regexp.MustCompile(`[^\S\n]{2,}`)

	// A space before punctuation that closes rather than opens. French spaces
	// before a colon on purpose, which is exactly why this reports instead of
	// fixing.
	cleanupSpaceBeforePunct = regexp.MustCompile(`\s+[,.;:!?)\]}]`)

	// A reference index left behind by the page it came from: a superscript
	// digit, a bracketed number, or a bare number welded to the end of a word.
	//
	// The third form is the loose one, and it is bounded on purpose: a digit
	// directly after a LETTER, at a word boundary, so "chapter 12" and "1984" are
	// left alone and "conscience12" is not. A sentence that genuinely ends in a
	// numeral is the false positive, and the reader can see that at a glance.
	cleanupReferenceMark = regexp.MustCompile(`[\x{00b9}\x{00b2}\x{00b3}\x{2070}-\x{209f}]|\[\d{1,3}\]|\p{L}\d{1,3}\b`)

	// A pronunciation gloss: IPA between slashes, IPA-only characters, or the
	// word a dictionary prints before one.
	cleanupPronunciation = regexp.MustCompile(`/[^/\n]{2,40}/|[\x{0250}-\x{02af}\x{02b0}-\x{02ff}]|\((?i:pronoun|pron\.)[^)\n]*\)`)

	// A word split by a line break and rejoined with the hyphen still in it. The
	// shape is lower-case, hyphen, lower-case with a space after the hyphen — or a
	// hyphen at a line end.
	cleanupHyphenBreak = regexp.MustCompile(`\p{Ll}-\s+\p{Ll}|\p{Ll}-\n`)

	// Doubled punctuation, minus the two that are real: an ellipsis, and the
	// em-dash pair some writers use.
	cleanupRepeatedPunct = regexp.MustCompile(`,{2,}|;{2,}|!{2,}|\?{2,}|\.{4,}|(?:[^.]|^)\.{2}(?:[^.]|$)`)
)

// cleanupRules is the whole set, in the order a reader is likely to care.
// Ordering is presentation and nothing depends on it.
var cleanupRules = []cleanupRule{
	{ID: "invisible", find: rangesOf(cleanupInvisible)},
	{ID: "edge-space", find: findEdgeSpace},
	{ID: "double-space", find: rangesOf(cleanupDoubleSpace)},
	{ID: "space-before-punctuation", find: rangesOf(cleanupSpaceBeforePunct)},
	{ID: "reference-mark", find: rangesOf(cleanupReferenceMark)},
	{ID: "pronunciation", find: rangesOf(cleanupPronunciation)},
	{ID: "hyphen-break", find: rangesOf(cleanupHyphenBreak)},
	{ID: "repeated-punctuation", find: rangesOf(cleanupRepeatedPunct)},
}

func rangesOf(re *regexp.Regexp) func(string) [][]int {
	return func(s string) [][]int { return re.FindAllStringIndex(s, -1) }
}

// findEdgeSpace reports the padding itself — the leading run, the trailing run,
// or both — and NOT the whole string.
//
// Returning the whole string is what the first version did, on the reasoning that
// a quote padded at both ends has one thing wrong with it. That is true and it was
// still wrong: the snippet is built from the first range, so a padded quote put
// its ENTIRE text into a list meant to be scanned at a glance. The count is now
// how many ends are padded, which is the honest number, and the snippet shows the
// padding with the words beside it like every other rule.
func findEdgeSpace(s string) [][]int {
	if s == "" || strings.TrimSpace(s) == s {
		return nil
	}
	var out [][]int
	if lead := len(s) - len(strings.TrimLeft(s, " \t\n\r\v\f")); lead > 0 {
		out = append(out, []int{0, lead})
	}
	if trail := len(s) - len(strings.TrimRight(s, " \t\n\r\v\f")); trail > 0 {
		out = append(out, []int{len(s) - trail, len(s)})
	}
	return out
}

// cleanupFinding is one rule firing on one field of one quote.
type cleanupFinding struct {
	Rule string `json:"rule"`
	// Field says WHICH text — a quote, a note, a translation — because a stray
	// space in a note is a different decision from one in the words themselves.
	Field string `json:"field"`
	// Snippet is the text around the match, with the match itself marked, so the
	// reader can judge without opening the quote. Invisible characters are the
	// reason a marker is needed at all: there is nothing to see otherwise.
	Snippet string `json:"snippet"`
	Count   int    `json:"count"`
}

// scanCleanup runs every rule over one field and returns what fired.
//
// ONE FINDING PER RULE PER FIELD, with a count — not one per match. A page's
// worth of double spaces in a long quote is one decision, and listing forty of
// them would bury the other seven rules.
func scanCleanup(field, text string) []cleanupFinding {
	if text == "" {
		return nil
	}
	var out []cleanupFinding
	for _, r := range cleanupRules {
		hits := r.find(text)
		if len(hits) == 0 {
			continue
		}
		out = append(out, cleanupFinding{
			Rule:    r.ID,
			Field:   field,
			Snippet: cleanupSnippet(text, hits[0]),
			Count:   len(hits),
		})
	}
	return out
}

// cleanupSnippet is the match with a little of its surroundings, and the match
// itself wrapped in guillemets.
//
// MARKED RATHER THAN JUST QUOTED, because half these rules find something with no
// appearance: a non-breaking space, a zero-width space and an ordinary space all
// look identical in a list, so a snippet that only showed the text would say
// nothing at all. The marker is what makes "there is something here" visible.
//
// Guillemets rather than brackets or braces: those occur in real quotes — a
// bracketed number IS one of the things being reported — and a marker that can be
// confused with the content is not a marker.
const cleanupContext = 32

func cleanupSnippet(text string, hit []int) string {
	start, end := hit[0], hit[1]
	from := start - cleanupContext
	if from < 0 {
		from = 0
	}
	to := end + cleanupContext
	if to > len(text) {
		to = len(text)
	}
	var b strings.Builder
	if from > 0 {
		b.WriteString("…")
	}
	b.WriteString(strings.ReplaceAll(text[from:start], "\n", "⏎"))
	b.WriteString("»")
	b.WriteString(strings.ReplaceAll(text[start:end], "\n", "⏎"))
	b.WriteString("«")
	b.WriteString(strings.ReplaceAll(text[end:to], "\n", "⏎"))
	if to < len(text) {
		b.WriteString("…")
	}
	return b.String()
}
