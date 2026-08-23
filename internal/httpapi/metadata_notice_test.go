package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"

	"tippani/internal/store"
)

// THE ONE-TIME NOTICE THAT THE DEFAULT FILM SOURCE MOVED (2.2.0).
//
// Two facts gate it and BOTH have to, so both directions are asserted here. The
// marker in `settings` is an instance fact written once by a one-time pass
// (store/onetime_2_2_0_tvdb_default.go) — without it, a library where somebody
// pinned things to TMDB on purpose since the change would be nagged about a
// change they never lived through. The count is per-user and it is what makes the
// notice self-clearing, so there is no dismissal to store and none to go stale.
//
// The marker's KEY is store.SettingFilmSourceNotice on both sides on purpose: a
// settings key spelled twice across a package boundary can be renamed on one
// side, and the symptom is a notice that silently never appears again.

type filmSourceNoticeResp struct {
	Notice *struct {
		Since      string `json:"since"`
		TMDBPinned int    `json:"tmdb_pinned"`
	} `json:"film_source_notice"`
}

func noticeOf(t *testing.T, c *testClient) *filmSourceNoticeResp {
	t.Helper()
	res := c.mustDo("GET", "/metadata/status", nil, http.StatusOK)
	var out filmSourceNoticeResp
	if err := json.Unmarshal(res.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode status: %v", err)
	}
	return &out
}

func TestTheFilmSourceNoticeNeedsBothTheMarkerAndAPinnedTitle(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// A TMDB-pinned film, but no marker: this instance has never been told the
	// default moved, so it was born after it and there is nothing to say.
	film := createFilm(t, c, "Suicide Squad", "David Ayer")
	c.mustDo("PUT", "/movies/"+itoa(film), map[string]any{
		"title": "Suicide Squad", "media_type": "movie", "tmdb_id": 297761,
	}, http.StatusOK)
	if n := noticeOf(t, c).Notice; n != nil {
		t.Fatalf("notice shown with no marker: %+v — a fresh install would be told "+
			"about a change it never lived through", n)
	}

	// The marker, as the one-time pass would have written it on an upgrade.
	if err := srv.Store.SetSetting(store.SettingFilmSourceNotice, "2.2.0"); err != nil {
		t.Fatal(err)
	}
	n := noticeOf(t, c).Notice
	if n == nil {
		t.Fatal("no notice on an upgraded instance with a TMDB-pinned title")
	}
	if n.Since != "2.2.0" || n.TMDBPinned != 1 {
		t.Fatalf("notice = %+v, want since 2.2.0 and 1 pinned title", n)
	}

	// IT CLEARS ITSELF. Giving the title a TheTVDB id is what re-verifying against
	// TheTVDB does, and the notice is about titles that have no such record — so
	// the count falls to zero and the notice goes, with nothing dismissed.
	c.mustDo("PUT", "/movies/"+itoa(film), map[string]any{
		"title": "Suicide Squad", "media_type": "movie", "tmdb_id": 297761, "tvdb_id": 297,
	}, http.StatusOK)
	if n := noticeOf(t, c).Notice; n != nil {
		t.Fatalf("notice survived the last title gaining a TheTVDB record: %+v", n)
	}
}
