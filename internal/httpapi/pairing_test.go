package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"tippani/internal/auth"
)

// devicePath builds /auth/devices/{id} for the revoke route.
func devicePath(id int64) string { return "/auth/devices/" + strconv.FormatInt(id, 10) }

// Pairing turns a signed-in browser session into a device token, without ever
// typing a password on the phone: Settings mints a short-lived one-shot code,
// the phone scans it off a QR and exchanges it for a token.
//
// The claim endpoint is necessarily unauthenticated — the phone has no
// credential yet, that being the point — so it is the one new route an attacker
// can reach without a session. Everything here that looks paranoid is about
// that: codes are one-shot, short-lived, and rate limited.

type pairResp struct {
	Code      string `json:"code"`
	ExpiresAt string `json:"expires_at"`
}

type claimResp struct {
	Token    string `json:"token"`
	Username string `json:"username"`
}

func startPairing(t *testing.T, c *testClient) pairResp {
	t.Helper()
	rec := c.mustDo("POST", "/auth/devices/pair", nil, http.StatusCreated)
	got := decode[pairResp](t, rec)
	if got.Code == "" {
		t.Fatal("pairing produced no code")
	}
	return got
}

// claim exchanges a code for a token with no credential attached, as a phone
// would.
func claim(t *testing.T, h http.Handler, code, name string) *httptest.ResponseRecorder {
	t.Helper()
	anon := &testClient{t: t, h: h}
	return anon.do("POST", "/auth/devices/claim", map[string]any{"code": code, "name": name})
}

func TestPairingHappyPath(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	web := signupAdmin(t, h)
	web.mustDo("POST", "/books", map[string]any{"title": "Invisible Cities"}, http.StatusCreated)

	pair := startPairing(t, web)
	rec := claim(t, h, pair.Code, "Alice's Pixel")
	if rec.Code != http.StatusCreated {
		t.Fatalf("claim: %d %s", rec.Code, rec.Body)
	}
	got := decode[claimResp](t, rec)
	if got.Token == "" {
		t.Fatal("claim returned no token")
	}
	if got.Username != "alice" {
		t.Fatalf("username = %q want alice", got.Username)
	}

	// The token works, and lands on the right account.
	phone := &testClient{t: t, h: h, bearer: got.Token}
	books := decode[struct {
		Books []struct {
			Title string `json:"title"`
		} `json:"books"`
	}](t, phone.mustDo("GET", "/books", nil, http.StatusOK))
	if len(books.Books) != 1 || books.Books[0].Title != "Invisible Cities" {
		t.Fatalf("paired device sees %+v", books.Books)
	}

	// And the device shows up in Settings under the name it claimed.
	devices := decode[struct {
		Devices []struct {
			Name string `json:"name"`
		} `json:"devices"`
	}](t, web.mustDo("GET", "/auth/devices", nil, http.StatusOK))
	if len(devices.Devices) != 1 || devices.Devices[0].Name != "Alice's Pixel" {
		t.Fatalf("device list: %+v", devices.Devices)
	}
}

// One-shot: a code that has been spent cannot pair a second device. Otherwise a
// code glimpsed over a shoulder stays useful indefinitely.
func TestPairingCodeIsOneShot(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	web := signupAdmin(t, h)

	pair := startPairing(t, web)
	if rec := claim(t, h, pair.Code, "First"); rec.Code != http.StatusCreated {
		t.Fatalf("first claim: %d %s", rec.Code, rec.Body)
	}
	if rec := claim(t, h, pair.Code, "Second"); rec.Code == http.StatusCreated {
		t.Fatal("a spent pairing code must not pair a second device")
	}
}

func TestPairingRejectsUnknownCode(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	signupAdmin(t, h)

	for _, code := range []string{"", "AAAAAAAA", "not-a-code"} {
		if rec := claim(t, h, code, "Pixel"); rec.Code == http.StatusCreated {
			t.Fatalf("claim(%q) should have failed", code)
		}
	}
}

func TestPairingCodeExpires(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	web := signupAdmin(t, h)

	pair := startPairing(t, web)
	srv.expirePairingCodes() // test seam: age every outstanding code past its TTL

	if rec := claim(t, h, pair.Code, "Pixel"); rec.Code == http.StatusCreated {
		t.Fatal("an expired pairing code must not be claimable")
	}
}

// Only a signed-in user can mint a code — otherwise the unauthenticated claim
// endpoint would have an unauthenticated counterpart that feeds it.
func TestPairingRequiresAuthToStart(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	signupAdmin(t, h)

	anon := &testClient{t: t, h: h}
	anon.mustDo("POST", "/auth/devices/pair", nil, http.StatusUnauthorized)
}

// The claim endpoint is the one unauthenticated route that hands out a
// credential, so guessing at it has to get expensive quickly.
func TestPairingClaimRateLimited(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	web := signupAdmin(t, h)
	pair := startPairing(t, web)

	var limited bool
	for i := 0; i < 40; i++ {
		if rec := claim(t, h, "WRONGCOD", "Attacker"); rec.Code == http.StatusTooManyRequests {
			limited = true
			break
		}
	}
	if !limited {
		t.Fatal("brute-forcing pairing codes should hit a rate limit")
	}

	// And the limiter is not so lax that a real code slips through afterwards
	// on the same bucket — it stays refused until the window passes.
	if rec := claim(t, h, pair.Code, "Pixel"); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("a limited client should stay limited, got %d", rec.Code)
	}
}

func TestPairingCodeScopedToItsUser(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	bob.mustDo("POST", "/books", map[string]any{"title": "Bob's Book"}, http.StatusCreated)

	// Bob pairs; the resulting token must be Bob's, not the admin's.
	pair := startPairing(t, bob)
	got := decode[claimResp](t, claim(t, h, pair.Code, "Bob's Pixel"))
	if got.Username != "bob" {
		t.Fatalf("username = %q want bob", got.Username)
	}

	phone := &testClient{t: t, h: h, bearer: got.Token}
	books := decode[struct {
		Books []struct {
			Title string `json:"title"`
		} `json:"books"`
	}](t, phone.mustDo("GET", "/books", nil, http.StatusOK))
	if len(books.Books) != 1 || books.Books[0].Title != "Bob's Book" {
		t.Fatalf("bob's device sees %+v", books.Books)
	}
}

func TestDeviceRevokeEndpoint(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	web := signupAdmin(t, h)

	pair := startPairing(t, web)
	token := decode[claimResp](t, claim(t, h, pair.Code, "Pixel")).Token
	phone := &testClient{t: t, h: h, bearer: token}
	phone.mustDo("GET", "/books", nil, http.StatusOK)

	devices := decode[struct {
		Devices []struct {
			ID int64 `json:"id"`
		} `json:"devices"`
	}](t, web.mustDo("GET", "/auth/devices", nil, http.StatusOK))

	web.mustDo("DELETE", devicePath(devices.Devices[0].ID), nil, http.StatusNoContent)
	phone.mustDo("GET", "/books", nil, http.StatusUnauthorized)
}

// A device list must never expose another user's devices, and revoking by a
// guessed id must not work across accounts.
func TestDeviceListAndRevokeAreScopedToOwner(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	bobPair := startPairing(t, bob)
	bobToken := decode[claimResp](t, claim(t, h, bobPair.Code, "Bob's Pixel")).Token

	// Alice sees none of Bob's devices.
	aliceDevices := decode[struct {
		Devices []struct {
			ID int64 `json:"id"`
		} `json:"devices"`
	}](t, alice.mustDo("GET", "/auth/devices", nil, http.StatusOK))
	if len(aliceDevices.Devices) != 0 {
		t.Fatalf("alice sees %d devices, want 0", len(aliceDevices.Devices))
	}

	bobDevices := decode[struct {
		Devices []struct {
			ID int64 `json:"id"`
		} `json:"devices"`
	}](t, bob.mustDo("GET", "/auth/devices", nil, http.StatusOK))

	// Alice cannot revoke Bob's device by id, and it keeps working.
	alice.mustDo("DELETE", devicePath(bobDevices.Devices[0].ID), nil, http.StatusNotFound)
	bobPhone := &testClient{t: t, h: h, bearer: bobToken}
	bobPhone.mustDo("GET", "/books", nil, http.StatusOK)
}

func TestDeviceRevokeAll(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	web := signupAdmin(t, h)

	var tokens []string
	for _, name := range []string{"Pixel", "Tablet"} {
		pair := startPairing(t, web)
		tokens = append(tokens, decode[claimResp](t, claim(t, h, pair.Code, name)).Token)
	}

	web.mustDo("POST", "/auth/devices/revoke-all", nil, http.StatusNoContent)
	for _, tok := range tokens {
		phone := &testClient{t: t, h: h, bearer: tok}
		phone.mustDo("GET", "/books", nil, http.StatusUnauthorized)
	}
}

// The device list is a credential list; it must carry no token material.
func TestDeviceListLeaksNoTokenMaterial(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	web := signupAdmin(t, h)
	pair := startPairing(t, web)
	token := decode[claimResp](t, claim(t, h, pair.Code, "Pixel")).Token

	rec := web.mustDo("GET", "/auth/devices", nil, http.StatusOK)
	body := rec.Body.String()
	for _, needle := range []string{token, auth.HashToken(token), "token_hash", "token"} {
		if strings.Contains(body, needle) {
			t.Fatalf("device list leaks %q: %s", needle, body)
		}
	}
}

// A backup taken on one box and restored on another must bring paired devices
// with it — otherwise moving to a new machine silently unpairs every phone,
// and the failure shows up as an inexplicable 401 on the device rather than
// anywhere the user is looking. Device tokens live in the same SQLite file as
// everything else, so this is really a guard that they stay there.
func TestDeviceTokensSurviveBackupRestore(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)

	pair := startPairing(t, admin)
	token := decode[claimResp](t, claim(t, h, pair.Code, "Pixel")).Token
	phone := &testClient{t: t, h: h, bearer: token}
	phone.mustDo("GET", "/books", nil, http.StatusOK)

	admin.mustDo("POST", "/admin/backup", nil, http.StatusOK)

	// Revoke everything, so a restore that failed to carry devices back would
	// be indistinguishable from one that worked.
	admin.mustDo("POST", "/auth/devices/revoke-all", nil, http.StatusNoContent)
	phone.mustDo("GET", "/books", nil, http.StatusUnauthorized)

	rec := admin.mustDo("POST", "/admin/restore", map[string]any{"confirm": "RESTORE"}, http.StatusOK)
	if rec.Code != http.StatusOK {
		t.Fatalf("restore: %s", rec.Body)
	}

	// The device paired before the backup works again against the restored DB.
	phone.mustDo("GET", "/books", nil, http.StatusOK)
}
