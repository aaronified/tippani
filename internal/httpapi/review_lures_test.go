package httpapi

// THE ROUND'S SAME-AUTHOR ALLOWANCE, MEASURED OVER A WHOLE DECK.
//
// WHY A DECK AND NOT A RANKING. distractorScore rewards a same-author candidate
// above every other kind of similarity, so on a shelf with one well-represented
// author it wins nearly every card — and the reader meets the same four titles
// all round. That is not a closer question, it is one question. The promise in
// docs/plans/spaced-repetition-difficulty.md is a CAP on the round ("at most one
// card in three draws a same-author lure"), and a cap is only observable across
// cards. A test that asked one ranking function could not see it at all, and a
// test that asked whether the bonus was withheld would have passed the first
// attempt at this, which withheld the bonus and still let a shuffle put a
// same-author title in the options about half the time.
//
// SO THIS COUNTS OPTIONS ON A DECK FROM THE ENDPOINT, and maps title to author
// from the fixture it seeded rather than from anything the server sends — the
// option payload carries a title and a cover, not a credit, and a test that
// needed the server to volunteer the author would be testing the fix's own
// plumbing.

import (
	"fmt"
	"net/http"
	"testing"
)

// seedAuthoredBook is seedReviewBook with a credit, which is the whole point
// here: the shared helper posts a title alone, so every workRef it builds has an
// empty author and the same-author term in distractorScore can never fire.
func seedAuthoredBook(t *testing.T, c *testClient, title, author string, n int) []int64 {
	t.Helper()
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": title, "author": author}, http.StatusCreated))
	ids := make([]int64, 0, n)
	for i := 0; i < n; i++ {
		a := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
			"book_id": book.ID,
			"quote": fmt.Sprintf(
				"%s passage %d: the sleeper must awaken and the spice must flow across the desert", title, i),
		}, http.StatusCreated))
		ids = append(ids, a.ID)
	}
	return ids
}

// parkItems puts a quote in the DISTRACTOR POOL but not in the deck — a long
// half-life, touched today, exactly what seedDistractorBook does for one row.
//
// IT IS THE HALF OF THE FIXTURE THAT MAKES THE MEASUREMENT MEAN ANYTHING. Without
// it the other authors' quotes come due too, so the deck is a mix of credits, and
// "did this card offer a lure by its own author" stops being one question.
func parkItems(t *testing.T, srv *Server, ids []int64) {
	t.Helper()
	for _, id := range ids {
		if _, err := srv.Store.DB.Exec(`INSERT INTO item_reviews
			(kind, item_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
			VALUES ('book', ?, 100, 1, 'got', datetime('now'), datetime('now'))`, id); err != nil {
			t.Fatal(err)
		}
	}
}

func TestAtMostOneCardInThreeOffersALureByTheAnswersOwnAuthor(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	// THE SHELF THIS IS ABOUT: one author the reader keeps a lot of, and enough
	// other books that a card has somewhere else to draw from. Every due card is
	// by Le Guin, so on every one of them a same-author lure is available and the
	// only thing that can stop it is the quota.
	const own = "Ursula K. Le Guin"
	byOwn := []string{"A Wizard of Earthsea", "The Tombs of Atuan", "The Farthest Shore", "The Dispossessed"}
	title2author := map[string]string{}
	for _, ti := range byOwn {
		seedAuthoredBook(t, c, ti, own, 3)
		title2author[ti] = own
	}
	var parked []int64
	for i, other := range []string{"Dune", "Solaris", "Emma", "Kindred", "Ubik", "Roadside Picnic"} {
		a := fmt.Sprintf("Author %d", i)
		parked = append(parked, seedAuthoredBook(t, c, other, a, 1)...)
		title2author[other] = a
	}
	ageSeededItems(t, srv)
	parkItems(t, srv, parked)

	// "WHICH BOOK IS THIS FROM?" ONLY, so every option is a title and the count
	// below is reading the thing the quota governs. The largest deck the quota
	// clamp allows, so thirds are worth counting.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srQuestions": `{"daily":["source"]}`, "srDaily": 10, "srTier": tierMedium}, http.StatusOK)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) < 6 {
		t.Fatalf("deck of %d cards is too short to measure a one-in-three cap", len(deck.Items))
	}

	withLure, checked := 0, 0
	for _, card := range deck.Items {
		if card.Direction != dirSource {
			continue
		}
		mine := title2author[card.Title]
		if mine != own {
			t.Fatalf("card %q is by %q — every due card in this fixture should be %s's", card.Title, mine, own)
		}
		checked++
		for i, opt := range card.Options {
			if i == card.Answer {
				continue
			}
			if title2author[opt] == own {
				withLure++
				break
			}
		}
	}
	if checked == 0 {
		t.Fatal(`the deck served no "which book?" cards, so nothing here was measured`)
	}

	// THE CAP. Ceiling division, because a deck of four may honestly carry two:
	// cards 0 and 3 both hold the allowance.
	cap := (checked + authorLurePeriod - 1) / authorLurePeriod
	if withLure > cap {
		t.Errorf("%d of %d cards offered a wrong answer by %s — at most %d may, and a reader who meets "+
			"the same author on every card is being asked one question rather than a closer one",
			withLure, checked, own, cap)
	}
	// AND IT IS A CAP, NOT A BAN. Removing same-author lures altogether would pass
	// the assertion above and lose the closest legitimate wrong answer the library
	// has — which is the thing distractorScore exists to find.
	if withLure == 0 {
		t.Errorf("no card in a deck of %d offered a wrong answer by %s, though three of that author's "+
			"other books were on the shelf — the quota has become a ban", checked, own)
	}
}

// AND A SHELF WITH NOTHING ELSE ON IT STILL GETS ITS QUESTION.
//
// The cap demotes a same-author candidate rather than excluding it, and this is
// the case that distinguishes the two: every book here is by one author, so an
// exclusion would leave "which book?" with one option and the card would be
// dropped from a deck that dailyRemaining had already counted — the badge-says-
// due-and-deck-serves-nothing failure buildQuestion's own comment records.
func TestAOneAuthorShelfStillOffersAChoice(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	for _, ti := range []string{"A Wizard of Earthsea", "The Tombs of Atuan", "The Farthest Shore"} {
		seedAuthoredBook(t, c, ti, "Ursula K. Le Guin", 3)
	}
	ageSeededItems(t, srv)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srQuestions": `{"daily":["source"]}`, "srDaily": 10, "srTier": tierMedium}, http.StatusOK)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) == 0 {
		t.Fatal("a shelf of three books by one author served an empty deck")
	}
	for i, card := range deck.Items {
		if card.Direction != dirSource {
			continue
		}
		if len(card.Options) < 2 {
			t.Fatalf("card %d (%q) offers %d options — a one-author shelf must still be asked, "+
				"so the quota demotes rather than excludes", i, card.Title, len(card.Options))
		}
	}
}
