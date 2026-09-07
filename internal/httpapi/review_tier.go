package httpapi

import "math"

// The three difficulties, and Random.
//
// review_questions.go handed over WHICH questions a deck may ask; review_tuning.go
// handed over how hard each answer moves the schedule. This is the third axis and
// the one the other two could not express: how hard the QUESTION itself is to
// answer. A reader could turn "which book?" off entirely, and could make every
// right answer worth less — neither of which makes the same card easier or harder
// to get right.
//
// A TIER IS A PROPERTY OF THE ROUND, NOT A COLUMN, which is the same ruling
// docs/PLAN.md already made for the measured difficulty signal: it is applied
// when the pool is built and nothing about it is stored per card. That keeps the
// founding constraint of §8 intact — no due-date column, no sweep, everything
// derived at query time — and it means changing tier is instant and reversible
// rather than a rewrite of the library's scheduling state.
//
// ---------------------------------------------------------------------------
//
// MEDIUM IS TODAY, EXACTLY, AND IT IS THE DEFAULT.
//
// Every function below returns its argument unchanged for tierMedium. That is
// deliberate and it is the whole risk argument for landing this near a release: a
// reader who changes nothing sees nothing change, and the two new tiers are
// reached only by asking for them. A tier that quietly re-ranked distractors for
// everybody would be a schedule-wide behaviour change wearing a settings switch.
//
// ---------------------------------------------------------------------------
//
// WHAT EASY COSTS, RECORDED RATHER THAN HIDDEN. Little, Bjork, Bjork & Angello
// (2012) found that multiple choice with COMPETITIVE alternatives teaches related,
// untested material better than cued recall — you retrieve why each wrong option
// is wrong — and that it avoids test-induced forgetting. Easy gives that up on
// purpose: two options instead of four, distractors chosen to be far rather than
// close. It is a lower floor, not a better question, and the infodot beside it
// says so in those words.
const (
	tierEasy   = "easy"
	tierMedium = "medium"
	tierHard   = "hard"
	// tierRandom picks per CARD rather than per round — see tierForCard. It is
	// never the answer to "which tier is this card?", only to "which tier did the
	// reader choose?".
	tierRandom = "random"
)

// reviewTiers is every tier the settings screen offers, in the order it lists
// them. Random last because it is a choice about the other three.
var reviewTiers = []string{tierEasy, tierMedium, tierHard, tierRandom}

// normalizeReviewTier is the round trip loadPrefs and the PUT handler both use.
// Empty and unknown both read as medium — a corrupt preference must not be able
// to change how hard the quiz is, and medium is the one that changes nothing.
func normalizeReviewTier(t string) string {
	for _, v := range reviewTiers {
		if t == v {
			return t
		}
	}
	return tierMedium
}

// tierForCard resolves the reader's choice to the tier THIS card is asked at.
//
// For the three fixed tiers that is the choice itself. For Random it is a seeded
// hash of the card and the day — the same mechanism dailyDirection uses, and for
// the same reason: a refresh must not reshuffle the difficulty of a card the
// reader is halfway through thinking about.
//
// WHY RANDOM IS WORTH HAVING AT ALL. A fixed tier over a mixed library is either
// too easy for the lines you know by heart or too hard for the ones you wrote
// down yesterday. Per-card difficulty is what the measured signal in
// docs/PLAN.md will eventually give; until it ships, a hash is the cheapest
// approximation of it that is stable enough to be lived with.
func tierForCard(tier, kind string, id, seed int64) string {
	if tier != tierRandom {
		return normalizeReviewTier(tier)
	}
	// Distinct from shuffleKey and from dailyDirection's hash. Deriving all three
	// from one number would tie difficulty to deck position and to question type,
	// so every hard card would arrive at the same end of the session asked the
	// same way — see dailyDirection's own comment on exactly this.
	h := uint64(id)*0xD6E8FEB86659FD93 + kindSalt(kind)*0x9E3779B97F4A7C15 + uint64(seed)*0x94D049BB133111EB
	h ^= h >> 33
	switch h % 3 {
	case 0:
		return tierEasy
	case 1:
		return tierMedium
	default:
		return tierHard
	}
}

// tierOptions is how many choices a multiple-choice card offers.
//
// TWO, NOT THREE, FOR EASY. A two-option card is a coin flip on a guess, and that
// is the honest shape of the floor this tier exists to lower: the reader who
// cannot yet place a line at all gets a question they can answer, and the schedule
// weighting already discounts what an easy question is worth. Three would be a
// compromise that is neither the floor nor a real question.
func tierOptions(tier string) int {
	if tier == tierEasy {
		return 2
	}
	return quizOptions
}

// tierDirections narrows a deck's repertoire to what the tier is willing to ask.
//
// IT NARROWS AND NEVER WIDENS, so the reader's own repertoire (review_questions.go)
// stays the outer bound: a tier cannot ask a question they turned off. And it
// never returns an empty list — rule 3 of that file, restated here for the same
// reason it exists there: a deck configured into nothing is a broken screen with
// no way back except guessing which switch did it.
func tierDirections(tier string, dirs []string) []string {
	var drop map[string]bool
	switch tier {
	case tierEasy:
		// MULTIPLE CHOICE ONLY. Typed recall with nothing to lean on is the
		// opposite of a floor, and the flip card is the reader marking themselves,
		// which is not easier — it is a different activity.
		drop = map[string]bool{dirCloze: true, dirFlip: true}
	case tierHard:
		// RECOGNITION IS WHAT HARD GIVES UP. "Which book is this from?" with four
		// covers in front of you is three quarters of the work already done; the
		// typed blank and the two "who?" questions are what is left when it is not.
		drop = map[string]bool{dirSource: true, dirQuote: true, dirClozeMCQ: true}
	default:
		return dirs
	}
	kept := make([]string, 0, len(dirs))
	for _, d := range dirs {
		if !drop[d] {
			kept = append(kept, d)
		}
	}
	if len(kept) == 0 {
		return dirs
	}
	return kept
}

// tierClozeThreshold is the half-life at which a blank may span more than one
// word, adjusted for the tier.
//
// THE TIER IS THE GATE AT BOTH ENDS. The stored threshold (tuning.ClozeWords,
// 30 days by default) exists so that a card you have only just met is not asked
// to reproduce a phrase. Hard says the reader has asked for the phrase, so the
// gate opens at once; Easy says one word whatever the half-life, which is a
// threshold nothing can reach rather than a second code path in clozeSpan.
func tierClozeThreshold(tier string, stored float64) float64 {
	switch tier {
	case tierEasy:
		return math.MaxFloat64
	case tierHard:
		return 1
	default:
		return stored
	}
}

// tierPrefers is the direction a tier reaches for first when the reader's
// repertoire allows it, and "" when it has no opinion.
//
// WEIGHTED UP RATHER THAN LEFT TO THE HASH, which is the difference between a
// tier and a relabelling. dailyDirection picks by a hash of card and day, so
// without this a "hard" round would be hard one card in five by luck. The
// preference is a preference and not a rule: buildQuestion falls through to the
// rest of the table when the preferred direction cannot form.
func tierPrefers(tier string) string {
	switch tier {
	case tierHard:
		return dirCloze // type the missing words
	case tierEasy:
		return dirClozeMCQ // the same hole, with the words offered
	default:
		return ""
	}
}

// tierMinOptions is the fewest choices a card may offer and still be asked.
//
// THE FLOOR EXISTS BECAUSE A COIN TOSS RECORDED AS A GRADE MOVES A SCHEDULE ON NO
// EVIDENCE — speakerMinOptions says so in as many words, and the cloze-MCQ card
// borrowed it for the same reason. Easy is the one tier that WANTS a coin toss:
// two options is the floor it exists to lower the question to, and refusing to
// ask below three would mean Easy could never draw the card it is defined by.
//
// So the floor follows the ceiling rather than standing beside it. It is never
// above what the tier offers, and never below two — one option is not a question
// at any difficulty.
func tierMinOptions(tier string) int {
	return min(speakerMinOptions, tierOptions(tier))
}
