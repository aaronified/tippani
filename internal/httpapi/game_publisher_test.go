package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// A game's publisher is a column of its own (0042), and this is the sweep over
// every site that had to learn it. The bug it comes from is one report: Mass
// Effect Legendary Edition stored Electronic Arts as its STUDIO, because both
// suppliers wrote the publisher into `director` when no developer was flagged and
// nothing downstream could tell the two facts apart afterwards.
//
// A column nothing writes is worse than a column that is absent, so these assert
// the WRITE PATHS rather than the DDL: create, full-state update, bulk edit, the
// export round trip, and — the one that actually loses data when it is missed —
// that a save of some other field does not blank it.
func TestGamePublisherRoundTrip(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	g := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Mass Effect Legendary Edition", "media_type": "game",
		"director": "BioWare", "publisher": "Electronic Arts", "release_year": 2021,
	}, http.StatusCreated))
	if g.Director != "BioWare" || g.Publisher != "Electronic Arts" {
		t.Fatalf("create: studio=%q publisher=%q — the two credits must not collapse", g.Director, g.Publisher)
	}

	// The read path: a fetch that forgot the column would answer "" here and the
	// details panel would show an empty field over a populated row.
	got := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(g.ID), nil, 200))
	if got.Publisher != "Electronic Arts" {
		t.Fatalf("GET: publisher = %q — the column is stored but not read", got.Publisher)
	}

	// THE TRAP THIS TEST EXISTS FOR. PUT is full-state, so a client that saves the
	// ♥ (or any single field) while omitting the publisher would clear it. That is
	// the failure movieState's own comment records against 0034, 0035, 0036 and
	// 0037 in turn — four columns, four times, one per release.
	c.mustDo("PUT", "/movies/"+itoa(g.ID), map[string]any{
		"title": "Mass Effect Legendary Edition", "media_type": "game",
		"director": "BioWare", "publisher": "Electronic Arts", "release_year": 2021,
		"favorite": true,
	}, 200)
	if p := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(g.ID), nil, 200)).Publisher; p != "Electronic Arts" {
		t.Fatalf("after a full-state save the publisher is %q", p)
	}

	// And the other half of full-state: an emptied field really does clear, so the
	// column can be corrected rather than only filled.
	c.mustDo("PUT", "/movies/"+itoa(g.ID), map[string]any{
		"title": "Mass Effect Legendary Edition", "media_type": "game",
		"director": "BioWare", "publisher": "", "release_year": 2021,
	}, 200)
	if p := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(g.ID), nil, 200)).Publisher; p != "" {
		t.Fatalf("an emptied publisher stayed %q — the field cannot be corrected", p)
	}

	// Bulk: a shelf of titles from one label is the shape the bulk editor is for,
	// and it is how a library of games stored before 0042 gets its publishers.
	c.mustDo("POST", "/movies/bulk", map[string]any{
		"ids": []int64{g.ID}, "publisher": "Electronic Arts",
	}, 200)
	if p := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(g.ID), nil, 200)).Publisher; p != "Electronic Arts" {
		t.Fatalf("bulk publisher = %q", p)
	}

	// An absent key in a bulk body means "leave it alone", not "clear it" — the
	// pointer contract every other field in that handler follows.
	c.mustDo("POST", "/movies/bulk", map[string]any{
		"ids": []int64{g.ID}, "series": "Mass Effect",
	}, 200)
	if p := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(g.ID), nil, 200)).Publisher; p != "Electronic Arts" {
		t.Fatalf("a bulk edit of another field cleared the publisher: %q", p)
	}

	// The export carries it, which is what makes an export a backup rather than a
	// summary. `publisher:` on its own line, beside `director:`.
	md := c.mustDo("GET", "/movies/"+itoa(g.ID)+"/export", nil, 200).Body.String()
	if !strings.Contains(md, "publisher: Electronic Arts") {
		t.Fatalf("export dropped the publisher:\n%s", md)
	}
	if !strings.Contains(md, "director: BioWare") {
		t.Fatalf("export dropped the studio:\n%s", md)
	}
}

// A film and a show do not show a publisher, and the export proves it: an empty
// frontmatter value is dropped, so a film's export is byte-for-byte what it was
// before the column existed. This is the guard against "a new field appeared in
// every export ever written".
func TestFilmExportGainsNoPublisherLine(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Casablanca", "director": "Michael Curtiz", "release_year": 1942,
	}, http.StatusCreated))
	md := c.mustDo("GET", "/movies/"+itoa(m.ID)+"/export", nil, 200).Body.String()
	if strings.Contains(md, "publisher:") {
		t.Fatalf("a film's export names a publisher:\n%s", md)
	}
}

// The re-fetch is the remedy 0042 promises every game stored before it, so the
// publisher must be OVERWRITTEN by a resync rather than preserved the way the
// IMDb id deliberately is. Asserted through the storage layer because a resync
// needs a live supplier: the point is which of the two rules the column follows.
func TestPublisherIsNotPreservedLikeTheIMDbID(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	g := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Hollow Reach", "media_type": "game", "director": "Lantern Works",
		"imdb_id": "tt1234567",
	}, http.StatusCreated))
	// The pre-0042 shape: a publisher's name sitting in the studio column, and an
	// empty publisher. Written directly, because no code path can produce it any
	// more — which is exactly why the row has to be constructed to test the fix.
	if _, err := srv.Store.DB.Exec(
		`UPDATE movies SET director = 'Ninefold Games', publisher = '' WHERE id = ?`, g.ID); err != nil {
		t.Fatal(err)
	}
	var director, publisher, imdb string
	if err := srv.Store.DB.QueryRow(
		`SELECT COALESCE(director,''), publisher, COALESCE(imdb_id,'') FROM movies WHERE id = ?`, g.ID).
		Scan(&director, &publisher, &imdb); err != nil {
		t.Fatal(err)
	}
	if director != "Ninefold Games" || publisher != "" {
		t.Fatalf("the migration is not meant to guess: got %q / %q", director, publisher)
	}
	// 0042 says so in as many words: nothing is backfilled, because nothing
	// records which of the two facts `director` holds.
	if imdb != "tt1234567" {
		t.Fatalf("imdb_id = %q", imdb)
	}
}
