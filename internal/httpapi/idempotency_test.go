package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// A QUEUED WRITE SENT TWICE MAKES ONE THING (ADR-0933). The phone queues a write while it has no signal; when the
// request reaches the server and the reply does not reach the phone, the phone sends it again. With an
// Idempotency-Key the second send is answered with the first answer and changes nothing.

func postKeyed(t *testing.T, c *testClient, method, path string, body any, key string) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	_ = json.NewEncoder(&buf).Encode(body)
	req := httptest.NewRequest(method, apiPath(path), &buf)
	req.Header.Set("Content-Type", "application/json")
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
	req.AddCookie(c.cookie)
	rec := httptest.NewRecorder()
	c.h.ServeHTTP(rec, req)
	return rec
}

func countAnthologies(t *testing.T, c *testClient) int {
	t.Helper()
	return len(decode[struct {
		Anthologies []anthologyRow `json:"anthologies"`
	}](t, c.mustDo("GET", "/anthologies", nil, http.StatusOK)).Anthologies)
}

func TestTheSameKeyMakesOneAnthologyAndAnswersTheSameAnswer(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	first := postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": "Once"}, "key-1")
	second := postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": "Once"}, "key-1")
	if first.Code != http.StatusCreated || second.Code != http.StatusCreated {
		t.Fatalf("statuses %d and %d, want 201 for both", first.Code, second.Code)
	}
	if first.Body.String() != second.Body.String() {
		t.Errorf("the repeat was answered %q, the first was %q", second.Body.String(), first.Body.String())
	}
	if second.Header().Get("Idempotency-Replayed") != "true" {
		t.Errorf("the repeat does not say it is a replay")
	}
	if n := countAnthologies(t, c); n != 1 {
		t.Fatalf("%d anthologies after the same request was sent twice, want 1", n)
	}

	postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": "Twice"}, "key-2")
	if n := countAnthologies(t, c); n != 2 {
		t.Errorf("a different key made %d anthologies in all, want 2", n)
	}
}

func TestARequestWithNoKeyIsNotRemembered(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": "A"}, "")
	postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": "A"}, "")
	if n := countAnthologies(t, c); n != 2 {
		t.Errorf("%d anthologies, want 2: with no key nothing is a repeat", n)
	}
}

func TestAKeyIsNotReusedForADifferentRequestAndIsNotAnotherAccounts(t *testing.T) {
	srv := newTestServer(t)
	alice := signupAdmin(t, srv.Handler())
	bob := addUser(t, srv.Handler(), alice, "bob")

	postKeyed(t, alice, "POST", "/anthologies", map[string]any{"title": "Mine"}, "shared-key")
	an := newAnthology(t, alice, "Host")
	if rec := postKeyed(t, alice, "POST", "/anthologies/"+itoa(an.ID)+"/sections", map[string]any{"title": "H"}, "shared-key"); rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("the same key on another route answered %d, want 422", rec.Code)
	}
	// Bob's identical key is his own: it makes his anthology rather than replaying Alice's.
	rec := postKeyed(t, bob, "POST", "/anthologies", map[string]any{"title": "Bobs"}, "shared-key")
	if rec.Code != http.StatusCreated || rec.Header().Get("Idempotency-Replayed") == "true" {
		t.Fatalf("another account's key was treated as a repeat: %d", rec.Code)
	}
	if n := countAnthologies(t, bob); n != 1 {
		t.Errorf("bob has %d anthologies, want 1", n)
	}
}

func TestARefusedRequestIsNotRememberedAndAnOldKeyIsForgotten(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	if rec := postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": ""}, "k"); rec.Code == http.StatusCreated {
		t.Fatal("an empty title was accepted")
	}
	if rec := postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": "Fixed"}, "k"); rec.Code != http.StatusCreated {
		t.Fatalf("the key was spent by a refusal: %d", rec.Code)
	}

	if _, err := srv.Store.DB.Exec(`UPDATE idempotency_keys SET created_at = datetime('now', '-2 days')`); err != nil {
		t.Fatal(err)
	}
	postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": "Fixed"}, "k")
	if n := countAnthologies(t, c); n != 2 {
		t.Errorf("%d anthologies, want 2: a key older than a day is no longer a repeat", n)
	}
	// a row of another key, past a day, goes when the next key is written
	if _, err := srv.Store.DB.Exec(`INSERT INTO idempotency_keys (user_id, key, method, path, status, body, created_at)
	                                SELECT id, 'ancient', 'POST', '/x', 201, x'', datetime('now', '-3 days') FROM users LIMIT 1`); err != nil {
		t.Fatal(err)
	}
	postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": "Later"}, "fresh")
	var ancient int
	_ = srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM idempotency_keys WHERE key = 'ancient'`).Scan(&ancient)
	if ancient != 0 {
		t.Errorf("a key three days old was kept: it is swept when the next one is written")
	}
}
