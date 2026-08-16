package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"
)

// createWork posts a movies-table row of the given media_type and returns its id.
// Games are movies rows with media_type 'game' (0040), so they go through the
// ordinary movie handler rather than a new one — the whole point of the design.
func createWork(t *testing.T, c *testClient, title, credit, mediaType string) int64 {
	t.Helper()
	rec := c.mustDo("POST", "/movies", map[string]any{
		"title": title, "director": credit, "media_type": mediaType,
	}, http.StatusCreated)
	var out struct {
		ID        int64  `json:"id"`
		MediaType string `json:"media_type"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode create %q: %v (%s)", title, err, rec.Body)
	}
	if out.MediaType != mediaType {
		t.Fatalf("created %q with media_type %q, want %q", title, out.MediaType, mediaType)
	}
	return out.ID
}

func createGame(t *testing.T, c *testClient, title, studio string) int64 {
	t.Helper()
	return createWork(t, c, title, studio, "game")
}

func createFilm(t *testing.T, c *testClient, title, director string) int64 {
	t.Helper()
	return createWork(t, c, title, director, "movie")
}

func statusOfMovie(t *testing.T, srv *Server, id int64) string {
	t.Helper()
	var s string
	if err := srv.Store.DB.QueryRow(`SELECT status FROM movies WHERE id = ?`, id).Scan(&s); err != nil {
		t.Fatal(err)
	}
	return s
}

func directorOf(t *testing.T, srv *Server, id int64) string {
	t.Helper()
	var d string
	if err := srv.Store.DB.QueryRow(
		`SELECT COALESCE(director, '') FROM movies WHERE id = ?`, id).Scan(&d); err != nil {
		t.Fatal(err)
	}
	return d
}

// TestRenamingADirectorLeavesGameStudiosAlone is hazard 1 of the games design,
// stated as behaviour.
//
// A game's studio lives in movies.director — the same column a film's director
// uses — split only by media_type. Before 0040 every people query read that
// column unfiltered, so renaming a director would have rewritten any game studio
// with the same name, in place, library-wide, with no undo. metadata.ReplaceCredit
// matches a name as a COMPONENT of a joined credit, which is what makes the blast
// radius larger than one row.
//
// The two works here deliberately SHARE a name. A test with distinct names would
// pass against the unfiltered query and prove nothing.
func TestRenamingADirectorLeavesGameStudiosAlone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	const shared = "Hideo Kojima"
	film := createFilm(t, c, "A Documentary", shared)
	game := createGame(t, c, "Death Stranding", shared)

	c.mustDo("POST", "/people/rename", map[string]any{
		"kind": "director", "from": shared, "to": "H. Kojima",
	}, http.StatusOK)

	if got := directorOf(t, srv, film); got != "H. Kojima" {
		t.Errorf("film director = %q, want the rename to have applied", got)
	}
	if got := directorOf(t, srv, game); got != shared {
		t.Errorf("GAME STUDIO = %q, want %q left untouched.\n"+
			"Renaming a director rewrote a game's studio — the two share movies.director\n"+
			"and are separated only by media_type.", got, shared)
	}
}

// The mirror: renaming a studio must not touch a film's director.
func TestRenamingAStudioLeavesFilmDirectorsAlone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	const shared = "Hideo Kojima"
	film := createFilm(t, c, "A Documentary", shared)
	game := createGame(t, c, "Death Stranding", shared)

	c.mustDo("POST", "/people/rename", map[string]any{
		"kind": "studio", "from": shared, "to": "Kojima Productions",
	}, http.StatusOK)

	if got := directorOf(t, srv, game); got != "Kojima Productions" {
		t.Errorf("game studio = %q, want the rename to have applied", got)
	}
	if got := directorOf(t, srv, film); got != shared {
		t.Errorf("FILM DIRECTOR = %q, want %q left untouched", got, shared)
	}
}

// TestPeopleNamesSeparatesDirectorsFromStudios is the other half of hazard 1 —
// the visible one. The Metadata console asks /people/names?kind=director, and an
// unfiltered query answers with every studio in the library, tallied, named as
// directors and offered for renaming. That exact sentence has been written in
// this repo twice before about other kinds.
func TestPeopleNamesSeparatesDirectorsFromStudios(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	createFilm(t, c, "Heat", "Michael Mann")
	createGame(t, c, "Elden Ring", "FromSoftware")

	names := func(kind string) map[string]bool {
		rec := c.mustDo("GET", "/people/names?kind="+kind, nil, http.StatusOK)
		var res struct {
			People []struct {
				Name  string `json:"name"`
				Count int    `json:"count"`
			} `json:"people"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("decode names(%s): %v (%s)", kind, err, rec.Body)
		}
		out := map[string]bool{}
		for _, n := range res.People {
			out[n.Name] = true
		}
		return out
	}

	dirs := names("director")
	if !dirs["Michael Mann"] {
		t.Errorf("directors = %v, want the film's director listed", dirs)
	}
	if dirs["FromSoftware"] {
		t.Errorf("directors = %v — a GAME STUDIO is listed as a director, and is therefore\n"+
			"offered for renaming from the Metadata console.", dirs)
	}

	studios := names("studio")
	if !studios["FromSoftware"] {
		t.Errorf("studios = %v, want the game's studio listed", studios)
	}
	if studios["Michael Mann"] {
		t.Errorf("studios = %v — a film DIRECTOR is listed as a studio.", studios)
	}
}

// TestGameShelfStatusIsPlayed covers hazard 2: shelfCap used to end in
// `default: return 2`, and activeStatus took only the kind — so a game would
// have silently been "watching", capped at two in progress, on the strength of a
// fallthrough rather than a decision.
func TestGameShelfStatusIsPlayed(t *testing.T) {
	if got := activeStatus("movie", "game"); got != StatusPlaying {
		t.Errorf("activeStatus(movie, game) = %q, want %q — a game is played, not watched", got, StatusPlaying)
	}
	if got := activeStatus("movie", "movie"); got != StatusWatching {
		t.Errorf("activeStatus(movie, movie) = %q, want %q", got, StatusWatching)
	}
	if got := activeStatus("movie", "show"); got != StatusWatching {
		t.Errorf("activeStatus(movie, show) = %q, want %q", got, StatusWatching)
	}
	if got := activeStatus("book", ""); got != StatusReading {
		t.Errorf("activeStatus(book) = %q, want %q", got, StatusReading)
	}
	// Every arm is a decision. Asserted as distinct VALUES rather than "not the
	// default", because inheriting the film cap is the failure.
	caps := map[string]int{"book": 5, "show": 5, "game": 3, "movie": 2}
	for mt, want := range caps {
		kind := "movie"
		if mt == "book" {
			kind = "book"
		}
		if got := shelfCap(kind, mt); got != want {
			t.Errorf("shelfCap(%s, %s) = %d, want %d", kind, mt, got, want)
		}
	}
}

// TestSettingAGameToPlaying drives the real endpoint: a game accepts 'playing'
// and refuses 'watching'.
func TestSettingAGameToPlaying(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	game := createGame(t, c, "Hades", "Supergiant Games")

	c.mustDo("PUT", "/movies/"+itoa(game)+"/status", map[string]any{"status": StatusPlaying}, http.StatusOK)
	if got := statusOfMovie(t, srv, game); got != StatusPlaying {
		t.Fatalf("status = %q, want %q", got, StatusPlaying)
	}
	// 'watching' is not a word that applies to a game, and is refused rather than
	// silently stored — a stored 'watching' would sort a game onto the wrong shelf.
	c.mustDo("PUT", "/movies/"+itoa(game)+"/status", map[string]any{"status": StatusWatching}, http.StatusBadRequest)
}

// TestBulkStatusResolvesPerRow covers the mixed selection: one bulk call over a
// film and a game must set each to its OWN in-progress word rather than writing
// the requested literal onto both.
func TestBulkStatusResolvesPerRow(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film := createFilm(t, c, "Heat", "Michael Mann")
	game := createGame(t, c, "Elden Ring", "FromSoftware")

	c.mustDo("POST", "/movies/bulk/status", map[string]any{
		"ids": []int64{film, game}, "status": StatusWatching,
	}, http.StatusOK)

	if got := statusOfMovie(t, srv, film); got != StatusWatching {
		t.Errorf("film status = %q, want %q", got, StatusWatching)
	}
	if got := statusOfMovie(t, srv, game); got != StatusPlaying {
		t.Errorf("game status = %q, want %q — a bulk 'watching' over a mixed selection must\n"+
			"resolve to each row's own word, not write the literal onto a game.", got, StatusPlaying)
	}
}
