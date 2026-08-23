package httpapi

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"tippani/internal/metadata"
)

// POST /cast/{id}/image — the character picture becomes ours, once (0050).
//
// The point of the route is that the app holds the bytes instead of a chip
// pointing at TheTVDB, so what these tests pin is the fetching: that it happens,
// that it happens ONCE, and that the three ways there is nothing to fetch are all
// distinguishable from a failure.

// seedTVDBCast puts one film in place with a cast seeded as a TheTVDB fetch would
// have seeded it: two credits, one with character art and one without.
func seedTVDBCast(t *testing.T, srv *Server, c *testClient) (film, withArt, noArt int64) {
	t.Helper()
	film = createFilm(t, c, "Suicide Squad", "David Ayer")
	tx, err := srv.Store.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	err = mergeProviderCast(tx, 1, "movie", film, "tvdb", []metadata.CastMember{
		{Character: "Amanda Waller", Actor: "Viola Davis", PersonID: "412",
			ImageURL:          "https://artworks.thetvdb.com/head412.jpg",
			CharacterImageURL: "https://artworks.thetvdb.com/waller.jpg"},
		// A role with no art of its own, which is most of them.
		{Character: "Uncredited Extra", Actor: "Somebody",
			ImageURL: "https://artworks.thetvdb.com/head99.jpg"},
	})
	if err != nil {
		tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	for _, row := range castOf(t, c, "/movies/"+itoa(film)+"/cast").Cast {
		switch row.Character {
		case "Amanda Waller":
			withArt = row.ID
		case "Uncredited Extra":
			noArt = row.ID
		}
	}
	if withArt == 0 || noArt == 0 {
		t.Fatal("seed did not produce both rows")
	}
	return film, withArt, noArt
}

func TestACharacterImageIsFetchedOnceAndThenOurs(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, withArt, noArt := seedTVDBCast(t, srv, c)

	fetches := []string{}
	srv.fetchImage = func(_ context.Context, rawURL, _ string) (string, error) {
		fetches = append(fetches, rawURL)
		return "waller-stored.jpg", nil
	}

	got := decode[castRow](t, c.mustDo("POST", "/cast/"+itoa(withArt)+"/image", nil, http.StatusOK))
	if got.CharacterImagePath != "waller-stored.jpg" {
		t.Fatalf("stored path = %q, want the name the fetch returned", got.CharacterImagePath)
	}
	if got.CharacterImageURL == "" {
		t.Error("the provider URL was cleared; it is what a later re-fetch would use")
	}
	if len(fetches) != 1 || fetches[0] != "https://artworks.thetvdb.com/waller.jpg" {
		t.Fatalf("fetches = %v, want exactly the character URL once", fetches)
	}

	// AGAIN. The route has to be cheap to call for every chip about to be drawn,
	// so a row that is already ours must not be fetched a second time.
	again := decode[castRow](t, c.mustDo("POST", "/cast/"+itoa(withArt)+"/image", nil, http.StatusOK))
	if again.CharacterImagePath != "waller-stored.jpg" {
		t.Errorf("second call changed the path to %q", again.CharacterImagePath)
	}
	if len(fetches) != 1 {
		t.Errorf("%d fetches after two calls, want 1 — the route is not idempotent", len(fetches))
	}

	// A ROLE WITH NO ART IS NOT AN ERROR, and must not be a 404: the client has to
	// be able to tell it from a row that is not theirs, because one falls back to
	// the actor's headshot and the other is a bug.
	empty := decode[castRow](t, c.mustDo("POST", "/cast/"+itoa(noArt)+"/image", nil, http.StatusOK))
	if empty.CharacterImagePath != "" {
		t.Errorf("a role with no provider art got a stored path %q", empty.CharacterImagePath)
	}
	if len(fetches) != 1 {
		t.Errorf("a row with no URL triggered a fetch: %v", fetches)
	}
}

// A FAILED FETCH COSTS A PICTURE, NOT THE ROW. The provider URL stays, so the
// next attempt can try again, and nothing is written.
func TestAFailedCharacterImageFetchLeavesTheRowAlone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, withArt, _ := seedTVDBCast(t, srv, c)

	srv.fetchImage = func(context.Context, string, string) (string, error) {
		return "", errors.New("image host said no")
	}
	c.mustDo("POST", "/cast/"+itoa(withArt)+"/image", nil, http.StatusBadGateway)

	for _, row := range castOf(t, c, "/movies/1/cast").Cast {
		if row.ID != withArt {
			continue
		}
		if row.CharacterImagePath != "" {
			t.Errorf("a failed fetch wrote a path: %q", row.CharacterImagePath)
		}
		if row.CharacterImageURL == "" {
			t.Error("a failed fetch cleared the provider URL, so a retry has nothing to fetch")
		}
	}
}

// ANOTHER READER'S ROW IS A 404, NEVER A 403 — the per-user rule this whole API
// follows, so one reader cannot learn that another's row exists.
func TestAnotherReadersCastImageIsNotFound(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	owner := signupAdmin(t, h)
	_, withArt, _ := seedTVDBCast(t, srv, owner)

	other := addUser(t, h, owner, "bob")
	fetched := false
	srv.fetchImage = func(context.Context, string, string) (string, error) {
		fetched = true
		return "leaked.jpg", nil
	}
	other.mustDo("POST", "/cast/"+itoa(withArt)+"/image", nil, http.StatusNotFound)
	if fetched {
		t.Error("another reader's request reached the fetch")
	}
}

// A READER'S OWN PICTURE WORKS THE SAME WAY AS A FETCHED ONE (0050).
//
// "The same way" is a claim about four things and each is asserted below: it
// lands in the same column, it goes through the reader's fetcher rather than the
// provider allowlist, it REPLACES what a provider supplied, and it survives every
// later refetch. The last is the one that would rot silently — a refetch takes
// character_image_url back by design, so if a reader's choice lived in that column
// the next /metadata/fill would quietly discard it.
func TestAReaderSuppliedCharacterImageWorksTheSameWayAndSurvivesARefetch(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film, withArt, noArt := seedTVDBCast(t, srv, c)

	provider, reader := []string{}, []string{}
	srv.fetchImage = func(_ context.Context, rawURL, _ string) (string, error) {
		provider = append(provider, rawURL)
		return "from-provider.jpg", nil
	}
	srv.fetchUserImage = func(_ context.Context, rawURL, _ string) (string, error) {
		reader = append(reader, rawURL)
		return "from-reader.jpg", nil
	}

	// A role the provider has no picture for — the case a reader most wants to fix.
	got := decode[castRow](t, c.mustDo("POST", "/cast/"+itoa(noArt)+"/image",
		map[string]any{"image_url": "https://example.test/my-extra.png"}, http.StatusOK))
	if got.CharacterImagePath != "from-reader.jpg" {
		t.Fatalf("stored path = %q, want the reader's picture", got.CharacterImagePath)
	}
	if len(reader) != 1 || reader[0] != "https://example.test/my-extra.png" {
		t.Fatalf("reader fetches = %v, want the typed URL once", reader)
	}
	if len(provider) != 0 {
		t.Errorf("a reader's URL went through the provider allowlist: %v", provider)
	}

	// AND IT REPLACES a provider's picture, because typing a URL is choosing.
	c.mustDo("POST", "/cast/"+itoa(withArt)+"/image", nil, http.StatusOK) // provider first
	replaced := decode[castRow](t, c.mustDo("POST", "/cast/"+itoa(withArt)+"/image",
		map[string]any{"image_url": "https://example.test/better-waller.png"}, http.StatusOK))
	if replaced.CharacterImagePath != "from-reader.jpg" {
		t.Fatalf("path = %q, want the reader's choice to replace the provider's",
			replaced.CharacterImagePath)
	}

	// NOW REFETCH THE WHOLE TITLE, which is what /metadata/fill does unattended.
	tx, err := srv.Store.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	err = mergeProviderCast(tx, 1, "movie", film, "tvdb", []metadata.CastMember{
		{Character: "Amanda Waller", Actor: "Viola Davis",
			CharacterImageURL: "https://artworks.thetvdb.com/waller-v2.jpg"},
		{Character: "Uncredited Extra", Actor: "Somebody"},
	})
	if err != nil {
		tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	after := map[string]castRow{}
	for _, row := range castOf(t, c, "/movies/"+itoa(film)+"/cast").Cast {
		after[row.Character] = row
	}
	if p := after["Amanda Waller"].CharacterImagePath; p != "from-reader.jpg" {
		t.Errorf("Waller's stored picture after a refetch = %q, want the reader's — a "+
			"refetch must not discard a picture somebody chose", p)
	}
	if p := after["Uncredited Extra"].CharacterImagePath; p != "from-reader.jpg" {
		t.Errorf("the extra's stored picture after a refetch = %q, want the reader's", p)
	}
	// The provider's URL DID move, so this is not passing because the refetch was
	// a no-op — the two columns are genuinely independent.
	if u := after["Amanda Waller"].CharacterImageURL; u != "https://artworks.thetvdb.com/waller-v2.jpg" {
		t.Errorf("provider URL = %q, want the refetched one; the refetch did not take effect", u)
	}
}

// A reader cannot make the SERVER read its own disk. file:// and data: are
// refused before any fetcher sees them.
func TestAReaderSuppliedCharacterImageMustBeHTTP(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, withArt, _ := seedTVDBCast(t, srv, c)

	reached := false
	srv.fetchUserImage = func(context.Context, string, string) (string, error) {
		reached = true
		return "x.jpg", nil
	}
	for _, bad := range []string{"file:///etc/passwd", "data:image/png;base64,AAA", "ftp://host/x.png"} {
		c.mustDo("POST", "/cast/"+itoa(withArt)+"/image",
			map[string]any{"image_url": bad}, http.StatusBadRequest)
	}
	if reached {
		t.Error("a non-http scheme reached the fetcher")
	}
}
