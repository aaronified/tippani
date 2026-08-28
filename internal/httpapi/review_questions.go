package httpapi

import (
	"encoding/json"
	"sort"
)

// The in-depth review controls — which questions each deck is allowed to ask.
//
// Until now the deck's repertoire was a constant. `directionsForMode` returned
// the same table for everybody, and the only thing a reader could say about the
// review loop was how many cards and which medium. That is a strange place to
// draw the line in an app whose review loop is the part with no equivalent
// elsewhere: somebody who cannot stand multiple choice, or who wants the daily
// deck to be nothing but fill-in-the-blank, had no way to say so.
//
// STORED AS A STRING, like LanguageMarks and for the same reason: `preferences`
// is a FLAT COMPARABLE STRUCT — ui_test.go declares a mirror of it and compares
// two values with `!=` — and a struct holding a map or a slice is not comparable
// in Go. So the wire and storage shape is a small JSON document and everything
// below is the parser for it.
//
// ---------------------------------------------------------------------------
//
// THREE RULES THE NORMALISER ENFORCES, and they are enforced HERE rather than in
// the interface, because a preference that arrives by PUT, by restore, or by
// somebody editing their own database is exactly as real as one that arrives by
// pressing a toggle.
//
//  1. An unknown direction is dropped, not rejected. A backup taken on a newer
//     build restores onto an older one without failing; a direction this build
//     has never heard of simply is not asked.
//
//  2. THE DAILY DECK CANNOT BE MADE SELF-SCORING. 1.15.3 took the flip card out
//     of the daily deck deliberately — every other card there is marked by the
//     server against a right answer, and one card in five being self-marked does
//     not make the deck slightly softer, it makes the score mean something else.
//     Making the repertoire configurable would hand that decision back by
//     accident, so `flip` is dropped from `daily` on the way in. It remains the
//     default in Practice, which is where it belongs.
//
//  3. NO DECK CAN BE CONFIGURED INTO NOTHING. "Every aspect is configurable" has
//     to stop short of "configure the quiz until it has no questions", because
//     the result is not a preference, it is a broken screen with no way back
//     except guessing which switch did it.
//
//     The check is sharper than "is the list empty", and the sharp part is the
//     one worth having: `speaker` only applies to something with a recorded
//     speaker — a film line or a speech — and `author` only to a book. A reader
//     who enables ONLY "who said this?" leaves every book with no question at all
//     — a deck that is not empty, and is empty for a third of a library. So a
//     deck must keep at least one direction that applies to EVERY kind, or it
//     goes back to its defaults.
type reviewQuestions struct {
	daily    []string
	practice []string
}

// reviewDeckDaily / reviewDeckPractice name the two decks on the wire.
const (
	reviewDeckDaily    = "daily"
	reviewDeckPractice = "practice"
)

// reviewDirectionsAll is every direction this build knows, in the order the
// settings screen lists them. It is the ONLY list of direction names outside
// review_handlers.go's constants, and it is what makes rule 1 above possible.
var reviewDirectionsAll = []string{dirSource, dirQuote, dirCloze, dirClozeMCQ, dirSpeaker, dirAuthor, dirFlip}

// reviewDirectionUniversal marks the directions that apply to EVERY kind of
// card. The two "who?" questions are the exceptions and the reason rule 3 is not
// simply a non-empty test — see the comment above. `speaker` needs a recorded
// speaker (a film line or a speech) and `author` needs a book; a reader who
// enabled only those would leave a third of the library with nothing to be
// asked.
var reviewDirectionUniversal = map[string]bool{
	dirSource: true, dirQuote: true, dirCloze: true, dirClozeMCQ: true, dirFlip: true,
}

// defaultReviewQuestions is what a reader gets who has never touched this, and
// what "Back to defaults" restores. Daily has no flip by rule 2; Practice keeps
// it, because being asked to be honest with yourself is the whole of what
// Practice is for.
func defaultReviewQuestions() reviewQuestions {
	return reviewQuestions{
		daily:    []string{dirSource, dirQuote, dirCloze, dirClozeMCQ, dirSpeaker, dirAuthor},
		practice: []string{dirSource, dirQuote, dirCloze, dirClozeMCQ, dirSpeaker, dirAuthor, dirFlip},
	}
}

// parseReviewQuestions reads the stored blob. Anything it cannot make sense of
// returns the defaults — a corrupt preference must not be able to break the one
// screen that would let you fix it.
func parseReviewQuestions(blob string) reviewQuestions {
	def := defaultReviewQuestions()
	if blob == "" {
		return def
	}
	var in struct {
		Daily    *[]string `json:"daily"`
		Practice *[]string `json:"practice"`
	}
	if err := json.Unmarshal([]byte(blob), &in); err != nil {
		return def
	}
	out := def
	// A POINTER PER DECK, so "not mentioned" and "explicitly empty" are different
	// requests. An older client that only knows about the daily deck must leave
	// Practice alone rather than reset it, which a plain []string could not
	// express: both cases unmarshal to nil.
	if in.Daily != nil {
		out.daily = cleanDirections(*in.Daily, reviewDeckDaily, def.daily)
	}
	if in.Practice != nil {
		out.practice = cleanDirections(*in.Practice, reviewDeckPractice, def.practice)
	}
	return out
}

// cleanDirections applies all three rules to one deck's list.
func cleanDirections(in []string, deck string, fallback []string) []string {
	seen := map[string]bool{}
	var out []string
	// Ordered by reviewDirectionsAll rather than by the caller's order, so the
	// stored blob is stable: toggling a direction off and on again produces the
	// same bytes, and a diff of two accounts' preferences means something.
	for _, d := range reviewDirectionsAll {
		if deck == reviewDeckDaily && d == dirFlip {
			continue // rule 2
		}
		for _, got := range in {
			if got == d && !seen[d] { // rule 1: anything not in the table falls out here
				seen[d] = true
				out = append(out, d)
			}
		}
	}
	// rule 3
	universal := false
	for _, d := range out {
		if reviewDirectionUniversal[d] {
			universal = true
			break
		}
	}
	if !universal {
		return append([]string(nil), fallback...)
	}
	return out
}

// blob renders the parsed form back to storage. Empty string when it matches the
// defaults, so an account that has never customised this stores nothing and
// picks up any future change to the defaults — the same rule normalizeLanguageMarks
// follows for a mark that is its language's own default.
func (q reviewQuestions) blob() string {
	def := defaultReviewQuestions()
	if sameDirections(q.daily, def.daily) && sameDirections(q.practice, def.practice) {
		return ""
	}
	b, err := json.Marshal(struct {
		Daily    []string `json:"daily"`
		Practice []string `json:"practice"`
	}{q.daily, q.practice})
	if err != nil {
		return ""
	}
	return string(b)
}

func sameDirections(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	x := append([]string(nil), a...)
	y := append([]string(nil), b...)
	sort.Strings(x)
	sort.Strings(y)
	for i := range x {
		if x[i] != y[i] {
			return false
		}
	}
	return true
}

// forDeck is the enabled set for one deck, as a lookup.
func (q reviewQuestions) forDeck(deck string) map[string]bool {
	list := q.practice
	if deck == reviewDeckDaily {
		list = q.daily
	}
	on := make(map[string]bool, len(list))
	for _, d := range list {
		on[d] = true
	}
	return on
}

// normalizeReviewQuestions is the round trip loadPrefs and the PUT handler both
// use: read whatever is stored, apply the three rules, write back the canonical
// form.
func normalizeReviewQuestions(blob string) string {
	return parseReviewQuestions(blob).blob()
}
