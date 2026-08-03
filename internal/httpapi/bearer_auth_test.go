package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// requireAuth grew a second credential for native clients: Authorization:
// Bearer <device token>, alongside the browser session cookie. A new auth path
// is the single most likely place to accidentally break the per-user isolation
// the whole multi-user design rests on, so that gets asserted here rather than
// assumed from the cookie path's tests.

// userIDOf looks up a seeded user's id so a test can mint them a device token.
func userIDOf(t *testing.T, srv *Server, username string) int64 {
	t.Helper()
	var id int64
	if err := srv.Store.DB.QueryRow(
		`SELECT id FROM users WHERE username = ?`, username).Scan(&id); err != nil {
		t.Fatalf("look up %q: %v", username, err)
	}
	return id
}

// pairDevice mints a device token for username and returns a client that
// authenticates with it and nothing else — no cookie, as on a real phone.
func pairDevice(t *testing.T, srv *Server, h http.Handler, username string) *testClient {
	t.Helper()
	token, err := srv.Devices.Create(userIDOf(t, srv, username), username+"'s Pixel")
	if err != nil {
		t.Fatal(err)
	}
	return &testClient{t: t, h: h, bearer: token}
}

func TestBearerTokenAuthenticatesCRUD(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	web := signupAdmin(t, h)
	web.mustDo("POST", "/books", map[string]any{"title": "Invisible Cities"}, http.StatusCreated)

	phone := pairDevice(t, srv, h, "alice")

	// Read what the browser wrote.
	rec := phone.mustDo("GET", "/books", nil, http.StatusOK)
	books := decode[struct {
		Books []struct {
			ID    int64  `json:"id"`
			Title string `json:"title"`
		} `json:"books"`
	}](t, rec)
	if len(books.Books) != 1 || books.Books[0].Title != "Invisible Cities" {
		t.Fatalf("device should see the account's books, got %+v", books.Books)
	}

	// And write back.
	phone.mustDo("POST", "/annotations", map[string]any{
		"book_id": books.Books[0].ID,
		"quote":   "Cities, like dreams, are made of desires and fears.",
	}, http.StatusCreated)
}

func TestBearerTokenRejectsBadCredentials(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	signupAdmin(t, h)

	for _, tc := range []struct{ name, header string }{
		{"unknown token", "Bearer 0123456789abcdef"},
		{"empty bearer", "Bearer "},
		{"bare scheme", "Bearer"},
		{"wrong scheme", "Basic YWxpY2U6cHc="},
		{"garbage", "nonsense"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", apiPath("/books"), nil)
			req.Header.Set("Authorization", tc.header)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("got %d want 401: %s", rec.Code, rec.Body)
			}
		})
	}
}

// TestBearerTokenIsolatedPerUser is the important one. Bob's device must not
// reach Alice's library, and each device sees only its own owner's rows.
func TestBearerTokenIsolatedPerUser(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	alice.mustDo("POST", "/books", map[string]any{"title": "Alice's Book"}, http.StatusCreated)
	bob.mustDo("POST", "/books", map[string]any{"title": "Bob's Book"}, http.StatusCreated)

	type listResp struct {
		Books []struct {
			Title string `json:"title"`
		} `json:"books"`
	}

	for _, tc := range []struct{ user, want string }{
		{"alice", "Alice's Book"},
		{"bob", "Bob's Book"},
	} {
		phone := pairDevice(t, srv, h, tc.user)
		got := decode[listResp](t, phone.mustDo("GET", "/books", nil, http.StatusOK))
		if len(got.Books) != 1 {
			t.Fatalf("%s's device saw %d books, want 1", tc.user, len(got.Books))
		}
		if got.Books[0].Title != tc.want {
			t.Fatalf("%s's device saw %q, want %q", tc.user, got.Books[0].Title, tc.want)
		}
	}
}

// The admin bit must travel with the token, in both directions.
func TestBearerTokenCarriesAdminRole(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	addUser(t, h, admin, "bob")

	adminPhone := pairDevice(t, srv, h, "alice")
	adminPhone.mustDo("GET", "/admin/users", nil, http.StatusOK)

	bobPhone := pairDevice(t, srv, h, "bob")
	bobPhone.mustDo("GET", "/admin/users", nil, http.StatusForbidden)
}

// A revoked device stops working on its very next request — no cached identity,
// no grace period.
func TestBearerTokenRevokedImmediately(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	signupAdmin(t, h)
	uid := userIDOf(t, srv, "alice")

	token, err := srv.Devices.Create(uid, "Pixel")
	if err != nil {
		t.Fatal(err)
	}
	phone := &testClient{t: t, h: h, bearer: token}
	phone.mustDo("GET", "/books", nil, http.StatusOK)

	devices, err := srv.Devices.List(uid)
	if err != nil {
		t.Fatal(err)
	}
	if err := srv.Devices.Revoke(uid, devices[0].ID); err != nil {
		t.Fatal(err)
	}

	phone.mustDo("GET", "/books", nil, http.StatusUnauthorized)
}

// When both credentials are present the bearer token decides, deterministically
// — otherwise which library you get would depend on header ordering.
func TestBearerTokenWinsOverCookie(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	bob.mustDo("POST", "/books", map[string]any{"title": "Bob's Book"}, http.StatusCreated)

	bobToken, err := srv.Devices.Create(userIDOf(t, srv, "bob"), "Bob's Pixel")
	if err != nil {
		t.Fatal(err)
	}
	// Alice's cookie, Bob's token.
	mixed := &testClient{t: t, h: h, cookie: alice.cookie, bearer: bobToken}

	got := decode[struct {
		Books []struct {
			Title string `json:"title"`
		} `json:"books"`
	}](t, mixed.mustDo("GET", "/books", nil, http.StatusOK))

	if len(got.Books) != 1 || got.Books[0].Title != "Bob's Book" {
		t.Fatalf("bearer token should win over the cookie, got %+v", got.Books)
	}
}

// An invalid bearer token must fail closed rather than falling back to a valid
// cookie that happens to be attached — otherwise a revoked device would keep
// working for as long as any cookie rode along with it.
func TestInvalidBearerDoesNotFallBackToCookie(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)

	mixed := &testClient{t: t, h: h, cookie: alice.cookie, bearer: "0123456789abcdef"}
	mixed.mustDo("GET", "/books", nil, http.StatusUnauthorized)
}

// The CSRF wrapper must not stand between a native client and a write. This
// repeats the header-less case from csrf_native_test.go with the credential the
// app actually uses.
func TestBearerWriteWithoutBrowserHeaders(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	web := signupAdmin(t, h)
	bookID := newTestBook(t, web, "Invisible Cities")

	phone := pairDevice(t, srv, h, "alice")
	rec := postRaw(t, h, phone, "/annotations", map[string]any{
		"book_id": bookID,
		"quote":   "Arriving at each new city, the traveller finds again a past of his.",
	}, nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("bearer write: got %d want 201: %s", rec.Code, rec.Body)
	}
}

// A bearer credential is never sent ambiently by a browser, so CSRF protection
// is meaningless for it — but relaxing it must not relax the cookie path. A
// cross-site request carrying only a cookie stays blocked.
func TestBearerBypassDoesNotWeakenCookieCSRF(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	web := signupAdmin(t, h)
	bookID := newTestBook(t, web, "Invisible Cities")

	// Bearer + cross-site headers: allowed, because the credential is explicit.
	phone := pairDevice(t, srv, h, "alice")
	rec := postRaw(t, h, phone, "/annotations", map[string]any{
		"book_id": bookID, "quote": "A bearer write from anywhere is still mine.",
	}, map[string]string{"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.example"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("bearer cross-site: got %d want 201: %s", rec.Code, rec.Body)
	}

	// Cookie + cross-site headers: still blocked.
	rec = postRaw(t, h, web, "/annotations", map[string]any{
		"book_id": bookID, "quote": "This must never be written.",
	}, map[string]string{"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.example"})
	if rec.Code != http.StatusForbidden {
		t.Fatalf("cookie cross-site: got %d want 403: %s", rec.Code, rec.Body)
	}
}
