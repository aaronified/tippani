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

// "Collecting since", the busiest month and the activity calendar all bucket the
// same set of rows by created_at. A library holding nothing but standalone
// quotes must still have a history.
func TestStatsHistoryIncludesQuotes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	u := newUtterance(t, c, bose())
	if _, err := srv.Store.DB.Exec(
		`UPDATE utterances SET created_at = '2026-07-14 09:00:00' WHERE id = ?`, u.ID); err != nil {
		t.Fatal(err)
	}

	st := getStats(t, c)
	if st.FirstSaved == nil || *st.FirstSaved != "2026-07-14" {
		t.Fatal("a quote-only library reported no history")
	}
	if st.BusiestMonth == nil || st.BusiestMonth.Month != "2026-07" || st.BusiestMonth.Count != 1 {
		t.Fatalf("busiest month: %+v", st.BusiestMonth)
	}
	var found bool
	for _, d := range st.DailyActivity {
		if d.Date == "2026-07-14" && d.Count == 1 {
			found = true
		}
	}
	if !found {
		t.Fatalf("the activity calendar has no dot for the day: %+v", st.DailyActivity)
	}
}

// The earliest save wins across all three kinds, so a quote older than every
// annotation has to move the date rather than be ignored.
func TestStatsFirstSavedSpansEveryKind(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Dune"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID, "quote": "a passage"}, http.StatusCreated)
	u := newUtterance(t, c, bose())

	if _, err := srv.Store.DB.Exec(`UPDATE annotations SET created_at = '2026-03-01 09:00:00'`); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(
		`UPDATE utterances SET created_at = '2025-11-02 09:00:00' WHERE id = ?`, u.ID); err != nil {
		t.Fatal(err)
	}

	if got := getStats(t, c).FirstSaved; got == nil || *got != "2025-11-02" {
		t.Fatal("the older quote did not move collecting-since")
	}
}

func TestStatsTagLeaderboardCountsQuotes(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	body := bose()
	body["tags"] = []string{"freedom"}
	newUtterance(t, c, body)

	st := getStats(t, c)
	if len(st.TopTags) != 1 || st.TopTags[0].Name != "freedom" || st.TopTags[0].Count != 1 {
		t.Fatalf("tag leaderboard missed the quote: %+v", st.TopTags)
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

	oc, ok := bd["occasions"]
	if !ok {
		t.Fatal("there is no occasions breakdown")
	}
	if oc.Count != 2 {
		t.Fatalf("occasions: %+v", oc)
	}
}

// A proverb has no speaker and no occasion, so it belongs to no entity — the
// same reason it never enters the review deck. It must not appear as a blank row.
func TestStatsBreakdownSkipsProverbs(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, map[string]any{"quote": "Least said, soonest mended"})

	st := getStats(t, c)
	if st.Quotes != 1 {
		t.Fatalf("the proverb should still be counted in the totals: %d", st.Quotes)
	}
	for _, kind := range []string{"speakers", "occasions"} {
		k := st.Breakdown[kind]
		if k.Count != 0 {
			t.Fatalf("%s gained a nameless row from a proverb: %+v", kind, k.Top)
		}
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
	if k := st.Breakdown["occasions"]; k.Count != 0 {
		t.Errorf("another account's occasions reached the breakdown: %+v", k.Top)
	}
}
