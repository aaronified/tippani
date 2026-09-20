package httpapi

import (
	"net/http"
	"testing"
)

// "NEW LINES START AT" ACTUALLY MOVES WHERE A NEW LINE STARTS.
//
// WHAT THIS GUARDS. `srStart` was stored, normalised on read and write, drawn as
// a row on the Review section and consumed by NOTHING: every first answer seeded
// its half-life at the floor whatever the reader had chosen. A journey vouched
// for the row by asserting the value round-tripped, which is the shape CLAUDE.md's
// testing ruling exists to stop — a green test over a dead feature. The assertion
// here is the half-life the schedule comes out with, not the preference going in.
//
// The row's own words are the specification: "Mastered starts it at the far end,
// for a library you already know — it still comes round, just rarely, and a wrong
// answer brings it back."
func TestNewLinesStartWhereTheReaderSaid(t *testing.T) {
	answerFresh := func(t *testing.T, start, result string) float64 {
		t.Helper()
		srv := newTestServer(t)
		h := srv.Handler()
		c := signupAdmin(t, h)
		if start != "" {
			c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srStart": start}, http.StatusOK)
		}
		book := createBook(t, c, "Pride and Prejudice")
		id := idOf(t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": book, "quote": "Call me Ishmael, and then call me again."},
			http.StatusCreated).Body.Bytes())
		ageSeededItems(t, srv)
		// Practice with srPracticeCounts off would not move the schedule at all,
		// so this goes through the daily path — the one a reader's first answer
		// actually takes.
		res := decode[answerResp](t, c.mustDo("POST", "/review/answer", map[string]any{
			"kind": kindBook, "id": id, "result": result, "mode": "daily",
		}, http.StatusOK))
		return res.Stability
	}

	// The default is unchanged: a first correct answer sits on the first rung.
	if got := answerFresh(t, "", "got"); got != reviewMinStability {
		t.Errorf("default start: first answer gave a half-life of %v, want the floor %v", got, reviewMinStability)
	}
	if got := answerFresh(t, startUnseen, "got"); got != reviewMinStability {
		t.Errorf("Not seen: first answer gave a half-life of %v, want the floor %v", got, reviewMinStability)
	}

	// Mastered: the far end, and the number has to be MUCH larger or the row is
	// telling the reader something the schedule does not do.
	mastered := answerFresh(t, startMastered, "got")
	if mastered <= reviewMinStability {
		t.Errorf("Mastered: first answer gave a half-life of %v, no further out than the floor %v", mastered, reviewMinStability)
	}
	if mastered != reviewMaxStability {
		t.Errorf("Mastered: first answer gave a half-life of %v, want the top rung %v", mastered, reviewMaxStability)
	}

	// AND A WRONG ANSWER BRINGS IT BACK, which is the clause that stops this being
	// a way to switch the quiz off. The top rung was the reader's assumption about
	// their own library; getting it wrong is the evidence against it.
	if got := answerFresh(t, startMastered, "forgot"); got != reviewMinStability {
		t.Errorf("Mastered then wrong: half-life is %v, want the floor %v — the row promises it comes back", got, reviewMinStability)
	}
}

// A CARD THAT HAS BEEN ANSWERED BEFORE IS NOT RE-SEEDED. `srStart` is about
// ENTERING the schedule; applying it to a card already in one would let a reader
// launder a forgotten line back to the far end by toggling a preference.
func TestStartingRungDoesNotReachACardAlreadyInTheSchedule(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Pride and Prejudice")
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "Call me Ishmael, and then call me again."},
		http.StatusCreated).Body.Bytes())
	ageSeededItems(t, srv)

	// It enters at the floor, under the default.
	first := decode[answerResp](t, c.mustDo("POST", "/review/answer", map[string]any{
		"kind": kindBook, "id": id, "result": "forgot", "mode": "daily",
	}, http.StatusOK))
	if first.Stability != reviewMinStability {
		t.Fatalf("the card did not enter at the floor: %v", first.Stability)
	}

	// Now the reader switches the preference. The card is already in the schedule,
	// so the next answer must climb from where it is rather than jump to the end.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srStart": startMastered}, http.StatusOK)
	next := decode[answerResp](t, c.mustDo("POST", "/review/answer", map[string]any{
		"kind": kindBook, "id": id, "result": "got", "mode": "practice",
	}, http.StatusOK))
	if next.Stability == reviewMaxStability {
		t.Errorf("a card already in the schedule was re-seeded at the top rung (%v)", next.Stability)
	}
}
