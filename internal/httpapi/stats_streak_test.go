package httpapi

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

// THE LONGEST RUN IS NOT DERIVABLE FROM THE CURRENT ONE, which is the whole
// reason it is its own number. A run that has ended is invisible to the current
// streak by construction — so a reader three days into a new run had nothing to
// measure three against, and the drawer and the Home card both showed them the
// three.
type memoryRecall struct {
	Recall struct {
		Streak  int `json:"streak"`
		Longest int `json:"longest_streak"`
	} `json:"recall"`
}

// Rows straight into quiz_sessions: the endpoint that writes them plays a whole
// round, and what is under test is the arithmetic over the days, not the round.
func seedQuizDays(t *testing.T, s *Server, uid int64, days ...string) {
	t.Helper()
	for _, d := range days {
		// ON CONFLICT because the table already carries UNIQUE(user_id, mode,
		// day): a second Daily Quiz on the same date updates the day's row
		// rather than adding one. Seeding a repeat therefore has to be silent
		// here, and the DISTINCT in the query is the belt to that braces.
		if _, err := s.Store.DB.Exec(
			`INSERT INTO quiz_sessions (user_id, day, mode, answered, got) VALUES (?, ?, 'daily', 5, 4)
			 ON CONFLICT (user_id, mode, day) DO UPDATE SET answered = answered + 5`,
			uid, d,
		); err != nil {
			t.Fatal(err)
		}
	}
}

func daysAgo(n int) string { return time.Now().UTC().AddDate(0, 0, -n).Format("2006-01-02") }

func TestLongestStreakOutlivesTheRunThatSetIt(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	uid := int64(1)

	// A four-day run that ended a fortnight ago, a gap, then two days ending
	// today. The current streak is 2; the record is 4 and must survive.
	seedQuizDays(t, srv, uid, daysAgo(20), daysAgo(19), daysAgo(18), daysAgo(17))
	seedQuizDays(t, srv, uid, daysAgo(1), daysAgo(0))

	got := decode[memoryRecall](t, c.mustDo("GET", "/stats?offset=0", nil, http.StatusOK))
	if got.Recall.Streak != 2 {
		t.Errorf("current streak = %d, want 2", got.Recall.Streak)
	}
	if got.Recall.Longest != 4 {
		t.Errorf("longest streak = %d, want 4 — the run that ended is the record", got.Recall.Longest)
	}
}

// TWO SESSIONS IN ONE DAY ARE ONE DAY. A reader who opens the Daily Quiz twice
// has not made a two-day streak. The schema says so as well — one row per
// (user, mode, day) — but the streak walk is the layer that would be wrong if
// that ever changed, so it is asserted here rather than assumed there.
func TestLongestStreakCountsDaysAndNotSessions(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	seedQuizDays(t, srv, 1, daysAgo(3), daysAgo(3), daysAgo(3), daysAgo(2))

	got := decode[memoryRecall](t, c.mustDo("GET", "/stats?offset=0", nil, http.StatusOK))
	if got.Recall.Longest != 2 {
		t.Fatalf("longest = %d, want 2 — three sessions on one day is one day", got.Recall.Longest)
	}
}

// A LIBRARY THAT HAS NEVER PLAYED REPORTS ZERO, not a nil the client has to
// guard: the tile is hidden on zero, and an absent field would hide it by
// accident rather than by rule.
func TestStreaksAreZeroBeforeAnythingIsPlayed(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	got := decode[memoryRecall](t, c.mustDo("GET", "/stats?offset=0", nil, http.StatusOK))
	if got.Recall.Longest != 0 || got.Recall.Streak != 0 {
		t.Fatalf("streaks before any quiz: %+v", got.Recall)
	}
}

// AND THEY ARE PER USER. quiz_sessions carries user_id and item_reviews does
// not, so this is the table where a missing arm is a leak of somebody else's
// habit rather than a wrong average.
func TestStreaksArePerUser(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	owner := signupAdmin(t, h)
	other := addUser(t, h, owner, "bob")
	seedQuizDays(t, srv, 1, daysAgo(2), daysAgo(1), daysAgo(0))

	mine := decode[memoryRecall](t, owner.mustDo("GET", "/stats?offset=0", nil, http.StatusOK))
	theirs := decode[memoryRecall](t, other.mustDo("GET", "/stats?offset=0", nil, http.StatusOK))
	if mine.Recall.Longest != 3 {
		t.Fatalf("owner longest = %d, want 3", mine.Recall.Longest)
	}
	if theirs.Recall.Longest != 0 || theirs.Recall.Streak != 0 {
		t.Fatalf("another user saw %+v", theirs.Recall)
	}
}

// The offset only decides which local day is "today", and only the CURRENT
// streak has an open end. A record that has already closed cannot move because
// the reader flew somewhere.
func TestOnlyTheCurrentStreakMovesWithTheTimezone(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	seedQuizDays(t, srv, 1, daysAgo(6), daysAgo(5), daysAgo(4))

	var longest []int
	for _, off := range []int{-720, 0, 840} {
		got := decode[memoryRecall](t, c.mustDo("GET", fmt.Sprintf("/stats?offset=%d", off), nil, http.StatusOK))
		longest = append(longest, got.Recall.Longest)
	}
	for _, n := range longest {
		if n != 3 {
			t.Fatalf("longest by offset = %v, want 3 everywhere", longest)
		}
	}
	c.mustDo("GET", "/stats?offset=1000", nil, http.StatusBadRequest)
}
