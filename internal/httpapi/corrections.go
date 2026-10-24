package httpapi

// Corrections from the file: where a stored quote and the file's own words differ.
//
// A quote's source_context.body is the FILE'S words for the span the quote was found
// in (source_context.go), so a correction is proposable from rows alone: no file is
// opened, on a pruned work or an unplugged mount. This is the extrinsic sibling of
// cleanup's rules, and like them it proposes and never writes.
//
// THE BUCKETS ARE THE FEATURE. A bucket is homogeneous by construction, which is what
// makes a bulk press safe: "take the file's punctuation for these 10" is a decision a
// reader can hold in their head, "accept all 30 differences" is not. Bulk therefore
// acts within one bucket and never across, and every bucket has both verbs: apply
// (the file's words replace the quote) and dismiss (a durable refusal in
// cleanup_ignores, so a rescan does not ask again).
//
// The classifier is pure over the pair of strings for the reason cleanupRule is pure
// over one: it is the part worth testing, and the interesting cases (a quote that lost
// its accents, a subtitle that lost them) are expensive to build through a database.

import (
	"strings"
	"unicode"

	"tippani/internal/srcmatch"
)

// The bucket vocabulary. The client maps each to a name in the reader's language.
const (
	corrSpacing     = "spacing"     // line breaks and spacing only
	corrPunctuation = "punctuation" // punctuation and quote marks only
	corrCase        = "capitalisation"
	corrAccents     = "accents"
	corrMarks       = "marks"     // several kinds of mark and spacing together
	corrExtend      = "extend"    // the quote stops early: the line continues
	corrTrim        = "trim"      // the quote runs past the line
	corrOneWord     = "one-word"  // exactly one word differs
	corrFewWords    = "few-words" // two or three words differ
	corrWording     = "wording"   // anything longer or different in length

	corrIgnoreRule = "context-correction"
)

// corrBuckets is the presentation order: the marks first, the words after, because
// the first group can be dispatched without reading and the second cannot.
var corrBuckets = []string{
	corrSpacing, corrPunctuation, corrCase, corrAccents, corrMarks,
	corrExtend, corrTrim, corrOneWord, corrFewWords, corrWording,
}

func corrBucketKnown(b string) bool {
	for _, k := range corrBuckets {
		if k == b {
			return true
		}
	}
	return false
}

// correction is a classified difference. Proposed is the file's words, as they would
// be stored; From and To are the differing stretch on each side (widened to whole
// words) so a screen can mark it.
type correction struct {
	Bucket   string
	Proposed string
	From, To string
}

// corrProposedText is the file's words as a quote would hold them. A cue's lines are
// joined by a newline in storage; a quote written on one line keeps being one line, so
// the newline only survives when the reader's own text has one.
func corrProposedText(stored, body string) string {
	body = strings.TrimSpace(body)
	if !strings.Contains(stored, "\n") {
		body = strings.Join(strings.Fields(body), " ")
	}
	return body
}

func stripSpaces(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return -1
		}
		return r
	}, s)
}

func lettersOnly(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			return r
		}
		return -1
	}, s)
}

// accentless maps each letter to its unaccented form, keeping case and punctuation.
func accentless(s string) string {
	return strings.Map(func(r rune) rune {
		if !unicode.IsLetter(r) {
			return r
		}
		f := []rune(srcmatch.Fold(string(r)))
		if len(f) != 1 {
			return r
		}
		if unicode.IsUpper(r) {
			return unicode.ToUpper(f[0])
		}
		return f[0]
	}, s)
}

// classifyCorrection says what kind of difference the stored quote has from the
// file's words, or ok=false when there is none worth proposing.
func classifyCorrection(stored, body string) (correction, bool) {
	stored = strings.TrimSpace(stored)
	proposed := corrProposedText(stored, body)
	if proposed == "" || proposed == stored {
		return correction{}, false
	}
	c := correction{Proposed: proposed}
	c.From, c.To = differingStretch(stored, proposed)

	a, b := stored, proposed
	switch {
	case stripSpaces(a) == stripSpaces(b):
		c.Bucket = corrSpacing
	case lettersOnly(a) == lettersOnly(b):
		c.Bucket = corrPunctuation
	case strings.EqualFold(stripSpaces(a), stripSpaces(b)):
		c.Bucket = corrCase
	case accentless(stripSpaces(a)) == accentless(stripSpaces(b)):
		c.Bucket = corrAccents
	case srcmatch.Fold(a) == srcmatch.Fold(b):
		c.Bucket = corrMarks
	default:
		c.Bucket = wordBucket(srcmatch.Fold(a), srcmatch.Fold(b))
	}
	return c, true
}

// wordBucket sorts a difference in the words themselves. The quote being a whole run
// of the file's words (or the other way round) is the extend/trim pair; otherwise
// words are counted when the lengths agree, and anything else is plain wording.
func wordBucket(fq, ff string) string {
	q, f := strings.Fields(fq), strings.Fields(ff)
	switch {
	case containsRun(f, q):
		return corrExtend
	case containsRun(q, f):
		return corrTrim
	case len(q) == len(f):
		n := 0
		for i := range q {
			if q[i] != f[i] {
				n++
			}
		}
		switch {
		case n == 1:
			return corrOneWord
		case n <= 3:
			return corrFewWords
		}
	}
	return corrWording
}

// containsRun reports whether needle is a contiguous run of hay (and shorter).
func containsRun(hay, needle []string) bool {
	if len(needle) == 0 || len(needle) >= len(hay) {
		return false
	}
	for i := 0; i+len(needle) <= len(hay); i++ {
		ok := true
		for j := range needle {
			if hay[i+j] != needle[j] {
				ok = false
				break
			}
		}
		if ok {
			return true
		}
	}
	return false
}

// differingStretch trims the common prefix and suffix of two strings and widens what
// is left to whole words, so the marked part is a word and not half of one.
func differingStretch(a, b string) (string, string) {
	ra, rb := []rune(a), []rune(b)
	p := 0
	for p < len(ra) && p < len(rb) && ra[p] == rb[p] {
		p++
	}
	s := 0
	for s < len(ra)-p && s < len(rb)-p && ra[len(ra)-1-s] == rb[len(rb)-1-s] {
		s++
	}
	widen := func(r []rune) string {
		from, to := p, len(r)-s
		for from > 0 && !unicode.IsSpace(r[from-1]) {
			from--
		}
		for to < len(r) && !unicode.IsSpace(r[to]) {
			to++
		}
		return string(r[from:to])
	}
	return widen(ra), widen(rb)
}
