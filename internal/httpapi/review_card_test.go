package httpapi

// WHAT THE RECALL PANEL IS ALLOWED TO SAY ABOUT A CARD.
//
// The owner asked for a popup behind the repetition dot: "it should show a
// popup for the halflife status, and recall history". Everything below is a
// claim about the ANSWER that popup reads, stated as behaviour a reader could
// check on their own phone — not as the shape of a JSON key.
//
// The two claims worth stating up front, because they are the ones that would
// be quietly wrong:
//
//  1. IT AGREES WITH THE DECK. The panel says when the card next comes round.
//     The deck decides which cards it serves. If those two are computed
//     separately they will disagree, and a panel promising a card is owed while
//     the quiz refuses to ask about it reads as the quiz being broken. So the
//     test does not check a number — it checks that `due` and the Daily Quiz
//     say the same thing about the same card.
//
//  2. IT IS FRESH. The card that opened the panel carries a copy of the
//     schedule from whenever its list was fetched, and the quiz moves the
//     schedule without telling the list. A panel whose subject is "when did I
//     last remember this" may not be the one surface showing yesterday's answer.

import (
	"fmt"
	"net/http"
	"testing"
)

type recallCardBody struct {
	Kind           string             `json:"kind"`
	ID             int64              `json:"id"`
	Reviewed       bool               `json:"reviewed"`
	Stability      float64            `json:"stability"`
	ReviewCount    int                `json:"review_count"`
	LapseCount     int                `json:"lapse_count"`
	LastResult     string             `json:"last_result"`
	LastReviewedAt string             `json:"last_reviewed_at"`
	CreatedAt      string             `json:"created_at"`
	Excluded       bool               `json:"excluded"`
	Due            bool               `json:"due"`
	DueInDays      *float64           `json:"due_in_days"`
	Logged         int                `json:"logged"`
	History        []recallHistoryRow `json:"history"`
}

type recallHistoryRow struct {
	Result      string   `json:"result"`
	Stability   float64  `json:"stability"`
	ElapsedDays *float64 `json:"elapsed_days"`
	AnsweredAt  string   `json:"answered_at"`
	Mode        *string  `json:"mode"`
	Counted     *bool    `json:"counted"`
}

// modeOf renders a history row's mode for an error message. A nil pointer is a
// row logged before 0066 gave the log that column, and "unrecorded" is what that
// means — printing the pointer prints an address.
func modeOf(a recallHistoryRow) string {
	if a.Mode == nil {
		return "unrecorded"
	}
	return *a.Mode
}

func recallCard(t *testing.T, c *testClient, kind string, id int64) recallCardBody {
	t.Helper()
	return decode[recallCardBody](t, c.mustDo("GET",
		fmt.Sprintf("/review/card?kind=%s&id=%d", kind, id), nil, http.StatusOK))
}

// A CARD THE QUIZ HAS NEVER ASKED ABOUT HAS NOTHING TO SHOW, AND SAYS SO
// WITHOUT CLAIMING IT IS OWED.
//
// The due rule the deck uses reads "no last review means maximally due", which
// is true of a schedule row that only ever got a seen-bump and NOT true of a
// card with no schedule row at all — those reach the deck through the unseen
// bucket and its grace week. Read literally onto a fresh card it would have the
// panel announce a card is due while the quiz is deliberately leaving it alone.
func TestRecallCardOfAnUnaskedQuote(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)

	got := recallCard(t, c, kindBook, ids[0])
	if got.Reviewed {
		t.Error("a quote nobody has been quizzed on reads as reviewed")
	}
	if len(got.History) != 0 || got.Logged != 0 {
		t.Errorf("a quote nobody has answered has %d logged answers and %d in the window", got.Logged, len(got.History))
	}
	if got.Due {
		t.Error("a quote the quiz has never asked about reads as due — the panel would say it is owed while the deck leaves it in its grace week")
	}
	if got.DueInDays != nil {
		t.Errorf("a quote with no recall clock was given one: due_in_days = %v", *got.DueInDays)
	}
	if got.CreatedAt == "" {
		t.Error("no created_at, so nothing can tell a brand-new quote from a forgotten one")
	}
}

// ANSWERING A CARD CHANGES WHAT THE PANEL SAYS ABOUT IT — the whole reason the
// panel asks the server rather than reading the card it was opened from.
func TestRecallCardIsFresherThanTheCardThatOpenedIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)
	ageSeededItems(t, srv)

	before := recallCard(t, c, kindBook, ids[0])
	// DAILY, because Practice moves nothing unless the reader has opted in — see
	// TestRecallCardKnowsPracticeFromTheQuiz, which is about exactly that.
	c.mustDo("POST", "/review/answer",
		map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusOK)
	after := recallCard(t, c, kindBook, ids[0])

	if before.Reviewed || !after.Reviewed {
		t.Fatalf("answering did not move the panel's state: reviewed %v -> %v", before.Reviewed, after.Reviewed)
	}
	if after.ReviewCount != 1 {
		t.Errorf("one answer counted as %d", after.ReviewCount)
	}
	if after.LastResult != "got" {
		t.Errorf("the panel reports the last result as %q, not the answer that was given", after.LastResult)
	}
	if after.LastReviewedAt == "" {
		t.Error("no last_reviewed_at after an answer, so the panel cannot say when")
	}
	if len(after.History) != 1 || after.Logged != 1 {
		t.Fatalf("one answer produced %d logged and %d in the window", after.Logged, len(after.History))
	}
	if after.History[0].Result != "got" {
		t.Errorf("the logged answer says %q", after.History[0].Result)
	}
	// The half-life that answer PRODUCED, which is what makes the log drawable as
	// a curve — a log of results alone could not be.
	if after.History[0].Stability != after.Stability {
		t.Errorf("the logged half-life (%v) is not the one the card now has (%v)",
			after.History[0].Stability, after.Stability)
	}
	// A FIRST ANSWER HAS NO GAP BEFORE IT. Zero would read as "answered twice in
	// the same moment", which a reader could not tell from the truth.
	if after.History[0].ElapsedDays != nil {
		t.Errorf("the first answer was given a gap of %v days since a previous one that does not exist",
			*after.History[0].ElapsedDays)
	}
}

// EVERY KIND OF QUOTE HAS A MEMORY, INCLUDING THE ONE WITH NO WORK BEHIND IT.
// A standalone quote is a review card like any other — that is what made 0065
// necessary — so the panel has to answer for it too.
func TestRecallCardCoversAllThreeKinds(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	_, anns := seedReviewBook(t, c, "Dune", 1)
	mv := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Heat"}, http.StatusCreated))
	dlg := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": mv.ID, "quote": "Don't let yourself get attached to anything you can't walk away from",
	}, http.StatusCreated))
	utts := seedReviewQuotes(t, c, "Subhas Chandra Bose", "Burma Radio broadcast", 1)
	ageSeededItems(t, srv)

	for _, tc := range []struct {
		kind string
		id   int64
		what string
	}{
		{kindBook, anns[0], "a highlight"},
		{kindScreen, dlg.ID, "a film line"},
		{kindUtterance, utts[0], "a standalone quote"},
	} {
		c.mustDo("POST", "/review/answer",
			map[string]any{"kind": tc.kind, "id": tc.id, "result": "forgot", "mode": "daily"}, http.StatusOK)
		got := recallCard(t, c, tc.kind, tc.id)
		if len(got.History) != 1 {
			t.Errorf("%s answered once has %d logged answers — this kind has no recall history", tc.what, len(got.History))
			continue
		}
		if got.History[0].Result != "forgot" || got.LapseCount != 1 {
			t.Errorf("%s: the lapse did not reach the panel (result %q, lapses %d)",
				tc.what, got.History[0].Result, got.LapseCount)
		}
	}
}

// THE PANEL AND THE QUIZ SAY THE SAME THING ABOUT WHETHER A CARD IS OWED.
//
// This is the claim, not the arithmetic: a card just answered is not due and the
// deck does not offer it; the same card with its half-life spent IS due and the
// deck does. Two separate spellings of the rule would pass a test that only
// checked the number.
func TestRecallCardAgreesWithTheDeckAboutDue(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)
	seedDistractorBook(t, srv, c, "Neuromancer")
	ageSeededItems(t, srv)
	c.mustDo("POST", "/review/answer",
		map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusOK)

	inDeck := func() bool {
		t.Helper()
		deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, http.StatusOK))
		for _, it := range deck.Items {
			if it.Kind == kindBook && it.ID == ids[0] {
				return true
			}
		}
		return false
	}

	fresh := recallCard(t, c, kindBook, ids[0])
	if fresh.Due {
		t.Error("a card answered a moment ago reads as due")
	}
	if fresh.DueInDays == nil || *fresh.DueInDays <= 0 {
		t.Errorf("a card just answered has no time left on its clock: %v", fresh.DueInDays)
	}
	// A sanity check rather than half the claim: the deck also leaves out anything
	// touched today, so this direction is over-determined. The claim is the other
	// one, below.
	if inDeck() {
		t.Error("the deck offered a card answered a moment ago, so this test is not measuring what it claims")
	}

	// Spend the half-life. The panel and the deck must both notice, and nothing
	// here tells either of them which answer to give.
	if _, err := srv.Store.DB.Exec(
		`UPDATE item_reviews SET last_reviewed_at = datetime('now', '-400 days'),
		                         last_touched_at = datetime('now', '-400 days')
		  WHERE kind = 'book' AND item_id = ?`, ids[0]); err != nil {
		t.Fatal(err)
	}
	stale := recallCard(t, c, kindBook, ids[0])
	if !stale.Due {
		t.Error("a card whose half-life is long spent does not read as due")
	}
	if stale.DueInDays == nil || *stale.DueInDays > 0 {
		t.Errorf("an overdue card's clock is not negative: %v", stale.DueInDays)
	}
	if !inDeck() {
		t.Fatal("the deck does not offer a card the panel calls due — the panel and the quiz disagree")
	}
}

// AND IT AGREES ABOUT A CARD WHOSE STORED HALF-LIFE IS UNDER THE FLOOR.
//
// The schedule never asks a card sooner than `reviewMinStability`, however small
// the number in the row — so the clock the panel prints has to be floored the
// same way. It was not tested: a rater took `MAX(r.stability, …)` out of
// `due_in_days` and every case passed, because no fixture in the file had a
// stability below seven. Five days after a stored half-life of three, the floored
// answer is two days LEFT and the unfloored one is two days OVERDUE — opposite
// verdicts, and the deck's is the floored one.
func TestRecallCardFloorsTheClockTheSameWayTheDeckDoes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)
	seedDistractorBook(t, srv, c, "Neuromancer")
	ageSeededItems(t, srv)
	c.mustDo("POST", "/review/answer",
		map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusOK)
	// A half-life under the floor, five days ago. Written straight in because
	// `nextStability` will not produce one — the ladder's first rung IS the floor,
	// which is exactly why the read has to floor it rather than trust the column.
	if _, err := srv.Store.DB.Exec(
		`UPDATE item_reviews SET stability = 3,
		                         last_reviewed_at = datetime('now', '-5 days'),
		                         last_touched_at = datetime('now', '-5 days')
		  WHERE kind = 'book' AND item_id = ?`, ids[0]); err != nil {
		t.Fatal(err)
	}

	got := recallCard(t, c, kindBook, ids[0])
	if got.DueInDays == nil {
		t.Fatal("a scheduled card came back with no clock")
	}
	// Floored: MAX(3, 7) - 5 = 2 days left. Unfloored: 3 - 5 = -2, overdue.
	if *got.DueInDays <= 0 {
		t.Errorf("the clock reads %.2f days — the stored half-life was used raw, so the panel calls a card overdue that the quiz will not ask for another two days",
			*got.DueInDays)
	}
	if got.Due {
		t.Error("the panel calls the card due")
	}
	// AND THE DECK IS THE ARBITER, not the arithmetic above: it floors the same
	// value in `dueSQL`, so if the two ever part company this is which way.
	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, http.StatusOK))
	for _, it := range deck.Items {
		if it.Kind == kindBook && it.ID == ids[0] {
			t.Fatal("the deck offered the card while the panel called it not due — the floor is spelled differently in the two places")
		}
	}
}

// SOMEBODY ELSE'S MEMORY IS NOT VISIBLE, AND THE REFUSAL DOES NOT CONFIRM THE
// CARD EXISTS. The repo's invariant: another user's row is 404, never 403.
func TestRecallCardIsPrivateToItsReader(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	_, ids := seedReviewBook(t, alice, "Dune", 1)
	ageSeededItems(t, srv)
	alice.mustDo("POST", "/review/answer",
		map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusOK)

	bob := addUser(t, h, alice, "bob")
	rec := bob.do("GET", fmt.Sprintf("/review/card?kind=%s&id=%d", kindBook, ids[0]), nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("another reader's recall history answered %d, want 404 (a 403 confirms the card exists): %s", rec.Code, rec.Body)
	}
	// And it is still there for the reader it belongs to — a 404 that came from
	// the row being gone would prove nothing.
	if got := recallCard(t, alice, kindBook, ids[0]); got.Logged != 1 {
		t.Fatalf("the owner's own history has %d answers, want 1", got.Logged)
	}
}

// THE HISTORY IS NEWEST FIRST, AND A LONG ONE IS A WINDOW THAT SAYS HOW MUCH IT
// IS NOT SHOWING.
//
// A reader looking at their own history sees the last thing they did at the top,
// or the panel is lying about the sequence. The answers here are given through
// the API in one burst, so they share a timestamp to the second — which is the
// case that has to come out right without the clock's help.
// TestRecallCardHistoryFollowsTheClock is the other half: rows whose order the
// clock DOES decide, and decides against the order they were written in.
func TestRecallCardHistoryIsNewestFirstAndBounded(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)
	ageSeededItems(t, srv)

	// Alternate got/forgot so the sequence is readable from the results alone,
	// then one distinct answer last so "newest first" is checkable without
	// trusting the timestamps at all.
	const answers = recallHistoryMax + 7
	for i := 0; i < answers-1; i++ {
		res := "got"
		if i%2 == 1 {
			res = "forgot"
		}
		c.mustDo("POST", "/review/answer",
			map[string]any{"kind": kindBook, "id": ids[0], "result": res, "mode": "practice"}, http.StatusOK)
	}
	c.mustDo("POST", "/review/answer",
		map[string]any{"kind": kindBook, "id": ids[0], "result": "skip", "mode": "practice"}, http.StatusOK)

	got := recallCard(t, c, kindBook, ids[0])
	if got.Logged != answers {
		t.Errorf("%d answers were given and the panel counts %d", answers, got.Logged)
	}
	if len(got.History) != recallHistoryMax {
		t.Fatalf("the window returned %d rows for %d answers, want %d — an unbounded history is a whole library in one response",
			len(got.History), answers, recallHistoryMax)
	}
	if got.History[0].Result != "skip" {
		t.Errorf("the newest answer (a skip) is not at the top: got %q — the panel would read as the sequence run backwards",
			got.History[0].Result)
	}
	// And only one skip was given, so the row under it is a different answer.
	if got.History[1].Result == "skip" {
		t.Error("two skips came back where one was given")
	}
	// A SKIP IS IN THE LOG. It is a thing the reader did, it is what the log
	// records, and it is the answer that does NOT move the schedule — so a panel
	// that hid it would make a run of skips look like a gap in the reader's
	// attention rather than a run of skips.
	if got.ReviewCount == answers {
		t.Error("a skip counted as a review — the schedule and the log are not the same ledger")
	}
}

// A CARD KEPT OUT OF THE QUIZ STILL HAS A HISTORY, AND THE PANEL SAYS IT IS OUT.
//
// The two facts are separate and both are needed: hiding the history of an
// excluded card would destroy a record the reader made, and saying "next due in
// 12 days" about a card that will never be asked is false.
func TestRecallCardOfAnExcludedQuote(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)
	ageSeededItems(t, srv)
	c.mustDo("POST", "/review/answer",
		map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusOK)
	c.mustDo("POST", "/annotations/bulk",
		map[string]any{"ids": ids[:1], "review": false}, http.StatusOK)

	got := recallCard(t, c, kindBook, ids[0])
	if !got.Excluded {
		t.Error("a quote kept out of the quiz does not say so, so the panel would promise a review that never comes")
	}
	if got.Logged != 1 || len(got.History) != 1 {
		t.Errorf("excluding a quote hid the answers already given: %d logged, %d shown", got.Logged, len(got.History))
	}
}

// A REQUEST THAT NAMES NOTHING IS REFUSED RATHER THAN ANSWERED ABOUT SOMETHING
// ELSE. `kind` picks which table is read, so an unrecognised one may never fall
// through to a default.
func TestRecallCardRefusesAnUnknownCard(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)

	for _, q := range []string{
		"kind=annotation&id=1", // the table's name, not the review kind
		"kind=&id=1",
		"kind=book",
		"kind=book&id=0",
		"kind=book&id=-3",
		"kind=book&id=notanumber",
	} {
		if rec := c.do("GET", "/review/card?"+q, nil); rec.Code != http.StatusBadRequest {
			t.Errorf("GET /review/card?%s answered %d, want 400: %s", q, rec.Code, rec.Body)
		}
	}
	// An id that is well-formed and simply is not there is a different answer.
	if rec := c.do("GET", fmt.Sprintf("/review/card?kind=book&id=%d", ids[0]+9999), nil); rec.Code != http.StatusNotFound {
		t.Errorf("a card that does not exist answered %d, want 404", rec.Code)
	}
}

// THE GAP BEFORE AN ANSWER IS IN THE LOG, BECAUSE NOTHING ELSE HOLDS IT.
//
// The half-life is a current value; the interval it was earned over is gone the
// moment the next answer overwrites `last_reviewed_at`. It is the one number a
// curve cannot be drawn without, and a reader looking at "12 days" wants to know
// whether they last saw the card a week ago or a year ago.
func TestRecallCardLogsTheIntervalItWasAnsweredOver(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)
	ageSeededItems(t, srv)

	c.mustDo("POST", "/review/answer",
		map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusOK)
	// Twenty days later. `last_touched_at` moves with it or the Daily Quiz treats
	// the second answer as today's repeat and echoes it without writing anything.
	if _, err := srv.Store.DB.Exec(
		`UPDATE item_reviews SET last_reviewed_at = datetime('now', '-20 days'),
		                         last_touched_at = datetime('now', '-20 days')
		  WHERE kind = 'book' AND item_id = ?`, ids[0]); err != nil {
		t.Fatal(err)
	}
	c.mustDo("POST", "/review/answer",
		map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusOK)

	got := recallCard(t, c, kindBook, ids[0])
	if len(got.History) != 2 {
		t.Fatalf("two answers produced %d log rows", len(got.History))
	}
	second, first := got.History[0], got.History[1]
	if first.ElapsedDays != nil {
		t.Errorf("the first answer was given a gap of %v days since a review that never happened", *first.ElapsedDays)
	}
	if second.ElapsedDays == nil {
		t.Fatal("the second answer carries no gap, so the interval it was earned over is lost")
	}
	// Twenty days, give or take the clock ticking during the test.
	if *second.ElapsedDays < 19.9 || *second.ElapsedDays > 20.1 {
		t.Errorf("the gap before the second answer reads %.3f days, want ~20", *second.ElapsedDays)
	}
	// AND THE HALF-LIFE GREW OVER THAT GAP. A log that recorded the interval but
	// not the value it produced could not be drawn as a curve either.
	if second.Stability <= first.Stability {
		t.Errorf("twenty days of remembering did not lengthen the half-life: %v -> %v",
			first.Stability, second.Stability)
	}
}

// PRACTICE AND THE DAILY QUIZ ARE DIFFERENT THINGS AND THE LOG SAYS WHICH.
//
// Practice moves no schedule unless the reader opts in (`srPracticeCounts`, off
// by default). So a reader who practises a card twenty times and then opens the
// panel sees twenty answers beside a half-life that never budged — which reads
// as the scheduler being broken. It is not. The log has to be able to say so,
// and it cannot say it afterwards: whether an answer counted depends on that
// setting AS IT STOOD, and the reader can change it tomorrow.
func TestRecallCardKnowsPracticeFromTheQuiz(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)
	ageSeededItems(t, srv)

	for i := 0; i < 3; i++ {
		c.mustDo("POST", "/review/answer",
			map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "practice"}, http.StatusOK)
	}
	practised := recallCard(t, c, kindBook, ids[0])
	if practised.Logged != 3 {
		t.Fatalf("three practice answers logged as %d", practised.Logged)
	}
	// The premise: they really did move nothing. If this ever stops being true the
	// rest of the test is meaningless, so it is asserted rather than assumed.
	if practised.Reviewed || practised.ReviewCount != 0 {
		t.Fatalf("practice moved the schedule (reviewed=%v count=%d) — the default changed and this test needs rewriting",
			practised.Reviewed, practised.ReviewCount)
	}
	for i, a := range practised.History {
		if a.Mode == nil || *a.Mode != "practice" {
			t.Errorf("history[%d] does not say it was practice: %s", i, modeOf(a))
		}
		if a.Counted == nil || *a.Counted {
			t.Errorf("history[%d] claims a practice answer moved the schedule, which it did not", i)
		}
	}

	c.mustDo("POST", "/review/answer",
		map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusOK)
	quizzed := recallCard(t, c, kindBook, ids[0])
	if !quizzed.Reviewed || quizzed.ReviewCount != 1 {
		t.Fatalf("the quiz answer did not reach the schedule: reviewed=%v count=%d", quizzed.Reviewed, quizzed.ReviewCount)
	}
	newest := quizzed.History[0]
	if newest.Mode == nil || *newest.Mode != "daily" {
		t.Errorf("the quiz answer does not say it was the quiz: %s", modeOf(newest))
	}
	if newest.Counted == nil || !*newest.Counted {
		t.Error("the quiz answer does not say it counted, so nothing in the log explains why the half-life moved on this one and not the three before it")
	}
	// AND A SKIP IS A THING THE READER DID THAT COUNTS FOR NOTHING, in either
	// mode. It belongs in the log — hiding it would turn a run of skips into a gap
	// in the reader's attention — and it may not claim to have moved anything.
	c.mustDo("POST", "/review/answer",
		map[string]any{"kind": kindBook, "id": ids[0], "result": "skip", "mode": "practice"}, http.StatusOK)
	skipped := recallCard(t, c, kindBook, ids[0])
	if skipped.History[0].Result != "skip" {
		t.Fatalf("the skip is not in the log: newest answer is %q", skipped.History[0].Result)
	}
	if skipped.History[0].Counted == nil || *skipped.History[0].Counted {
		t.Error("a skip claims to have moved the schedule")
	}
}

// THE HISTORY IS THE READER'S SEQUENCE, NOT THE TABLE'S.
//
// A log is rows in a table and the order they were written is not necessarily
// the order they happened: an archive restored on a new machine writes them
// afresh, and a clock that moved leaves a row dated before the one before it.
// The panel is a history, so it follows the clock. This is the half of the order
// the burst test cannot reach — there every row shares a timestamp, so the row
// order and the answer order agree by accident.
func TestRecallCardHistoryFollowsTheClock(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)
	ageSeededItems(t, srv)

	// Three answers, each a different result, so each row is identifiable
	// without knowing its id.
	for _, res := range []string{"got", "forgot", "skip"} {
		c.mustDo("POST", "/review/answer",
			map[string]any{"kind": kindBook, "id": ids[0], "result": res, "mode": "practice"}, http.StatusOK)
	}
	// Now date them AGAINST the order they were written: the first answer is the
	// most recent, the last is the oldest.
	for res, days := range map[string]int{"got": 1, "forgot": 30, "skip": 90} {
		if _, err := srv.Store.DB.Exec(
			`UPDATE item_recalls SET answered_at = datetime('now', ?) WHERE kind = 'book' AND item_id = ? AND result = ?`,
			fmt.Sprintf("-%d days", days), ids[0], res); err != nil {
			t.Fatal(err)
		}
	}

	got := recallCard(t, c, kindBook, ids[0])
	var order []string
	for _, a := range got.History {
		order = append(order, a.Result)
	}
	want := []string{"got", "forgot", "skip"} // 1 day, 30 days, 90 days ago
	if len(order) != len(want) {
		t.Fatalf("three answers came back as %v", order)
	}
	for i := range want {
		if order[i] != want[i] {
			t.Fatalf("the history reads %v; the reader answered them in the order that puts %v on the page — the panel is ordering by row rather than by when",
				order, want)
		}
	}
}
