package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"tippani/internal/auth"
)

const maxAuthBody = 4 << 10 // 4 KiB is plenty for credentials

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Username == "" || req.Password == "" {
		writeErr(w, http.StatusBadRequest, "username and password required")
		return
	}
	if !s.loginLimiter.Allow(s.clientIP(r) + "|" + req.Username) {
		writeErr(w, http.StatusTooManyRequests, "too many attempts; try again later")
		return
	}

	var id int64
	var hash string
	err := s.Store.DB.QueryRow(
		`SELECT id, password_hash FROM users WHERE username = ?`, req.Username,
	).Scan(&id, &hash)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		auth.CheckPasswordDummy(req.Password) // equalize timing
		writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	case err != nil:
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if !auth.CheckPassword(hash, req.Password) {
		writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	s.startSession(w, id, req.Username)
}

// startSession creates a session, sets the cookie, and writes {username}.
func (s *Server) startSession(w http.ResponseWriter, id int64, uname string) {
	token, err := s.Sessions.Create(id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	http.SetCookie(w, s.sessionCookie(token, int(auth.SessionLifetime.Seconds())))
	writeJSON(w, http.StatusOK, map[string]string{"username": uname})
}

// handleStatus is public: it tells the SPA whether first-run onboarding is
// still open (no users yet) so it can show the "create admin" screen.
func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	var n int
	if err := s.Store.DB.QueryRow(`SELECT count(*) FROM users`).Scan(&n); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"needs_onboarding": n == 0})
}

// handleSignup creates the first user (the admin) during onboarding. It only
// succeeds while the users table is empty; afterwards the admin adds users
// in-app (PLAN §2). The insert is atomic, so concurrent onboarding requests
// can't create two admins.
func (s *Server) handleSignup(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "username and password required")
		return
	}
	// Rate-limit this unauthenticated route so it can't be used to pin CPU via
	// repeated bcrypt hashing during the (brief) onboarding window.
	if !s.loginLimiter.Allow(s.clientIP(r) + "|signup") {
		writeErr(w, http.StatusTooManyRequests, "too many attempts; try again later")
		return
	}
	uname, ok := normalizeUsername(req.Username)
	if !ok {
		writeErr(w, http.StatusBadRequest, "username required")
		return
	}
	if msg := passwordProblem(req.Password); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	// Cheap check before the expensive hash: once any user exists onboarding is
	// closed, so don't spend bcrypt on a request we're going to reject.
	var exists bool
	if err := s.Store.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM users)`).Scan(&exists); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if exists {
		writeErr(w, http.StatusForbidden, "onboarding is closed; ask an admin to add you")
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	// The INSERT ... WHERE NOT EXISTS stays as the atomic guard: if a concurrent
	// signup won the race after the check above, this inserts nothing.
	res, err := s.Store.DB.Exec(
		`INSERT INTO users (username, password_hash, is_admin)
		 SELECT ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM users)`,
		uname, hash,
	)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusForbidden, "onboarding is closed; ask an admin to add you")
		return
	}
	id, _ := res.LastInsertId()
	s.startSession(w, id, uname)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		_ = s.Sessions.Delete(c.Value)
	}
	http.SetCookie(w, s.sessionCookie("", -1))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	p, err := s.loadPrefs(userID(r))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":          userID(r),
		"username":    username(r),
		"is_admin":    isAdmin(r),
		"preferences": p,
	})
}

// ---- UI preferences (§10; enums from the UI instructions §4) ----

var (
	prefAesthetics = map[string]bool{"paper": true, "film": true}
	prefThemes     = map[string]bool{"light": true, "dark": true, "system": true}
	prefAccents    = map[string]bool{"terracotta": true, "ochre": true, "olive": true, "slate": true}
)

type prefs struct {
	Aesthetic string `json:"aesthetic"`
	Theme     string `json:"theme"`
	Accent    string `json:"accent"`
}

// loadPrefs reads users.preferences and applies defaults for anything unset:
// theme "system", accent "terracotta", and aesthetic per theme — dark defaults
// to film, everything else to paper (instructions §4).
func (s *Server) loadPrefs(uid int64) (prefs, error) {
	var raw string
	if err := s.Store.DB.QueryRow(
		`SELECT preferences FROM users WHERE id = ?`, uid).Scan(&raw); err != nil {
		return prefs{}, err
	}
	var p prefs
	_ = json.Unmarshal([]byte(raw), &p) // bad stored JSON -> all defaults
	if !prefThemes[p.Theme] {
		p.Theme = "system"
	}
	if !prefAccents[p.Accent] {
		p.Accent = "terracotta"
	}
	if !prefAesthetics[p.Aesthetic] {
		if p.Theme == "dark" {
			p.Aesthetic = "film"
		} else {
			p.Aesthetic = "paper"
		}
	}
	return p, nil
}

// handleUpdatePreferences stores the full preference set (all three fields
// required, validated enums) as JSON in users.preferences.
func (s *Server) handleUpdatePreferences(w http.ResponseWriter, r *http.Request) {
	var p prefs
	if !decodeBody(w, r, &p) {
		return
	}
	switch {
	case !prefAesthetics[p.Aesthetic]:
		writeErr(w, http.StatusBadRequest, "aesthetic must be paper or film")
		return
	case !prefThemes[p.Theme]:
		writeErr(w, http.StatusBadRequest, "theme must be light, dark or system")
		return
	case !prefAccents[p.Accent]:
		writeErr(w, http.StatusBadRequest, "accent must be terracotta, ochre, olive or slate")
		return
	}
	raw, err := json.Marshal(p)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if _, err := s.Store.DB.Exec(
		`UPDATE users SET preferences = ? WHERE id = ?`, string(raw), userID(r)); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handlePassword(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Current string `json:"current"`
		New     string `json:"new"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request")
		return
	}
	if msg := passwordProblem(req.New); msg != "" {
		writeErr(w, http.StatusBadRequest, "new "+msg)
		return
	}
	var hash string
	if err := s.Store.DB.QueryRow(
		`SELECT password_hash FROM users WHERE id = ?`, userID(r),
	).Scan(&hash); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if !auth.CheckPassword(hash, req.Current) {
		writeErr(w, http.StatusUnauthorized, "current password is incorrect")
		return
	}
	newHash, err := auth.HashPassword(req.New)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if _, err := s.Store.DB.Exec(
		`UPDATE users SET password_hash = ? WHERE id = ?`, newHash, userID(r),
	); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	// Revoke every existing session for this user (a leaked cookie must not
	// survive a password change), then re-issue one for the current caller so
	// changing your own password doesn't log you out.
	if err := s.Sessions.DeleteAllForUser(userID(r)); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	token, err := s.Sessions.Create(userID(r))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	http.SetCookie(w, s.sessionCookie(token, int(auth.SessionLifetime.Seconds())))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// bcrypt rejects inputs longer than 72 bytes; validate up front so we return a
// clean 400 instead of a 500 out of HashPassword.
const maxPasswordBytes = 72

func passwordProblem(pw string) string {
	switch {
	case len(pw) < 8:
		return "password must be at least 8 characters"
	case len(pw) > maxPasswordBytes:
		return "password must be at most 72 bytes"
	}
	return ""
}

func (s *Server) sessionCookie(value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     sessionCookie,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   s.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
}
