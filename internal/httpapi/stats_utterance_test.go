package httpapi

// Stats over standalone quotes (ROADMAP §24).
//
// Every "how much have I saved" aggregate on this page was a UNION over
// annotations and dialogues: the totals, the favourites, the busiest month, the
// activity calendar, the tag leaderboard, and "collecting since". A kind that
// misses one of them does not fail — it just reports a smaller library than the
// user has, which is the one thing a statistics page must not do. The three
// created_at aggregates now share one helper for that reason, and the tests
// below check each surface separately so a half-added kind cannot hide behind
// the others.

import (
	"net/http"
	"testing"
)

func getStats(t *testing.T, c *testClient) statsResp {
	t.Helper()
	return decode[statsResp](t, c.mustDo("GET", "/stats", nil, http.StatusOK))
}

func TestStatsCountsStandaloneQuotes(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, bose())
	fav := bose()
	fav["quote"] = "Freedom is not given, it is taken"
	fav["favorite"] = true
	newUtterance(t, c, fav)

	st := getStats(t, c)
	if st.Quotes != 2 {
		t.Fatalf("quotes total: %d", st.Quotes)
	}
	// Favourites is one number across every kind, so a missing arm undercounts
	// rather than erroring.
	if st.Favorites != 1 {
		t.Fatalf("favourites did not include the quote: %d", st.Favorites)
	}
}

// The colour card is headed "Highlight colours" and counts itself in "quotes",
// but it only ever counted book annotations. Dialogues have worn a colour since
// 0021 and standalone quotes since 0026, so on a library of films the card read
// "no highlights yet" over a shelf full of coloured lines.
func TestStatsColoursCountEveryKind(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Dune"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "a passage", "color": "blue"}, http.StatusCreated)

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Casablanca"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "here's looking at you", "color": "blue"}, http.StatusCreated)

	q := bose()
	q["color"] = "pink"
	newUtterance(t, c, q)

	st := getStats(t, c)
	if st.Colors["blue"] != 2 {
		t.Fatalf("blue counted %d — the dialogue or the annotation is missing", st.Colors["blue"])
	}
	if st.Colors["pink"] != 1 {
		t.Fatalf("pink counted %d — the standalone quote is missing", st.Colors["pink"])
	}
	if st.Colors["yellow"] != 0 || st.Colors["orange"] != 0 {
		t.Fatalf("unused colours should stay at zero: %+v", st.Colors)
	}
}

func TestStatsColoursAreScopedToTheOwner(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	q := bose()
	q["color"] = "pink"
	newUtterance(t, alice, q)

	if got := getStats(t, bob).Colors["pink"]; got != 0 {
		t.Fatalf("another account's colours reached the chart: %d", got)
	}
}

// A speaker is to a quote what an author is to a book, and an occasion is the
// work. Both are their own breakdown kinds.
func TestStatsBreakdownHasSpeakersAndOccasions(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, bose())
	second := bose()
	second["quote"] = "Freedom is not given, it is taken"
	second["occasion"] = "Singapore rally"
	newUtterance(t, c, second)

	bd := getStats(t, c).Breakdown
	sp, ok := bd["speakers"]
	if !ok {
		t.Fatal("there is no speakers breakdown")
	}
	if sp.Count != 1 || len(sp.Top) != 1 {
		t.Fatalf("speakers: %+v", sp)
	}
	if sp.Top[0].Name != "Subhas Chandra Bose" || sp.Top[0].Quotes != 2 {
		t.Fatalf("speaker row: %+v", sp.Top[0])
	}
	// Two speeches by one person are two works, exactly as two books by one
	// author are.
	if sp.Top[0].Works != 2 {
		t.Fatalf("a speaker's works should count distinct occasions, got %d", sp.Top[0].Works)
	}

	// The occasions breakdown is gone: an occasion is a locator, not somebody you
	// quote, and a list of rallies answers no question the speaker list does not
	// answer better. The speaker's `works` count still counts distinct occasions,
	// which is where that information now lives.
	if _, ok := bd["occasions"]; ok {
		t.Error("the occasions breakdown came back")
	}

	// And the speaker appears in the combined people breakdown too, because a
	// speaker is a person and so is an author.
	pp, ok := bd["people"]
	if !ok {
		t.Fatal("there is no people breakdown")
	}
	if pp.Count == 0 {
		t.Fatalf("people: %+v", pp)
	}
}

// Every one of these aggregates carries its own user scope, because the rows
// have no parent to inherit one from.
func TestStatsQuotesAreScopedToTheOwner(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	body := bose()
	body["tags"] = []string{"freedom"}
	body["favorite"] = true
	u := newUtterance(t, alice, body)
	if _, err := srv.Store.DB.Exec(
		`UPDATE utterances SET created_at = '2026-07-14 09:00:00' WHERE id = ?`, u.ID); err != nil {
		t.Fatal(err)
	}

	st := getStats(t, bob)
	if st.Quotes != 0 {
		t.Errorf("another account's quotes reached the totals: %d", st.Quotes)
	}
	if st.Favorites != 0 {
		t.Errorf("another account's favourites were counted: %d", st.Favorites)
	}
	if st.FirstSaved != nil {
		t.Errorf("another account's history set collecting-since: %q", *st.FirstSaved)
	}
	if st.BusiestMonth != nil {
		t.Errorf("another account's month reached the stats: %+v", st.BusiestMonth)
	}
	if len(st.DailyActivity) != 0 {
		t.Errorf("another account's activity reached the calendar: %+v", st.DailyActivity)
	}
	for _, tg := range st.TopTags {
		if tg.Count != 0 {
			t.Errorf("another account's tag use was counted: %+v", tg)
		}
	}
	if k := st.Breakdown["speakers"]; k.Count != 0 {
		t.Errorf("another account's speakers reached the breakdown: %+v", k.Top)
	}
	if k := st.Breakdown["people"]; k.Count != 0 {
		t.Errorf("another account's people reached the breakdown: %+v", k.Top)
	}
}
