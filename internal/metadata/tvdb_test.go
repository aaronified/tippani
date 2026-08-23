package metadata

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestTVDBSearchAndDetails exercises the login → search → details flow against a
// stubbed TheTVDB v4 API, checking the bearer handoff and the mapping into the
// shared MovieCandidate / MovieDetails shapes.
func TestTVDBSearchAndDetails(t *testing.T) {
	logins := 0
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/login":
			logins++
			w.Write([]byte(`{"status":"success","data":{"token":"tok123"}}`))
		case r.URL.Path == "/search":
			if r.Header.Get("Authorization") != "Bearer tok123" {
				t.Errorf("search missing bearer: %q", r.Header.Get("Authorization"))
			}
			if r.URL.Query().Get("type") != "series" {
				t.Errorf("type = %q, want series", r.URL.Query().Get("type"))
			}
			w.Write([]byte(`{"data":[{"tvdb_id":"121361","name":"Game of Thrones","year":"2011","type":"series","overview":"Nine noble families."}]}`))
		case r.URL.Path == "/series/121361/extended":
			w.Write([]byte(`{"data":{"id":121361,"name":"Game of Thrones","year":"2011",
				"image":"https://artworks.thetvdb.com/banners/x.jpg",
				"genres":[{"name":"Drama"},{"name":"Fantasy"}],
				"characters":[{"name":"Jon Snow","personName":"Kit Harington","peopleType":"Actor"},
				              {"name":"","personName":"David Benioff","peopleType":"Creator"}]}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer fake.Close()

	tv := &TVDB{Key: "k", BaseURL: fake.URL}
	ctx := context.Background()

	cands, err := tv.Search(ctx, "Game of Thrones", 2011, "show")
	if err != nil {
		t.Fatal(err)
	}
	if len(cands) != 1 {
		t.Fatalf("got %d candidates", len(cands))
	}
	c := cands[0]
	if c.Source != "tvdb" || c.SourceID != "121361" || c.MediaType != "show" ||
		c.Title != "Game of Thrones" || c.ReleaseYear != 2011 {
		t.Fatalf("candidate: %+v", c)
	}

	d, err := tv.SeriesDetails(ctx, "121361")
	if err != nil {
		t.Fatal(err)
	}
	if d.Source != "tvdb" || d.MediaType != "show" || d.TVDBID != 121361 ||
		d.Title != "Game of Thrones" || d.ReleaseYear != 2011 {
		t.Fatalf("details: %+v", d)
	}
	if d.PosterURL == "" || len(d.Genres) != 2 {
		t.Fatalf("details genres/poster: %+v", d)
	}
	if d.Director != "David Benioff" {
		t.Fatalf("creator (director) = %q, want David Benioff", d.Director)
	}
	if len(d.Cast) != 1 || d.Cast[0].Character != "Jon Snow" || d.Cast[0].Actor != "Kit Harington" {
		t.Fatalf("cast: %+v", d.Cast)
	}
	if logins != 1 {
		t.Fatalf("expected a single login, got %d", logins)
	}
}

// TestTVDBKeepsTheRoleAndThePersonApart pins the one thing a single image field
// would have quietly got wrong: TheTVDB's character record carries the actor's
// headshot in `personImgURL` and the ROLE IN COSTUME in `image`, and they must
// land in different places. A mapping that took whichever was present would put
// Amanda Waller's costume on Viola Davis's identity, everywhere she appears.
//
// The third entry is the case the fallback exists for — a real role with no art
// of its own, which is the majority of them. It must leave the field EMPTY rather
// than copy the headshot into it: TheTVDB's own site substitutes the headshot at
// display time, and a caller cannot make that choice if the two are already the
// same string in the database.
func TestTVDBKeepsTheRoleAndThePersonApart(t *testing.T) {
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/login":
			w.Write([]byte(`{"status":"success","data":{"token":"t"}}`))
		case r.URL.Path == "/movies/297/extended":
			w.Write([]byte(`{"data":{"id":297,"name":"Suicide Squad","year":"2016",
				"characters":[
				  {"name":"Amanda Waller","personName":"Viola Davis","peopleType":"Actor",
				   "peopleId":412,
				   "personImgURL":"https://artworks.thetvdb.com/banners/person/412/head.jpg",
				   "image":"https://artworks.thetvdb.com/banners/character/9001/waller.jpg"},
				  {"name":"Harley Quinn","personName":"Margot Robbie","peopleType":"Actor",
				   "personImgURL":"https://artworks.thetvdb.com/banners/person/77/head.jpg",
				   "image":"https://artworks.thetvdb.com/banners/character/9002/quinn.jpg"},
				  {"name":"Uncredited Extra","personName":"Somebody","peopleType":"Actor",
				   "personImgURL":"https://artworks.thetvdb.com/banners/person/99/head.jpg"}]}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer fake.Close()

	d, err := (&TVDB{Key: "k", BaseURL: fake.URL}).MovieDetails(context.Background(), "297")
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Cast) != 3 {
		t.Fatalf("got %d cast members, want 3: %+v", len(d.Cast), d.Cast)
	}

	waller := d.Cast[0]
	if waller.Character != "Amanda Waller" || waller.Actor != "Viola Davis" {
		t.Fatalf("first credit: %+v", waller)
	}
	if waller.ImageURL != "https://artworks.thetvdb.com/banners/person/412/head.jpg" {
		t.Errorf("actor headshot = %q, want the personImgURL", waller.ImageURL)
	}
	if waller.CharacterImageURL != "https://artworks.thetvdb.com/banners/character/9001/waller.jpg" {
		t.Errorf("character image = %q, want the character record's own image", waller.CharacterImageURL)
	}
	if waller.ImageURL == waller.CharacterImageURL {
		t.Error("the role and the person got the same picture")
	}
	if waller.PersonID != "412" {
		t.Errorf("person id = %q, want 412", waller.PersonID)
	}

	// A role with no image of its own: empty, never the headshot.
	if extra := d.Cast[2]; extra.CharacterImageURL != "" {
		t.Errorf("a role with no art got %q; the fallback belongs at display time, not here",
			extra.CharacterImageURL)
	} else if extra.ImageURL == "" {
		t.Error("the headshot went missing along with the absent character image")
	}
}

// TestTVDBAuthFailure maps a rejected key to ErrTVDBAuth.
func TestTVDBAuthFailure(t *testing.T) {
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer fake.Close()
	tv := &TVDB{Key: "bad", BaseURL: fake.URL}
	if _, err := tv.Search(context.Background(), "x", 0, "movie"); !errors.Is(err, ErrTVDBAuth) {
		t.Fatalf("err = %v, want ErrTVDBAuth", err)
	}
}
