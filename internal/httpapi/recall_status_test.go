package httpapi

// recallStatus — the forgetting curve, server side, tested directly.
//
// Until this file existed the function was only ever reached end-to-end, through
// the deck endpoints in review_test.go. That is a thin rope to hang it on: the
// deck tests assert which cards come back and in what order, so a status they
// never look at can drift without anything going red. It is also called from
// stats_handlers.go (twice, once per medium, to bucket every quote in the
// library breakdown), so a regression here breaks the Stats page with no test
// anywhere naming the cause. I want the model itself pinned, boundary by
// boundary, independent of any HTTP round trip.
//
// The model: p = 2^(-elapsedDays/stability). Remembered at p >= 0.9, forgetting
// down to 0.5, probably-forgotten below. stability is floored at
// reviewMinStability, an item younger than reviewNewItemDays reads remembered,
// and a lapse beats all of it.
//
// The mirror of this function is reviewStatus() in web/frontend/src/ui.jsx,
// tested in web/frontend/test/pure/review-status.test.js. The two are separate
// implementations of one model, so the boundary cases here are deliberately the
// same boundaries that file uses — if I move a threshold in one, the other side
// should go red rather than silently disagree about the colour of a dot.

import (
	"math"
	"testing"
)

// ageDays for an item long out of its grace week, so a case exercises the curve
// rather than the "added this week" shortcut. Mirrors OLD() in the JS test.
const oldItemDays = 400.0

type recallCase struct {
	name       string
	seen       bool
	stability  float64
	elapsed    float64
	age        float64
	lastResult string
	want       string
}

// recallFloorCases are the fixtures chosen so that flooring the stability and
// NOT flooring it give different answers — kept in their own slice because
// TestRecallStatusFloorDiscriminates re-runs them against an unfloored
// reference to prove they actually discriminate. A fixture where both readings
// agree would pass whether or not the floor exists, which is a test that only
// looks like it covers the branch.
var recallFloorCases = []recallCase{
	// Floored: p = 2^(-3/7) = 0.743 -> forgetting.
	// Unfloored: p = 2^(-3/1) = 0.125 -> probably-forgotten.
	{"sub-floor stability is floored to seven days", true, 1, 3, oldItemDays, "got", "forgetting"},
	// A zero stability is what a pre-ladder row can carry. Floored: p = 2^(-1/7)
	// = 0.906 -> remembered. Unfloored it is a division by zero: -1/0 is -Inf and
	// math.Pow(2, -Inf) is 0 -> probably-forgotten. So the floor is also what
	// keeps this branch off the IEEE edge, not just what makes the answer nicer.
	{"zero stability is floored, not divided by", true, 0, 1, oldItemDays, "got", "remembered"},
	// The tightest pair I can build: 0.1 of a day under the floor, at an elapsed
	// that straddles p = 0.5 depending on which half-life is used.
	// Floored: p = 2^(-6.95/7) = 0.5025 -> forgetting (>= 0.5).
	// Unfloored: p = 2^(-6.95/6.9) = 0.4975 -> probably-forgotten.
	{"a hair under the floor still floors", true, 6.9, 6.95, oldItemDays, "got", "forgetting"},
}

func TestRecallStatus(t *testing.T) {
	cases := []recallCase{
		// ---- the new-item grace week (reviewNewItemDays) ----
		//
		// Having just written a quote down counts as knowing it, so a fresh item
		// reads remembered before it has ever been answered.
		{"fresh item reads remembered before any review", false, reviewMinStability, 0, 2, "", "remembered"},
		{"grace holds on the last day of the week", false, reviewMinStability, 0, 6.999, "", "remembered"},
		// The comparison is `ageDays < reviewNewItemDays`, so seven days exactly is
		// OUT. This is the edge the JS test pins from its own side
		// ("falls out of grace at exactly seven days"); both must agree or a card
		// changes colour the moment the page re-renders from a different source.
		{"grace ends at exactly seven days", false, reviewMinStability, 0, reviewNewItemDays, "", "unseen"},
		// Grace is checked before the curve, so a fresh item that was somehow
		// reviewed a year ago still reads remembered. Contrived, but it is what
		// pins the branch ORDER rather than just the branch.
		{"grace outranks a stale curve", true, reviewMinStability, 365, 3, "got", "remembered"},
		// A missing created_at arrives as the COALESCE default 1e9 from both the
		// deck queries and itemAgeDays — very old, so no accidental grace.
		{"a missing created_at gets no grace", false, reviewMinStability, 0, 1e9, "", "unseen"},

		// ---- unseen ----
		{"never reviewed and out of grace", false, reviewMinStability, 0, oldItemDays, "", "unseen"},

		// ---- the p >= 0.9 boundary, from both sides ----
		//
		// p = 0.9 lands at elapsed = -stability*log2(0.9) = 0.15200309*stability.
		// At stability 30 that is 4.5600928 days.
		//
		// Unlike the 0.5 boundary below, this one cannot be straddled EXACTLY:
		// there is no tidy pair of inputs for which math.Pow(2, -elapsed/stability)
		// returns precisely the double nearest 0.9, so `>=` versus `>` on this line
		// is not something a fixture can pin without depending on how one machine's
		// libm rounds. I would rather say so than ship a case that passes here and
		// flakes elsewhere. The pair below brackets the crossing to two millionths.
		{"a card answered a moment ago", true, 30, 0, oldItemDays, "got", "remembered"},
		{"inside 0.9 by half a day", true, 30, 4, oldItemDays, "got", "remembered"},      // p = 0.9117
		{"outside 0.9 by half a day", true, 30, 5, oldItemDays, "got", "forgetting"},     // p = 0.8909
		{"inside 0.9 by a hundredth", true, 30, 4.56, oldItemDays, "got", "remembered"},  // p = 0.900002
		{"outside 0.9 by a hundredth", true, 30, 4.57, oldItemDays, "got", "forgetting"}, // p = 0.899794
		// The same crossing one rung down, to show it scales with the half-life
		// rather than being a constant number of days: 0.15200309*7 = 1.0640216.
		{"the 0.9 crossing scales with the half-life", true, 7, 1.06, oldItemDays, "got", "remembered"},
		{"and tips just past it", true, 7, 1.07, oldItemDays, "got", "forgetting"},

		// ---- the p >= 0.5 boundary, from both sides ----
		//
		// One half-life elapsed is p = 0.5 exactly — and exactly is the point: at
		// elapsed == stability the exponent is precisely -1, so math.Pow(2, -1)
		// returns 0.5 with no rounding to argue about, and the `>=` keeps it on
		// the forgetting side.
		//
		// Note this is the one tick where the dot and the Daily deck read the card
		// differently: the due-ness SQL admits it at `elapsed >= MAX(stability, 7)`,
		// so at elapsed == stability the card is already IN the deck while its dot
		// still says forgetting. Continuous time makes that a measure-zero instant
		// in production, but it is why I pin the boundary here rather than trusting
		// the "due exactly when its dot reads probably-forgotten" comment on the
		// bucketDue query.
		{"exactly one half-life is still forgetting", true, 30, 30, oldItemDays, "got", "forgetting"},
		{"a whisker past one half-life is lost", true, 30, 30.0001, oldItemDays, "got", "probably-forgotten"}, // p = 0.4999988
		{"a day past one half-life is lost", true, 30, 31, oldItemDays, "got", "probably-forgotten"},          // p = 0.4886
		{"deeply overdue stays probably-forgotten", true, 30, 400, oldItemDays, "got", "probably-forgotten"},
		// Mid-band, well clear of either boundary, so the middle branch is covered
		// by something other than a boundary case: p = 2^(-0.5) = 0.7071.
		{"half a half-life is squarely forgetting", true, 100, 50, oldItemDays, "got", "forgetting"},
		// The ceiling rung is not clamped downward the way the floor clamps up.
		{"a top-rung card holds for weeks", true, reviewMaxStability, 14, oldItemDays, "got", "remembered"}, // p = 0.907519

		// ---- the lapse override ----
		//
		// The curve assumes the last review was a SUCCESS (p = 1 at elapsed 0), and
		// a wrong answer resets last_reviewed_at to now — so without the
		// short-circuit a card answered wrong one second ago would read as the
		// best-remembered card in the library.
		{"a lapse beats a perfect elapsed time", true, reviewMaxStability, 0, oldItemDays, "forgot", "probably-forgotten"},
		{"a lapse beats the grace week", true, reviewMaxStability, 0, 1, "forgot", "probably-forgotten"},
		{"a lapse beats a sub-floor stability", true, 0, 0, oldItemDays, "forgot", "probably-forgotten"},
		{"a later success clears the lapse", true, 30, 1, oldItemDays, "got", "remembered"},
		// "" is what a bumpSeen-only row carries (and what COALESCE gives for a
		// NULL last_result): it must ride the curve, not short-circuit.
		{"an empty last_result rides the curve", true, 30, 1, oldItemDays, "", "remembered"},
		// The comparison is against the exact literal the handler writes. Anything
		// else is not a lapse — pinned so a future case-insensitive or
		// prefix-matching "fix" has to argue with a test first.
		//
		// Two fixtures, because the two loosenings fail differently and one does
		// not catch the other: "Forgot" is the one strings.EqualFold would wave
		// through, and "forgotten" is the one strings.HasPrefix/strings.Contains
		// would. I checked by making each of those substitutions in recallStatus
		// and re-running: with only the "Forgot" case here, the prefix and
		// substring versions both stayed green, which is the exact failure this
		// comment claims not to have.
		{"only the exact string forgot short-circuits", true, 30, 1, oldItemDays, "Forgot", "remembered"},
		{"a longer word beginning with forgot is not a lapse", true, 30, 1, oldItemDays, "forgotten", "remembered"},
	}
	cases = append(cases, recallFloorCases...)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := recallStatus(tc.seen, tc.stability, tc.elapsed, tc.age, tc.lastResult)
			if got != tc.want {
				p := math.Pow(2, -tc.elapsed/math.Max(tc.stability, reviewMinStability))
				t.Errorf("recallStatus(seen=%v, stability=%v, elapsed=%v, age=%v, lastResult=%q) = %q, want %q (floored p = %.6f)",
					tc.seen, tc.stability, tc.elapsed, tc.age, tc.lastResult, got, tc.want, p)
			}
		})
	}
}

// TestRecallStatusFloorDiscriminates proves the floor fixtures earn their place.
// A test for a clamp is worthless if the clamped and unclamped models happen to
// agree on the inputs it uses, and that agreement is easy to hit by accident:
// most stabilities below 7 still land in the same band at most elapsed times.
// So rather than trust the arithmetic in the comments above, I run each fixture
// against a copy of the model with the floor removed and require the two to
// DISAGREE. If someone deletes the clamp in recallStatus, TestRecallStatus goes
// red; if someone weakens these fixtures until they no longer test the clamp,
// this goes red instead.
func TestRecallStatusFloorDiscriminates(t *testing.T) {
	// Deliberately a second, floorless copy of the curve, not a call into the
	// real one — its whole job is to be the thing recallStatus must differ from.
	unfloored := func(stability, elapsed float64) string {
		switch p := math.Pow(2, -elapsed/stability); {
		case p >= 0.9:
			return "remembered"
		case p >= 0.5:
			return "forgetting"
		default:
			return "probably-forgotten"
		}
	}
	for _, tc := range recallFloorCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.stability >= reviewMinStability {
				t.Fatalf("fixture stability %v is not below the floor (%v), so it cannot exercise it",
					tc.stability, reviewMinStability)
			}
			// The fixture also has to REACH the curve. The floorless reference below
			// knows only about stability and elapsed, so if a fixture were ever
			// edited into an unseen card, a lapse, or an item still inside its grace
			// week, recallStatus would answer from one of the earlier short-circuits
			// and the two would "disagree" for a reason that has nothing to do with
			// the floor. That is a green light this test would not have earned, and
			// the whole point of the file is that it earns them.
			if !tc.seen || tc.lastResult == "forgot" || tc.age < reviewNewItemDays {
				t.Fatalf("fixture never reaches the curve (seen=%v lastResult=%q age=%v), so a disagreement here would not be about the floor",
					tc.seen, tc.lastResult, tc.age)
			}
			floored := recallStatus(tc.seen, tc.stability, tc.elapsed, tc.age, tc.lastResult)
			raw := unfloored(tc.stability, tc.elapsed)
			if floored == raw {
				t.Errorf("floored and unfloored both say %q for stability=%v elapsed=%v — this fixture does not discriminate; pick an elapsed that straddles a band boundary between stability=%v and stability=%v",
					floored, tc.stability, tc.elapsed, tc.stability, reviewMinStability)
			}
		})
	}
}

// TestRecallStatusLapseOutranksUnseen documents the ONE known divergence between
// this function and reviewStatus() in web/frontend/src/ui.jsx: Go returns
// probably-forgotten for lastResult == "forgot" BEFORE it ever looks at `seen`,
// whereas the JS checks !reviewed first and answers "unseen".
//
// The combination cannot occur in practice. Both fields come off the same LEFT
// JOIN — `seen` is `r.item_id IS NOT NULL` and lastResult is
// `COALESCE(r.last_result,”)` — so no row means seen=false AND lastResult="",
// and a lapse means there is a row. The divergence is unreachable by
// construction rather than handled, which is exactly why it is worth an
// assertion on both sides: the day the server starts sending a lapse without a
// review row, this pair of tests is where the two models start disagreeing.
//
// The matching assertion is in web/frontend/test/pure/review-status.test.js,
// under `describe('parity with the server')` → "never sees a lapse on an
// unreviewed card", which expects "unseen" for the same input. Change one of
// these without the other and the pair stops being a record of anything.
func TestRecallStatusLapseOutranksUnseen(t *testing.T) {
	if got := recallStatus(false, reviewMinStability, 0, oldItemDays, "forgot"); got != "probably-forgotten" {
		t.Errorf("unreviewed card with a lapse = %q, want %q (the JS mirror says \"unseen\" for this input)", got, "probably-forgotten")
	}
	// The same divergence inside the grace week, where Go skips both the age and
	// the seen check. JS also answers "unseen" here: its grace branch is guarded
	// by `last_result !== "forgot"`, so the lapse pushes it past grace and into
	// the !reviewed check.
	if got := recallStatus(false, reviewMinStability, 0, 1, "forgot"); got != "probably-forgotten" {
		t.Errorf("unreviewed fresh card with a lapse = %q, want %q (the JS mirror says \"unseen\" for this input)", got, "probably-forgotten")
	}
}
