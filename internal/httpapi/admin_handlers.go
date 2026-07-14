package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode"

	"tippani/internal/auth"
	"tippani/internal/olog"
)

type userRow struct {
	ID         int64  `json:"id"`
	Username   string `json:"username"`
	IsAdmin    bool   `json:"is_admin"`
	CreatedAt  string `json:"created_at"`
	AvatarPath string `json:"avatar_path"`
}

// handleListUsers returns all users (admin only) for the management UI.
func (s *Server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[admin] handleListUsers")
	rows, err := s.Store.DB.Query(
		`SELECT id, username, is_admin, created_at, avatar_path FROM users ORDER BY id`,
	)
	if err != nil {
		internalError(w, r, "list users", err)
		return
	}
	defer rows.Close()
	users := []userRow{}
	for rows.Next() {
		var u userRow
		if err := rows.Scan(&u.ID, &u.Username, &u.IsAdmin, &u.CreatedAt, &u.AvatarPath); err != nil {
			olog.Warnf(olog.CodeAdminRowScan, "[admin] list users row scan failed: %v", err)
			continue
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeAdminRowScan, "[admin] list users row iteration failed: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": users})
}

// handleCreateUser lets the admin add a regular (non-admin) user in-app.
func (s *Server) handleCreateUser(w http.ResponseWriter, r *http.Request) {
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
	if !ok {
		writeErr(w, http.StatusBadRequest, "username required")
		return
	}
	olog.Tracef("[admin] handleCreateUser username=%q", uname)
	if msg := passwordProblem(req.Password); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		internalError(w, r, "hash password", err)
		return
	}
	res, err := s.Store.DB.Exec(
		`INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)
		 ON CONFLICT(username) DO NOTHING`, uname, hash,
	)
	if err != nil {
		internalError(w, r, "insert user", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusConflict, "username already taken")
		return
	}
	id, _ := res.LastInsertId()
	if s.SeedNewUsers {
		seedDefaultTags(s.Store.DB, id) // starter tag/sticker vocabulary (v3)
	}
	writeJSON(w, http.StatusCreated, userRow{ID: id, Username: uname, IsAdmin: false})
}

// handleSetUserAdmin grants or revokes a user's admin rights (PATCH is_admin).
// The last remaining admin can never be demoted — the count + update are one
// atomic statement — so an instance always keeps at least one admin. Granting
// admin to another user and revoking your own is how the primary-admin role is
// handed over.
func (s *Server) handleSetUserAdmin(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		IsAdmin *bool `json:"is_admin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.IsAdmin == nil {
		writeErr(w, http.StatusBadRequest, "is_admin (bool) required")
		return
	}
	olog.Tracef("[admin] handleSetUserAdmin id=%d is_admin=%v", id, *req.IsAdmin)
	if *req.IsAdmin {
		res, err := s.Store.DB.Exec(`UPDATE users SET is_admin = 1 WHERE id = ?`, id)
		if err != nil {
			internalError(w, r, "grant admin", err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeErr(w, http.StatusNotFound, "no such user")
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	// Revoke, unless it would remove the last admin (guard in SQL, atomic).
	res, err := s.Store.DB.Exec(
		`UPDATE users SET is_admin = 0 WHERE id = ? AND is_admin = 1
		 AND (SELECT count(*) FROM users WHERE is_admin = 1) > 1`, id)
	if err != nil {
		internalError(w, r, "revoke admin", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// Distinguish no-such-user / already-regular / last-admin.
		var isAdm bool
		switch err := s.Store.DB.QueryRow(`SELECT is_admin FROM users WHERE id = ?`, id).Scan(&isAdm); {
		case errors.Is(err, sql.ErrNoRows):
			writeErr(w, http.StatusNotFound, "no such user")
			return
		case err != nil:
			internalError(w, r, "load user admin status", err)
			return
		case isAdm:
			writeErr(w, http.StatusConflict, "cannot remove the last admin")
			return
		}
		// already a regular user — idempotent success
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// handleDeleteUser removes a user (their books/annotations cascade). The admin
// cannot delete their own account, and the last remaining admin can never be
// removed — so an instance always keeps at least one admin.
func (s *Server) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}
	olog.Tracef("[admin] handleDeleteUser id=%d uid=%d", id, userID(r))
	if id == userID(r) {
		writeErr(w, http.StatusConflict, "cannot delete your own account")
		return
	}
	// Collect the user's cover/poster filenames before the DB rows cascade away,
	// so we can remove the now-orphaned files afterwards (the cascade only frees
	// rows, not on-disk images).
	covers := s.userCoverFiles(id)
	// Delete unless it would remove the last admin. The guard is in SQL so the
	// count and delete are one atomic statement.
	res, err := s.Store.DB.Exec(
		`DELETE FROM users WHERE id = ?
		 AND (is_admin = 0 OR (SELECT count(*) FROM users WHERE is_admin = 1) > 1)`, id)
	if err != nil {
		internalError(w, r, "delete user", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// Distinguish "no such user" from "blocked as the last admin".
		var isLastAdmin bool
		switch err := s.Store.DB.QueryRow(`SELECT is_admin FROM users WHERE id = ?`, id).Scan(&isLastAdmin); {
		case errors.Is(err, sql.ErrNoRows):
			writeErr(w, http.StatusNotFound, "no such user")
		case err != nil:
			internalError(w, r, "load user admin status", err)
		default:
			writeErr(w, http.StatusConflict, "cannot remove the last admin")
		}
		return
	}
	for _, name := range covers {
		s.removeCoverFile(name) // best-effort
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// userCoverFiles returns the stored image filenames owned by a user (book
// covers + movie posters + uploaded stickers), for cleanup when the user is
// deleted — the row cascade frees DB rows, not the on-disk files.
func (s *Server) userCoverFiles(id int64) []string {
	rows, err := s.Store.DB.Query(`
		SELECT cover_path FROM books  WHERE user_id = ? AND cover_path  IS NOT NULL
		UNION ALL
		SELECT poster_path FROM movies WHERE user_id = ? AND poster_path IS NOT NULL
		UNION ALL
		SELECT path FROM stickers WHERE user_id = ?`, id, id, id)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeAdminRowScan, "[admin] user cover files row scan failed: %v", err)
			continue
		}
		if n != "" {
			names = append(names, n)
		}
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeAdminRowScan, "[admin] user cover files row iteration failed: %v", err)
	}
	return names
}

// normalizeUsername trims surrounding space and validates: 1–64 characters,
// no whitespace or control characters. Returns the cleaned name and whether
// it is acceptable.
func normalizeUsername(s string) (string, bool) {
	name := strings.TrimSpace(s)
	if name == "" || len([]rune(name)) > 64 {
		return "", false
	}
	for _, r := range name {
		if unicode.IsSpace(r) || unicode.IsControl(r) {
			return "", false
		}
	}
	return name, true
}
