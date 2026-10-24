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

// Who can take admin rights away from whom.
//
// The rule is asymmetric on purpose: GRANTING is something you do to others,
// REVOKING is something you do to yourself. Without that, admin is not a role
// but a race — two admins, and whichever opens the page first is the only one
// left. There is no seniority here to appeal to, no founder flag, no audit
// trail, and nothing to undo it with once your own rights are gone.
//
// None of this is enforceable in the UI. Hiding a button is a courtesy to the
// person who was not going to press it; the request is four words of curl, and
// the account it demotes is the one that could have stopped it.

// adminOf promotes an existing member and returns their session, which is the
// supported route to a second admin: no fixture writes is_admin directly,
// because a rule about who may promote whom is worth exercising through the
// endpoint that enforces it.
func promote(t *testing.T, by *testClient, id int64) {
	t.Helper()
	by.mustDo("PATCH", "/admin/users/"+itoa(id), map[string]bool{"is_admin": true}, 200)
}

func userIDNamed(t *testing.T, c *testClient, name string) int64 {
	t.Helper()
	users := decode[struct {
		Users []userRow `json:"users"`
	}](t, c.mustDo("GET", "/admin/users", nil, 200))
	for _, u := range users.Users {
		if u.Username == name {
			return u.ID
		}
	}
	t.Fatalf("no user named %q", name)
	return 0
}

func TestAnAdminCannotRevokeAnotherAdmin(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	bobID := userIDNamed(t, alice, "bob")

	// Promoting a member is the half that stays allowed.
	promote(t, alice, bobID)
	bob.mustDo("GET", "/admin/users", nil, 200)

	// Neither direction, and it is worth asserting BOTH: a rule written as
	// "the first admin is protected" would pass one of these.
	aliceID := userIDNamed(t, alice, "alice")
	alice.mustDo("PATCH", "/admin/users/"+itoa(bobID), map[string]bool{"is_admin": false}, http.StatusForbidden)
	bob.mustDo("PATCH", "/admin/users/"+itoa(aliceID), map[string]bool{"is_admin": false}, http.StatusForbidden)

	// And the refusal is a refusal, not a 200 that did nothing.
	if !isAdminNow(t, srv, bobID) {
		t.Fatal("bob lost his rights to a request that was refused")
	}
	if !isAdminNow(t, srv, aliceID) {
		t.Fatal("alice lost her rights to a request that was refused")
	}
}

func TestAnAdminCanStepDownWhileAnotherRemains(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	bobID := userIDNamed(t, alice, "bob")
	aliceID := userIDNamed(t, alice, "alice")
	promote(t, alice, bobID)

	// The handover, which must still work end to end — the point of the rule is
	// to stop one person doing both halves, not to freeze the roster.
	alice.mustDo("PATCH", "/admin/users/"+itoa(aliceID), map[string]bool{"is_admin": false}, 200)
	alice.mustDo("GET", "/admin/users", nil, http.StatusForbidden)
	bob.mustDo("GET", "/admin/users", nil, 200)
}

func TestTheLastAdminCannotStepDown(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	aliceID := userIDNamed(t, alice, "alice")

	// 409, not 403: this one IS about the state of the instance, and the same
	// request succeeds the moment there is a second admin.
	alice.mustDo("PATCH", "/admin/users/"+itoa(aliceID), map[string]bool{"is_admin": false}, http.StatusConflict)
	if !isAdminNow(t, srv, aliceID) {
		t.Fatal("the instance lost its last admin")
	}
}

func TestAnAdminCannotBeDeletedByAnother(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	addUser(t, h, alice, "bob")
	bobID := userIDNamed(t, alice, "bob")

	// A member is deletable — the guard must not have swallowed the ordinary case.
	carol := addUser(t, h, alice, "carol")
	_ = carol
	carolID := userIDNamed(t, alice, "carol")
	alice.mustDo("DELETE", "/admin/users/"+itoa(carolID), nil, 200)

	// An admin is not, and this is the bypass the revoke rule needs closed:
	// refusing to take someone's rights while allowing their whole account to be
	// removed protects nothing at all.
	promote(t, alice, bobID)
	alice.mustDo("DELETE", "/admin/users/"+itoa(bobID), nil, http.StatusForbidden)
	if !isAdminNow(t, srv, bobID) {
		t.Fatal("bob was removed by a request that was refused")
	}
}

// isAdminNow reads the flag straight out of the database. Asserting on the
// response alone would pass for a handler that refuses loudly and updates
// anyway — which is the one failure this whole file exists to catch.
func isAdminNow(t *testing.T, srv *Server, id int64) bool {
	t.Helper()
	var v bool
	if err := srv.Store.DB.QueryRow(`SELECT is_admin FROM users WHERE id = ?`, id).Scan(&v); err != nil {
		t.Fatalf("read is_admin for %d: %v", id, err)
	}
	return v
}

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
	srv := New(st, fstest.MapFS{}, t.TempDir(), false, false)
	h := srv.Handler()

	// do sends a JSON request, optionally carrying a session cookie, and
	// returns the response recorder.
	do := func(method, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		var buf bytes.Buffer
		if body != nil {
			_ = json.NewEncoder(&buf).Encode(body)
		}
		req := httptest.NewRequest(method, apiPath(path), &buf)
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

	// An admin is not deletable by another admin, last or not. Otherwise the rule
	// that an admin cannot revoke another admin's rights protects nothing: the
	// bypass is one button away and takes that person's whole library with it.
	if _, err := st.DB.Exec(`INSERT INTO users (username, password_hash, is_admin) VALUES ('carol', 'x', 1)`); err != nil {
		t.Fatal(err)
	}
	var carolID int64
	if err := st.DB.QueryRow(`SELECT id FROM users WHERE username = 'carol'`).Scan(&carolID); err != nil {
		t.Fatal(err)
	}
	if rec := do("DELETE", "/admin/users/"+itoa(carolID), nil, admin); rec.Code != http.StatusForbidden {
		t.Fatalf("deleting another admin should be refused: %d %s", rec.Code, rec.Body)
	}
	// Once she has stepped down she is an ordinary account again, and the
	// last-admin guard must not block removing her — which is the case this
	// block was originally written to cover.
	if _, err := st.DB.Exec(`UPDATE users SET is_admin = 0 WHERE id = ?`, carolID); err != nil {
		t.Fatal(err)
	}
	if rec := do("DELETE", "/admin/users/"+itoa(carolID), nil, admin); rec.Code != 200 {
		t.Fatalf("deleting a former admin should succeed: %d %s", rec.Code, rec.Body)
	}
}

func itoa(n int64) string {
	return strconv.FormatInt(n, 10)
}

// TestDisplayNameAndRoles covers PUT /auth/me (rename) and PATCH
// /admin/users/{id} (grant/revoke admin, transfer, last-admin guard).
func TestDisplayNameAndRoles(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h) // "alice", user 1, admin

	// Rename self; reflected on the next request (session re-reads the name).
	admin.mustDo("PUT", "/auth/me", map[string]string{"username": "alice2"}, 200)
	if me := decode[meResp](t, admin.mustDo("GET", "/auth/me", nil, 200)); me.Username != "alice2" {
		t.Fatalf("rename: got %q", me.Username)
	}
	// Blank / whitespace / spaced names are rejected.
	admin.mustDo("PUT", "/auth/me", map[string]string{"username": "   "}, http.StatusBadRequest)
	admin.mustDo("PUT", "/auth/me", map[string]string{"username": "has space"}, http.StatusBadRequest)

	// A second user: renaming into their name conflicts (409); a no-op rename to
	// your own current name still succeeds.
	bob := addUser(t, h, admin, "bob")
	admin.mustDo("PUT", "/auth/me", map[string]string{"username": "bob"}, http.StatusConflict)
	bob.mustDo("PUT", "/auth/me", map[string]string{"username": "bob"}, 200)

	users := decode[struct {
		Users []userRow `json:"users"`
	}](t, admin.mustDo("GET", "/admin/users", nil, 200))
	var bobID int64
	for _, u := range users.Users {
		if u.Username == "bob" {
			bobID = u.ID
		}
	}
	if bobID == 0 {
		t.Fatal("bob not in the user list")
	}

	// A non-admin can't change roles; a missing body is a 400.
	bob.mustDo("PATCH", "/admin/users/"+itoa(bobID), map[string]bool{"is_admin": true}, http.StatusForbidden)
	admin.mustDo("PATCH", "/admin/users/"+itoa(bobID), map[string]string{}, http.StatusBadRequest)

	// Grant bob admin; now bob can manage users too.
	admin.mustDo("PATCH", "/admin/users/"+itoa(bobID), map[string]bool{"is_admin": true}, 200)
	bob.mustDo("GET", "/admin/users", nil, 200)

	// Transfer: alice2 (user 1) drops her own admin — allowed while bob is admin.
	admin.mustDo("PATCH", "/admin/users/1", map[string]bool{"is_admin": false}, 200)
	admin.mustDo("GET", "/admin/users", nil, http.StatusForbidden)

	// bob is now the only admin and cannot be demoted; unknown user → 404.
	bob.mustDo("PATCH", "/admin/users/"+itoa(bobID), map[string]bool{"is_admin": false}, http.StatusConflict)
	bob.mustDo("PATCH", "/admin/users/99999", map[string]bool{"is_admin": true}, http.StatusNotFound)
}

// A password the admin chose is temporary: until its owner picks their own, the
// session answers who-am-I, the change itself, sign-out and the reader's own fonts, and nothing else —
// the admin who knows the password must not be able to read the library with it.
func TestAnAdminSetPasswordMustBeChangedBeforeTheLibraryOpens(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("POST", "/admin/users", map[string]string{"username": "cara", "password": "given-by-admin"}, http.StatusCreated)

	cara := &testClient{t: t, h: h}
	rec := cara.do("POST", "/auth/login", map[string]string{"username": "cara", "password": "given-by-admin"})
	if rec.Code != 200 {
		t.Fatalf("login: %d %s", rec.Code, rec.Body)
	}
	cara.cookie = cookieOf(t, rec)
	me := decode[struct {
		Must bool `json:"must_change_password"`
	}](t, cara.mustDo("GET", "/auth/me", nil, 200))
	if !me.Must {
		t.Fatal("/auth/me does not say the password is temporary")
	}
	cara.mustDo("GET", "/books", nil, http.StatusForbidden)
	// What stays open: the fonts the app loads first, and the way out.
	cara.mustDo("GET", "/fonts", nil, 200)
	// Past the gate to the handler: a font that does not exist is a 404, not the 403.
	cara.mustDo("GET", "/fonts/999/file", nil, http.StatusNotFound)
	leaver := &testClient{t: t, h: h}
	rec2 := leaver.do("POST", "/auth/login", map[string]string{"username": "cara", "password": "given-by-admin"})
	leaver.cookie = cookieOf(t, rec2)
	leaver.mustDo("POST", "/auth/logout", nil, 200)
	cara.mustDo("POST", "/books", map[string]any{"title": "Nope"}, http.StatusForbidden)
	// Choosing the given password again is not choosing one's own.
	cara.mustDo("POST", "/auth/password", map[string]string{"current": "given-by-admin", "new": "given-by-admin"}, http.StatusBadRequest)

	rec = cara.mustDo("POST", "/auth/password", map[string]string{"current": "given-by-admin", "new": "caras-own-pw"}, 200)
	cara.cookie = cookieOf(t, rec)
	cara.mustDo("GET", "/books", nil, 200)
	me = decode[struct {
		Must bool `json:"must_change_password"`
	}](t, cara.mustDo("GET", "/auth/me", nil, 200))
	if me.Must {
		t.Fatal("still temporary after choosing one")
	}
	// The admin's own account, made at onboarding, was never temporary.
	admin.mustDo("GET", "/books", nil, 200)
}
