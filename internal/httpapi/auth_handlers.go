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
	uname, ok := normalizeUsername(req.Username)
	if !ok || len(req.Password) < 8 {
		writeErr(w, http.StatusBadRequest, "username required and password must be at least 8 characters")
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
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
	writeJSON(w, http.StatusOK, map[string]any{
		"id":       userID(r),
		"username": username(r),
		"is_admin": isAdmin(r),
	})
}

func (s *Server) handlePassword(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Current string `json:"current"`
		New     string `json:"new"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.New) < 8 {
		writeErr(w, http.StatusBadRequest, "new password must be at least 8 characters")
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
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
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
