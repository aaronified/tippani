package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// The dashboard widget, driven the way gethomepage drives it: a GET with the
// key in a header, and four numbers back. The library is built through the API
// and the two recall numbers are earned by answering the quiz, so "mastered"
// and "forgot" here mean what a reader's own answers made them.
func TestWidgetReportsTheFourNumbers(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	// Mastered is the top rung; srStart=mastered puts a first correct answer there.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srStart": startMastered}, http.StatusOK)
	book := createBook(t, c, "Meditations")
	c.mustDo("POST", "/books", map[string]any{"title": "Letters from a Stoic"}, http.StatusCreated)
	var ids []int64
	for _, q := range []string{
		"You have power over your mind, not outside events.",
		"The best revenge is not to be like your enemy.",
		"Waste no more time arguing what a good man should be.",
	} {
		ids = append(ids, idOf(t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": book, "quote": q}, http.StatusCreated).Body.Bytes()))
	}
	c.mustDo("POST", "/quotes", map[string]any{"quote": "Be the change.", "speaker": "Somebody", "occasion": "A speech"}, http.StatusCreated)
	ageSeededItems(t, srv)
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusOK)
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[1], "result": "forgot", "mode": "daily"}, http.StatusOK)

	// No key yet: the endpoint answers nobody.
	if rec := widgetGet(h, "Authorization", "Bearer tpw_nothing"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("unknown key: %d", rec.Code)
	}
	key := decode[struct{ Key string }](t, c.mustDo("POST", "/auth/widget-key", nil, 200)).Key

	for _, hdr := range []string{"Authorization", "X-API-Key"} {
		v := key
		if hdr == "Authorization" {
			v = "Bearer " + key
		}
		rec := widgetGet(h, hdr, v)
		if rec.Code != 200 {
			t.Fatalf("%s: %d %s", hdr, rec.Code, rec.Body)
		}
		got := decode[widgetCounts](t, rec)
		want := widgetCounts{Works: 2, Quotes: 4, Forgot: 1, Mastered: 1}
		if got != want {
			t.Fatalf("%s: got %+v, want %+v", hdr, got, want)
		}
	}

	// A key opens four numbers and nothing else.
	req := httptest.NewRequest("GET", "/api/books", nil)
	req.Header.Set("Authorization", "Bearer "+key)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("widget key reached /books: %d", rec.Code)
	}

	// Rotating replaces; revoking closes.
	key2 := decode[struct{ Key string }](t, c.mustDo("POST", "/auth/widget-key", nil, 200)).Key
	if widgetGet(h, "X-API-Key", key).Code != http.StatusUnauthorized || widgetGet(h, "X-API-Key", key2).Code != 200 {
		t.Fatal("a rotated key did not replace the old one")
	}
	c.mustDo("DELETE", "/auth/widget-key", nil, 200)
	if widgetGet(h, "X-API-Key", key2).Code != http.StatusUnauthorized {
		t.Fatal("a revoked key still answers")
	}
}

// Another reader's key sees another reader's library: the counts are per user.
func TestWidgetKeyIsPerUser(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	createBook(t, alice, "Only Alice's")
	key := decode[struct{ Key string }](t, bob.mustDo("POST", "/auth/widget-key", nil, 200)).Key
	if got := decode[widgetCounts](t, widgetGet(h, "X-API-Key", key)); got.Works != 0 {
		t.Fatalf("bob's widget counted alice's works: %+v", got)
	}
}

func widgetGet(h http.Handler, header, value string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", "/api/widget", nil)
	req.Header.Set(header, value)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}
