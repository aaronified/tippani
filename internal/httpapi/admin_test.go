package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"testing"
	"testing/fstest"

	"tippani/internal/store"
)

// TestOnboardingAndAdmin exercises the first-run onboarding -> admin -> in-app
// user management flow end to end through the full handler chain.
func TestOnboardingAndAdmin(t *testing.T) {
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	srv := New(st, fstest.MapFS{}, false, false)
	h := srv.Handler()

	// do sends a JSON request, optionally carrying a session cookie, and
	// returns the response recorder.
	do := func(method, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		var buf bytes.Buffer
		if body != nil {
			_ = json.NewEncoder(&buf).Encode(body)
		}
		req := httptest.NewRequest(method, path, &buf)
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

	// Onboarding is open before any user exists.
	if rec := do("GET", "/auth/status", nil, nil); rec.Code != 200 || !bytes.Contains(rec.Body.Bytes(), []byte(`"needs_onboarding":true`)) {
		t.Fatalf("status before onboarding: %d %s", rec.Code, rec.Body)
	}

	// Signup creates the admin and logs them in.
	rec := do("POST", "/auth/signup", creds, nil)
	if rec.Code != 200 {
		t.Fatalf("signup: %d %s", rec.Code, rec.Body)
	}
	admin := sessionOf(rec)

	// The admin flag is set on /auth/me.
	if rec := do("GET", "/auth/me", nil, admin); !bytes.Contains(rec.Body.Bytes(), []byte(`"is_admin":true`)) {
		t.Fatalf("me: %s", rec.Body)
	}
	// Onboarding is now closed.
	if rec := do("GET", "/auth/status", nil, nil); !bytes.Contains(rec.Body.Bytes(), []byte(`"needs_onboarding":false`)) {
		t.Fatalf("status after onboarding: %s", rec.Body)
	}
	if rec := do("POST", "/auth/signup", map[string]string{"username": "mallory", "password": "supersecret"}, nil); rec.Code != http.StatusForbidden {
		t.Fatalf("second signup should be forbidden: %d", rec.Code)
	}

	// Admin adds a regular user.
	rec = do("POST", "/admin/users", map[string]string{"username": "bob", "password": "supersecret"}, admin)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create user: %d %s", rec.Code, rec.Body)
	}
	var created userRow
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	if created.IsAdmin || created.ID == 0 {
		t.Fatalf("created user should be non-admin with an id: %+v", created)
	}
	// Duplicate username is rejected.
	if rec := do("POST", "/admin/users", map[string]string{"username": "bob", "password": "supersecret"}, admin); rec.Code != http.StatusConflict {
		t.Fatalf("duplicate username: %d", rec.Code)
	}

	// A non-admin cannot manage users.
	bob := sessionOf(do("POST", "/auth/login", map[string]string{"username": "bob", "password": "supersecret"}, nil))
	if rec := do("GET", "/admin/users", nil, bob); rec.Code != http.StatusForbidden {
		t.Fatalf("non-admin listing users should be forbidden: %d", rec.Code)
	}

	// The admin cannot delete themselves, but can delete others.
	if rec := do("DELETE", "/admin/users/1", nil, admin); rec.Code != http.StatusConflict {
		t.Fatalf("self-delete should be rejected: %d", rec.Code)
	}
	if rec := do("DELETE", "/admin/users/"+itoa(created.ID), nil, admin); rec.Code != 200 {
		t.Fatalf("delete user: %d %s", rec.Code, rec.Body)
	}
	if rec := do("GET", "/admin/users", nil, admin); bytes.Contains(rec.Body.Bytes(), []byte(`"bob"`)) {
		t.Fatalf("deleted user still listed: %s", rec.Body)
	}
}

func itoa(n int64) string {
	return strconv.FormatInt(n, 10)
}
