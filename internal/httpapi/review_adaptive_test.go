package httpapi

// Tests for adaptive intervals (srAdaptive) — the opt-in scheduling rule that
// sits beside the fixed 7 → 30 → 100 ladder.
//
// The rule exists for ONE reason: under the ladder a lapse drops a card to 7
// from any rung, so a single miss on a quote recalled four times costs the whole
// climb. Adaptive halves instead. Most of what follows pins that asymmetry —
// and, just as importantly, pins that the default is untouched, because an
// opt-in that quietly changes the schedule of everyone who never opted in is
// worse than not shipping it.

import (
	"math"
	"net/http"
	"testing"
)

// nextStability is the whole rule, so it is tested directly rather than through
// six HTTP round-trips. The endpoint wiring is covered by TestAdaptivePrefReachesTheSchedule.
func TestNextStabilityLadderUnchanged(t *testing.T) {
	cases := []struct {
		name      string
		result    string
		cur       float64
		elapsed   float64
		succeeded bool
		want      float64
	}{
		// The first success takes the starting rung and no more, whether the card
		// is brand new or has only ever been forgotten.
		{"first success from nothing", "got", reviewMinStability, 0, false, 7},
		{"first success after lapses", "got", 7, 40, false, 7},
		// ...and a "seen"-lengthened half-life is not shortened by it.
		{"first success keeps a seen bump", "got", 9, 0, false, 9},
		// Then one rung per success, stopping at the cap.
		{"second success climbs", "got", 7, 8, true, 30},
		{"third success climbs", "got", 30, 31, true, 100},
		{"top rung stays", "got", 100, 400, true, 100},
		// And any lapse falls all the way back. This is the behaviour adaptive
		// exists to offer an alternative to, so it is pinned here deliberately.
		{"lapse from the top resets", "forgot", 100, 120, true, 7},
		{"lapse from the middle resets", "forgot", 30, 31, true, 7},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := nextStability(false, c.result, c.cur, c.elapsed, c.succeeded)
			if got != c.want {
				t.Errorf("nextStability(ladder, %s, cur=%g, elapsed=%g, succeeded=%v) = %g, want %g",
					c.result, c.cur, c.elapsed, c.succeeded, got, c.want)
			}
		})
	}
}

func TestNextStabilityAdaptive(t *testing.T) {
	cases := []struct {
		name      string
		result    string
		cur       float64
		elapsed   float64
		succeeded bool
		want      float64
	}{
		// The first success behaves identically to the ladder: a card with no
		// track record has demonstrated nothing yet under either rule.
		{"first success from nothing", "got", reviewMinStability, 0, false, 7},
		{"first success after lapses", "got", 7, 40, false, 7},
		// Later successes multiply rather than step.
		{"second success multiplies", "got", 7, 8, true, 17.5},
		{"third success multiplies", "got", 17.5, 18, true, 43.75},
		// Late recall is its own evidence: remembering it 90 days on says the
		// half-life is around 90, not around cur*2.5.
		{"late recall beats the multiplier", "got", 10, 90, true, 100}, // 90*1.2 = 108, capped to 100
		{"late recall below the cap", "got", 10, 50, true, 60},         // 50*1.2 = 60 beats 10*2.5 = 25
		// The cap holds — no stored half-life may promise a review past 100 days.
		{"cap holds", "got", 100, 0, true, 100},
		{"cap holds on a big multiply", "got", 80, 0, true, 100},
		// THE POINT OF THE FEATURE: a lapse halves instead of resetting.
		{"lapse from the top halves", "forgot", 100, 120, true, 50},
		{"lapse from the middle halves", "forgot", 30, 31, true, 15},
		// ...but never below the floor every due-ness query already assumes.
		{"lapse floors at the minimum", "forgot", 7, 8, true, 7},
		{"lapse cannot go under the floor", "forgot", 8, 9, true, 7},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := nextStability(true, c.result, c.cur, c.elapsed, c.succeeded)
			if math.Abs(got-c.want) > 1e-9 {
				t.Errorf("nextStability(adaptive, %s, cur=%g, elapsed=%g, succeeded=%v) = %g, want %g",
					c.result, c.cur, c.elapsed, c.succeeded, got, c.want)
			}
		})
	}
}

// Neither rule may ever hand back a half-life outside the bounds the schema and
// every due-ness query assume. A rule that can return 0 makes a card due
// forever; one that can exceed the cap contradicts migration 0019.
func TestNextStabilityStaysInBounds(t *testing.T) {
	for _, adaptive := range []bool{false, true} {
		for _, result := range []string{"got", "forgot"} {
			for _, cur := range []float64{0, 1, 7, 30, 99, 100, 1000} {
				for _, elapsed := range []float64{0, 1, 500, 10000} {
					for _, succeeded := range []bool{false, true} {
						got := nextStability(adaptive, result, cur, elapsed, succeeded)
						if got < reviewMinStability || got > reviewMaxStability {
							t.Fatalf("nextStability(adaptive=%v, %s, cur=%g, elapsed=%g, succeeded=%v) = %g, outside [%g, %g]",
								adaptive, result, cur, elapsed, succeeded, got, reviewMinStability, reviewMaxStability)
						}
					}
				}
			}
		}
	}
}

// THE PREFERENCE HAS TO REACH THE SCHEDULE, which is a different claim from the
// two above and was for a while asserted by nothing but a comment naming a test
// that did not exist. nextStability can be perfectly correct and perfectly
// unreachable: pass the wrong argument at the one call site in handleReviewAnswer
// and every test in this file still passes while every reader is still on the
// ladder.
//
// Asserted end-to-end, over HTTP, through the same endpoint the client posts to,
// and on the ONE value the two rules disagree about most loudly — the lapse.
func TestAdaptivePrefReachesTheSchedule(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Persuasion")
	// Two quotes with the same history, so the only difference between them at
	// the end is which rule was in force.
	ladder := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "the first line"}, http.StatusCreated).Body.Bytes())
	adaptive := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "the second line"}, http.StatusCreated).Body.Bytes())
	ageSeededItems(t, srv)

	// Climb both to the second rung: first success takes 7 (both rules agree),
	// second success climbs. Practice, with the schedule opted in, so the day's
	// idempotency guard does not swallow the second answer to the same card.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srPracticeCounts": true}, http.StatusOK)
	for _, id := range []int64{ladder, adaptive} {
		if got := answer(t, c, kindBook, id, "got", "practice").Stability; got != 7 {
			t.Fatalf("first success on %d: stability %g, want 7", id, got)
		}
	}
	for _, id := range []int64{ladder, adaptive} {
		if got := answer(t, c, kindBook, id, "got", "practice").Stability; got != 30 {
			t.Fatalf("second success on %d: stability %g, want 30", id, got)
		}
	}

	// Now the rules part company. Under the ladder a lapse falls to 7 from any
	// rung; under adaptive it halves, to 15.
	if got := answer(t, c, kindBook, ladder, "forgot", "practice").Stability; got != 7 {
		t.Fatalf("lapse under the ladder: stability %g, want 7", got)
	}
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srAdaptive": true}, http.StatusOK)
	if got := answer(t, c, kindBook, adaptive, "forgot", "practice").Stability; got != 15 {
		t.Fatalf("lapse under adaptive: stability %g, want 15 — the preference is not reaching nextStability", got)
	}
}

// And it has to be off until somebody turns it on, survive a PUT that never
// mentions it, and be turnable back off.
func TestAdaptivePrefRoundtrip(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	me := decode[meResp](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK))
	if me.Preferences.SRAdaptive {
		t.Fatal("srAdaptive should be off by default — the ladder is the default rule")
	}

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srAdaptive": true}, http.StatusOK)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK))
	if !me.Preferences.SRAdaptive {
		t.Fatal("srAdaptive did not persist")
	}
	// A partial PUT that never mentions srAdaptive must leave it alone — the
	// preferences endpoint merges, and every other field relies on that.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srDaily": 4}, http.StatusOK)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK))
	if !me.Preferences.SRAdaptive {
		t.Fatal("an unrelated preferences PUT cleared srAdaptive")
	}
	// Turning it back off must work too — a switch you cannot unflip is a trap,
	// and `false` is a bool's zero value, which is exactly the case a naive
	// merge drops.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srAdaptive": false}, http.StatusOK)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK))
	if me.Preferences.SRAdaptive {
		t.Fatal("srAdaptive could not be turned back off")
	}
}
