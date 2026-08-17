package httpapi

import (
	"encoding/json"
	"fmt"
)

// The numbers behind the schedule, made yours.
//
// review_questions.go handed over WHAT the deck asks. This hands over HOW HARD
// it is: the multipliers a right and a wrong answer move a half-life by, the
// extra credit a harder question earns, and the point at which a fill-in-the-
// blank is allowed to hide more than one word.
//
// Until now every one of these was a package constant, which made the review
// loop the one part of this app whose behaviour was an opinion the reader could
// not disagree with. The comments beside them argued their cases well — 2.5 is
// SM-2's classic ease, 1.25/0.85 is "a harder question pays more and costs less"
// — and a good argument is still somebody else's answer.
//
// STORED AS A STRING, like LanguageMarks and SRQuestions, because `preferences`
// is a flat comparable struct that ui_test.go compares with `!=`.
//
// ---------------------------------------------------------------------------
//
// EVERY VALUE IS CLAMPED, AND THE CLAMPS ARE THE FEATURE.
//
// These numbers multiply a half-life on every answer, so a bad one does not
// produce a wrong screen — it produces a schedule that is quietly useless and
// stays that way. A grow of 0.5 shortens a card on every CORRECT answer, so a
// quote you know perfectly is asked more and more often for ever. A shrink of 3
// lengthens it on every failure. Neither errors, neither looks broken, and both
// would take weeks to notice.
//
// So: grow is > 1 and shrink is < 1 BY CONSTRUCTION rather than by hoping. The
// bounds are wide enough to be worth having (1.1–5 and 0.1–0.95) and closed at
// exactly the point where the number would start meaning its opposite.
type reviewTuning struct {
	Grow        float64 `json:"grow"`        // adaptive: correct-answer multiplier
	Shrink      float64 `json:"shrink"`      // adaptive: lapse multiplier
	ClozeGrow   float64 `json:"clozeGrow"`   // extra credit for a typed answer
	ClozeShrink float64 `json:"clozeShrink"` // reduced cost for missing a typed answer
	ClozeWords  float64 `json:"clozeWords"`  // half-life (days) at which a blank may span several words
	Ladder1     float64 `json:"ladder1"`     // the fixed ladder's three rungs, in days
	Ladder2     float64 `json:"ladder2"`
	Ladder3     float64 `json:"ladder3"`
}

func defaultReviewTuning() reviewTuning {
	return reviewTuning{
		Grow: reviewGrow, Shrink: reviewShrink,
		ClozeGrow: clozeGrowWeight, ClozeShrink: clozeShrinkWeight,
		ClozeWords: clozeMultiWordFrom,
		Ladder1:    reviewMinStability, Ladder2: 30, Ladder3: reviewMaxStability,
	}
}

// clampTuning is where a nonsense number becomes a usable one. Anything outside
// its range falls back to the DEFAULT rather than to the nearest bound: a reader
// who typed 0.5 into "correct answer multiplier" meant something, and silently
// giving them 1.1 would be answering a question they did not ask. The default is
// at least a number whose behaviour is documented.
func clampTuning(t reviewTuning) reviewTuning {
	d := defaultReviewTuning()
	pick := func(v, lo, hi, def float64) float64 {
		if v < lo || v > hi {
			return def
		}
		return v
	}
	// grow > 1 and shrink < 1, closed at the point each would invert.
	t.Grow = pick(t.Grow, 1.1, 5, d.Grow)
	t.Shrink = pick(t.Shrink, 0.1, 0.95, d.Shrink)
	// A harder question must not be worth LESS than an easy one, or the weighting
	// argues against itself.
	t.ClozeGrow = pick(t.ClozeGrow, 1, 3, d.ClozeGrow)
	t.ClozeShrink = pick(t.ClozeShrink, 0.2, 1, d.ClozeShrink)
	t.ClozeWords = pick(t.ClozeWords, 1, reviewMaxStability, d.ClozeWords)
	// The ladder has to ASCEND, and has to stay inside the bounds every query
	// floors and caps against — reviewMinStability/reviewMaxStability are spliced
	// into the due-ness SQL, so a rung outside them is a card that is due for ever
	// or never.
	t.Ladder1 = pick(t.Ladder1, reviewMinStability, reviewMaxStability, d.Ladder1)
	t.Ladder2 = pick(t.Ladder2, reviewMinStability, reviewMaxStability, d.Ladder2)
	t.Ladder3 = pick(t.Ladder3, reviewMinStability, reviewMaxStability, d.Ladder3)
	if !(t.Ladder1 < t.Ladder2 && t.Ladder2 < t.Ladder3) {
		t.Ladder1, t.Ladder2, t.Ladder3 = d.Ladder1, d.Ladder2, d.Ladder3
	}
	return t
}

func parseReviewTuning(blob string) reviewTuning {
	if blob == "" {
		return defaultReviewTuning()
	}
	t := defaultReviewTuning()
	if err := json.Unmarshal([]byte(blob), &t); err != nil {
		return defaultReviewTuning()
	}
	return clampTuning(t)
}

// blob renders back to storage, and is empty when it matches the defaults — so
// an account that never touched this picks up any later change to them, the same
// rule the language marks and the question sets follow. Empty is also exactly
// what "Back to defaults" sends.
func (t reviewTuning) blob() string {
	if t == defaultReviewTuning() {
		return ""
	}
	b, err := json.Marshal(t)
	if err != nil {
		return ""
	}
	return string(b)
}

func normalizeReviewTuning(blob string) string {
	return parseReviewTuning(blob).blob()
}

// ladder renders the three rungs as the array nextRung walks.
func (t reviewTuning) ladder() [3]float64 {
	return [3]float64{t.Ladder1, t.Ladder2, t.Ladder3}
}

func (t reviewTuning) String() string {
	return fmt.Sprintf("grow=%.2f shrink=%.2f cloze=%.2f/%.2f words@%.0f ladder=%.0f/%.0f/%.0f",
		t.Grow, t.Shrink, t.ClozeGrow, t.ClozeShrink, t.ClozeWords, t.Ladder1, t.Ladder2, t.Ladder3)
}
