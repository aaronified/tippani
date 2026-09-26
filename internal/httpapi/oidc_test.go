package httpapi

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"tippani/internal/auth"
)

// fakeIdP is an OpenID provider with one user. It remembers the nonce and PKCE
// challenge from the authorize URL the app built, and refuses a token request
// whose verifier does not hash to that challenge — so a test that passes has
// driven the whole code flow, PKCE included, and not a shortcut around it.
type fakeIdP struct {
	srv       *httptest.Server
	mu        sync.Mutex
	nonce     string
	challenge string
	sub       string
	username  string
	aud       string // "" = the client id
	audList   []string
	azp       string
	nonceLie  bool // issue a token with the wrong nonce
	// namesInUserinfo moves preferred_username out of the ID token and into the
	// userinfo endpoint, the way Authelia's default claims policy does.
	namesInUserinfo bool
}

func newFakeIdP(t *testing.T) *fakeIdP {
	t.Helper()
	f := &fakeIdP{sub: "u-123", username: "alice"}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issuer":                 f.srv.URL,
			"authorization_endpoint": f.srv.URL + "/authorize",
			"token_endpoint":         f.srv.URL + "/token",
			"userinfo_endpoint":      f.srv.URL + "/userinfo",
		})
	})
	mux.HandleFunc("POST /token", func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		f.mu.Lock()
		defer f.mu.Unlock()
		user, pass, ok := r.BasicAuth()
		sum := sha256.Sum256([]byte(r.PostForm.Get("code_verifier")))
		if !ok || user != "tippani" || pass != "s3cret" || r.PostForm.Get("code") != "good-code" ||
			base64.RawURLEncoding.EncodeToString(sum[:]) != f.challenge {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":"invalid_grant"}`))
			return
		}
		nonce := f.nonce
		if f.nonceLie {
			nonce = "not-the-nonce"
		}
		aud := f.aud
		if aud == "" {
			aud = "tippani"
		}
		c := map[string]any{
			"iss": f.srv.URL, "sub": f.sub, "aud": aud, "exp": time.Now().Add(time.Hour).Unix(),
			"nonce": nonce, "preferred_username": f.username,
		}
		if f.audList != nil {
			c["aud"] = f.audList
		}
		if f.azp != "" {
			c["azp"] = f.azp
		}
		if f.namesInUserinfo {
			delete(c, "preferred_username")
		}
		claims, _ := json.Marshal(c)
		enc := base64.RawURLEncoding.EncodeToString
		_ = json.NewEncoder(w).Encode(map[string]string{
			"id_token":     enc([]byte(`{"alg":"RS256"}`)) + "." + enc(claims) + ".sig",
			"access_token": "at-" + f.sub,
		})
	})
	mux.HandleFunc("GET /userinfo", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		if r.Header.Get("Authorization") != "Bearer at-"+f.sub {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"sub": f.sub, "preferred_username": f.username})
	})
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	return f
}

func withOIDC(t *testing.T, srv *Server) *fakeIdP {
	idp := newFakeIdP(t)
	srv.OIDC = &auth.OIDC{Issuer: idp.srv.URL, ClientID: "tippani", ClientSecret: "s3cret", Name: "Authelia"}
	return idp
}

// signInWithOIDC presses the button, lets the provider answer, and follows the
// provider's redirect back. It returns the final redirect and any session
// cookie the callback set. existing is the browser's cookie, if it has one.
func signInWithOIDC(t *testing.T, h http.Handler, idp *fakeIdP, query string, existing *http.Cookie) (string, *http.Cookie) {
	t.Helper()
	return oidcRoundTrip(t, h, idp, query, existing, true)
}

// oidcRoundTrip is signInWithOIDC with the state cookie optional: withState
// false replays the callback in a browser that did not start the login, after
// the provider has been through the WHOLE flow — so the only thing wrong with
// the callback is the missing cookie.
func oidcRoundTrip(t *testing.T, h http.Handler, idp *fakeIdP, query string, existing *http.Cookie, withState bool) (string, *http.Cookie) {
	t.Helper()
	req := httptest.NewRequest("GET", "/api/auth/oidc/login"+query, nil)
	if existing != nil {
		req.AddCookie(existing)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("login: %d %s", rec.Code, rec.Body)
	}
	loc, _ := url.Parse(rec.Header().Get("Location"))
	if !strings.HasPrefix(loc.String(), idp.srv.URL+"/authorize") {
		// An error redirect back into the app — hand it to the caller.
		return loc.String(), nil
	}
	q := loc.Query()
	idp.mu.Lock()
	idp.nonce, idp.challenge = q.Get("nonce"), q.Get("code_challenge")
	idp.mu.Unlock()
	var state *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == oidcStateCookie {
			state = c
		}
	}
	cb := httptest.NewRequest("GET", "/api/auth/oidc/callback?code=good-code&state="+url.QueryEscape(q.Get("state")), nil)
	if state != nil && withState {
		cb.AddCookie(state)
	}
	if existing != nil {
		cb.AddCookie(existing)
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, cb)
	if rec.Code != http.StatusFound {
		t.Fatalf("callback: %d %s", rec.Code, rec.Body)
	}
	for _, c := range rec.Result().Cookies() {
		if c.Name == sessionCookie && c.Value != "" {
			return rec.Header().Get("Location"), c
		}
	}
	return rec.Header().Get("Location"), nil
}

func TestOIDCStatusOffersTheButtonOnlyWhenConfigured(t *testing.T) {
	srv := newTestServer(t)
	anon := &testClient{t: t, h: srv.Handler()}
	if got := decode[map[string]any](t, anon.mustDo("GET", "/auth/status", nil, 200))["oidc"]; got != nil {
		t.Fatalf("unconfigured: oidc = %v, want null", got)
	}
	withOIDC(t, srv)
	anon = &testClient{t: t, h: srv.Handler()}
	st := decode[struct {
		OIDC struct{ Name string } `json:"oidc"`
	}](t, anon.mustDo("GET", "/auth/status", nil, 200))
	if st.OIDC.Name != "Authelia" {
		t.Fatalf("configured: oidc.name = %q, want Authelia", st.OIDC.Name)
	}
}

// The journey the feature exists for: a reader with a password links their
// provider account from Settings, signs out, and signs back in with the button.
func TestOIDCLinkThenSignIn(t *testing.T) {
	srv := newTestServer(t)
	idp := withOIDC(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	alice.mustDo("POST", "/books", map[string]any{"title": "Invisible Cities"}, http.StatusCreated)

	// Unlinked, with neither opt-in set: the provider's say-so is not enough.
	if loc, c := signInWithOIDC(t, h, idp, "", nil); c != nil || !strings.Contains(loc, "oidc_error=") {
		t.Fatalf("unlinked identity signed in: loc=%s cookie=%v", loc, c)
	}

	loc, _ := signInWithOIDC(t, h, idp, "?link=1", alice.cookie)
	if !strings.Contains(loc, "oidc_linked=1") {
		t.Fatalf("link: redirected to %s", loc)
	}
	me := decode[map[string]any](t, alice.mustDo("GET", "/auth/me", nil, 200))
	if me["oidc_linked"] != true {
		t.Fatalf("after linking, /auth/me oidc_linked = %v", me["oidc_linked"])
	}
	alice.mustDo("POST", "/auth/logout", nil, 200)

	loc, cookie := signInWithOIDC(t, h, idp, "", nil)
	if cookie == nil || loc != "/" {
		t.Fatalf("linked sign-in: loc=%s cookie=%v", loc, cookie)
	}
	browser := &testClient{t: t, h: h, cookie: cookie}
	books := decode[struct {
		Books []struct{ Title string } `json:"books"`
	}](t, browser.mustDo("GET", "/books", nil, 200))
	if len(books.Books) != 1 || books.Books[0].Title != "Invisible Cities" {
		t.Fatalf("signed in to the wrong library: %+v", books.Books)
	}

	// Unlinking closes the door again.
	browser.mustDo("DELETE", "/auth/oidc/link", nil, 200)
	if _, c := signInWithOIDC(t, h, idp, "", nil); c != nil {
		t.Fatal("signed in after unlinking")
	}
}

func TestOIDCAutoCreateMakesAnAccountAndFirstIsAdmin(t *testing.T) {
	srv := newTestServer(t)
	idp := withOIDC(t, srv)
	srv.OIDCAutoCreate = true
	h := srv.Handler()
	_, cookie := signInWithOIDC(t, h, idp, "", nil)
	if cookie == nil {
		t.Fatal("auto-create: no session")
	}
	me := decode[struct {
		Username string `json:"username"`
		IsAdmin  bool   `json:"is_admin"`
	}](t, (&testClient{t: t, h: h, cookie: cookie}).mustDo("GET", "/auth/me", nil, 200))
	if me.Username != "alice" || !me.IsAdmin {
		t.Fatalf("auto-created %+v, want alice as the first (admin) account", me)
	}

	// A second identity asking for a taken name gets a fresh account, not alice's.
	idp.sub = "u-456"
	_, cookie2 := signInWithOIDC(t, h, idp, "", nil)
	me2 := decode[struct {
		Username string `json:"username"`
		IsAdmin  bool   `json:"is_admin"`
	}](t, (&testClient{t: t, h: h, cookie: cookie2}).mustDo("GET", "/auth/me", nil, 200))
	if me2.Username != "alice-2" || me2.IsAdmin {
		t.Fatalf("second identity got %+v, want a non-admin alice-2", me2)
	}
}

// An account single sign-on made has a password nobody was shown. Unlinking it
// would leave no way in, so the server refuses — and a password set by the
// operator lifts the refusal.
func TestOIDCUnlinkRefusedWhenNoPasswordIsKnown(t *testing.T) {
	srv := newTestServer(t)
	idp := withOIDC(t, srv)
	srv.OIDCAutoCreate = true
	h := srv.Handler()
	_, cookie := signInWithOIDC(t, h, idp, "", nil)
	if cookie == nil {
		t.Fatal("auto-create: no session")
	}
	browser := &testClient{t: t, h: h, cookie: cookie}
	browser.mustDo("DELETE", "/auth/oidc/link", nil, http.StatusConflict)
	if _, c := signInWithOIDC(t, h, idp, "", nil); c == nil {
		t.Fatal("a refused unlink still unlinked the account")
	}

	// What `tippani user passwd` writes.
	if _, err := srv.Store.DB.Exec(`UPDATE users SET password_unknown = 0 WHERE username = 'alice'`); err != nil {
		t.Fatal(err)
	}
	browser.mustDo("DELETE", "/auth/oidc/link", nil, 200)
}

func TestOIDCLinkByUsernameIsOptIn(t *testing.T) {
	srv := newTestServer(t)
	idp := withOIDC(t, srv)
	h := srv.Handler()
	signupAdmin(t, h)
	if _, c := signInWithOIDC(t, h, idp, "", nil); c != nil {
		t.Fatal("matched by username without TIPPANI_OIDC_LINK_USERNAME")
	}
	srv.OIDCLinkByUsername = true
	if _, c := signInWithOIDC(t, h, idp, "", nil); c == nil {
		t.Fatal("TIPPANI_OIDC_LINK_USERNAME on: alice was not matched")
	}
}

func TestOIDCRefusesTokensNotBoundToThisLogin(t *testing.T) {
	for _, tc := range []struct {
		name string
		mut  func(*fakeIdP)
	}{
		{"wrong nonce", func(f *fakeIdP) { f.nonceLie = true }},
		{"another client's token", func(f *fakeIdP) { f.aud = "someone-else" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv := newTestServer(t)
			idp := withOIDC(t, srv)
			srv.OIDCAutoCreate = true
			tc.mut(idp)
			if loc, c := signInWithOIDC(t, srv.Handler(), idp, "", nil); c != nil || !strings.Contains(loc, "oidc_error=") {
				t.Fatalf("accepted: loc=%s cookie=%v", loc, c)
			}
		})
	}
}

// Login CSRF: a callback URL replayed in a browser that did not start the login
// (no state cookie) is refused even though the state, the code and the PKCE
// verifier are all good. Mutation: with the cookie comparison removed from
// handleOIDCCallback this signs in.
func TestOIDCCallbackNeedsTheBrowserThatStartedIt(t *testing.T) {
	srv := newTestServer(t)
	idp := withOIDC(t, srv)
	srv.OIDCAutoCreate = true
	h := srv.Handler()
	// The same flow with the cookie succeeds, so the refusal below is the cookie.
	if _, c := oidcRoundTrip(t, h, idp, "", nil, true); c == nil {
		t.Fatal("control: the full flow with its state cookie did not sign in")
	}
	loc, c := oidcRoundTrip(t, h, idp, "", nil, false)
	if c != nil || !strings.Contains(loc, "oidc_error=") {
		t.Fatalf("callback without the state cookie: loc=%s cookie=%v", loc, c)
	}
}

// A token minted for several audiences must name this client as the party it
// was issued to. Mutation: without the azp check this signs in.
func TestOIDCRefusesATokenAuthorisedForAnotherParty(t *testing.T) {
	srv := newTestServer(t)
	idp := withOIDC(t, srv)
	srv.OIDCAutoCreate = true
	idp.audList = []string{"tippani", "someone-else"}
	idp.azp = "someone-else"
	if loc, c := signInWithOIDC(t, srv.Handler(), idp, "", nil); c != nil || !strings.Contains(loc, "oidc_error=") {
		t.Fatalf("accepted a token whose azp is another client: loc=%s", loc)
	}
	idp.azp = "tippani"
	if _, c := signInWithOIDC(t, srv.Handler(), idp, "", nil); c == nil {
		t.Fatal("control: azp = this client should sign in")
	}
}

// Username matching never moves an account's EXISTING link to a new identity.
// Mutation: without `AND oidc_subject IS NULL`, the second identity takes alice.
func TestOIDCLinkByUsernameDoesNotStealALinkedAccount(t *testing.T) {
	srv := newTestServer(t)
	idp := withOIDC(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	signInWithOIDC(t, h, idp, "?link=1", alice.cookie) // alice ↔ u-123
	srv.OIDCLinkByUsername = true
	idp.sub = "u-intruder" // same preferred_username, different identity
	if _, c := signInWithOIDC(t, h, idp, "", nil); c != nil {
		t.Fatal("a second identity named alice signed in to alice's already-linked account")
	}
	idp.sub = "u-123"
	if _, c := signInWithOIDC(t, h, idp, "", nil); c == nil {
		t.Fatal("alice's own identity no longer signs in")
	}
}

// One identity, one account: linking an identity another account holds is refused.
func TestOIDCLinkRefusesAnIdentityHeldByAnotherAccount(t *testing.T) {
	srv := newTestServer(t)
	idp := withOIDC(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	signInWithOIDC(t, h, idp, "?link=1", alice.cookie)
	loc, _ := signInWithOIDC(t, h, idp, "?link=1", bob.cookie)
	if !strings.Contains(loc, "oidc_error=") {
		t.Fatalf("bob linked alice's identity: %s", loc)
	}
	if decode[map[string]any](t, bob.mustDo("GET", "/auth/me", nil, 200))["oidc_linked"] == true {
		t.Fatal("bob's account reads as linked")
	}
}

// A provider that keeps names out of the ID token (Authelia's default claims
// policy) still gets a named account: the name comes from userinfo. Mutation:
// without the userinfo call the account is named "reader".
func TestOIDCNamesComeFromUserinfoWhenTheTokenHasNone(t *testing.T) {
	srv := newTestServer(t)
	idp := withOIDC(t, srv)
	idp.namesInUserinfo = true
	srv.OIDCAutoCreate = true
	h := srv.Handler()
	_, cookie := signInWithOIDC(t, h, idp, "", nil)
	if cookie == nil {
		t.Fatal("no session")
	}
	me := decode[struct{ Username string }](t, (&testClient{t: t, h: h, cookie: cookie}).mustDo("GET", "/auth/me", nil, 200))
	if me.Username != "alice" {
		t.Fatalf("account named %q, want alice from userinfo", me.Username)
	}
}

// A SIGN-ON LINK STARTED BEFORE A RESET OR A RESTORE DOES NOT COMPLETE AFTER IT.
// A pending link names the account that started it by id, and the database a
// reset or a restore swaps in gives ids out again: after a reset the admin who
// onboards the emptied server is id 1, as the starter was. A link completed
// then would attach the starter's provider identity to that admin, and the
// starter could sign in as them with the provider's button.
//
// WHAT IT KNOWS: the routes, and the provider stand-in the rest of this file
// uses. The link is started and finished by hand rather than by signInWithOIDC,
// because the swap has to happen between the press and the provider's answer.
func TestAnOIDCLinkStartedBeforeASwapDoesNotCompleteAfterIt(t *testing.T) {
	for _, swap := range []string{"reset", "restore"} {
		t.Run(swap, func(t *testing.T) {
			srv := newTestServer(t)
			idp := withOIDC(t, srv)
			h := srv.Handler()
			starter := signupAdmin(t, h)
			if swap == "restore" {
				backupNow(starter)
			}

			// The press on "Link Authelia", up to the provider's page.
			req := httptest.NewRequest("GET", "/api/auth/oidc/login?link=1", nil)
			req.AddCookie(starter.cookie)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			loc, _ := url.Parse(rec.Header().Get("Location"))
			if rec.Code != http.StatusFound || !strings.HasPrefix(loc.String(), idp.srv.URL+"/authorize") {
				t.Fatalf("starting the link: %d %s", rec.Code, loc)
			}
			q := loc.Query()
			idp.mu.Lock()
			idp.nonce, idp.challenge = q.Get("nonce"), q.Get("code_challenge")
			idp.mu.Unlock()
			var state *http.Cookie
			for _, c := range rec.Result().Cookies() {
				if c.Name == oidcStateCookie {
					state = c
				}
			}

			safetyBackup(t, starter)
			var holder *testClient
			if swap == "reset" {
				starter.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusOK)
				holder = signupAdmin(t, h) // id 1 again
			} else {
				starter.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)
				holder = starter
			}

			// The provider answers, after the swap.
			cb := httptest.NewRequest("GET", "/api/auth/oidc/callback?code=good-code&state="+url.QueryEscape(q.Get("state")), nil)
			cb.AddCookie(state)
			rec = httptest.NewRecorder()
			h.ServeHTTP(rec, cb)
			if back := rec.Header().Get("Location"); strings.Contains(back, "oidc_linked=1") {
				t.Fatalf("a link started before the %s completed after it: %s", swap, back)
			}
			if swap == "reset" {
				if me := decode[map[string]any](t, holder.mustDo("GET", "/auth/me", nil, 200)); me["oidc_linked"] == true {
					t.Fatalf("the admin who onboarded after the reset is linked to the starter's identity")
				}
			}
			if _, c := signInWithOIDC(t, h, idp, "", nil); c != nil {
				t.Fatalf("the starter's identity signs in after the %s", swap)
			}
		})
	}
}
