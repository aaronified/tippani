package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"testing/fstest"

	"tippani/internal/store"
)

// clientIP must trust only the rightmost X-Forwarded-For entry (the one a single
// reverse proxy appends). Reading the leftmost, client-forgeable entry let an
// attacker rotate a fake IP per request and evade the login rate limiter.
func TestClientIPRightmostXFF(t *testing.T) {
	req := func(xff, remote string) *http.Request {
		r := httptest.NewRequest("POST", "/auth/login", nil)
		r.RemoteAddr = remote
		if xff != "" {
			r.Header.Set("X-Forwarded-For", xff)
		}
		return r
	}

	trusting := &Server{TrustedProxy: true}
	if got := trusting.clientIP(req("1.2.3.4, 9.9.9.9", "10.0.0.1:1234")); got != "9.9.9.9" {
		t.Fatalf("trusted proxy: got %q, want rightmost 9.9.9.9", got)
	}
	if got := trusting.clientIP(req("9.9.9.9", "10.0.0.1:1234")); got != "9.9.9.9" {
		t.Fatalf("single XFF entry: got %q", got)
	}
	// Without a trusted proxy, XFF is ignored entirely — use the socket peer.
	untrusting := &Server{TrustedProxy: false}
	if got := untrusting.clientIP(req("1.2.3.4", "10.0.0.1:1234")); got != "10.0.0.1" {
		t.Fatalf("untrusted: got %q, want RemoteAddr host 10.0.0.1", got)
	}
}

// Changing a password must revoke every other session for that user (a leaked
// cookie can't outlive the password), while keeping the caller logged in.
func TestPasswordChangeInvalidatesOtherSessions(t *testing.T) {
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	srv := New(st, fstest.MapFS{}, t.TempDir(), false, false)
	h := srv.Handler()

	do := func(method, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		var buf bytes.Buffer
		if body != nil {
			_ = json.NewEncoder(&buf).Encode(body)
		}
		req := httptest.NewRequest(method, apiPath(path), &buf)
		req.Header.Set("Origin", "http://example.test") // satisfy CrossOriginProtection on non-GET
		req.Host = "example.test"
		if cookie != nil {
			req.AddCookie(cookie)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	sessionOf := func(rec *httptest.ResponseRecorder) *http.Cookie {
		t.Helper()
		for _, c := range rec.Result().Cookies() {
			if c.Name == sessionCookie {
				return c
			}
		}
		t.Fatal("no session cookie set")
		return nil
	}

	creds := map[string]string{"username": "alice", "password": "supersecret"}
	sessionA := sessionOf(do("POST", "/auth/signup", creds, nil))
	// A second, independent login for the same user (a "stolen"/other device).
	sessionB := sessionOf(do("POST", "/auth/login", creds, nil))

	// Both sessions work before the change.
	if rec := do("GET", "/auth/me", nil, sessionB); rec.Code != 200 {
		t.Fatalf("session B before change: %d", rec.Code)
	}

	// Change the password using session A.
	rec := do("POST", "/auth/password", map[string]string{"current": "supersecret", "new": "brand-new-secret"}, sessionA)
	if rec.Code != 200 {
		t.Fatalf("password change: %d %s", rec.Code, rec.Body)
	}
	// The caller gets a fresh cookie and stays logged in.
	fresh := sessionOf(rec)
	if r := do("GET", "/auth/me", nil, fresh); r.Code != 200 {
		t.Fatalf("re-issued session rejected: %d", r.Code)
	}
	// The other session (and the old A cookie) are now invalid.
	if r := do("GET", "/auth/me", nil, sessionB); r.Code != http.StatusUnauthorized {
		t.Fatalf("session B should be revoked, got %d", r.Code)
	}
	if r := do("GET", "/auth/me", nil, sessionA); r.Code != http.StatusUnauthorized {
		t.Fatalf("old session A should be revoked, got %d", r.Code)
	}
}

// Passwords longer than bcrypt's 72-byte limit must be a clean 400, not a 500.
func TestPasswordLengthBounds(t *testing.T) {
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	srv := New(st, fstest.MapFS{}, t.TempDir(), false, false)
	h := srv.Handler()

	body := new(bytes.Buffer)
	long := make([]byte, 100)
	for i := range long {
		long[i] = 'a'
	}
	_ = json.NewEncoder(body).Encode(map[string]string{"username": "bob", "password": string(long)})
	req := httptest.NewRequest("POST", "/api/auth/signup", body)
	req.Header.Set("Origin", "http://example.test")
	req.Host = "example.test"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("over-long password: got %d, want 400 (%s)", rec.Code, rec.Body)
	}
}
