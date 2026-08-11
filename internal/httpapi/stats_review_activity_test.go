package httpapi

import (
	"net/http"
	"testing"
)

// The Quiz and Practice calendars on the Stats page report ACCURACY, not just
// volume.
//
// The heatmap shades a day by how many cards it holds, which for a review stream
// answers half the question and paints the other half misleadingly: a day of
// four answers all wrong is the same shade as a day of four all right. So each
// review day carries `got` beside `answered`, and the client's hover line reads
// "N answers · X% correct" off the pair.
//
// The half that has to be exactly right is the ABSENT day. Rows are only sent
// for days with answers on them, and DELETE /review/practice deletes those rows
// outright — so a reset practice history is nothing but absent days, and the
// numerator and the denominator have to leave together. A `got` surviving its
// `answered` would let the client compute an accuracy for a session that no
// longer exists.

type activityDay struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
	Got   int    `json:"got"`
}

type reviewActivity struct {
	Quiz     []activityDay `json:"daily_quiz"`
	Practice []activityDay `json:"daily_practice"`
	Saves    []activityDay `json:"daily_activity"`
}

func reviewActivityOf(t *testing.T, c *testClient) reviewActivity {
	t.Helper()
	return decode[reviewActivity](t, c.mustDo("GET", "/stats", nil, http.StatusOK))
}

func TestReviewActivityCarriesTheRightAnswers(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 4)
	ageSeededItems(t, srv)

	// Three practice answers on one day: two right, one wrong. Skips are not
	// answers and must not reach either number.
	answer(t, c, kindBook, ids[0], "got", "practice")
	answer(t, c, kindBook, ids[1], "got", "practice")
	answer(t, c, kindBook, ids[2], "forgot", "practice")
	answer(t, c, kindBook, ids[3], "skip", "practice")

	act := reviewActivityOf(t, c)
	if len(act.Practice) != 1 {
		t.Fatalf("practice activity: got %d days, want 1 (%+v)", len(act.Practice), act.Practice)
	}
	if d := act.Practice[0]; d.Count != 3 || d.Got != 2 {
		t.Errorf("practice day: count=%d got=%d, want 3/2 — a skip is not an answer", d.Count, d.Got)
	}

	// The Daily Quiz keeps its own tally in the same shape, on its own rows.
	if len(act.Quiz) != 0 {
		t.Errorf("practice answers leaked into the quiz stream: %+v", act.Quiz)
	}
	answer(t, c, kindBook, ids[0], "forgot", "daily")
	act = reviewActivityOf(t, c)
	if len(act.Quiz) != 1 {
		t.Fatalf("quiz activity: got %d days, want 1 (%+v)", len(act.Quiz), act.Quiz)
	}
	if d := act.Quiz[0]; d.Count != 1 || d.Got != 0 {
		t.Errorf("quiz day: count=%d got=%d, want 1/0", d.Count, d.Got)
	}
}

func TestPracticeResetTakesTheAccuracyWithIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Emma", 2)
	ageSeededItems(t, srv)

	answer(t, c, kindBook, ids[0], "got", "practice")
	answer(t, c, kindBook, ids[1], "got", "daily")
	if act := reviewActivityOf(t, c); len(act.Practice) != 1 || act.Practice[0].Got != 1 {
		t.Fatalf("practice day not recorded: %+v", act.Practice)
	}

	c.mustDo("DELETE", "/review/practice", nil, http.StatusOK)

	act := reviewActivityOf(t, c)
	// Not "a day with 0 got" — no day at all. The client draws a quiet day as
	// "no answers", and it can only do that if the row is gone rather than zeroed.
	if len(act.Practice) != 0 {
		t.Errorf("reset left practice days behind: %+v", act.Practice)
	}
	// The Daily Quiz history is permanent and must survive a practice reset.
	if len(act.Quiz) != 1 || act.Quiz[0].Count != 1 || act.Quiz[0].Got != 1 {
		t.Errorf("practice reset touched the quiz history: %+v", act.Quiz)
	}
}
