package httpapi

// WHAT THIS FILE KNOWS: GET /movies/{id}/episodes and the answer's fields, POST /movies and
// /dialogues to arrange a show with lines, and the one-time pass's effect on a database that
// already held lines (run directly through the store, since the server has booted by then).

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"tippani/internal/store"
)

type episodesBody struct {
	Order    string `json:"order"`
	HasDVD   bool   `json:"has_dvd"`
	Episodes []struct {
		Name       string                                   `json:"name"`
		Quotes     int                                      `json:"quotes"`
		Candidates []string                                 `json:"candidates"`
		Orders     map[string]struct{ Season, Episode int } `json:"orders"`
	} `json:"episodes"`
}

func TestAShowsEpisodesAreListedWithTheirQuoteCountsAndNameCandidates(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	show := c.newScreen("A Show", "show")
	c.newLine(show, "one", map[string]any{"season": 1, "episode": 1, "episode_name": "Pilot"})
	c.newLine(show, "two", map[string]any{"season": 1, "episode": 1, "episode_name": "Pilot"})
	if _, err := srv.Store.DB.Exec(`INSERT INTO episodes (movie_id, name, source) VALUES (?, '', '')`, show); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`INSERT INTO episode_orders (episode_id, kind, season, episode) VALUES (1, 'tv', 1, 1)`); err != nil {
		t.Fatal(err)
	}
	got := decode[episodesBody](t, c.mustDo("GET", "/movies/"+itoa(show)+"/episodes", nil, http.StatusOK))
	if got.Order != "tv" || got.HasDVD || len(got.Episodes) != 1 {
		t.Fatalf("%+v", got)
	}
	e := got.Episodes[0]
	if e.Quotes != 2 || len(e.Candidates) != 1 || e.Candidates[0] != "Pilot" || e.Orders["tv"].Season != 1 {
		t.Fatalf("%+v", e)
	}
}

func TestAFilmHasNoEpisodesAndAnotherReadersShowIsNotFound(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	film := alice.newScreen("A Film", "movie")
	show := alice.newScreen("Alice's Show", "show")
	alice.mustDo("GET", "/movies/"+itoa(film)+"/episodes", nil, http.StatusNotFound)
	bob.mustDo("GET", "/movies/"+itoa(show)+"/episodes", nil, http.StatusNotFound)
	alice.mustDo("GET", "/movies/"+itoa(show)+"/episodes", nil, http.StatusOK)
}

func (c *testClient) putEpisodes(show int64, body map[string]any, want int) *httptest.ResponseRecorder {
	c.t.Helper()
	return c.mustDo("PUT", "/movies/"+itoa(show)+"/episodes", body, want)
}

// A show with two episodes, each with a line, and the episodes made the way the 3.5.0 pass makes them.
func showWithTwoEpisodes(t *testing.T, srv *Server, c *testClient) (show int64, e1, e2, l1, l2 int64) {
	t.Helper()
	show = c.newScreen("A Show", "show")
	l1 = c.newLine(show, "first line", map[string]any{"season": 1, "episode": 1})
	l2 = c.newLine(show, "second line", map[string]any{"season": 1, "episode": 2})
	mk := func(season, episode int) int64 {
		res, err := srv.Store.DB.Exec(`INSERT INTO episodes (movie_id, name, source) VALUES (?, '', '')`, show)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := res.LastInsertId()
		if _, err := srv.Store.DB.Exec(`INSERT INTO episode_orders (episode_id, kind, season, episode) VALUES (?, 'tv', ?, ?)`, id, season, episode); err != nil {
			t.Fatal(err)
		}
		return id
	}
	return show, mk(1, 1), mk(1, 2), l1, l2
}

func lineRow(t *testing.T, srv *Server, id int64) (season, episode int, hash string) {
	t.Helper()
	if err := srv.Store.DB.QueryRow(`SELECT season, episode, dedupe_hash FROM dialogues WHERE id = ?`, id).Scan(&season, &episode, &hash); err != nil {
		t.Fatal(err)
	}
	return
}

func TestRenumberingTheTVOrderNeedsConfirmingThenSwapsTheLinesAndRehashesThem(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	show, e1, e2, l1, l2 := showWithTwoEpisodes(t, srv, c)
	_, _, h1 := lineRow(t, srv, l1)
	_, _, h2 := lineRow(t, srv, l2)
	swap := map[string]any{"order": "tv", "episodes": []map[string]any{
		{"id": e1, "season": 1, "episode": 2}, {"id": e2, "season": 1, "episode": 1}}}

	// Without the reader's yes nothing moves, and the answer says how many would.
	resp := decode[struct {
		Moves int `json:"moves"`
	}](t, c.putEpisodes(show, swap, http.StatusConflict))
	if resp.Moves != 2 {
		t.Fatalf("moves = %d", resp.Moves)
	}
	if s, e, h := lineRow(t, srv, l1); s != 1 || e != 1 || h != h1 {
		t.Fatalf("an unconfirmed save moved a line: %d %d", s, e)
	}

	swap["confirm"] = true
	c.putEpisodes(show, swap, http.StatusOK)
	s1, ep1, nh1 := lineRow(t, srv, l1)
	s2, ep2, nh2 := lineRow(t, srv, l2)
	if s1 != 1 || ep1 != 2 || s2 != 1 || ep2 != 1 {
		t.Fatalf("lines at %d/%d and %d/%d", s1, ep1, s2, ep2)
	}
	// Rehashed for the new place, byte for byte what a line added there would carry.
	one, two := 1, 2
	if nh1 != store.DialogueDedupeHash("first line", &one, &two, "", "") || nh2 != store.DialogueDedupeHash("second line", &one, &one, "", "") || nh1 == h1 || nh2 == h2 {
		t.Fatalf("hashes not rehashed: %q %q", nh1, nh2)
	}
}

func TestARenumberedQuoteThatWouldMeetAnotherIsRefusedAndNothingChanges(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	show, e1, _, l1, _ := showWithTwoEpisodes(t, srv, c)
	// A line already in 1/3 (no episode of its own yet) with the same words as the one in 1/1.
	c.newLine(show, "first line", map[string]any{"season": 1, "episode": 3})
	_, _, before := lineRow(t, srv, l1)
	resp := decode[struct {
		Collisions int `json:"collisions"`
	}](t, c.putEpisodes(show, map[string]any{"order": "tv", "confirm": true, "episodes": []map[string]any{
		{"id": e1, "season": 1, "episode": 3}}}, http.StatusConflict))
	if resp.Collisions != 1 {
		t.Fatalf("collisions = %d", resp.Collisions)
	}
	if s, e, h := lineRow(t, srv, l1); s != 1 || e != 1 || h != before {
		t.Fatalf("a refused save changed the line: %d %d", s, e)
	}
}

func TestSavingTheCustomOrderTouchesNoLineAndTheDVDOrderIsRefused(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bob := addUser(t, h, c, "bob")
	show, e1, e2, l1, l2 := showWithTwoEpisodes(t, srv, c)
	_, _, h1 := lineRow(t, srv, l1)
	_, _, h2 := lineRow(t, srv, l2)
	c.putEpisodes(show, map[string]any{"order": "custom", "episodes": []map[string]any{
		{"id": e1, "name": "Pilot", "season": 3, "episode": 9}, {"id": e2, "season": 3, "episode": 1}}}, http.StatusOK)
	if _, _, got := lineRow(t, srv, l1); got != h1 {
		t.Fatal("custom changed a line's hash")
	}
	if _, _, got := lineRow(t, srv, l2); got != h2 {
		t.Fatal("custom changed a line's hash")
	}
	got := decode[episodesBody](t, c.mustDo("GET", "/movies/"+itoa(show)+"/episodes", nil, http.StatusOK))
	var pilot bool
	for _, e := range got.Episodes {
		if e.Name == "Pilot" && e.Orders["custom"].Season == 3 && e.Orders["custom"].Episode == 9 && e.Orders["tv"].Episode == 1 {
			pilot = true
		}
	}
	if !pilot {
		t.Fatalf("%+v", got)
	}
	// The name is on the line too, so an export still says it.
	var name string
	srv.Store.DB.QueryRow(`SELECT episode_name FROM dialogues WHERE id = ?`, l1).Scan(&name)
	if name != "Pilot" {
		t.Fatalf("line's episode name = %q", name)
	}
	c.putEpisodes(show, map[string]any{"order": "dvd", "episodes": []map[string]any{{"id": e1, "season": 1, "episode": 1}}}, http.StatusBadRequest)
	bob.putEpisodes(show, map[string]any{"order": "custom", "episodes": []map[string]any{}}, http.StatusNotFound)
}

func TestTheEditFormsFullStateSaveLeavesTheEpisodeOrderAlone(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	show := c.newScreen("A Show", "show")
	c.mustDo("PUT", "/movies/"+itoa(show), map[string]any{"title": "A Show", "media_type": "show", "episode_order": "custom"}, http.StatusOK)
	c.mustDo("PUT", "/movies/"+itoa(show), map[string]any{"title": "A Show Renamed", "media_type": "show"}, http.StatusOK)
	var order string
	srv.Store.DB.QueryRow(`SELECT episode_order FROM movies WHERE id = ?`, show).Scan(&order)
	if order != "custom" {
		t.Fatalf("order = %q", order)
	}
	c.mustDo("PUT", "/movies/"+itoa(show), map[string]any{"title": "A Show Renamed", "media_type": "show", "episode_order": "nonsense"}, http.StatusBadRequest)
}

// An episode's own name and a custom numbering exist nowhere else, so a deleted show that comes back
// without them has lost something.
func TestADeletedShowComesBackWithItsEpisodeNamesAndCustomOrder(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	show, e1, e2, _, _ := showWithTwoEpisodes(t, srv, c)
	c.putEpisodes(show, map[string]any{"order": "custom", "episodes": []map[string]any{
		{"id": e1, "name": "Pilot", "season": 5, "episode": 7}, {"id": e2, "season": 5, "episode": 1}}}, http.StatusOK)

	c.mustDo("DELETE", "/movies/"+itoa(show), nil, http.StatusOK)
	var gone int
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM episodes WHERE movie_id = ?`, show).Scan(&gone)
	if gone != 0 {
		t.Fatalf("%d episodes survived the delete", gone)
	}
	bin := binOf(t, c)
	restore(t, c, bin.Trash[0].ID, http.StatusOK)

	got := decode[episodesBody](t, c.mustDo("GET", "/movies/"+itoa(show)+"/episodes", nil, http.StatusOK))
	if len(got.Episodes) != 2 {
		t.Fatalf("%+v", got)
	}
	var named bool
	for _, e := range got.Episodes {
		if e.Name == "Pilot" && e.Orders["custom"].Season == 5 && e.Orders["custom"].Episode == 7 && e.Orders["tv"].Episode == 1 {
			named = true
		}
	}
	if !named {
		t.Fatalf("name and custom order did not come back: %+v", got.Episodes)
	}
}

func TestADeletedAccountComesBackWithItsEpisodes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	show, e1, e2, _, _ := showWithTwoEpisodes(t, srv, bob)
	bob.putEpisodes(show, map[string]any{"order": "custom", "episodes": []map[string]any{
		{"id": e1, "name": "Pilot", "season": 5, "episode": 7}, {"id": e2, "season": 5, "episode": 1}}}, http.StatusOK)
	var bobID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'bob'`).Scan(&bobID); err != nil {
		t.Fatal(err)
	}
	admin.mustDo("DELETE", "/admin/users/"+itoa(bobID), nil, http.StatusOK)
	restore(t, admin, binOf(t, admin).Trash[0].ID, http.StatusOK)

	var names, orders int
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM episodes WHERE movie_id = ? AND name = 'Pilot'`, show).Scan(&names)
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM episode_orders WHERE kind = 'custom' AND season = 5`).Scan(&orders)
	if names != 1 || orders != 2 {
		t.Fatalf("names=%d custom places=%d", names, orders)
	}
}

// A show keeps one subtitle per episode, so deleting one with two of them has to bin both. The bin's
// query for what was read from those files was written for one source and answered "row value
// misused" for two, which failed the delete with a 500 and left the show where it was.
func TestAShowWithTwoEpisodeSubtitlesCanBeDeletedAndComesBack(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	show := c.newScreen("A Show", "show")
	c.newLine(show, "Hello there.", map[string]any{"season": 1, "episode": 1})
	c.newLine(show, "General Kenobi.", map[string]any{"season": 1, "episode": 2})
	c.putSource(sourceFields("screen", show, "episode", "s01e01"), "a.srt", []byte(srtSample)).Result()
	c.putSource(sourceFields("screen", show, "episode", "s01e02"), "b.srt", []byte(srtSample)).Result()
	var files int
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM work_sources WHERE subject_id = ?`, show).Scan(&files)
	if files != 2 {
		t.Fatalf("arranged %d source files, want 2", files)
	}
	c.mustDo("DELETE", "/movies/"+itoa(show), nil, http.StatusOK)
	restore(t, c, binOf(t, c).Trash[0].ID, http.StatusOK)
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM work_sources WHERE subject_id = ?`, show).Scan(&files)
	if files != 2 {
		t.Fatalf("%d source files came back, want 2", files)
	}
}

// A fake TMDB with one show whose episode names the test can change between fetches.
func newEpisodeTMDB(t *testing.T, names map[int]*string, failSeasons *bool) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/tv/77":
			_, _ = w.Write([]byte(`{"id":77,"name":"A Fetched Show","first_air_date":"2002-02-02","seasons":[{"season_number":1}]}`))
		case "/tv/77/season/1":
			if *failSeasons {
				http.Error(w, "down", http.StatusInternalServerError)
				return
			}
			_, _ = w.Write([]byte(`{"episodes":[
				{"episode_number":1,"season_number":1,"name":"` + *names[1] + `","overview":"It begins."},
				{"episode_number":2,"season_number":1,"name":"` + *names[2] + `"}]}`))
		case "/tv/77/episode_groups":
			_, _ = w.Write([]byte(`{"results":[{"id":"d","type":3,"episode_count":2}]}`))
		case "/tv/episode_group/d":
			_, _ = w.Write([]byte(`{"groups":[{"order":1,"episodes":[
				{"season_number":1,"episode_number":2,"order":0},{"season_number":1,"episode_number":1,"order":1}]}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
}

func TestAddingAndRefetchingAShowKeepsTheReadersNamesAndEveryEpisode(t *testing.T) {
	one, two := "Pilot", "Second"
	failing := false
	fake := newEpisodeTMDB(t, map[int]*string{1: &one, 2: &two}, &failing)
	defer fake.Close()
	srv := newTestServer(t)
	srv.TMDB.Key, srv.TMDB.BaseURL = "k", fake.URL
	c := signupAdmin(t, srv.Handler())

	show := idOf(t, c.mustDo("POST", "/movies", map[string]any{"source": "tmdb", "source_id": "77", "media_type": "show"}, http.StatusCreated).Body.Bytes())
	got := decode[episodesBody](t, c.mustDo("GET", "/movies/"+itoa(show)+"/episodes", nil, http.StatusOK))
	if len(got.Episodes) != 2 || !got.HasDVD {
		t.Fatalf("a fetched show has episodes and a dvd order: %+v", got)
	}
	byName := map[string]int{}
	for i, e := range got.Episodes {
		byName[e.Name] = i
	}
	pilot := got.Episodes[byName["Pilot"]]
	if pilot.Orders["tv"].Episode != 1 || pilot.Orders["dvd"].Episode != 2 {
		t.Fatalf("pilot's places: %+v", pilot.Orders)
	}

	// The reader names episode one; the supplier then renames both and the series is fetched again.
	var e1 int64
	srv.Store.DB.QueryRow(`SELECT e.id FROM episodes e JOIN episode_orders o ON o.episode_id = e.id AND o.kind = 'tv' WHERE e.movie_id = ? AND o.episode = 1`, show).Scan(&e1)
	c.putEpisodes(show, map[string]any{"order": "custom", "episodes": []map[string]any{{"id": e1, "name": "My Pilot", "season": 1, "episode": 1}}}, http.StatusOK)
	one, two = "Supplier Pilot", "Supplier Second"
	c.mustDo("PUT", "/movies/"+itoa(show), map[string]any{"title": "A Fetched Show", "media_type": "show", "source": "tmdb", "source_id": "77"}, http.StatusOK)
	names := map[int]string{}
	got = decode[episodesBody](t, c.mustDo("GET", "/movies/"+itoa(show)+"/episodes", nil, http.StatusOK))
	for _, e := range got.Episodes {
		names[e.Orders["tv"].Episode] = e.Name
	}
	if names[1] != "My Pilot" || names[2] != "Supplier Second" {
		t.Fatalf("a refetch must keep the reader's name and take the supplier's other: %v", names)
	}

	// A supplier that will not answer for the seasons must not empty the show.
	failing = true
	c.mustDo("PUT", "/movies/"+itoa(show), map[string]any{"title": "A Fetched Show", "media_type": "show", "source": "tmdb", "source_id": "77"}, http.StatusOK)
	got = decode[episodesBody](t, c.mustDo("GET", "/movies/"+itoa(show)+"/episodes", nil, http.StatusOK))
	if len(got.Episodes) != 2 || !got.HasDVD {
		t.Fatalf("a failed episode fetch emptied the show: %+v", got)
	}
}

// The order a series shows decides how its lines are labelled and in what order they are listed: a
// custom view that only renamed episodes would list them in the tv order under custom numbers.
func TestASeriesShowingItsCustomOrderListsAndLabelsLinesInThatOrder(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	show, e1, e2, l1, l2 := showWithTwoEpisodes(t, srv, c)

	type line struct {
		ID           int64 `json:"id"`
		Season       *int  `json:"season"`
		Episode      *int  `json:"episode"`
		ShownSeason  *int  `json:"shown_season"`
		ShownEpisode *int  `json:"shown_episode"`
	}
	list := func() []line {
		return decode[struct {
			Dialogues []line `json:"dialogues"`
		}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(show), nil, http.StatusOK)).Dialogues
	}
	if got := list(); len(got) != 2 || got[0].ID != l1 || got[0].ShownSeason != nil {
		t.Fatalf("on tv the order is the stored one and nothing is shown: %+v", got)
	}

	// custom puts the second episode first, in another season.
	c.putEpisodes(show, map[string]any{"order": "custom", "episodes": []map[string]any{
		{"id": e1, "season": 2, "episode": 5}, {"id": e2, "season": 2, "episode": 1}}}, http.StatusOK)
	c.mustDo("PUT", "/movies/"+itoa(show), map[string]any{"title": "A Show", "media_type": "show", "episode_order": "custom"}, http.StatusOK)
	got := list()
	if len(got) != 2 || got[0].ID != l2 || got[1].ID != l1 {
		t.Fatalf("the list did not follow the custom order: %+v", got)
	}
	if got[0].ShownSeason == nil || *got[0].ShownSeason != 2 || *got[0].ShownEpisode != 1 || *got[0].Episode != 2 {
		t.Fatalf("shown place or stored place wrong: %+v", got[0])
	}
	// The lines themselves were not touched: tv is still what they hold.
	if s, e, _ := lineRow(t, srv, l2); s != 1 || e != 2 {
		t.Fatalf("a shown order changed a stored line: %d/%d", s, e)
	}

	// Back to tv, and everything reads as before.
	c.mustDo("PUT", "/movies/"+itoa(show), map[string]any{"title": "A Show", "media_type": "show", "episode_order": "tv"}, http.StatusOK)
	if got := list(); got[0].ID != l1 || got[0].ShownSeason != nil {
		t.Fatalf("%+v", got)
	}
}
