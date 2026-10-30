package metadata

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// The suppliers' episode lists, served in the shapes their documentation gives. The assertions are
// the values a quote's season and episode will be matched against.

func TestTMDBEpisodesCarryNamesTheTVOrderAndTheDVDGroupsPlaces(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/tv/77/season/0":
			_, _ = w.Write([]byte(`{"episodes":[{"episode_number":1,"season_number":0,"name":"A Special","air_date":"2001-01-01"}]}`))
		case "/tv/77/season/1":
			_, _ = w.Write([]byte(`{"episodes":[
				{"episode_number":1,"season_number":1,"name":"Pilot","overview":"It begins.","air_date":"2002-02-02"},
				{"episode_number":2,"season_number":1,"name":"Second"}]}`))
		case "/tv/77/episode_groups":
			_, _ = w.Write([]byte(`{"results":[
				{"id":"small","type":3,"episode_count":1},
				{"id":"dvd","type":3,"episode_count":2},
				{"id":"prod","type":6,"episode_count":9}]}`))
		case "/tv/episode_group/dvd":
			_, _ = w.Write([]byte(`{"groups":[{"order":1,"episodes":[
				{"season_number":1,"episode_number":2,"order":0},
				{"season_number":1,"episode_number":1,"order":1}]}]}`))
		default:
			t.Errorf("unexpected call %s", r.URL.Path)
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	got, err := (&TMDB{Key: "v3key", BaseURL: srv.URL}).Episodes(context.Background(), 77,
		[]byte(`{"seasons":[{"season_number":0},{"season_number":1}]}`))
	if err != nil {
		t.Fatal(err)
	}
	want := []Episode{
		{Season: 0, Number: 1, Name: "A Special", AirDate: "2001-01-01"},
		{Season: 1, Number: 1, Name: "Pilot", Overview: "It begins.", AirDate: "2002-02-02", DVDSeason: 1, DVDNumber: 2},
		{Season: 1, Number: 2, Name: "Second", DVDSeason: 1, DVDNumber: 1},
	}
	if len(got) != len(want) {
		t.Fatalf("%+v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("episode %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestTMDBShowWithNoDVDGroupKeepsItsEpisodesWithoutADVDOrder(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/season/1"):
			_, _ = w.Write([]byte(`{"episodes":[{"episode_number":1,"season_number":1,"name":"Pilot"}]}`))
		case strings.HasSuffix(r.URL.Path, "/episode_groups"):
			http.Error(w, "nope", http.StatusInternalServerError)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	got, err := (&TMDB{Key: "v3key", BaseURL: srv.URL}).Episodes(context.Background(), 5, []byte(`{"seasons":[{"season_number":1}]}`))
	if err != nil || len(got) != 1 || got[0].DVDNumber != 0 || got[0].Name != "Pilot" {
		t.Fatalf("%+v %v", got, err)
	}
}

func TestTVDBEpisodesArePagedAndJoinedToTheDVDOrderByID(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/login":
			_, _ = w.Write([]byte(`{"data":{"token":"tok"}}`))
		case r.URL.Path == "/series/9/episodes/official" && r.URL.Query().Get("page") == "0":
			_, _ = w.Write([]byte(`{"data":{"episodes":[{"id":11,"name":"Two","seasonNumber":1,"number":2}]},"links":{"next":1}}`))
		case r.URL.Path == "/series/9/episodes/official" && r.URL.Query().Get("page") == "1":
			_, _ = w.Write([]byte(`{"data":{"episodes":[{"id":10,"name":"One","overview":"o","aired":"2003-03-03","seasonNumber":1,"number":1}]},"links":{"next":null}}`))
		case r.URL.Path == "/series/9/episodes/dvd":
			_, _ = w.Write([]byte(`{"data":{"episodes":[{"id":10,"seasonNumber":1,"number":2},{"id":11,"seasonNumber":1,"number":1}]},"links":{"next":null}}`))
		default:
			t.Errorf("unexpected call %s", r.URL.String())
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	got, err := (&TVDB{Key: "k", BaseURL: srv.URL}).Episodes(context.Background(), "9")
	if err != nil {
		t.Fatal(err)
	}
	want := []Episode{
		{Season: 1, Number: 1, Name: "One", Overview: "o", AirDate: "2003-03-03", DVDSeason: 1, DVDNumber: 2},
		{Season: 1, Number: 2, Name: "Two", DVDSeason: 1, DVDNumber: 1},
	}
	if len(got) != 2 || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("%+v", got)
	}
}
