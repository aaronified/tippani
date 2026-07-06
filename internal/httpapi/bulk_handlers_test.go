package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

func mkMovie(t *testing.T, c *testClient, title string) int64 {
	t.Helper()
	rec := c.mustDo("POST", "/movies", map[string]any{"title": title}, 201)
	var m struct {
		ID int64 `json:"id"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &m)
	return m.ID
}

// TestBulkTagAnnotations: tag + flag a set of annotations at once (the search
// "select all → tag them" flow), scoped to the caller.
func TestBulkTagAnnotations(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bk := createBook(t, admin, "Dune")

	mk := func(q string) int64 {
		rec := admin.mustDo("POST", "/annotations", map[string]any{"book_id": bk, "quote": q}, 201)
		var a struct {
			ID int64 `json:"id"`
		}
		_ = json.Unmarshal(rec.Body.Bytes(), &a)
		return a.ID
	}
	a1, a2 := mk("one"), mk("two")

	admin.mustDo("POST", "/annotations/bulk", map[string]any{
		"ids": []int64{a1, a2}, "add_tags": []string{"epic", "reread"}, "favorite": true,
	}, 200)

	res := decode[struct {
		Annotations []struct {
			ID       int64    `json:"id"`
			Tags     []string `json:"tags"`
			Favorite bool     `json:"favorite"`
		} `json:"annotations"`
	}](t, admin.mustDo("GET", fmt.Sprintf("/annotations?book_id=%d", bk), nil, 200))
	if len(res.Annotations) != 2 {
		t.Fatalf("want 2 annotations, got %d", len(res.Annotations))
	}
	for _, a := range res.Annotations {
		if len(a.Tags) != 2 || !a.Favorite {
			t.Fatalf("annotation %d not tagged/faved: %+v", a.ID, a)
		}
	}

	// A second user can't tag them.
	bob := addUser(t, h, admin, "bob")
	bob.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{a1, a2}, "add_tags": []string{"x"}}, http.StatusNotFound)
}

// TestBulkUpdateMovies: batch director/series correction over a selection.
func TestBulkUpdateMovies(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m1, m2 := mkMovie(t, c, "Heat"), mkMovie(t, c, "Collateral")

	c.mustDo("POST", "/movies/bulk", map[string]any{
		"ids": []int64{m1, m2}, "director": "Michael Mann", "add_genres": []string{"crime"},
	}, 200)

	for _, id := range []int64{m1, m2} {
		var m map[string]any
		_ = json.Unmarshal(c.mustDo("GET", fmt.Sprintf("/movies/%d", id), nil, 200).Body.Bytes(), &m)
		if m["director"] != "Michael Mann" {
			t.Fatalf("movie %d director = %v", id, m["director"])
		}
		if gs, _ := m["genres"].([]any); len(gs) != 1 {
			t.Fatalf("movie %d genres = %v, want [crime]", id, m["genres"])
		}
	}
}
