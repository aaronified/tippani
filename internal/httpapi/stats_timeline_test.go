package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"
)

// The timeline: when the library's works are FROM.
//
// The activity calendar already answers "when was I reading". This answers "how
// old is what I read", which in a library assembled around old books is a
// different and more interesting shape — and one nothing in the app could show,
// despite every book and film having carried a year since 0001 and 0003.
//
// A quote is dated by its WORK, not by when it was saved. A line copied out of
// the Analects last Tuesday belongs at 479 BCE, not at last Tuesday.

type tlBucket struct {
	Year   int `json:"year"`
	Works  int `json:"works"`
	Quotes int `json:"quotes"`
}

func timelineOf(t *testing.T, c *testClient) map[int]tlBucket {
	t.Helper()
	got := decode[struct {
		Timeline []tlBucket `json:"timeline"`
	}](t, c.mustDo("GET", "/stats", nil, http.StatusOK))
	out := map[int]tlBucket{}
	for _, b := range got.Timeline {
		out[b.Year] = b
	}
	return out
}

func TestTheTimelineDatesAQuoteByItsWork(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// An ancient book with two quotes, and a modern film with one.
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Analects", "published_year": -479, "published_circa": true,
	}, http.StatusCreated))
	for _, q := range []string{"A line", "Another line"} {
		c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID, "quote": q}, http.StatusCreated)
	}
	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Unforgiven", "release_year": 1992,
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "A line from the film",
	}, http.StatusCreated)

	tl := timelineOf(t, c)
	if b := tl[-479]; b.Works != 1 || b.Quotes != 2 {
		t.Errorf("479 BCE: works=%d quotes=%d, want 1/2", b.Works, b.Quotes)
	}
	if b := tl[1992]; b.Works != 1 || b.Quotes != 1 {
		t.Errorf("1992: works=%d quotes=%d, want 1/1", b.Works, b.Quotes)
	}
	// circa never moves anything. It is how a year is written, not which year it
	// is; a "c." that shifted a bucket would put the timeline and the shelf into
	// disagreement about the same book.
	if _, ok := tl[-478]; ok {
		t.Error("an estimate moved the work off its own year")
	}
}

func TestTheTimelineOrdersBCEBeforeCE(t *testing.T) {
	// The whole reason the year columns are INTEGER rather than the partial-date
	// TEXT used elsewhere: -479 must sort before 1992 arithmetically. As text it
	// would not.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	for _, y := range []int{1992, -479, 180, -2100} {
		c.mustDo("POST", "/books", map[string]any{"title": "B", "published_year": y}, http.StatusCreated)
	}
	got := decode[struct {
		Timeline []tlBucket `json:"timeline"`
	}](t, c.mustDo("GET", "/stats", nil, http.StatusOK))
	want := []int{-2100, -479, 180, 1992}
	if len(got.Timeline) != len(want) {
		t.Fatalf("got %d buckets, want %d", len(got.Timeline), len(want))
	}
	for i, y := range want {
		if got.Timeline[i].Year != y {
			t.Fatalf("bucket %d = %d, want %d (order: %+v)", i, got.Timeline[i].Year, y, got.Timeline)
		}
	}
}

func TestAStandaloneQuoteIsDatedByItsOccasion(t *testing.T) {
	// occasion_date is the only date an utterance carries that is about the
	// quote rather than about the saving of it. It is a partial date in TEXT, so
	// the year comes off the front.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newUtterance(t, c, map[string]any{
		"quote": "Give me blood", "speaker": "Bose", "occasion": "A rally", "occasion_date": "1944-07-04",
	})
	newUtterance(t, c, map[string]any{
		"quote": "Year only", "speaker": "Bose", "occasion": "Broadcast", "occasion_date": "1943",
	})
	// No occasion date at all: nothing to place it with.
	newUtterance(t, c, map[string]any{"quote": "Undated", "speaker": "Bose"})

	tl := timelineOf(t, c)
	if b := tl[1944]; b.Quotes != 1 {
		t.Errorf("1944: quotes=%d, want 1", b.Quotes)
	}
	if b := tl[1943]; b.Quotes != 1 {
		t.Errorf("1943: quotes=%d, want 1", b.Quotes)
	}
	if len(tl) != 2 {
		t.Errorf("buckets = %+v, want only the two dated occasions", tl)
	}
}

func TestTheTimelineIsPerUser(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	alice.mustDo("POST", "/books", map[string]any{"title": "Hers", "published_year": 1974}, http.StatusCreated)
	if tl := timelineOf(t, bob); len(tl) != 0 {
		t.Fatalf("alice's shelf reached bob's timeline: %+v", tl)
	}
}

// The person whose quotes you have hearted most.
func TestTheMostFavouritedPerson(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Good Omens", "author": "Neil Gaiman & Terry Pratchett",
	}, http.StatusCreated))
	// Two hearted quotes on a two-author book: both authors get two each.
	for _, q := range []string{"One", "Two"} {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": book.ID, "quote": q, "favorite": true,
		}, http.StatusCreated)
	}
	// One un-hearted quote, which must not count.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Three",
	}, http.StatusCreated)

	// A film where the same person directs and stars, with three hearted lines.
	// Counting both credits would give Eastwood 3 + 3 and hand him the tile.
	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Unforgiven", "director": "Clint Eastwood",
	}, http.StatusCreated))
	for _, q := range []string{"A", "B", "C"} {
		c.mustDo("POST", "/dialogues", map[string]any{
			"movie_id": film.ID, "quote": q, "actor": "Clint Eastwood", "favorite": true,
		}, http.StatusCreated)
	}

	got := decode[struct {
		FavouritePerson *struct {
			Title string `json:"title"`
			Count int    `json:"count"`
		} `json:"favourite_person"`
	}](t, c.mustDo("GET", "/stats", nil, http.StatusOK))
	if got.FavouritePerson == nil {
		t.Fatal("no favourite person")
	}
	if got.FavouritePerson.Title != "Clint Eastwood" || got.FavouritePerson.Count != 3 {
		t.Fatalf("favourite person = %+v, want Clint Eastwood with 3 (not 6)", *got.FavouritePerson)
	}
}

// CHARACTERS ARE THEIR OWN BREAKDOWN, not a relabelled actor list (2.2.0).
//
// The two are not derivable from each other, and the case that settles it is a
// BOOK: a book quote carries a character and no actor at all (0047), so a merged
// list would leave every book quote out of the only section it belongs in. This
// asserts both halves — a film line lands in both lists under different names, and
// a book line lands in characters only.
func TestStatsListsCharactersSeparatelyFromActors(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := createFilm(t, c, "Casablanca", "Michael Curtiz")
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "Here's looking at you, kid.",
		"character": "Rick Blaine", "actor": "Humphrey Bogart",
	}, http.StatusCreated)

	book := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune", "author": "Frank Herbert"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Fear is the mind-killer.", "character": "Paul Atreides",
	}, http.StatusCreated)

	// The breakdown rides inside GET /stats rather than a route of its own.
	res := c.mustDo("GET", "/stats", nil, http.StatusOK)
	var body struct {
		Breakdown map[string]struct {
			Top []struct {
				Name   string `json:"name"`
				Quotes int    `json:"quotes"`
			} `json:"top"`
		} `json:"breakdown"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode stats: %v", err)
	}
	out := body.Breakdown

	names := func(section string) map[string]int {
		m := map[string]int{}
		for _, r := range out[section].Top {
			m[r.Name] = r.Quotes
		}
		return m
	}
	actors, characters := names("actors"), names("characters")

	if _, ok := out["characters"]; !ok {
		t.Fatal("no characters section in the breakdown")
	}
	if characters["Rick Blaine"] == 0 {
		t.Errorf("the film's character is missing from characters: %v", characters)
	}
	if actors["Humphrey Bogart"] == 0 {
		t.Errorf("the actor is missing from actors: %v", actors)
	}
	// The lists must not bleed into each other.
	if _, ok := characters["Humphrey Bogart"]; ok {
		t.Error("an actor appears in the characters list")
	}
	if _, ok := actors["Rick Blaine"]; ok {
		t.Error("a character appears in the actors list")
	}
	// THE BOOK CASE. A character with no actor anywhere, which a merged list loses.
	if characters["Paul Atreides"] == 0 {
		t.Errorf("a book's character is missing from characters: %v", characters)
	}
	if len(actors) != 1 {
		t.Errorf("actors = %v, want only the one film actor — a book has none", actors)
	}
	// And a character is NOT a person: `people` is the actor/director merge and
	// must not have grown a character row.
	for _, r := range out["people"].Top {
		if r.Name == "Rick Blaine" || r.Name == "Paul Atreides" {
			t.Errorf("%q reached the people breakdown; a character has no portrait or page", r.Name)
		}
	}
}

// THE FOUR COUNTS THE NAV ASKS FOR, and why they are on /stats rather than on
// four endpoints of their own.
//
// The rail names each destination with the container and what is inside it —
// boards and their quotes, anthologies and their entries, tags and their
// stickers. Every one of those is a count(*) over an indexed user_id, and the
// shell already calls /stats on load, so they ride the statement it was going to
// run anyway. The alternative was four round trips on every page load and four
// more places for the rail and the screen to disagree.
//
// `anthologies` IS THE ONE WITH A HISTORY. navBadge has read `stats.anthologies`
// since the drawer was written and this endpoint has never sent it, so the row
// has worn no count for its whole life — silently, because the client's null
// guard reads absent as "draw nothing". A test over the payload is what would
// have caught it, and this is that test.
func TestStatsCountsWhatTheNavNames(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// Two boards, and quotes inside one of them. The board count is the Quotes
	// row's left-hand number — the "works" of that screen.
	newBoard(t, c, "Speeches")
	newBoard(t, c, "Proverbs")

	// An anthology with entries across kinds, because anthology_entries carries
	// no user_id of its own and is scoped through its anthology — a join this
	// test exists partly to keep honest.
	ann, dia, utt := threeKinds(t, c)
	a := newAnthology(t, c, "Best of the year")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": ann},
		{"kind": "screen", "item_id": dia},
		{"kind": "utterance", "item_id": utt},
	})

	uploadSticker(t, c, "seal.png", "Gold Seal", pngMagic)

	st := getStats(t, c)
	if st.Boards != 2 {
		t.Errorf("boards=%d, want 2", st.Boards)
	}
	if st.Anthologies != 1 {
		t.Errorf("anthologies=%d, want 1", st.Anthologies)
	}
	if st.AnthologyQuotes != 3 {
		t.Errorf("anthology_quotes=%d, want 3", st.AnthologyQuotes)
	}
	if st.Stickers != 1 {
		t.Errorf("stickers=%d, want 1", st.Stickers)
	}
}

// PER-USER ISOLATION, over the four new counts specifically. Three of them are
// plain user_id filters and one is a join, and the join is the one where a
// missing WHERE would badge one reader's rail with another reader's library.
func TestStatsNavCountsAreScopedToTheOwner(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	newBoard(t, alice, "Hers")
	ann, _, _ := threeKinds(t, alice)
	a := newAnthology(t, alice, "Hers too")
	addEntries(t, alice, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	uploadSticker(t, alice, "seal.png", "Hers", pngMagic)

	st := getStats(t, bob)
	if st.Boards != 0 || st.Anthologies != 0 || st.AnthologyQuotes != 0 || st.Stickers != 0 {
		t.Fatalf("bob sees alice's library: boards=%d anthologies=%d anthology_quotes=%d stickers=%d",
			st.Boards, st.Anthologies, st.AnthologyQuotes, st.Stickers)
	}
	// And the request itself is a plain 200, not a 403 — another reader's rows
	// are absent, never refused.
	alice.mustDo("GET", "/stats", nil, http.StatusOK)
}

// The combined people breakdown.
//
// 0027 already decided this: a person's identity is their NAME, and their roles
// are a set they belong to, written that way precisely because "a speaker is
// very often already an author". The stats never caught up. They asked the
// question four times — authors, directors, actors, speakers — so anyone who
// crosses media was two half-people in two different sections, and no section
// could answer "who do I actually quote most".
//
// The failure mode is quiet. Nothing errors, nothing is empty; the numbers are
// simply each smaller than the truth, in a way you would only catch by adding
// two rows together yourself and wondering why nothing on the page had.

func breakdownRow(t *testing.T, c *testClient, kind, name string) (works, quotes int, found bool) {
	t.Helper()
	for _, r := range getStats(t, c).Breakdown[kind].Top {
		if r.Name == name {
			return r.Works, r.Quotes, true
		}
	}
	return 0, 0, false
}

// One person credited twice over one work is one row holding one work and one
// quote — however the two credits happen to be spelled.
//
// EVERY ROW BUILDS ITS OWN SERVER. Both rows credit the same person, so one
// shared database would hand Eastwood two works and two quotes and break both
// expectations. The merge here is structural, not a wall-clock saving.
func TestCombinedPeopleBreakdownCountsAPersonOnce(t *testing.T) {
	cases := []struct {
		name                  string
		title                 string
		director              string
		actor                 string
		quote                 string
		wantWorks, wantQuotes int
	}{
		{
			// The one place merging the roles can double count. A dialogue is the only
			// quote carrying two credits, and Eastwood directs and stars in the same
			// film — so a naive union would give him two quotes for one line and a
			// leaderboard that rewards holding two jobs.
			name:      "two credits on one work",
			title:     "Unforgiven",
			director:  "Clint Eastwood",
			actor:     "Clint Eastwood",
			quote:     "Deserve's got nothin' to do with it",
			wantWorks: 1, wantQuotes: 1,
		},
		{
			// tallyMap folds case, so the set feeding it must too — otherwise "Clint
			// Eastwood" the director and "clint eastwood" the actor arrive as two people
			// and the double count comes straight back through the side door.
			name:     "the two credits differ only in case",
			title:    "Gran Torino",
			director: "Clint Eastwood",
			actor:    "clint eastwood",
			quote:    "Get off my lawn",
			// The works tally was unasserted before the merge; it is asserted here
			// only because the folded row was confirmed to report 1.
			wantWorks: 1, wantQuotes: 1,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newTestServer(t).Handler()
			c := signupAdmin(t, h)

			film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
				"title": tc.title, "director": tc.director,
			}, http.StatusCreated))
			c.mustDo("POST", "/dialogues", map[string]any{
				"movie_id": film.ID, "quote": tc.quote, "actor": tc.actor,
			}, http.StatusCreated)

			w, q, ok := breakdownRow(t, c, "people", "Clint Eastwood")
			if !ok {
				t.Fatal("Clint Eastwood is missing from the people breakdown")
			}
			if w != tc.wantWorks || q != tc.wantQuotes {
				t.Errorf("people row: works=%d quotes=%d, want %d/%d — one film, one line counted once",
					w, q, tc.wantWorks, tc.wantQuotes)
			}
		})
	}
}

func TestAMultiAuthorCreditStillSplitsIntoPeople(t *testing.T) {
	// The combined map must not become a place where "Gaiman & Pratchett" is one
	// person. It reuses the same credit splitter as every other tally.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Good Omens", "author": "Neil Gaiman & Terry Pratchett",
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "A line",
	}, http.StatusCreated)

	for _, name := range []string{"Neil Gaiman", "Terry Pratchett"} {
		if _, q, ok := breakdownRow(t, c, "people", name); !ok || q != 1 {
			t.Errorf("%s: quotes=%d found=%v", name, q, ok)
		}
	}
	if _, _, ok := breakdownRow(t, c, "people", "Neil Gaiman & Terry Pratchett"); ok {
		t.Error("the joined credit was kept as one person")
	}
}

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
