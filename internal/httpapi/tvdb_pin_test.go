package httpapi

// A REJECTED THETVDB KEY USED TO BE INVISIBLE, and the reported symptom was
// exactly the shape of that: "TVDB says the API key is inactive! but i can
// search TVDB from the app!" Both halves were true. TheTVDB's free
// user-supported key logs in only with the subscriber's PIN beside it — the app
// never sent one — so login 401s, the partial-failure rule swallows it because
// TMDB answered, and the reader reads TMDB's hits as TheTVDB's.

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tippani/internal/metadata"
)

type lookupWarnResp struct {
	Candidates []metadata.MovieCandidate `json:"candidates"`
	Warning    string                    `json:"warning"`
}

// The stub refuses at login the way TheTVDB refuses a key with no PIN behind it.
func newRefusingTVDB(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/login" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		http.NotFound(w, r)
	}))
}

func newAnsweringTMDB(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/search/movie" {
			_, _ = w.Write([]byte(`{"results":[{"id":297761,"title":"Suicide Squad","release_date":"2016-08-05"}]}`))
			return
		}
		http.NotFound(w, r)
	}))
}

func TestARejectedTVDBKeyIsSaidOutLoudEvenWhenTMDBAnswers(t *testing.T) {
	srv := newTestServer(t)
	tmdb, tvdb := newAnsweringTMDB(t), newRefusingTVDB(t)
	defer tmdb.Close()
	defer tvdb.Close()
	srv.TMDB.Key, srv.TMDB.BaseURL = "testkey", tmdb.URL
	srv.TVDB = &metadata.TVDB{Key: "testkey", BaseURL: tvdb.URL}

	c := signupAdmin(t, srv.Handler())
	got := decode[lookupWarnResp](t, c.mustDo("POST", "/movies/lookup",
		map[string]any{"title": "Suicide Squad"}, 200))

	// THE RESULTS STILL COME BACK. One supplier being down must never hide the
	// other's hits — that rule is right and is not what this changes.
	if len(got.Candidates) != 1 || got.Candidates[0].Source != "tmdb" {
		t.Fatalf("the working supplier's hits did not survive: %+v", got.Candidates)
	}
	// AND THE READER IS TOLD WHOSE THEY ARE.
	if got.Warning == "" {
		t.Fatal("a rejected key produced results with no explanation, which is the reported bug")
	}
	if !strings.Contains(got.Warning, "PIN") {
		t.Errorf("the warning does not name the usual cause: %q", got.Warning)
	}
}

// AND ONLY WHEN THERE IS SOMETHING TO EXPLAIN. With no hits at all the request
// already fails with the supplier's own message, and a warning beside an error
// would be the same fact twice.
func TestNoWarningWhenTheLookupFailedOutright(t *testing.T) {
	srv := newTestServer(t)
	tvdb := newRefusingTVDB(t)
	defer tvdb.Close()
	srv.TMDB.Key = ""
	srv.TVDB = &metadata.TVDB{Key: "testkey", BaseURL: tvdb.URL}

	c := signupAdmin(t, srv.Handler())
	rec := c.do("POST", "/movies/lookup", map[string]any{"title": "Suicide Squad"})
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502 when the only supplier refused", rec.Code)
	}
	if strings.Contains(rec.Body.String(), `"warning"`) {
		t.Errorf("an error carried a warning as well: %s", rec.Body)
	}
}

// A working supplier that merely found nothing says nothing: a timeout or an
// empty result is not something the reader can act on, and a line under every
// search would train them to ignore the one that matters.
func TestNoWarningWhenTheKeyWasAccepted(t *testing.T) {
	srv := newTestServer(t)
	tmdb := newAnsweringTMDB(t)
	defer tmdb.Close()
	working := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/login" {
			_, _ = w.Write([]byte(`{"data":{"token":"tok"}}`))
			return
		}
		_, _ = w.Write([]byte(`{"data":[]}`))
	}))
	defer working.Close()
	srv.TMDB.Key, srv.TMDB.BaseURL = "testkey", tmdb.URL
	srv.TVDB = &metadata.TVDB{Key: "testkey", BaseURL: working.URL}

	c := signupAdmin(t, srv.Handler())
	got := decode[lookupWarnResp](t, c.mustDo("POST", "/movies/lookup",
		map[string]any{"title": "Suicide Squad"}, 200))
	if got.Warning != "" {
		t.Errorf("a supplier that answered was reported as refusing: %q", got.Warning)
	}
}

// The PIN is stored write-only and saved on its own, like every other secret —
// correcting a mistyped PIN must not mean re-entering the key beside it.
func TestTheTVDBPINIsWriteOnlyAndSavedOnItsOwn(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/admin/metadata-keys", map[string]any{"tvdb_key": "abc", "tvdb_pin": "4242"}, 200)

	body := c.mustDo("GET", "/admin/metadata-keys", nil, 200).Body.String()
	if strings.Contains(body, "4242") {
		t.Fatalf("the PIN was echoed back: %s", body)
	}
	if !strings.Contains(body, `"tvdb_pin_set":true`) || !strings.Contains(body, `"tvdb_key_set":true`) {
		t.Fatalf("the pair is not reported: %s", body)
	}
	c.mustDo("PUT", "/admin/metadata-keys", map[string]any{"tvdb_pin": "9999"}, 200)
	if !strings.Contains(c.mustDo("GET", "/admin/metadata-keys", nil, 200).Body.String(), `"tvdb_key_set":true`) {
		t.Fatal("saving the PIN cleared the key")
	}
}
