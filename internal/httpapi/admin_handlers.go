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
)

type userRow struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	IsAdmin   bool   `json:"is_admin"`
	CreatedAt string `json:"created_at"`
}

// handleListUsers returns all users (admin only) for the management UI.
func (s *Server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.Store.DB.Query(
		`SELECT id, username, is_admin, created_at FROM users ORDER BY id`,
	)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()
	users := []userRow{}
	for rows.Next() {
		var u userRow
		if err := rows.Scan(&u.ID, &u.Username, &u.IsAdmin, &u.CreatedAt); err == nil {
			users = append(users, u)
		}
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
		`INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)
		 ON CONFLICT(username) DO NOTHING`, uname, hash,
	)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusConflict, "username already taken")
		return
	}
	id, _ := res.LastInsertId()
	writeJSON(w, http.StatusCreated, userRow{ID: id, Username: uname, IsAdmin: false})
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
	if id == userID(r) {
		writeErr(w, http.StatusConflict, "cannot delete your own account")
		return
	}
	// Delete unless it would remove the last admin. The guard is in SQL so the
	// count and delete are one atomic statement.
	res, err := s.Store.DB.Exec(
		`DELETE FROM users WHERE id = ?
		 AND (is_admin = 0 OR (SELECT count(*) FROM users WHERE is_admin = 1) > 1)`, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// Distinguish "no such user" from "blocked as the last admin".
		var isLastAdmin bool
		switch err := s.Store.DB.QueryRow(`SELECT is_admin FROM users WHERE id = ?`, id).Scan(&isLastAdmin); {
		case errors.Is(err, sql.ErrNoRows):
			writeErr(w, http.StatusNotFound, "no such user")
		case err != nil:
			writeErr(w, http.StatusInternalServerError, "internal error")
		default:
			writeErr(w, http.StatusConflict, "cannot remove the last admin")
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
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
