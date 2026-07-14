package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"tippani/internal/auth"
	"tippani/internal/buildinfo"
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
	if s.SeedNewUsers {
		seedDefaultTags(s.Store.DB, id) // starter tag/sticker vocabulary (v3)
	}
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
	var avatar string
	_ = s.Store.DB.QueryRow(`SELECT avatar_path FROM users WHERE id = ?`, userID(r)).Scan(&avatar)
	writeJSON(w, http.StatusOK, map[string]any{
		"id":          userID(r),
		"username":    username(r),
		"is_admin":    isAdmin(r),
		"preferences": p,
		"avatar_path": avatar,
		"version":     buildinfo.Version, // running build, for the Settings → Updates card
	})
}

// handleUpdateMe changes the caller's own display name. The session stores only
// the user id and re-reads username/is_admin on each request (auth.Validate's
// JOIN), so the new name takes effect on the next request with no re-issue.
func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request")
		return
	}
	uname, ok := normalizeUsername(req.Username)
	if !ok {
		writeErr(w, http.StatusBadRequest, "username required")
		return
	}
	// Atomic uniqueness: rename only if no OTHER user holds the name. Setting it
	// to your own current name is a no-op that still reports success.
	res, err := s.Store.DB.Exec(
		`UPDATE users SET username = ? WHERE id = ?
		 AND NOT EXISTS (SELECT 1 FROM users WHERE username = ? AND id <> ?)`,
		uname, userID(r), uname, userID(r))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusConflict, "username already taken")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"username": uname})
}

// ---- UI preferences (§10; enums from the UI instructions §4) ----

var (
	prefAesthetics = map[string]bool{"paper": true, "film": true}
	prefThemes     = map[string]bool{"light": true, "dark": true, "system": true}
	prefAccents    = map[string]bool{"terracotta": true, "ochre": true, "olive": true, "slate": true}
	prefNav        = map[string]bool{"tabs": true, "menu": true}
	srScopes       = map[string]bool{"books": true, "movies": true, "both": true}
)

// clampInt returns def when v is unset (0), else v bounded to [lo, hi].
func clampInt(v, lo, hi, def int) int {
	if v == 0 {
		return def
	}
	return max(lo, min(v, hi))
}

// clampFloat returns def when v is unset (0), else v bounded to [lo, hi].
func clampFloat(v, lo, hi, def float64) float64 {
	if v == 0 {
		return def
	}
	return max(lo, min(v, hi))
}

// prefs is the whole preference set. The retired "home" start-page key
// (pre-0.4 rows may still carry it) is dropped on read and on the next PUT —
// the Home screen replaced the landing-tab choice.
type prefs struct {
	Aesthetic string `json:"aesthetic"`
	Theme     string `json:"theme"`
	Accent    string `json:"accent"`
	// NavUtilities: where the Metadata + Tags screens live on desktop —
	// "tabs" (in the navbar) or "menu" (a ⋯ overflow). The account chip is
	// always separate. Empty on older rows; loadPrefs defaults it.
	NavUtilities string `json:"navUtilities"`
	// Spaced repetition (v0.5.0 Daily Quiz & Practice), per-user, defaults +
	// clamps applied in loadPrefs. SRDaily (Daily Quiz deck size) is 2..10;
	// SRReviewScope (books|movies|both) bounds BOTH modes; SRGrow (the "got it"
	// half-life multiplier) and SRShrink (the "forgot" retained fraction) stay
	// in a deliberately narrow band. SRPracticeCounts opts Practice into moving
	// the schedule (off by default, so Practice is study without distortion).
	SRDaily          int     `json:"srDaily"`
	SRReviewScope    string  `json:"srReviewScope"`
	SRGrow           float64 `json:"srGrow"`
	SRShrink         float64 `json:"srShrink"`
	// SRSeen is the "seeing" multiplier — practising (not skipping), sharing, or
	// favouriting a card lengthens its half-life marginally. 1.0 = off (default),
	// so this reinforcement is entirely opt-in.
	SRSeen           float64 `json:"srSeen"`
	SRPracticeCounts bool    `json:"srPracticeCounts"`
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
	if !prefNav[p.NavUtilities] {
		p.NavUtilities = "menu"
	}
	p.SRDaily = clampInt(p.SRDaily, 2, 10, reviewQuota)
	if !srScopes[p.SRReviewScope] {
		p.SRReviewScope = "both"
	}
	p.SRGrow = clampFloat(p.SRGrow, 1.5, 4.0, reviewGrowth)
	p.SRShrink = clampFloat(p.SRShrink, 0.1, 0.6, reviewLapseShrink)
	p.SRSeen = clampFloat(p.SRSeen, 1.0, 1.5, reviewSeen)
	return p, nil
}

// handleUpdatePreferences is a partial update: it loads the current set, overlays
// only the fields present in the body, validates, and stores. So the Appearance
// panel and the nav-placement toggle can each PUT just their own field(s) without
// clobbering the other's. Any appearance field it does receive is a required
// enum; navUtilities is optional (empty = leave as-is, so older clients that
// don't know the field aren't rejected).
func (s *Server) handleUpdatePreferences(w http.ResponseWriter, r *http.Request) {
	cur, err := s.loadPrefs(userID(r))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	var in struct {
		Aesthetic     *string  `json:"aesthetic"`
		Theme         *string  `json:"theme"`
		Accent        *string  `json:"accent"`
		NavUtilities  *string  `json:"navUtilities"`
		SRDaily          *int     `json:"srDaily"`
		SRReviewScope    *string  `json:"srReviewScope"`
		SRGrow           *float64 `json:"srGrow"`
		SRShrink         *float64 `json:"srShrink"`
		SRSeen           *float64 `json:"srSeen"`
		SRPracticeCounts *bool    `json:"srPracticeCounts"`
	}
	if !decodeBody(w, r, &in) {
		return
	}
	if in.Aesthetic != nil {
		cur.Aesthetic = *in.Aesthetic
	}
	if in.Theme != nil {
		cur.Theme = *in.Theme
	}
	if in.Accent != nil {
		cur.Accent = *in.Accent
	}
	// Optional fields: an empty/zero value means "leave unchanged", so a client
	// PUTting only one field (or an older client omitting the newer ones) is
	// neither rejected nor allowed to clobber the rest.
	if in.NavUtilities != nil && *in.NavUtilities != "" {
		cur.NavUtilities = *in.NavUtilities
	}
	if in.SRDaily != nil && *in.SRDaily != 0 {
		cur.SRDaily = *in.SRDaily
	}
	if in.SRReviewScope != nil && *in.SRReviewScope != "" {
		cur.SRReviewScope = *in.SRReviewScope
	}
	if in.SRGrow != nil && *in.SRGrow != 0 {
		cur.SRGrow = *in.SRGrow
	}
	if in.SRShrink != nil && *in.SRShrink != 0 {
		cur.SRShrink = *in.SRShrink
	}
	if in.SRSeen != nil && *in.SRSeen != 0 {
		cur.SRSeen = *in.SRSeen
	}
	// A bool has no "empty" sentinel, so presence is the pointer being non-nil.
	if in.SRPracticeCounts != nil {
		cur.SRPracticeCounts = *in.SRPracticeCounts
	}
	switch {
	case !prefAesthetics[cur.Aesthetic]:
		writeErr(w, http.StatusBadRequest, "aesthetic must be paper or film")
		return
	case !prefThemes[cur.Theme]:
		writeErr(w, http.StatusBadRequest, "theme must be light, dark or system")
		return
	case !prefAccents[cur.Accent]:
		writeErr(w, http.StatusBadRequest, "accent must be terracotta, ochre, olive or slate")
		return
	case !prefNav[cur.NavUtilities]:
		writeErr(w, http.StatusBadRequest, "navUtilities must be tabs or menu")
		return
	case cur.SRDaily < 2 || cur.SRDaily > 10:
		writeErr(w, http.StatusBadRequest, "srDaily must be between 2 and 10")
		return
	case !srScopes[cur.SRReviewScope]:
		writeErr(w, http.StatusBadRequest, "srReviewScope must be books, movies or both")
		return
	case cur.SRGrow < 1.5 || cur.SRGrow > 4:
		writeErr(w, http.StatusBadRequest, "srGrow must be between 1.5 and 4")
		return
	case cur.SRShrink < 0.1 || cur.SRShrink > 0.6:
		writeErr(w, http.StatusBadRequest, "srShrink must be between 0.1 and 0.6")
		return
	case cur.SRSeen < 1.0 || cur.SRSeen > 1.5:
		writeErr(w, http.StatusBadRequest, "srSeen must be between 1.0 and 1.5")
		return
	}
	raw, err := json.Marshal(cur)
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
