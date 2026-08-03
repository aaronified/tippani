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
	SessionLifetime    = 30 * 24 * time.Hour // sliding idle window
	SessionMaxLifetime = 90 * 24 * time.Hour // absolute cap from creation (PLAN §2)
	sessionRefreshAt   = 15 * 24 * time.Hour // sliding: bump when less than this remains
)

var ErrInvalidSession = errors.New("invalid or expired session")

// ErrNoSuchDevice covers both "no such device" and "not yours" — the caller
// must not be able to tell those apart, or the revoke endpoint becomes an
// oracle for which device ids exist on other accounts.
var ErrNoSuchDevice = errors.New("no such device")

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
		th, userID, lifetimeModifier(SessionLifetime),
	)
	return token, err
}

// Validate resolves a cookie token to (userID, username, isAdmin), sliding the
// expiry forward when it has passed the halfway mark.
func (s Sessions) Validate(token string) (userID int64, username string, isAdmin bool, err error) {
	th := HashToken(token)
	var expires string
	err = s.DB.QueryRow(`
		SELECT s.user_id, u.username, u.is_admin, s.expires_at
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = ? AND s.expires_at >= datetime('now')`, th,
	).Scan(&userID, &username, &isAdmin, &expires)
	if err != nil {
		return 0, "", false, ErrInvalidSession
	}
	if t, perr := time.Parse("2006-01-02 15:04:05", expires); perr == nil {
		if time.Until(t) < sessionRefreshAt {
			// Slide the idle window forward, but never past the absolute cap
			// created_at + SessionMaxLifetime — so a token can't renew forever
			// (a stolen cookie stops working 90 d after login regardless of use).
			// The `expires_at <> …` guard skips no-op writes once expiry is
			// pinned at the cap, so a long-lived session doesn't turn every
			// request into a redundant write on the single writer (PLAN §8).
			_, _ = s.DB.Exec(
				`UPDATE sessions SET expires_at = min(datetime('now', ?), datetime(created_at, ?))
				 WHERE token_hash = ?
				   AND expires_at <> min(datetime('now', ?), datetime(created_at, ?))`,
				lifetimeModifier(SessionLifetime), lifetimeModifier(SessionMaxLifetime), th,
				lifetimeModifier(SessionLifetime), lifetimeModifier(SessionMaxLifetime),
			)
		}
	}
	return userID, username, isAdmin, nil
}

func (s Sessions) Delete(token string) error {
	_, err := s.DB.Exec(`DELETE FROM sessions WHERE token_hash = ?`, HashToken(token))
	return err
}

// DeleteAllForUser revokes every session a user has — called on password change
// so a leaked cookie can't outlive the password that (should have) protected it.
func (s Sessions) DeleteAllForUser(userID int64) error {
	_, err := s.DB.Exec(`DELETE FROM sessions WHERE user_id = ?`, userID)
	return err
}

func lifetimeModifier(d time.Duration) string {
	return fmt.Sprintf("+%d hours", int(d.Hours())) // SQLite datetime modifier, e.g. "+720 hours"
}

// agoModifier is lifetimeModifier's backwards twin, for "older than d" checks:
// e.g. "-1 hours". Passing a negative duration to lifetimeModifier would give
// "+-1 hours", which SQLite rejects by returning NULL rather than erroring —
// so the comparison it feeds quietly evaluates to false forever.
func agoModifier(d time.Duration) string {
	return fmt.Sprintf("-%d hours", int(d.Hours()))
}

// ---- device tokens ----

// DeviceTokens persists the bearer credentials native clients carry (the
// Android app under mobile/), in their own table alongside Sessions.
//
// They are deliberately not sessions, in two ways:
//
//   - No expiry. A cookie session slides on use and dies at SessionMaxLifetime
//     regardless; a paired device lives until it is revoked from Settings.
//   - A password change does not revoke them. Sessions are swept by
//     DeleteAllForUser so a leaked cookie can't outlive the password that should
//     have protected it. Doing the same to devices would silently unpair every
//     phone on a routine rotation, with no signal on the device and no way to
//     tell that from a server outage. Revoking a device is its own explicit act.
//
// The credential itself is handled exactly as a session token is: 256 bits of
// randomness, sha256 at rest, the raw value returned once at pairing time.
type DeviceTokens struct{ DB *sql.DB }

// Device is one row of the Settings device list. It deliberately carries no
// token material.
type Device struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	CreatedAt  string `json:"created_at"`
	LastSeenAt string `json:"last_seen_at"` // "" until first use
}

// lastSeenInterval is how stale last_seen_at must be before a validation
// refreshes it. Writing on every request would turn each authenticated read
// into a write on the single SQLite writer (PLAN §8) — the same reason
// Sessions.Validate only slides its expiry past a threshold.
const lastSeenInterval = time.Hour

// Create issues a device token for userID and returns the raw token — the only
// time it exists outside the client.
func (d DeviceTokens) Create(userID int64, name string) (token string, err error) {
	token, th, err := NewToken()
	if err != nil {
		return "", err
	}
	_, err = d.DB.Exec(
		`INSERT INTO device_tokens (token_hash, user_id, name) VALUES (?, ?, ?)`, th, userID, name)
	if err != nil {
		return "", err
	}
	return token, nil
}

// Validate resolves a bearer token to (userID, username, isAdmin), refreshing
// last_seen_at at most once per lastSeenInterval.
func (d DeviceTokens) Validate(token string) (userID int64, username string, isAdmin bool, err error) {
	if token == "" {
		return 0, "", false, ErrInvalidSession
	}
	th := HashToken(token)
	err = d.DB.QueryRow(`
		SELECT t.user_id, u.username, u.is_admin
		FROM device_tokens t JOIN users u ON u.id = t.user_id
		WHERE t.token_hash = ?`, th,
	).Scan(&userID, &username, &isAdmin)
	if err != nil {
		return 0, "", false, ErrInvalidSession
	}
	// Throttled in SQL so it stays one statement: the write is a no-op unless
	// last_seen_at is missing or older than the interval. Note the modifier is
	// built with agoModifier, not lifetimeModifier — the latter always emits a
	// leading '+', so a negative duration yields "+-1 hours", which SQLite
	// rejects, making datetime() NULL and the comparison silently never true.
	_, _ = d.DB.Exec(
		`UPDATE device_tokens SET last_seen_at = datetime('now')
		 WHERE token_hash = ?
		   AND (last_seen_at IS NULL OR last_seen_at < datetime('now', ?))`,
		th, agoModifier(lastSeenInterval))
	return userID, username, isAdmin, nil
}

// List returns userID's devices, newest first, without any token material.
func (d DeviceTokens) List(userID int64) ([]Device, error) {
	rows, err := d.DB.Query(`
		SELECT id, name, created_at, COALESCE(last_seen_at, '')
		FROM device_tokens WHERE user_id = ?
		ORDER BY created_at DESC, id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	devices := []Device{}
	for rows.Next() {
		var dev Device
		if err := rows.Scan(&dev.ID, &dev.Name, &dev.CreatedAt, &dev.LastSeenAt); err != nil {
			return nil, err
		}
		devices = append(devices, dev)
	}
	return devices, rows.Err()
}

// Revoke removes one device. The user_id predicate is the authorization check,
// not a filter: without it, any signed-in user could revoke another's device by
// guessing an id.
func (d DeviceTokens) Revoke(userID, id int64) error {
	res, err := d.DB.Exec(`DELETE FROM device_tokens WHERE id = ? AND user_id = ?`, id, userID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNoSuchDevice
	}
	return nil
}

// RevokeAllForUser unpairs every device — the "sign out all devices" button,
// and what a user reaches for if a phone is lost.
func (d DeviceTokens) RevokeAllForUser(userID int64) error {
	_, err := d.DB.Exec(`DELETE FROM device_tokens WHERE user_id = ?`, userID)
	return err
}

// ConstantTimeEqual is used for any future fixed-token comparisons.
func ConstantTimeEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
