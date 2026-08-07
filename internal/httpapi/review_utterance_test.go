package httpapi

// The review deck's third kind: standalone quotes (ROADMAP §24).
//
// The roadmap claimed "the review deck applies unchanged". It does not, and the
// two places it doesn't are what most of this file is about.
//
// First, the deck's whole question is "where is this from?" — and a standalone
// quote has no parent row to take a title from. Its source is the occasion, or
// the speaker when the occasion went unrecorded, and a quote with neither is not
// reviewable at all. That last part is the interesting one: it makes this the
// only kind whose pool is smaller than its table.
//
// Second, five queries have to agree on which rows those are — the two deck
// buckets, the badge count, the status tally, and the Stats half-life. They used
// to agree by being copies of each other. A copy that is only ALMOST updated
// shows up as a badge promising a card the deck won't serve, so the tests below
// check the counts against the deck rather than against a number I typed in.

import (
	"net/http"
	"testing"
)

// seedReviewQuotes adds n standalone quotes attributed to one speaker on one
// occasion, and returns their ids.
func seedReviewQuotes(t *testing.T, c *testClient, speaker, occasion string, n int) []int64 {
	t.Helper()
	ids := make([]int64, 0, n)
	for i := 0; i < n; i++ {
		u := newUtterance(t, c, map[string]any{
			"quote":    occasion + " line " + itoa(int64(i)),
			"speaker":  speaker,
			"occasion": occasion,
		})
		ids = append(ids, u.ID)
	}
	return ids
}

// ---- what a quote's "work" is ----

func TestUtteranceAttribution(t *testing.T) {
	cases := []struct{ speaker, occasion, want string }{
		{"Subhas Chandra Bose", "Burma Radio broadcast", "Burma Radio broadcast"}, // the occasion is the work
		{"Subhas Chandra Bose", "", "Subhas Chandra Bose"},                        // no occasion: the speaker stands in
		{"", "Burma Radio broadcast", "Burma Radio broadcast"},                    // an unattributed speech is still a speech
		{"  Bose  ", "   ", "Bose"},                                               // whitespace is not an occasion
		{"", "", ""},                                                              // a proverb belongs to nothing
	}
	for _, tc := range cases {
		if got := utteranceAttribution(tc.speaker, tc.occasion); got != tc.want {
			t.Errorf("utteranceAttribution(%q, %q) = %q, want %q", tc.speaker, tc.occasion, got, tc.want)
		}
	}
}

// Two spellings of one speech must be ONE work, or the deck will offer a speech
// as its own wrong answer — the option list would show the same event twice and
// both would be correct.
func TestUtteranceWorkKeyFoldsSpelling(t *testing.T) {
	a := utteranceWorkKey("Bose", "Burma Radio broadcast")
	b := utteranceWorkKey("Bose", "burma   radio  BROADCAST ")
	if a != b {
		t.Fatalf("one speech became two works: %q vs %q", a, b)
	}
	if a == "" {
		t.Fatal("an attributed quote must have a work key")
	}
	if utteranceWorkKey("", "") != "" {
		t.Fatal("a proverb must have no work key — it would group every proverb into one work")
	}
	// Two different speeches by the same person stay distinct: they are exactly
	// the pair the deck most wants to be able to tell apart.
	if utteranceWorkKey("Bose", "Singapore rally") == a {
		t.Fatal("two speeches by one speaker collapsed into one work")
	}
}

// ---- the deck ----

func TestPracticeServesStandaloneQuotes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	seedReviewQuotes(t, c, "Subhas Chandra Bose", "Burma Radio broadcast", 2)
	seedReviewQuotes(t, c, "Franklin D. Roosevelt", "first inaugural address", 2)
	ageSeededItems(t, srv)

	deck := decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
	if len(deck.Items) != 4 {
		t.Fatalf("expected four cards, got %d", len(deck.Items))
	}
	var sawSource, sawQuote bool
	for _, card := range deck.Items {
		if card.Kind != kindUtterance {
			t.Fatalf("wrong kind: %q", card.Kind)
		}
		// Title is what a "source" card asks for, so it must be the occasion —
		// not blank, and not the speaker while an occasion exists.
		if card.Title != "Burma Radio broadcast" && card.Title != "first inaugural address" {
			t.Fatalf("card title is not the occasion: %q", card.Title)
		}
		if card.Speaker == "" {
			t.Fatal("the speaker did not reach the card")
		}
		if len(card.Options) < 2 {
			t.Fatalf("a card with no wrong answer is not a question: %+v", card.Options)
		}
		switch card.Direction {
		case dirSource:
			sawSource = true
			// The answer is the occasion the quote came from.
			if card.Options[card.Answer] != card.Title {
				t.Fatalf("source card's answer is not its own occasion: %q vs %q",
					card.Options[card.Answer], card.Title)
			}
		case dirQuote:
			sawQuote = true
			if card.Options[card.Answer] != card.Quote {
				t.Fatalf("quote card's answer is not its own quote: %q vs %q",
					card.Options[card.Answer], card.Quote)
			}
		}
	}
	if !sawSource && !sawQuote {
		t.Fatal("no card carried a direction")
	}
}

// A proverb — no speaker, no occasion — has nothing to recall but the words
// already printed on the card. It must be absent from the deck AND from every
// count beside it. The counts are the point: a status tally that includes a card
// the deck will never serve leaves a quote permanently "unseen".
func TestProverbsAreNotReviewable(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	seedReviewQuotes(t, c, "Subhas Chandra Bose", "Burma Radio broadcast", 1)
	seedReviewQuotes(t, c, "Franklin D. Roosevelt", "first inaugural address", 1)
	newUtterance(t, c, map[string]any{"quote": "Least said, soonest mended"})
	newUtterance(t, c, map[string]any{"quote": "A stitch in time saves nine"})
	ageSeededItems(t, srv)

	// Four quotes stored, two reviewable.
	list := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 4 {
		t.Fatalf("expected four stored quotes, got %d", len(list.Utterances))
	}

	deck := decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
	if len(deck.Items) != 2 {
		t.Fatalf("the deck should hold only the two attributed quotes, got %d", len(deck.Items))
	}
	for _, card := range deck.Items {
		if card.Title == "" {
			t.Fatal("a card with no source reached the deck")
		}
	}

	// And the tally agrees. This is the assertion that catches a WHERE clause
	// updated in the candidate query but not in reviewStates.
	scores := decode[scoresResp](t, c.mustDo("GET", "/review/scores", nil, 200))
	if scores.States.Total != 2 {
		t.Fatalf("status tally counted %d quotes, deck holds 2 — the two queries disagree", scores.States.Total)
	}
}

// The badge and the deck are computed by different queries over the same rule,
// so they are checked against each other rather than against a fixed number.
func TestDailyRemainingAgreesWithTheDeck(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	seedReviewQuotes(t, c, "Subhas Chandra Bose", "Burma Radio broadcast", 2)
	seedReviewQuotes(t, c, "Franklin D. Roosevelt", "first inaugural address", 2)
	newUtterance(t, c, map[string]any{"quote": "Least said, soonest mended"}) // never eligible
	ageSeededItems(t, srv)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) == 0 {
		t.Fatal("no standalone quote reached the daily deck")
	}
	scores := decode[scoresResp](t, c.mustDo("GET", "/review/scores", nil, 200))
	if scores.Daily.Remaining != len(deck.Items) {
		t.Fatalf("badge says %d due, deck serves %d", scores.Daily.Remaining, len(deck.Items))
	}
	if scores.States.Total != 4 {
		t.Fatalf("tally counted %d, expected the 4 attributed quotes", scores.States.Total)
	}
}

// ---- answering ----

func TestAnsweringAStandaloneQuoteMovesItsSchedule(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	ids := seedReviewQuotes(t, c, "Subhas Chandra Bose", "Burma Radio broadcast", 2)
	seedReviewQuotes(t, c, "Franklin D. Roosevelt", "first inaugural address", 1)
	ageSeededItems(t, srv)

	got := answer(t, c, kindUtterance, ids[0], "got", "daily")
	if got.Stability != reviewMinStability {
		t.Fatalf("a first correct recall should take the 7-day rung, got %v", got.Stability)
	}
	if got.Status != "remembered" {
		t.Fatalf("status after a correct recall: %q", got.Status)
	}

	// And it is recorded against the right kind, not against an annotation that
	// happens to share the id.
	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT count(*) FROM item_reviews WHERE kind = 'utterance' AND item_id = ?`, ids[0]).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("expected one utterance schedule row, got %d", n)
	}

	// A lapse is decisive whatever the clock says. (A second card, because the
	// Daily Quiz treats a same-day repeat as a no-op echo.)
	forgot := answer(t, c, kindUtterance, ids[1], "forgot", "daily")
	if forgot.Status != "probably-forgotten" {
		t.Fatalf("a lapse should read probably-forgotten, got %q", forgot.Status)
	}
}

// Practice is study without distortion unless the user opts in — the third kind
// must inherit that, not quietly become the one kind practice grades.
func TestPracticeDoesNotMoveAQuotesSchedule(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	ids := seedReviewQuotes(t, c, "Subhas Chandra Bose", "Burma Radio broadcast", 1)
	seedReviewQuotes(t, c, "Franklin D. Roosevelt", "first inaugural address", 1)
	ageSeededItems(t, srv)

	answer(t, c, kindUtterance, ids[0], "forgot", "practice")
	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT count(*) FROM item_reviews WHERE kind = 'utterance' AND item_id = ?`, ids[0]).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("practice created a schedule row with srPracticeCounts off")
	}

	// Opted in, the same answer counts.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srPracticeCounts": true}, 200)
	res := answer(t, c, kindUtterance, ids[0], "forgot", "practice")
	if res.Status != "probably-forgotten" {
		t.Fatalf("an opted-in practice lapse should land: %q", res.Status)
	}
}

// Someone else's quote is indistinguishable from a missing one — the review
// endpoints are a write path onto a parentless table, so ownsItem is the only
// thing between them and another account's row.
func TestReviewAnswerOwnershipForQuotes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	ids := seedReviewQuotes(t, alice, "Subhas Chandra Bose", "Burma Radio broadcast", 1)

	bob.mustDo("POST", "/review/answer",
		map[string]any{"kind": kindUtterance, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusNotFound)
	bob.mustDo("POST", "/review/seen",
		map[string]any{"kind": kindUtterance, "id": ids[0]}, http.StatusNotFound)

	var n int
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM item_reviews WHERE kind = 'utterance'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("a stranger's answer reached the schedule")
	}
}

// ownsItem used to default to annotations for any kind it did not recognise, so
// an unknown kind would have been checked against — and could have authorised a
// write to — a completely different table.
func TestOwnsItemRejectsUnknownKinds(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	_, ids := seedReviewBook(t, c, "Dune", 1)
	uid := int64(1)

	ok, err := srv.ownsItem(uid, kindBook, ids[0])
	if err != nil || !ok {
		t.Fatalf("the owner should own their own annotation: ok=%v err=%v", ok, err)
	}
	// Same id, a kind nobody serves. It must not fall through to annotations.
	ok, err = srv.ownsItem(uid, "annotation", ids[0])
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("an unrecognised kind was resolved against the annotations table")
	}
}

func TestReviewAnswerRejectsUnknownKind(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/review/answer",
		map[string]any{"kind": "utterances", "id": 1, "result": "got", "mode": "daily"}, http.StatusBadRequest)
	c.mustDo("POST", "/review/seen", map[string]any{"kind": "quote", "id": 1}, http.StatusBadRequest)
}

// ---- scope ----

// Every narrow scope must exclude the other two media, and "both" must include
// all three — it predates the third kind, so an existing account would otherwise
// never see a standalone quote in its deck.
func TestReviewScopeCoversTheThirdKind(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	seedReviewBook(t, c, "Dune", 2)
	seedReviewBook(t, c, "Emma", 2)
	seedReviewQuotes(t, c, "Subhas Chandra Bose", "Burma Radio broadcast", 2)
	seedReviewQuotes(t, c, "Franklin D. Roosevelt", "first inaugural address", 2)
	ageSeededItems(t, srv)

	kindsInDeck := func(scope string) map[string]int {
		t.Helper()
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": scope}, 200)
		deck := decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
		out := map[string]int{}
		for _, card := range deck.Items {
			out[card.Kind]++
		}
		return out
	}

	if got := kindsInDeck("books"); got[kindUtterance] != 0 || got[kindBook] != 4 {
		t.Fatalf(`scope "books": %v`, got)
	}
	if got := kindsInDeck("quotes"); got[kindBook] != 0 || got[kindUtterance] != 4 {
		t.Fatalf(`scope "quotes": %v`, got)
	}
	if got := kindsInDeck("both"); got[kindBook] != 4 || got[kindUtterance] != 4 {
		t.Fatalf(`scope "both" must mean all three media: %v`, got)
	}

	// The status tally follows the scope too — it is rendered next to the deck.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": "quotes"}, 200)
	scores := decode[scoresResp](t, c.mustDo("GET", "/review/scores", nil, 200))
	if scores.States.Total != 4 {
		t.Fatalf(`scope "quotes" tally counted %d, expected 4`, scores.States.Total)
	}
}

func TestReviewScopeRejectsNonsense(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": "utterances"}, http.StatusBadRequest)
}

// ---- Stats ----

type statsRecallResp struct {
	Recall struct {
		Reviewed int          `json:"reviewed"`
		States   statusCounts `json:"states"`
		HalfLife float64      `json:"avg_half_life"`
	} `json:"recall"`
}

// The Stats "Memory" card reports on the whole library regardless of the deck's
// scope, and its half-life average is a separate query with one ownership arm
// per kind. A kind missing from that list shrinks the average silently.
func TestStatsRecallCountsStandaloneQuotes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	ids := seedReviewQuotes(t, c, "Subhas Chandra Bose", "Burma Radio broadcast", 1)
	seedReviewQuotes(t, c, "Franklin D. Roosevelt", "first inaugural address", 1)
	ageSeededItems(t, srv)
	answer(t, c, kindUtterance, ids[0], "got", "daily")

	stats := decode[statsRecallResp](t, c.mustDo("GET", "/stats", nil, 200))
	if stats.Recall.Reviewed != 1 {
		t.Fatalf("the answered quote is missing from the reviewed count: %d", stats.Recall.Reviewed)
	}
	if stats.Recall.HalfLife != reviewMinStability {
		t.Fatalf("average half-life %v, expected the 7-day rung", stats.Recall.HalfLife)
	}
	if stats.Recall.States.Total != 2 {
		t.Fatalf("library-wide tally counted %d, expected 2", stats.Recall.States.Total)
	}
}

// ---- distractors ----

// Two speeches by the same person are the hard pair, so the speaker plays the
// author's role in the distractor ranking.
func TestQuoteDistractorsPreferTheSameSpeaker(t *testing.T) {
	own := workRef{key: "utterance:burma radio broadcast", kind: kindUtterance,
		title: "Burma Radio broadcast", author: "Subhas Chandra Bose"}
	sameSpeaker := workRef{key: "utterance:singapore rally", kind: kindUtterance,
		title: "Singapore rally", author: "Subhas Chandra Bose"}
	otherSpeaker := workRef{key: "utterance:first inaugural address", kind: kindUtterance,
		title: "first inaugural address", author: "Franklin D. Roosevelt"}
	aBook := workRef{key: "book:1", kind: kindBook, title: "Dune", author: "Frank Herbert"}

	if distractorScore(own, sameSpeaker) <= distractorScore(own, otherSpeaker) {
		t.Fatal("another speech by the same speaker should be the better distractor")
	}
	if distractorScore(own, otherSpeaker) <= distractorScore(own, aBook) {
		t.Fatal("another speech should outrank a book")
	}
	if distractorScore(own, own) != -1 {
		t.Fatal("a work must never be offered as its own wrong answer")
	}
}

// A quote titled by its speaker (no occasion) must not also carry that speaker
// as its option chip — the option would read "Bose" with "Bose" underneath.
func TestQuoteOptionChipDoesNotRepeatTheTitle(t *testing.T) {
	titled := workRef{kind: kindUtterance, title: "Burma Radio broadcast", author: "Subhas Chandra Bose"}
	if p := titled.person(); p.Person != "Subhas Chandra Bose" || p.Kind != "speaker" {
		t.Fatalf("a speech should credit its speaker: %+v", p)
	}
	bare := workRef{kind: kindUtterance, title: "Subhas Chandra Bose", author: "Subhas Chandra Bose"}
	if p := bare.person(); p.Person != "" {
		t.Fatalf("the chip repeated the option text: %+v", p)
	}
}

// ---- seeing ----

// Favouriting is a "seeing" event for the other two kinds; a quote with no
// parent should not quietly be the one kind it isn't.
func TestFavouritingAQuoteCountsAsSeeing(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srSeen": 1.5}, 200)

	ids := seedReviewQuotes(t, c, "Subhas Chandra Bose", "Burma Radio broadcast", 1)
	seedReviewQuotes(t, c, "Franklin D. Roosevelt", "first inaugural address", 1)
	ageSeededItems(t, srv)
	answer(t, c, kindUtterance, ids[0], "got", "daily") // gets it onto the ladder at 7

	body := map[string]any{
		"quote": "Burma Radio broadcast line 0", "speaker": "Subhas Chandra Bose",
		"occasion": "Burma Radio broadcast", "favorite": true,
	}
	c.mustDo("PUT", "/quotes/"+itoa(ids[0]), body, http.StatusOK)

	var stability float64
	if err := srv.Store.DB.QueryRow(
		`SELECT stability FROM item_reviews WHERE kind = 'utterance' AND item_id = ?`, ids[0]).Scan(&stability); err != nil {
		t.Fatal(err)
	}
	if stability <= reviewMinStability {
		t.Fatalf("favouriting did not count as seeing: stability still %v", stability)
	}

	// Re-saving an already-favourite quote must not re-credit it.
	c.mustDo("PUT", "/quotes/"+itoa(ids[0]), body, http.StatusOK)
	var again float64
	if err := srv.Store.DB.QueryRow(
		`SELECT stability FROM item_reviews WHERE kind = 'utterance' AND item_id = ?`, ids[0]).Scan(&again); err != nil {
		t.Fatal(err)
	}
	if again != stability {
		t.Fatalf("re-saving a favourite credited it again: %v -> %v", stability, again)
	}
}
