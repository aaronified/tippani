package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"tippani/internal/metadata"
)

// The on-demand TheTVDB cast re-pull.
//
// WHAT IS UNDER TEST is why this route exists at all: TheTVDB is the only source
// with an image PER ROLE, and the only way to get one used to be a full resync
// that also re-pulls the poster, the year and the overview. So the cases below
// assert that the cast and the character art arrive, that the rest of the record
// does NOT move, and that a title with no TheTVDB id is refused before anything
// leaves the machine.

// tvdbCastStub stands in for TheTVDB's v4 API and counts what was asked for. The
// login is counted separately from the record: "one request" here means one
// extended-record fetch, and a bearer handshake is not a second look at the cast.
type tvdbCastStub struct {
	logins  int
	records int
	paths   []string
	body    string
	code    int
}

func newTVDBCastStub(t *testing.T, body string) (*tvdbCastStub, *metadata.TVDB, func()) {
	t.Helper()
	st := &tvdbCastStub{body: body, code: http.StatusOK}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/login" {
			st.logins++
			_, _ = w.Write([]byte(`{"status":"success","data":{"token":"tok"}}`))
			return
		}
		st.records++
		st.paths = append(st.paths, r.URL.Path)
		if st.code != http.StatusOK {
			w.WriteHeader(st.code)
			return
		}
		_, _ = w.Write([]byte(st.body))
	}))
	return st, &metadata.TVDB{Key: "k", BaseURL: srv.URL}, srv.Close
}

// A record with two roles, one of which has art of its own and one of which does
// not — which is the ordinary case on TheTVDB and the reason CharacterImageURL is
// a separate field from the headshot.
const tvdbSuicideSquad = `{"data":{"id":297762,"name":"Suicide Squad","year":"2016",
	"image":"https://artworks.thetvdb.com/banners/poster.jpg",
	"genres":[{"name":"Action"}],
	"characters":[
	  {"name":"Amanda Waller","personName":"Viola Davis","peopleType":"Actor","peopleId":412,
	   "personImgURL":"https://artworks.thetvdb.com/head412.jpg",
	   "image":"https://artworks.thetvdb.com/waller.jpg"},
	  {"name":"Harley Quinn","personName":"Margot Robbie","peopleType":"Actor","peopleId":99,
	   "personImgURL":"https://artworks.thetvdb.com/head99.jpg"},
	  {"name":"","personName":"David Ayer","peopleType":"Director"}]}}`

type tvdbCastReply struct {
	Title string `json:"title"`
	Added int    `json:"added"`
	Cast  []struct {
		Character          string `json:"character"`
		Actor              string `json:"actor"`
		ImageURL           string `json:"image_url"`
		CharacterImageURL  string `json:"character_image_url"`
		CharacterImagePath string `json:"character_image_path"`
		Origin             string `json:"origin"`
		Source             string `json:"source"`
	} `json:"cast"`
}

// filmWithTVDBID makes a film the ordinary way and then puts a TheTVDB id on it,
// which is what the Details panel does — no fetch, so the stub below counts only
// what the cast route asks for.
func filmWithTVDBID(t *testing.T, c *testClient, title string, tvdbID int64) int64 {
	t.Helper()
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": title, "media_type": "movie"}, http.StatusCreated))
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10),
		map[string]any{"title": title, "media_type": "movie", "tvdb_id": tvdbID}, http.StatusOK)
	return m.ID
}

func TestTVDBCastFillBringsTheCharacterArt(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := filmWithTVDBID(t, c, "Suicide Squad", 297762)
	stub, client, done := newTVDBCastStub(t, tvdbSuicideSquad)
	defer done()
	srv.TVDB = client

	got := decode[tvdbCastReply](t, c.mustDo("POST",
		"/movies/"+strconv.FormatInt(id, 10)+"/cast/tvdb", nil, http.StatusOK))

	// ONE record fetch. The extended payload carries the names, the person ids, the
	// headshots and the per-role art together, so a second request would mean
	// somebody had added a per-person lookup back in.
	if stub.records != 1 {
		t.Fatalf("fetched %d records (%v), want exactly one", stub.records, stub.paths)
	}
	if stub.paths[0] != "/movies/297762/extended" {
		t.Errorf("asked for %q, want /movies/297762/extended", stub.paths[0])
	}
	// The director is not a cast row: peopleType filters, so two of the three
	// characters in the fixture arrive.
	if got.Added != 2 || len(got.Cast) != 2 {
		t.Fatalf("added %d, stored %+v", got.Added, got.Cast)
	}
	if got.Cast[0].Character != "Amanda Waller" || got.Cast[0].Actor != "Viola Davis" {
		t.Errorf("first row is %+v", got.Cast[0])
	}
	// THE WHOLE REASON THE ROUTE EXISTS. The role's own picture, which no other
	// source in this app supplies.
	if got.Cast[0].CharacterImageURL != "https://artworks.thetvdb.com/waller.jpg" {
		t.Errorf("no character art on the first row: %+v", got.Cast[0])
	}
	// And the headshot beside it, which is a different picture of a different thing.
	if got.Cast[0].ImageURL != "https://artworks.thetvdb.com/head412.jpg" {
		t.Errorf("no headshot on the first row: %+v", got.Cast[0])
	}
	// A role with no art of its own is not an error and not a gap in the row — the
	// client falls back to the headshot, which is what TheTVDB's own site does.
	if got.Cast[1].CharacterImageURL != "" || got.Cast[1].ImageURL == "" {
		t.Errorf("second row is %+v, want no character art and a headshot", got.Cast[1])
	}
	// NOTHING IS FETCHED YET. The path is filled on demand by POST /cast/{id}/image,
	// per chip: twenty roles is twenty files and a reader quotes two.
	if got.Cast[0].CharacterImagePath != "" {
		t.Errorf("the route downloaded an image it was not asked for: %q", got.Cast[0].CharacterImagePath)
	}
	if got.Cast[0].Origin != "provider" || got.Cast[0].Source != "tvdb" {
		t.Errorf("provenance is %+v, want provider/tvdb", got.Cast[0])
	}
}

// THE DIFFERENCE FROM A RESYNC, asserted rather than described. This is the whole
// argument for a second route: a reader who has corrected a title's year by hand
// will not press a control that offers to take it back.
func TestTVDBCastFillLeavesTheRestOfTheRecordAlone(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := filmWithTVDBID(t, c, "Suicide Squad", 297762)
	// A year and a description the reader typed, and which TheTVDB disagrees with.
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(id, 10), map[string]any{
		"title": "Suicide Squad", "media_type": "movie", "tvdb_id": 297762,
		"release_year": 1999, "description": "mine",
	}, http.StatusOK)
	_, client, done := newTVDBCastStub(t, tvdbSuicideSquad)
	defer done()
	srv.TVDB = client

	c.mustDo("POST", "/movies/"+strconv.FormatInt(id, 10)+"/cast/tvdb", nil, http.StatusOK)

	after := decode[struct {
		ReleaseYear int    `json:"release_year"`
		Description string `json:"description"`
		Title       string `json:"title"`
	}](t, c.mustDo("GET", "/movies/"+strconv.FormatInt(id, 10), nil, http.StatusOK))
	if after.ReleaseYear != 1999 || after.Description != "mine" || after.Title != "Suicide Squad" {
		t.Errorf("the cast fetch rewrote the record: %+v", after)
	}
}

// The provenance rule, over the source it was written for — the case that would
// let a re-pull quietly overwrite a correction.
func TestTVDBCastFillKeepsACorrectedRow(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := filmWithTVDBID(t, c, "Suicide Squad", 297762)
	_, client, done := newTVDBCastStub(t, tvdbSuicideSquad)
	defer done()
	srv.TVDB = client
	path := "/movies/" + strconv.FormatInt(id, 10) + "/cast/tvdb"

	first := decode[tvdbCastReply](t, c.mustDo("POST", path, nil, http.StatusOK))
	if len(first.Cast) != 2 {
		t.Fatalf("first pass stored %+v", first.Cast)
	}
	// Correct the second row's actor by hand, then re-pull.
	rows := decode[struct {
		Cast []struct {
			ID        int64  `json:"id"`
			Character string `json:"character"`
		} `json:"cast"`
	}](t, c.mustDo("GET", "/movies/"+strconv.FormatInt(id, 10)+"/cast", nil, http.StatusOK))
	var harley int64
	for _, r := range rows.Cast {
		if r.Character == "Harley Quinn" {
			harley = r.ID
		}
	}
	if harley == 0 {
		t.Fatalf("no Harley Quinn row in %+v", rows.Cast)
	}
	c.mustDo("PUT", "/cast/"+strconv.FormatInt(harley, 10),
		map[string]any{"character": "Harley Quinn", "actor": "M. Robbie"}, http.StatusOK)

	again := decode[tvdbCastReply](t, c.mustDo("POST", path, nil, http.StatusOK))
	for _, r := range again.Cast {
		if r.Character == "Harley Quinn" && r.Actor != "M. Robbie" {
			t.Errorf("the re-pull overwrote a corrected row: %+v", r)
		}
	}
}

// A TITLE WITH NO TheTVDB ID IS REFUSED BEFORE ANYTHING IS FETCHED. A search here
// is where the wrong cast gets attached to the right work, and a wrong cast reads
// as a correct one because the capture form autofills "played by" from it.
func TestTVDBCastFillRefusesAnUnmatchedTitle(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Some Film", "media_type": "movie"}, http.StatusCreated))
	stub, client, done := newTVDBCastStub(t, tvdbSuicideSquad)
	defer done()
	srv.TVDB = client

	c.mustDo("POST", "/movies/"+strconv.FormatInt(m.ID, 10)+"/cast/tvdb", nil, http.StatusConflict)
	if stub.records != 0 || stub.logins != 0 {
		t.Errorf("talked to TheTVDB anyway: %d logins, %d records", stub.logins, stub.records)
	}
}

// A foreign work is a 404 and never a fetch: an outbound request for somebody
// else's id would be a way to make this server say whether their row exists.
func TestTVDBCastFillIsPerUser(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	owner := signupAdmin(t, h)
	id := filmWithTVDBID(t, owner, "Suicide Squad", 297762)
	other := addUser(t, h, owner, "bob")
	stub, client, done := newTVDBCastStub(t, tvdbSuicideSquad)
	defer done()
	srv.TVDB = client

	other.mustDo("POST", "/movies/"+strconv.FormatInt(id, 10)+"/cast/tvdb", nil, http.StatusNotFound)
	if stub.records != 0 || stub.logins != 0 {
		t.Errorf("fetched for a work that is not theirs: %d logins, %d records", stub.logins, stub.records)
	}
}

// A show's record lives under /series, and asking /movies for it 404s at TheTVDB.
func TestTVDBCastFillAsksTheRightEndpointForAShow(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Game of Thrones", "media_type": "show"}, http.StatusCreated))
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10),
		map[string]any{"title": "Game of Thrones", "media_type": "show", "tvdb_id": 121361}, http.StatusOK)
	stub, client, done := newTVDBCastStub(t, `{"data":{"id":121361,"name":"Game of Thrones",
		"characters":[{"name":"Jon Snow","personName":"Kit Harington","peopleType":"Actor"}]}}`)
	defer done()
	srv.TVDB = client

	c.mustDo("POST", "/movies/"+strconv.FormatInt(m.ID, 10)+"/cast/tvdb", nil, http.StatusOK)
	if len(stub.paths) != 1 || stub.paths[0] != "/series/121361/extended" {
		t.Errorf("asked for %v, want /series/121361/extended", stub.paths)
	}
}

// No key is a 503 and not a 500: it is an answer about the configuration rather
// than a failure of this request.
func TestTVDBCastFillWithoutAKey(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := filmWithTVDBID(t, c, "Suicide Squad", 297762)
	srv.TVDB = &metadata.TVDB{} // no key, and no setting behind it in a fresh store
	c.mustDo("POST", "/movies/"+strconv.FormatInt(id, 10)+"/cast/tvdb", nil, http.StatusServiceUnavailable)
}
