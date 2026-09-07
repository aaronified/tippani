package httpapi

// Tests for the two scheduling rules: adaptive intervals, which are now the
// DEFAULT, and the fixed 7 -> 30 -> 100 -> 365 ladder, which is now the opt-in
// (prefs.SRLadder).
//
// The switch happened for ONE reason: under the ladder a lapse drops a card to 7
// from any rung, so a single miss on a quote recalled four times costs the whole
// climb. Adaptive halves instead. Most of what follows pins that asymmetry, and
// the rest pins WHICH SIDE OF IT A READER LANDS ON WITHOUT CHOOSING — see
// TestAdaptiveIsTheRuleNobodyHasToChoose. That distinction is the whole content
// of the change, and a table where `adaptive` is just an input column cannot make
// it: every row here would pass unchanged with the default pointing either way.

import (
	"fmt"
	"math"
	"net/http"
	"strings"
	"testing"
)

// nextStability is the whole rule, so it is tested directly rather than through
// six HTTP round-trips. The endpoint wiring is covered by TestAdaptivePrefReachesTheSchedule.
//
// Both rules are the same function over the same signature, so they are one
// table: `adaptive` is input data like every other column. The "ladder:" rows
// carry the claim that used to be a test name of its own — THE OPT-IN LEAVES
// THE DEFAULT RULE ALONE — so they must keep passing untouched no matter what
// the adaptive rows below them are changed to say.
func TestNextStability(t *testing.T) {
	cases := []struct {
		name      string
		adaptive  bool
		result    string
		cur       float64
		elapsed   float64
		succeeded bool
		want      float64
	}{
		// ---- the ladder, unchanged by the opt-in ---------------------------
		// The first success takes the starting rung and no more, whether the card
		// is brand new or has only ever been forgotten.
		{"ladder: first success from nothing", false, "got", reviewMinStability, 0, false, 7},
		{"ladder: first success after lapses", false, "got", 7, 40, false, 7},
		// ...and a "seen"-lengthened half-life is not shortened by it.
		{"ladder: first success keeps a seen bump", false, "got", 9, 0, false, 9},
		// Then one rung per success, stopping at the cap.
		{"ladder: second success climbs", false, "got", 7, 8, true, 30},
		{"ladder: third success climbs", false, "got", 30, 31, true, 100},
		{"ladder: fourth success climbs to the year", false, "got", 100, 400, true, 365},
		{"ladder: top rung stays", false, "got", 365, 400, true, 365},
		// And any lapse falls all the way back. This is the behaviour adaptive
		// exists to offer an alternative to, so it is pinned here deliberately.
		{"ladder: lapse from the top resets", false, "forgot", 365, 400, true, 7},
		{"ladder: lapse from the year rung's approach resets", false, "forgot", 100, 120, true, 7},
		{"ladder: lapse from the middle resets", false, "forgot", 30, 31, true, 7},

		// ---- adaptive ------------------------------------------------------
		// The first success behaves identically to the ladder: a card with no
		// track record has demonstrated nothing yet under either rule.
		{"adaptive: first success from nothing", true, "got", reviewMinStability, 0, false, 7},
		{"adaptive: first success after lapses", true, "got", 7, 40, false, 7},
		// Later successes multiply rather than step.
		{"adaptive: second success multiplies", true, "got", 7, 8, true, 17.5},
		{"adaptive: third success multiplies", true, "got", 17.5, 18, true, 43.75},
		// Late recall is its own evidence: remembering it 90 days on says the
		// half-life is around 90, not around cur*2.5.
		{"adaptive: late recall beats the multiplier", true, "got", 10, 90, true, 108}, // 90*1.2 = 108 beats 10*2.5 = 25
		{"adaptive: late recall below the cap", true, "got", 10, 50, true, 60},        // 50*1.2 = 60 beats 10*2.5 = 25
		// The cap holds — no stored half-life may promise a review past a year.
		// AND IT IS THE CLAMP DOING IT, ON PURPOSE: grow 2.5 from 100 overshoots
		// 365 in one step (250 does not, 200 does), and tapering growth near the
		// ceiling would add a parameter nobody can evaluate. So a card in the last
		// third of the ladder lands exactly on the ceiling rather than near it.
		{"adaptive: below the cap it still multiplies", true, "got", 100, 0, true, 250},
		{"adaptive: cap holds", true, "got", 200, 0, true, 365},
		{"adaptive: cap holds on a big multiply", true, "got", 365, 0, true, 365},
		{"adaptive: cap holds against a very late recall", true, "got", 10, 5000, true, 365},
		// THE POINT OF THE FEATURE: a lapse halves instead of resetting.
		{"adaptive: lapse from the top halves", true, "forgot", 365, 400, true, 182.5},
		{"adaptive: lapse from the third rung halves", true, "forgot", 100, 120, true, 50},
		{"adaptive: lapse from the middle halves", true, "forgot", 30, 31, true, 15},
		// ...but never below the floor every due-ness query already assumes.
		{"adaptive: lapse floors at the minimum", true, "forgot", 7, 8, true, 7},
		{"adaptive: lapse cannot go under the floor", true, "forgot", 8, 9, true, 7},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := nextStability(c.adaptive, c.result, c.cur, c.elapsed, c.succeeded, defaultReviewTuning())
			// Tolerance, not equality, because 50*1.2 is not exactly 60 in
			// binary. It is a no-op for the ladder rows, whose expectations come
			// straight back out of reviewLadder as integral literals.
			if math.Abs(got-c.want) > 1e-9 {
				rule := "ladder"
				if c.adaptive {
					rule = "adaptive"
				}
				t.Errorf("nextStability(%s, %s, cur=%g, elapsed=%g, succeeded=%v) = %g, want %g",
					rule, c.result, c.cur, c.elapsed, c.succeeded, got, c.want)
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
			for _, cur := range []float64{0, 1, 7, 30, 99, 100, 364, 365, 1000, 1e6} {
				for _, elapsed := range []float64{0, 1, 500, 10000} {
					for _, succeeded := range []bool{false, true} {
						got := nextStability(adaptive, result, cur, elapsed, succeeded, defaultReviewTuning())
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

	// ON THE LADDER FIRST, EXPLICITLY. Adaptive is the default now, so climbing
	// under the default would put both cards at 7 x 2.5 rather than on a rung, and
	// this test is about the two rules disagreeing rather than about either one.
	// Practice, with the schedule opted in, so the day's idempotency guard does
	// not swallow the second answer to the same card.
	c.mustDo("PUT", "/auth/me/preferences",
		map[string]any{"srPracticeCounts": true, "srLadder": true}, http.StatusOK)
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
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srLadder": false}, http.StatusOK)
	if got := answer(t, c, kindBook, adaptive, "forgot", "practice").Stability; got != 15 {
		t.Fatalf("lapse under adaptive: stability %g, want 15 — the preference is not reaching nextStability", got)
	}
}

// ADAPTIVE IS WHAT A READER GETS WITHOUT CHOOSING, and this is the assertion that
// says so — through the endpoint, on the value the two rules disagree about most
// loudly, with NO preference set at all.
//
// The ladder's lapse was the one place the loop was harsher than the science asks:
// a single miss on a card recalled four times cost the whole climb. A reader who
// has expressed no opinion should not be on the harsher of the two rules, and a
// test that only checks the rules differ WHEN SWITCHED cannot tell which of them
// is the one nobody chose.
func TestAdaptiveIsTheRuleNobodyHasToChoose(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	book := createBook(t, c, "Persuasion")
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "the only line"}, http.StatusCreated).Body.Bytes())
	ageSeededItems(t, srv)

	// srPracticeCounts ALONE. Nothing here says a word about which schedule.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srPracticeCounts": true}, http.StatusOK)
	if got := answer(t, c, kindBook, id, "got", "practice").Stability; got != 7 {
		t.Fatalf("first success: stability %g, want 7 — both rules agree here", got)
	}
	// Under the ladder this would be 30. Under adaptive it is 7 x 2.5.
	if got := answer(t, c, kindBook, id, "got", "practice").Stability; got != 17.5 {
		t.Fatalf("second success with no preference set: stability %g, want 17.5 — "+
			"a reader who chose nothing is on the ladder, not on adaptive", got)
	}
	// And the lapse, which is the whole reason for the switch: halved, not reset.
	if got := answer(t, c, kindBook, id, "forgot", "practice").Stability; got != 8.75 {
		t.Fatalf("lapse with no preference set: stability %g, want 8.75 (half of 17.5) — "+
			"the default still resets a card to the first rung", got)
	}
}

// And the LADDER is the flag now: off until somebody asks for it, surviving a PUT
// that never mentions it, and turnable back off.
//
// The sense inverted deliberately — see prefs.SRLadder. `srAdaptive` was a flat
// bool in a JSON blob with no omitempty, so every stored preference carried
// `false` whether the reader chose the ladder or never opened the panel, and a
// default like that cannot be flipped. The stored flag names the non-default
// choice, which is the convention srPracticeCounts and srSubmit already follow.
func TestLadderPrefRoundtrip(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	me := decode[meResp](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK))
	if me.Preferences.SRLadder {
		t.Fatal("srLadder should be off by default — adaptive is the default rule")
	}
	if !me.Preferences.adaptive() {
		t.Fatal("prefs.adaptive() disagrees with srLadder on a fresh account")
	}

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srLadder": true}, http.StatusOK)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK))
	if !me.Preferences.SRLadder {
		t.Fatal("srLadder did not persist")
	}
	if me.Preferences.adaptive() {
		t.Fatal("prefs.adaptive() still reports adaptive for a reader who chose the ladder")
	}
	// A partial PUT that never mentions srLadder must leave it alone — the
	// preferences endpoint merges, and every other field relies on that.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srDaily": 4}, http.StatusOK)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK))
	if !me.Preferences.SRLadder {
		t.Fatal("an unrelated preferences PUT cleared srLadder")
	}
	// Turning it back off must work too — a switch you cannot unflip is a trap,
	// and `false` is a bool's zero value, which is exactly the case a naive
	// merge drops.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srLadder": false}, http.StatusOK)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK))
	if me.Preferences.SRLadder {
		t.Fatal("srLadder could not be turned back off")
	}
}

// ---- the seeded deck actually being seeded --------------------------------
//
// seededRand's comment says the point of it is that "the exact options —
// distractor choice AND order — are identical for every client viewing the same
// day's card", after a bug where the wrong options changed between browsers and
// only the right answer stayed put.
//
// The promise was still not being kept, in two places that no test looked at.
// The work pool was built by ranging a Go MAP, whose iteration order is
// deliberately randomised, and the quote pool was capped with ORDER BY RANDOM(),
// which hands a different sample to every request. A seeded shuffle over either
// is a seeded permutation of a random input, which is just a random output.
//
// Asserted by fetching the same day's deck repeatedly: same cards, same options,
// same order.
func TestDailyDeckIsIdenticalAcrossRequests(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Enough works and quotes that both pools have real choices to make — with
	// one book and one quote every ordering is trivially identical and the test
	// would pass against the bug it exists for.
	for i := 0; i < 6; i++ {
		book := createBook(t, c, fmt.Sprintf("Book %d", i))
		for j := 0; j < 3; j++ {
			c.mustDo("POST", "/annotations", map[string]any{
				"book_id": book, "quote": fmt.Sprintf("line %d of book %d", j, i),
			}, http.StatusCreated)
		}
	}
	ageSeededItems(t, srv)

	first := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, http.StatusOK))
	if len(first.Items) == 0 {
		t.Fatal("empty deck — nothing to compare")
	}
	fingerprint := func(d reviewDeckResp) string {
		var b strings.Builder
		for _, it := range d.Items {
			fmt.Fprintf(&b, "%s#%d/%s/%d[", it.Kind, it.ID, it.Direction, it.Answer)
			for _, o := range it.Options {
				b.WriteString(o)
				b.WriteByte('|')
			}
			b.WriteString("]\n")
		}
		return b.String()
	}
	want := fingerprint(first)
	// Several times: a map's iteration order can coincide with the last one, so
	// one repeat is a coin toss rather than a check.
	for i := 0; i < 6; i++ {
		got := fingerprint(decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, http.StatusOK)))
		if got != want {
			t.Fatalf("the same day's deck differs between requests (attempt %d)\nfirst:\n%s\nnow:\n%s", i+1, want, got)
		}
	}
}

// ---- leeches ---------------------------------------------------------------
//
// A card forgotten five times is a leech: it costs a slot in every deck and
// gives nothing back. The deck says so, and the reader is offered a way out.
//
// THE SUBTLE HALF IS THE ANSWER RESPONSE, not the deck. A lapse sets
// last_reviewed_at to now and stability to the first rung, and a card is due
// only when elapsed >= MAX(stability, 7) — so the very answer that makes a card
// a leech also guarantees it will not be in a deck for at least a week. A flag
// that travelled only on the deck would surface the offer seven days after the
// frustration that earned it.
func TestLeechIsReportedByTheAnswerThatCausesIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Persuasion")
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book,
			// Long enough to be askable: a three-word quote cannot be clozed, and
			// with the flip card gone from the daily deck an unaskable card sits
			// the round out — which would make this test about fixture length
			// rather than about the leech flag.
			"quote": "a line I never remember however often the quiz brings it back around to me"},
		http.StatusCreated).Body.Bytes())
	ageSeededItems(t, srv)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srPracticeCounts": true}, http.StatusOK)

	for i := 1; i <= reviewLeechLapses; i++ {
		res := answer(t, c, kindBook, id, "forgot", "practice")
		if res.LapseCount != i {
			t.Fatalf("lapse %d reported lapse_count %d", i, res.LapseCount)
		}
		want := i >= reviewLeechLapses
		if res.Leech != want {
			t.Fatalf("after %d lapses leech = %v, want %v — the offer has to arrive with the answer that earns it",
				i, res.Leech, want)
		}
	}
}

// Practice that is not counting must not count toward it either: those answers
// never reach lapse_count, so offering to set a card aside on the strength of
// them would be an offer made about a history that was not recorded.
func TestPracticeThatDoesNotCountDoesNotMakeALeech(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Persuasion")
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book,
			// Long enough to be askable. With the flip card gone from the daily
			// deck a card that can be asked NOTHING sits the round out, so a
			// three-word fixture would make this test about quote length rather
			// than about the leech flag reaching the deck.
			"quote": "a line I never remember however often the quiz brings it back around again"},
		http.StatusCreated).Body.Bytes())
	ageSeededItems(t, srv)

	for i := 0; i < reviewLeechLapses+2; i++ {
		res := answer(t, c, kindBook, id, "forgot", "practice")
		if res.LapseCount != 0 || res.Leech {
			t.Fatalf("schedule-neutral practice moved the lapse count: %+v", res)
		}
	}
}

// And the deck carries it too, for a card that was already a leech before today.
func TestDeckCarriesTheLeechFlag(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Persuasion")
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book,
			// Long enough to be askable. With the flip card gone from the daily
			// deck a card that can be asked NOTHING sits the round out, so a
			// three-word fixture would make this test about quote length rather
			// than about the leech flag reaching the deck.
			"quote": "a line I never remember however often the quiz brings it back around again"},
		http.StatusCreated).Body.Bytes())
	ageSeededItems(t, srv)

	if _, err := srv.Store.DB.Exec(
		`INSERT INTO item_reviews (kind, item_id, stability, review_count, lapse_count, last_result,
		                           last_reviewed_at, last_touched_at)
		 VALUES ('book', ?, 7, 6, 6, 'forgot', datetime('now','-30 days'), datetime('now','-30 days'))`,
		id); err != nil {
		t.Fatal(err)
	}
	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, http.StatusOK))
	if len(deck.Items) != 1 {
		t.Fatalf("expected the overdue card: %+v", deck)
	}
	if !deck.Items[0].Leech || deck.Items[0].LapseCount != 6 {
		t.Fatalf("deck card does not report the leech: %+v", deck.Items[0])
	}
}
