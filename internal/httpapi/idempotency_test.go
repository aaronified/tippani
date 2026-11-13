package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
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

func TestARepeatWhileTheFirstIsStillBeingMadeIsToldToWaitAndADeadOneIsReplaced(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	var uid int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users LIMIT 1`).Scan(&uid); err != nil {
		t.Fatal(err)
	}
	// the path the wrapper sees is the route's, without the /api prefix the mount strips
	path := "/anthologies"
	if _, err := srv.Store.DB.Exec(`DELETE FROM idempotency_keys`); err != nil {
		t.Fatal(err)
	}
	insert := func(age string) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(`INSERT OR REPLACE INTO idempotency_keys (user_id, key, method, path, status, body, created_at)
		                                VALUES (?, 'pending', 'POST', ?, 0, x'', datetime('now', ?))`, uid, path, age); err != nil {
			t.Fatal(err)
		}
	}
	insert("-10 seconds")
	rec := postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": "Racing"}, "pending")
	if rec.Code != http.StatusConflict || rec.Header().Get("Retry-After") == "" {
		t.Fatalf("a repeat while the first is being made answered %d, want 409 with Retry-After", rec.Code)
	}
	if n := countAnthologies(t, c); n != 0 {
		t.Fatalf("%d anthologies made while the first request was still pending", n)
	}

	insert("-10 minutes")
	if rec := postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": "Retried"}, "pending"); rec.Code != http.StatusCreated {
		t.Fatalf("a request that died ten minutes ago blocked its retry: %d", rec.Code)
	}
}

func TestTwoRequestsWithOneKeyInFlightAtOnceMakeOneAnthology(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	var wg sync.WaitGroup
	codes := make([]int, 8)
	for i := range codes {
		wg.Add(1)
		go func() {
			defer wg.Done()
			codes[i] = postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": "Once"}, "same").Code
		}()
	}
	wg.Wait()
	made := 0
	for _, code := range codes {
		if code == http.StatusCreated {
			made++
		} else if code != http.StatusConflict {
			t.Errorf("a repeat answered %d, want 201 (the answer again) or 409 (still being made)", code)
		}
	}
	if made == 0 {
		t.Fatal("no request was answered 201")
	}
	if n := countAnthologies(t, c); n != 1 {
		t.Fatalf("%d anthologies after eight sends of one key, want 1", n)
	}
}

func TestEveryRouteTheAppQueuesHonoursAKey(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := newTestBook(t, c, "Walden")
	movie := newWork(t, c, "Heat", "movie")
	an := newAnthology(t, c, "Host")
	utt := idOf(t, c.mustDo("POST", "/quotes", map[string]any{"quote": "A standalone line."}, http.StatusCreated).Body.Bytes())

	for _, tc := range []struct {
		name, path string
		body       map[string]any
	}{
		{"an anthology", "/anthologies", map[string]any{"title": "Fresh"}},
		{"a heading", "/anthologies/" + itoa(an.ID) + "/sections", map[string]any{"title": "Part one"}},
		{"entries", "/anthologies/" + itoa(an.ID) + "/entries", map[string]any{"items": []map[string]any{{"kind": "utterance", "item_id": utt}}}},
		{"an annotation", "/annotations", map[string]any{"book_id": book, "quote": "A highlight."}},
		{"a dialogue", "/dialogues", map[string]any{"movie_id": movie, "quote": "A film line."}},
		{"a quote", "/quotes", map[string]any{"quote": "Another standalone line."}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			first := postKeyed(t, c, "POST", tc.path, tc.body, "route-"+tc.name)
			if first.Code < 200 || first.Code >= 300 {
				t.Fatalf("the first request answered %d: %s", first.Code, first.Body)
			}
			again := postKeyed(t, c, "POST", tc.path, tc.body, "route-"+tc.name)
			if again.Header().Get("Idempotency-Replayed") != "true" {
				t.Errorf("the repeat was made again (%d) instead of answered from the first", again.Code)
			}
			if again.Body.String() != first.Body.String() {
				t.Errorf("the repeat said %q, the first said %q", again.Body.String(), first.Body.String())
			}
		})
	}
}

func TestAKeyTooLongForTheMemoryIsRefusedNotSilentlyIgnored(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	long := make([]byte, 101)
	for i := range long {
		long[i] = 'k'
	}
	rec := postKeyed(t, c, "POST", "/anthologies", map[string]any{"title": "X"}, string(long))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("a 101-character key answered %d, want 400", rec.Code)
	}
	if n := countAnthologies(t, c); n != 0 {
		t.Errorf("%d anthologies made by a request refused for its key", n)
	}
}
