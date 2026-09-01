package httpapi

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

// A portrait belongs to a RECORD, and this is where it can finally be set on one.
//
// THE BUG UNDERNEATH. `PUT /people` upserts by (kind, name), and since records
// stopped being unique on a display name two people may genuinely share one. Its
// own comment says the LOWEST id wins — deliberately, so enrichment is at least
// deterministic — which means choosing a picture for the second of two namesakes
// put it on the first, silently, with a 200 and the wrong face. The record panel,
// which is the one surface that knows exactly which record it is looking at, could
// not offer a portrait at all.
//
// So: `PUT /people/id/{id}` takes the same two fields and the same fetcher, and
// this pins the three things that make it safe — it reaches the record named in
// the path, the old file is collected only after a successful write, and a fetch
// that fails writes nothing.

// twoNamesakes makes two records with one name, which is the case the whole test
// exists for. The second is created directly: the API deliberately resolves by
// name, so there is no request that makes a second one.
func twoNamesakes(t *testing.T, srv *Server, c *testClient) (first, second int64) {
	t.Helper()
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "David Reich"}, http.StatusOK)
	res, err := srv.Store.DB.Exec(`INSERT INTO people (user_id, name) VALUES (1, 'David Reich')`)
	if err != nil {
		t.Fatal(err)
	}
	second, err = res.LastInsertId()
	if err != nil {
		t.Fatal(err)
	}
	if err := srv.Store.DB.QueryRow(
		`SELECT MIN(id) FROM people WHERE user_id = 1 AND name = 'David Reich'`).Scan(&first); err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("seed did not produce two records")
	}
	return first, second
}

func personImage(t *testing.T, srv *Server, id int64) string {
	t.Helper()
	var p string
	if err := srv.Store.DB.QueryRow(`SELECT image_path FROM people WHERE id = ?`, id).Scan(&p); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestAPortraitLandsOnTheRecordNamedInThePathAndNotOnItsNamesake(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	first, second := twoNamesakes(t, srv, c)

	srv.fetchUserImage = func(context.Context, string, string) (string, error) {
		return "reich-second.jpg", nil
	}
	c.mustDo("PUT", "/people/id/"+itoa(second),
		map[string]any{"image_url": "https://example.test/reich.jpg"}, http.StatusOK)

	if got := personImage(t, srv, second); got != "reich-second.jpg" {
		t.Fatalf("the record in the path has image_path %q", got)
	}
	// THE WHOLE POINT. The name-keyed upsert would have written this onto `first`,
	// because it resolves by name and takes the lowest id.
	if got := personImage(t, srv, first); got != "" {
		t.Fatalf("the namesake was given a picture it was never offered: %q", got)
	}
}

func TestClearingAPortraitEmptiesTheRecordAndAFailedFetchWritesNothing(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, id := twoNamesakes(t, srv, c)

	srv.fetchUserImage = func(context.Context, string, string) (string, error) {
		return "reich.jpg", nil
	}
	c.mustDo("PUT", "/people/id/"+itoa(id),
		map[string]any{"image_url": "https://example.test/a.jpg"}, http.StatusOK)

	// A FETCH THAT FAILS COSTS A PICTURE, NOT THE ONE ALREADY THERE. The reader
	// pasted a bad address; losing the portrait they had over it would be the
	// write punishing them for a typo.
	srv.fetchUserImage = func(context.Context, string, string) (string, error) {
		return "", errors.New("nope")
	}
	c.mustDo("PUT", "/people/id/"+itoa(id),
		map[string]any{"image_url": "https://example.test/broken.jpg"}, http.StatusBadGateway)
	if got := personImage(t, srv, id); got != "reich.jpg" {
		t.Fatalf("a failed fetch left image_path %q", got)
	}

	c.mustDo("PUT", "/people/id/"+itoa(id), map[string]any{"clear_image": true}, http.StatusOK)
	if got := personImage(t, srv, id); got != "" {
		t.Fatalf("clearing left %q", got)
	}
}

func TestAnEditThatSaysNothingAboutThePortraitLeavesItAlone(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, id := twoNamesakes(t, srv, c)
	srv.fetchUserImage = func(context.Context, string, string) (string, error) {
		return "reich.jpg", nil
	}
	c.mustDo("PUT", "/people/id/"+itoa(id),
		map[string]any{"image_url": "https://example.test/a.jpg"}, http.StatusOK)

	// THE POINTER RULE, WHICH THE IMAGE FIELDS HAD TO JOIN. A panel that edits one
	// field sends one field, and the portrait must not be collected by a save about
	// a sort name — which is exactly the shape of bug a plain string field makes.
	c.mustDo("PUT", "/people/id/"+itoa(id), map[string]any{"sort_name": "Reich, David"}, http.StatusOK)
	if got := personImage(t, srv, id); got != "reich.jpg" {
		t.Fatalf("a save about the sort name changed the portrait to %q", got)
	}
}

func TestTheRecordEndpointCanEditABioAtLast(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, id := twoNamesakes(t, srv, c)
	// Bio was the one field the record panel could not reach, for the same reason
	// the portrait could not: it was only ever writable by name.
	c.mustDo("PUT", "/people/id/"+itoa(id), map[string]any{"bio": "A geneticist."}, http.StatusOK)
	var bio string
	if err := srv.Store.DB.QueryRow(`SELECT bio FROM people WHERE id = ?`, id).Scan(&bio); err != nil {
		t.Fatal(err)
	}
	if bio != "A geneticist." {
		t.Fatalf("bio = %q", bio)
	}
}
