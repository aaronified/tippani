package metadata

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const tmdbSearchJSON = `{"results":[
  {"id":603,"title":"The Matrix","release_date":"1999-03-30","overview":"Neo.","poster_path":"/matrix.jpg"},
  {"id":604,"title":"The Matrix Reloaded","release_date":"2003-05-15","overview":"More Neo."}]}`

func tmdbDetailsBody() string {
	cast := make([]string, 25)
	for i := range cast {
		cast[i] = fmt.Sprintf(`{"character":"C%d","name":"A%d","order":%d}`, i, i, i)
	}
	return `{"id":603,"title":"The Matrix","overview":"Neo.","release_date":"1999-03-30",` +
		`"poster_path":"/matrix.jpg",` +
		`"genres":[{"id":28,"name":"Action"},{"id":878,"name":"Science Fiction"}],` +
		`"credits":{"cast":[` + strings.Join(cast, ",") + `],` +
		`"crew":[{"job":"Producer","name":"Joel Silver"},` +
		`{"job":"Director","name":"Lana Wachowski"},{"job":"Director","name":"Lilly Wachowski"}]}}`
}

func TestTMDBSearch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/search/movie" {
			t.Errorf("path = %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("query") != "the matrix" || q.Get("year") != "1999" {
			t.Errorf("query = %v", q)
		}
		if q.Get("api_key") != "v3key" {
			t.Errorf("api_key = %q, want v3 key as query param", q.Get("api_key"))
		}
		if got := r.Header.Get("Authorization"); got != "" {
			t.Errorf("unexpected auth header %q with v3 key", got)
		}
		_, _ = w.Write([]byte(tmdbSearchJSON))
	}))
	defer srv.Close()

	tm := &TMDB{Key: "v3key", BaseURL: srv.URL}
	got, err := tm.Search(context.Background(), "the matrix", 1999)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d candidates, want 2", len(got))
	}
	want := MovieCandidate{
		Source: "tmdb", SourceID: "603", MediaType: "movie",
		TMDBID: 603, Title: "The Matrix", ReleaseYear: 1999, Overview: "Neo.",
		PosterURL: "https://image.tmdb.org/t/p/w342/matrix.jpg",
	}
	if got[0] != want {
		t.Errorf("candidate = %+v, want %+v", got[0], want)
	}
}

func TestTMDBBearerAuth(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer eyFAKE.token" {
			t.Errorf("auth header = %q", got)
		}
		if r.URL.Query().Has("api_key") {
			t.Error("api_key sent alongside bearer token")
		}
		if r.URL.Query().Has("year") {
			t.Error("year param sent when year is 0")
		}
		_, _ = w.Write([]byte(tmdbSearchJSON))
	}))
	defer srv.Close()

	tm := &TMDB{Key: "eyFAKE.token", BaseURL: srv.URL}
	if _, err := tm.Search(context.Background(), "x", 0); err != nil {
		t.Fatal(err)
	}
}

func TestTMDBDetails(t *testing.T) {
	body := tmdbDetailsBody()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/movie/603" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("append_to_response"); got != "credits" {
			t.Errorf("append_to_response = %q", got)
		}
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	tm := &TMDB{Key: "v3key", BaseURL: srv.URL}
	d, err := tm.Details(context.Background(), 603)
	if err != nil {
		t.Fatal(err)
	}
	if d.TMDBID != 603 || d.Title != "The Matrix" || d.ReleaseYear != 1999 || d.Overview != "Neo." {
		t.Errorf("details = %+v", d)
	}
	if d.Director != "Lana Wachowski" {
		t.Errorf("director = %q, want first crew entry with job Director", d.Director)
	}
	if d.PosterURL != "https://image.tmdb.org/t/p/w342/matrix.jpg" {
		t.Errorf("poster = %q", d.PosterURL)
	}
	if len(d.Genres) != 2 || d.Genres[1] != "Science Fiction" {
		t.Errorf("genres = %v", d.Genres)
	}
	if len(d.Cast) != 20 {
		t.Fatalf("cast = %d entries, want top 20", len(d.Cast))
	}
	if d.Cast[0] != (CastMember{Character: "C0", Actor: "A0"}) || d.Cast[19].Actor != "A19" {
		t.Errorf("cast = %+v", d.Cast[:2])
	}
	if string(d.Raw) != body {
		t.Error("Raw != response body")
	}
}

func TestTMDBErrors(t *testing.T) {
	srv401 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv401.Close()
	_, err := (&TMDB{Key: "bad", BaseURL: srv401.URL}).Search(context.Background(), "x", 0)
	if !errors.Is(err, ErrTMDBAuth) {
		t.Fatalf("401 err = %v, want ErrTMDBAuth", err)
	}

	srv500 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv500.Close()
	_, err = (&TMDB{Key: "k", BaseURL: srv500.URL}).Details(context.Background(), 1)
	if err == nil || !strings.Contains(err.Error(), "500") {
		t.Fatalf("500 err = %v, want status mention", err)
	}
}
