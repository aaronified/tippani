package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"tippani/internal/metadata"
)

// THE BUG THIS FILE EXISTS FOR: a character strip could not reach the only
// supplier that has character art.
//
// `/images/search` knew two suppliers, Google Custom Search and the Amazon
// scrape. Google needs a key AND an engine id, so on the ordinary install it
// contributes nothing; Amazon is a shop and has been shown the door for faces.
// That left the strip empty on a machine whose TheTVDB key was working — and
// TheTVDB is where the photograph of the role actually is, which is the entire
// reason 2.2.0 made it the default film source.
//
// So these tests assert the rung exists, that it is the FIRST rung, and that the
// picture it returns is the ROLE and not the actor: those are three different
// failures and only the first is visible as "no results".

// ladderCastRow is the slice of a stored cast row these tests care about.
type ladderCastRow struct {
	ID        int64  `json:"id"`
	Character string `json:"character"`
	Actor     string `json:"actor"`
	PersonID  string `json:"person_id"`
	Source    string `json:"source"`
}

// castRowsForImageLadder fills a film's cast from TheTVDB and hands back the
// stored rows, which is how a real character strip comes to have a cast_id.
func castRowsForImageLadder(t *testing.T, c *testClient, filmID int64) []ladderCastRow {
	t.Helper()
	c.mustDo("POST", "/movies/"+strconv.FormatInt(filmID, 10)+"/cast/tvdb", nil, http.StatusOK)
	got := decode[struct {
		Cast []ladderCastRow `json:"cast"`
	}](t, c.mustDo("GET", "/movies/"+strconv.FormatInt(filmID, 10)+"/cast", nil, http.StatusOK))
	return got.Cast
}

func TestACharacterStripReachesTheTVDBAndOffersTheRoleNotTheActor(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := filmWithTVDBID(t, c, "Suicide Squad", 297762)
	stub, client, done := newTVDBCastStub(t, tvdbSuicideSquad)
	defer done()
	srv.TVDB = client

	rows := castRowsForImageLadder(t, c, film)
	var waller int64
	for _, r := range rows {
		if r.Character == "Amanda Waller" {
			waller = r.ID
		}
	}
	if waller == 0 {
		t.Fatalf("no Amanda Waller row to ask about: %+v", rows)
	}

	before := stub.records
	got := decode[imageSearchResp](t, c.mustDo("POST", "/images/search", map[string]any{
		"kind": "character", "name": "Amanda Waller", "actor": "Viola Davis",
		"title": "Suicide Squad", "media_type": "movie", "cast_id": waller,
	}, http.StatusOK))

	if stub.records == before {
		t.Fatal("TheTVDB was never asked — the strip is still the old two-supplier merge")
	}
	if len(got.Images) == 0 {
		t.Fatal("no pictures for a role TheTVDB has art for")
	}
	// THE ROLE, NOT THE HEADSHOT. waller.jpg is Amanda Waller in costume;
	// head412.jpg is Viola Davis on the same payload. A tier that returned the
	// second would look like a working feature and be the wrong picture.
	if got.Images[0].URL != "https://artworks.thetvdb.com/waller.jpg" {
		t.Errorf("first picture is %q, want the character art", got.Images[0].URL)
	}
	if got.Images[0].Source != "tvdb" {
		t.Errorf("hit does not name TheTVDB as its source: %+v", got.Images[0])
	}
	if !got.Sources.TVDB {
		t.Error("sources.tvdb is false on a request TheTVDB answered — the client " +
			"will report the app unconfigured and open a browser tab")
	}
}

// A ROLE WITH NO ART IS NOT THE ACTOR'S HEADSHOT. Harley Quinn is on the same
// fixture with a personImgURL and no image of her own, and the character tier
// must decline rather than quietly hand back the face of the person playing her:
// the strip's own ladder decides what to do next, and a substitution made inside
// the tier is invisible to the reader choosing a picture.
func TestTheCharacterTierDeclinesWhenOnlyTheActorHasAPicture(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := filmWithTVDBID(t, c, "Suicide Squad", 297762)
	_, client, done := newTVDBCastStub(t, tvdbSuicideSquad)
	defer done()
	srv.TVDB = client

	var harley int64
	for _, r := range castRowsForImageLadder(t, c, film) {
		if r.Character == "Harley Quinn" {
			harley = r.ID
		}
	}
	if harley == 0 {
		t.Fatal("no Harley Quinn row")
	}
	got := decode[imageSearchResp](t, c.mustDo("POST", "/images/search", map[string]any{
		"kind": "character", "name": "Harley Quinn", "actor": "Margot Robbie",
		"title": "Suicide Squad", "media_type": "movie", "cast_id": harley,
	}, http.StatusOK))
	for _, im := range got.Images {
		if im.URL == "https://artworks.thetvdb.com/head99.jpg" {
			t.Errorf("the actor's headshot was offered as the character: %+v", im)
		}
	}
}

// ANOTHER READER'S CAST ROW IS NOT A LADDER RUNG. The id crosses the wire, so it
// has to be scoped on arrival — and the failure has to be a strip that lost its
// top rung, not a 403 confirming the row exists. Per-user isolation, same rule as
// every other query.
func TestACastIDFromAnotherReaderBuysNothing(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	owner := signupAdmin(t, h)
	film := filmWithTVDBID(t, owner, "Suicide Squad", 297762)
	stub, client, done := newTVDBCastStub(t, tvdbSuicideSquad)
	defer done()
	srv.TVDB = client
	rows := castRowsForImageLadder(t, owner, film)
	if len(rows) == 0 {
		t.Fatal("no rows to borrow")
	}

	other := addUser(t, h, owner, "nosy")
	before := stub.records
	got := decode[imageSearchResp](t, other.mustDo("POST", "/images/search", map[string]any{
		"kind": "character", "name": "Amanda Waller", "media_type": "movie",
		"cast_id": rows[0].ID,
	}, http.StatusOK))
	if stub.records != before {
		t.Error("somebody else's cast row reached TheTVDB")
	}
	if len(got.Images) != 0 || got.Sources.TVDB {
		t.Errorf("a borrowed cast id produced a TheTVDB rung: %+v", got)
	}
}

// THE PORTRAIT LADDER STARTS AT TheTVDB TOO, and the id it needs is one the app
// has been storing and discarding: `work_cast.person_id` is TheTVDB's peopleId,
// written by the cast fetch, and the portrait resolver's own comment says it had
// no client to hand it to. So a portrait strip for an actor already in the
// library reaches TheTVDB with no new parameter and no name search.
func TestAPortraitStripUsesTheTVDBPersonIDTheCastFetchAlreadyStored(t *testing.T) {
	tvdbSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/login" {
			_, _ = w.Write([]byte(`{"status":"success","data":{"token":"tok"}}`))
			return
		}
		switch r.URL.Path {
		case "/movies/297762/extended":
			_, _ = w.Write([]byte(tvdbSuicideSquad))
		case "/people/412/extended":
			// A primary image plus a second artwork: a picker exists so somebody
			// can reject the first one, so both must arrive.
			_, _ = w.Write([]byte(`{"data":{"name":"Viola Davis",
			  "image":"https://artworks.thetvdb.com/p412a.jpg",
			  "artworks":[{"image":"https://artworks.thetvdb.com/p412a.jpg"},
			              {"image":"https://artworks.thetvdb.com/p412b.jpg"}]}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer tvdbSrv.Close()

	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := filmWithTVDBID(t, c, "Suicide Squad", 297762)
	srv.TVDB = &metadata.TVDB{Key: "k", BaseURL: tvdbSrv.URL}
	castRowsForImageLadder(t, c, film)

	got := decode[imageSearchResp](t, c.mustDo("POST", "/images/search", map[string]any{
		"kind": "portrait", "name": "Viola Davis",
	}, http.StatusOK))

	if len(got.Images) != 2 {
		t.Fatalf("want both portraits TheTVDB holds, got %+v", got.Images)
	}
	if got.Images[0].URL != "https://artworks.thetvdb.com/p412a.jpg" {
		t.Errorf("primary portrait is not first: %+v", got.Images)
	}
	if got.Images[0].Source != "tvdb" || !got.Sources.TVDB {
		t.Errorf("the portrait rung does not name itself: %+v / %+v", got.Images[0], got.Sources)
	}
}
