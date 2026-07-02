// Package auth: password hashing and cookie-session management (PLAN §2).
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// BcryptCost 10 ≈ 60–100 ms on weak ARM: fine for a rare login event, and
// deliberately not memory-hard (argon2id's ~64 MB/hash is wrong on a shared NAS).
const BcryptCost = 10

const (
	SessionLifetime  = 30 * 24 * time.Hour
	sessionRefreshAt = 15 * 24 * time.Hour // sliding: bump when less than this remains
)

var ErrInvalidSession = errors.New("invalid or expired session")

func HashPassword(pw string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pw), BcryptCost)
	return string(b), err
}

func CheckPassword(hash, pw string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}

// dummyHash is compared against when the username doesn't exist, so login
// takes the same time either way.
var dummyHash, _ = HashPassword("tippani-timing-equalizer")

func CheckPasswordDummy(pw string) { _ = CheckPassword(dummyHash, pw) }

// NewToken returns a 256-bit random token (hex) and its sha256 (hex).
// Only the hash is stored; the raw token lives in the cookie.
func NewToken() (token, tokenHash string, err error) {
	raw := make([]byte, 32)
	if _, err = rand.Read(raw); err != nil {
		return "", "", err
	}
	token = hex.EncodeToString(raw)
	return token, HashToken(token), nil
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// Sessions persists sessions in SQLite.
type Sessions struct{ DB *sql.DB }

// Create opens a session for userID and lazily purges expired rows
// (no cleanup cron; PLAN §2).
func (s Sessions) Create(userID int64) (token string, err error) {
	token, th, err := NewToken()
	if err != nil {
		return "", err
	}
	if _, err := s.DB.Exec(`DELETE FROM sessions WHERE expires_at < datetime('now')`); err != nil {
		return "", err
	}
	_, err = s.DB.Exec(
		`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`,
		th, userID, lifetimeModifier(),
	)
	return token, err
}

// Validate resolves a cookie token to (userID, username), sliding the expiry
// forward when it has passed the halfway mark.
func (s Sessions) Validate(token string) (userID int64, username string, err error) {
	th := HashToken(token)
	var expires string
	err = s.DB.QueryRow(`
		SELECT s.user_id, u.username, s.expires_at
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = ? AND s.expires_at >= datetime('now')`, th,
	).Scan(&userID, &username, &expires)
	if err != nil {
		return 0, "", ErrInvalidSession
	}
	if t, perr := time.Parse("2006-01-02 15:04:05", expires); perr == nil {
		if time.Until(t) < sessionRefreshAt {
			_, _ = s.DB.Exec(
				`UPDATE sessions SET expires_at = datetime('now', ?) WHERE token_hash = ?`,
				lifetimeModifier(), th,
			)
		}
	}
	return userID, username, nil
}

func (s Sessions) Delete(token string) error {
	_, err := s.DB.Exec(`DELETE FROM sessions WHERE token_hash = ?`, HashToken(token))
	return err
}

func lifetimeModifier() string {
	return fmt.Sprintf("+%d hours", int(SessionLifetime.Hours())) // SQLite datetime modifier, e.g. "+720 hours"
}

// ConstantTimeEqual is used for any future fixed-token comparisons.
func ConstantTimeEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
