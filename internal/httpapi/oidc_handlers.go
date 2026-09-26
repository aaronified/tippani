package httpapi

// Single sign-on through the operator's OpenID Connect provider.
//
// THREE WAYS AN IDENTITY MEETS AN ACCOUNT, and the order is the security:
//
//  1. An account already linked to this `issuer|sub` signs in. Always.
//  2. A reader who is SIGNED IN and presses "Link" on Profile attaches the
//     identity to the account they are in. Proof of both halves at once.
//  3. Otherwise, only what the operator opted into: TIPPANI_OIDC_LINK_USERNAME
//     links to an existing account whose username equals preferred_username,
//     and TIPPANI_OIDC_AUTO_CREATE makes a new account. Both are off by default
//     because both trust the provider's idea of a name — an IdP that lets
//     people choose their preferred_username would otherwise hand them any
//     account they can spell.
//
// Logins in flight live in memory for ten minutes, like pairing codes: a
// restart mid-login costs one more press, and the schema stays clean.

import (
	"database/sql"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"tippani/internal/auth"
	"tippani/internal/olog"
)

const (
	oidcStateCookie = "tippani_oidc"
	oidcLoginTTL    = 10 * time.Minute
	oidcMaxPending  = 1000
)

type oidcPending struct {
	login   auth.OIDCLogin
	linkUID int64 // non-zero: attach to this signed-in account instead of signing in
	exp     time.Time
}

type oidcState struct {
	mu      sync.Mutex
	pending map[string]oidcPending
}

func (st *oidcState) put(p oidcPending) bool {
	st.mu.Lock()
	defer st.mu.Unlock()
	if st.pending == nil {
		st.pending = map[string]oidcPending{}
	}
	now := time.Now()
	for k, v := range st.pending {
		if now.After(v.exp) {
			delete(st.pending, k)
		}
	}
	// A bound on an unauthenticated route that allocates: somebody hammering
	// /login cannot grow this map without limit.
	if len(st.pending) >= oidcMaxPending {
		return false
	}
	st.pending[p.login.State] = p
	return true
}

// forgetLinks drops every pending link and keeps pending sign-ins. A link names
// the account that started it by id, and the database a reset or a restore swaps
// in reuses ids, so a link completed after the swap would attach the starter's
// provider identity to whoever holds that id now, and the starter could then sign
// in as them. A sign-in names no account until the provider answers.
func (st *oidcState) forgetLinks() {
	st.mu.Lock()
	defer st.mu.Unlock()
	for k, p := range st.pending {
		if p.linkUID != 0 {
			delete(st.pending, k)
		}
	}
}

// take returns and forgets the login, so a state is good for one callback.
func (st *oidcState) take(state string) (oidcPending, bool) {
	st.mu.Lock()
	defer st.mu.Unlock()
	p, ok := st.pending[state]
	delete(st.pending, state)
	if !ok || time.Now().After(p.exp) {
		return oidcPending{}, false
	}
	return p, true
}

// oidcRedirectURL is the callback address: configured, or this request's own
// origin. Forwarded headers are read only behind a proxy the operator vouched
// for (TIPPANI_TRUSTED_PROXY), the same rule clientIP follows.
func (s *Server) oidcRedirectURL(r *http.Request) string {
	if s.OIDC.RedirectURL != "" {
		return s.OIDC.RedirectURL
	}
	scheme, host := "http", r.Host
	if r.TLS != nil {
		scheme = "https"
	}
	if s.TrustedProxy {
		if p := r.Header.Get("X-Forwarded-Proto"); p == "https" || p == "http" {
			scheme = p
		}
		if h := r.Header.Get("X-Forwarded-Host"); h != "" {
			host = strings.TrimSpace(strings.Split(h, ",")[0])
		}
	}
	return scheme + "://" + host + "/api/auth/oidc/callback"
}

// oidcFail sends the browser back to the app with a reason the login screen
// can print. A redirect rather than a JSON error because the browser arrived
// here by navigation, not by fetch.
func oidcFail(w http.ResponseWriter, r *http.Request, back, reason string) {
	if back == "" {
		back = "/"
	}
	http.Redirect(w, r, back+"?oidc_error="+url.QueryEscape(reason), http.StatusFound)
}

func (s *Server) handleOIDCLogin(w http.ResponseWriter, r *http.Request) {
	if !s.OIDC.Enabled() {
		writeErr(w, http.StatusNotFound, "single sign-on is not configured")
		return
	}
	if !s.loginLimiter.Allow(s.clientIP(r) + "|oidc") {
		writeErr(w, http.StatusTooManyRequests, "too many attempts; try again later")
		return
	}
	var linkUID int64
	if r.URL.Query().Get("link") == "1" {
		c, err := r.Cookie(sessionCookie)
		if err != nil {
			oidcFail(w, r, "/profile", "sign in first to link an account")
			return
		}
		uid, _, _, err := s.Sessions.Validate(c.Value)
		if err != nil {
			oidcFail(w, r, "/profile", "sign in first to link an account")
			return
		}
		linkUID = uid
	}
	dest, login, err := s.OIDC.Begin(r.Context(), s.oidcRedirectURL(r))
	if err != nil {
		olog.Warnf(olog.CodeOIDC, "[oidc] begin: %v", err)
		oidcFail(w, r, "/", "the sign-in provider could not be reached")
		return
	}
	if !s.oidc.put(oidcPending{login: login, linkUID: linkUID, exp: time.Now().Add(oidcLoginTTL)}) {
		writeErr(w, http.StatusTooManyRequests, "too many sign-ins in progress; try again shortly")
		return
	}
	// The state rides a cookie as well as the URL, so a callback can only be
	// completed in the browser that started it (login CSRF, RFC 6749 §10.12).
	http.SetCookie(w, &http.Cookie{
		Name: oidcStateCookie, Value: login.State, Path: "/api/auth/oidc",
		MaxAge: int(oidcLoginTTL.Seconds()), HttpOnly: true, Secure: s.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, dest, http.StatusFound)
}

func (s *Server) handleOIDCCallback(w http.ResponseWriter, r *http.Request) {
	if !s.OIDC.Enabled() {
		writeErr(w, http.StatusNotFound, "single sign-on is not configured")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: oidcStateCookie, Path: "/api/auth/oidc", MaxAge: -1,
		HttpOnly: true, Secure: s.CookieSecure, SameSite: http.SameSiteLaxMode})
	q := r.URL.Query()
	state := q.Get("state")
	c, err := r.Cookie(oidcStateCookie)
	if err != nil || state == "" || !auth.ConstantTimeEqual(c.Value, state) {
		oidcFail(w, r, "/", "the sign-in expired or was started in another browser; try again")
		return
	}
	p, ok := s.oidc.take(state)
	if !ok {
		oidcFail(w, r, "/", "the sign-in expired; try again")
		return
	}
	back := "/"
	if p.linkUID != 0 {
		back = "/profile"
	}
	if e := q.Get("error"); e != "" {
		oidcFail(w, r, back, "the provider refused: "+e)
		return
	}
	claims, err := s.OIDC.Finish(r.Context(), p.login, q.Get("code"))
	if err != nil {
		olog.Warnf(olog.CodeOIDC, "[oidc] finish: %v", err)
		oidcFail(w, r, back, "the provider's answer could not be verified")
		return
	}

	if p.linkUID != 0 {
		res, err := s.Store.DB.Exec(`UPDATE users SET oidc_subject = ? WHERE id = ?
			AND NOT EXISTS (SELECT 1 FROM users WHERE oidc_subject = ? AND id <> ?)`,
			claims.Subject, p.linkUID, claims.Subject, p.linkUID)
		if err != nil {
			internalError(w, r, "link oidc", err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			oidcFail(w, r, back, "that identity is already linked to another account")
			return
		}
		http.Redirect(w, r, back+"?oidc_linked=1", http.StatusFound)
		return
	}

	id, uname, err := s.oidcAccount(claims)
	switch {
	case errors.Is(err, errOIDCNoAccount):
		oidcFail(w, r, back, "no account is linked to this identity; sign in with a password and link it from Profile")
		return
	case err != nil:
		internalError(w, r, "oidc account", err)
		return
	}
	if old, err := r.Cookie(sessionCookie); err == nil && old.Value != "" {
		_ = s.Sessions.Delete(old.Value)
	}
	token, err := s.Sessions.Create(id)
	if err != nil {
		internalError(w, r, "create session", err)
		return
	}
	noteRequestUser(r, uname)
	http.SetCookie(w, s.sessionCookie(token, int(auth.SessionLifetime.Seconds())))
	http.Redirect(w, r, "/", http.StatusFound)
}

var errOIDCNoAccount = errors.New("no account for this identity")

// oidcAccount finds or (when allowed) makes the account for an identity.
func (s *Server) oidcAccount(c auth.Claims) (int64, string, error) {
	var id int64
	var uname string
	err := s.Store.DB.QueryRow(`SELECT id, username FROM users WHERE oidc_subject = ?`, c.Subject).Scan(&id, &uname)
	if err == nil {
		return id, uname, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, "", err
	}
	want := c.PreferredUsername
	if want == "" {
		want, _, _ = strings.Cut(c.Email, "@")
	}
	want, ok := normalizeUsername(want)
	if s.OIDCLinkByUsername && ok {
		res, err := s.Store.DB.Exec(`UPDATE users SET oidc_subject = ? WHERE username = ? AND oidc_subject IS NULL`,
			c.Subject, want)
		if err != nil {
			return 0, "", err
		}
		if n, _ := res.RowsAffected(); n == 1 {
			err := s.Store.DB.QueryRow(`SELECT id FROM users WHERE username = ?`, want).Scan(&id)
			return id, want, err
		}
	}
	if !s.OIDCAutoCreate {
		return 0, "", errOIDCNoAccount
	}
	if !ok {
		want = "reader"
	}
	// No password anyone knows: a random one, hashed, so the account can only
	// be entered through the provider until an admin resets it.
	pw, _, err := auth.NewToken()
	if err != nil {
		return 0, "", err
	}
	hash, err := auth.HashPassword(pw[:32])
	if err != nil {
		return 0, "", err
	}
	for i := 1; i <= 50; i++ {
		name := want
		if i > 1 {
			name = want + "-" + strconv.Itoa(i)
		}
		// The first account is the admin, the same rule onboarding and
		// `tippani user add` follow.
		res, err := s.Store.DB.Exec(`INSERT INTO users (username, password_hash, is_admin, oidc_subject, password_unknown)
			SELECT ?, ?, CASE WHEN NOT EXISTS (SELECT 1 FROM users) THEN 1 ELSE 0 END, ?, 1
			WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = ?)`, name, hash, c.Subject, name)
		if err != nil {
			return 0, "", err
		}
		if n, _ := res.RowsAffected(); n == 1 {
			id, _ = res.LastInsertId()
			if s.SeedNewUsers {
				seedDefaultTags(s.Store.DB, id)
				s.seedDefaultStickers(id)
			}
			return id, name, nil
		}
	}
	return 0, "", errors.New("no free username for " + want)
}

// handleOIDCUnlink detaches the identity from the signed-in account. An account
// the provider created has a password nobody knows (see oidcAccount), so the
// Profile row warns before this is pressed; an admin can still reset it.
func (s *Server) handleOIDCUnlink(w http.ResponseWriter, r *http.Request) {
	// REFUSED WHEN IT WOULD LOCK THE ACCOUNT OUT. An account single sign-on made
	// has a password nobody was shown; without the link it has no way in at all.
	// Checked here and not in the client, because a button is not a guard.
	var unknown bool
	if err := s.Store.DB.QueryRow(`SELECT password_unknown FROM users WHERE id = ?`, userID(r)).Scan(&unknown); err != nil {
		internalError(w, r, "read password state", err)
		return
	}
	if unknown {
		writeErr(w, http.StatusConflict, "this account has no password yet, so unlinking would lock it out; ask your admin to set one first")
		return
	}
	if _, err := s.Store.DB.Exec(`UPDATE users SET oidc_subject = NULL WHERE id = ?`, userID(r)); err != nil {
		internalError(w, r, "unlink oidc", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// oidcStatus is what /auth/status and /auth/me say about single sign-on.
func (s *Server) oidcStatus() any {
	if !s.OIDC.Enabled() {
		return nil
	}
	name := s.OIDC.Name
	if name == "" {
		name = "single sign-on"
	}
	return map[string]string{"name": name}
}
