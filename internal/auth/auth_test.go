package auth_test

import (
	"path/filepath"
	"testing"

	"tippani/internal/auth"
	"tippani/internal/store"
)

// Device tokens are the credential the Android app under mobile/ carries. They
// deliberately behave unlike the cookie sessions next to them in the schema, so
// most of what follows asserts the differences rather than the similarities:
// no expiry, and survival across a password change.

func newDB(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	return st
}

// addUser inserts a user directly and returns their id.
func addUser(t *testing.T, st *store.Store, name string, admin bool) int64 {
	t.Helper()
	hash, err := auth.HashPassword("supersecret")
	if err != nil {
		t.Fatal(err)
	}
	res, err := st.DB.Exec(
		`INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)`, name, hash, admin)
	if err != nil {
		t.Fatal(err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func TestDeviceTokenCreateAndValidate(t *testing.T) {
	st := newDB(t)
	d := auth.DeviceTokens{DB: st.DB}
	uid := addUser(t, st, "alice", true)

	token, err := d.Create(uid, "Alice's Pixel")
	if err != nil {
		t.Fatal(err)
	}
	if token == "" {
		t.Fatal("empty token")
	}

	gotUID, gotName, gotAdmin, err := d.Validate(token)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if gotUID != uid || gotName != "alice" || !gotAdmin {
		t.Fatalf("validate: got (%d, %q, %v) want (%d, alice, true)", gotUID, gotName, gotAdmin, uid)
	}
}

// The raw token must never reach the database — only its sha256. A leaked
// backup or a stray SELECT must not hand out working credentials.
func TestDeviceTokenStoredHashedOnly(t *testing.T) {
	st := newDB(t)
	d := auth.DeviceTokens{DB: st.DB}
	uid := addUser(t, st, "alice", false)

	token, err := d.Create(uid, "Pixel")
	if err != nil {
		t.Fatal(err)
	}

	var stored string
	if err := st.DB.QueryRow(`SELECT token_hash FROM device_tokens`).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored == token {
		t.Fatal("raw token was stored in the database")
	}
	if stored != auth.HashToken(token) {
		t.Fatalf("stored value is not the token's sha256: %q", stored)
	}
}

func TestDeviceTokenRejectsUnknown(t *testing.T) {
	st := newDB(t)
	d := auth.DeviceTokens{DB: st.DB}
	addUser(t, st, "alice", false)

	for _, tok := range []string{"", "not-a-token", auth.HashToken("guess")} {
		if _, _, _, err := d.Validate(tok); err == nil {
			t.Fatalf("validate(%q) should have failed", tok)
		}
	}
}

// TestDeviceTokenDoesNotExpire is the whole point of a separate table: a
// browser session dies at SessionMaxLifetime regardless of use, a paired device
// does not. A token created two years ago still works.
func TestDeviceTokenDoesNotExpire(t *testing.T) {
	st := newDB(t)
	d := auth.DeviceTokens{DB: st.DB}
	uid := addUser(t, st, "alice", false)

	token, err := d.Create(uid, "Pixel")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := st.DB.Exec(
		`UPDATE device_tokens SET created_at = datetime('now', '-730 days')`); err != nil {
		t.Fatal(err)
	}

	if _, _, _, err := d.Validate(token); err != nil {
		t.Fatalf("a two-year-old device token must still validate: %v", err)
	}
}

func TestDeviceTokenRevoke(t *testing.T) {
	st := newDB(t)
	d := auth.DeviceTokens{DB: st.DB}
	uid := addUser(t, st, "alice", false)

	keep, err := d.Create(uid, "Tablet")
	if err != nil {
		t.Fatal(err)
	}
	drop, err := d.Create(uid, "Pixel")
	if err != nil {
		t.Fatal(err)
	}
	var dropID int64
	if err := st.DB.QueryRow(
		`SELECT id FROM device_tokens WHERE token_hash = ?`, auth.HashToken(drop)).Scan(&dropID); err != nil {
		t.Fatal(err)
	}

	if err := d.Revoke(uid, dropID); err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := d.Validate(drop); err == nil {
		t.Fatal("revoked token still validates")
	}
	if _, _, _, err := d.Validate(keep); err != nil {
		t.Fatalf("revoking one device must not affect another: %v", err)
	}
}

// A user must not be able to revoke someone else's device by guessing its id.
func TestDeviceTokenRevokeIsScopedToOwner(t *testing.T) {
	st := newDB(t)
	d := auth.DeviceTokens{DB: st.DB}
	alice := addUser(t, st, "alice", false)
	bob := addUser(t, st, "bob", false)

	bobToken, err := d.Create(bob, "Bob's Pixel")
	if err != nil {
		t.Fatal(err)
	}
	var bobID int64
	if err := st.DB.QueryRow(
		`SELECT id FROM device_tokens WHERE token_hash = ?`, auth.HashToken(bobToken)).Scan(&bobID); err != nil {
		t.Fatal(err)
	}

	if err := d.Revoke(alice, bobID); err == nil {
		t.Fatal("alice should not be able to revoke bob's device")
	}
	if _, _, _, err := d.Validate(bobToken); err != nil {
		t.Fatalf("bob's token should be untouched: %v", err)
	}
}

func TestDeviceTokenRevokeAll(t *testing.T) {
	st := newDB(t)
	d := auth.DeviceTokens{DB: st.DB}
	alice := addUser(t, st, "alice", false)
	bob := addUser(t, st, "bob", false)

	a1, _ := d.Create(alice, "Pixel")
	a2, _ := d.Create(alice, "Tablet")
	b1, _ := d.Create(bob, "Bob's Pixel")

	if err := d.RevokeAllForUser(alice); err != nil {
		t.Fatal(err)
	}
	for _, tok := range []string{a1, a2} {
		if _, _, _, err := d.Validate(tok); err == nil {
			t.Fatal("alice's tokens should all be revoked")
		}
	}
	if _, _, _, err := d.Validate(b1); err != nil {
		t.Fatalf("bob's token must survive alice's revoke-all: %v", err)
	}
}

// TestDeviceTokenSurvivesPasswordChange pins the deliberate divergence from
// sessions. Sessions.DeleteAllForUser is called on password change so a leaked
// cookie can't outlive the password; device tokens are explicitly *not* swept
// up, because silently unpairing every phone on a routine password rotation is
// worse than the threat it would mitigate. Revoking a device is its own action.
func TestDeviceTokenSurvivesPasswordChange(t *testing.T) {
	st := newDB(t)
	sessions := auth.Sessions{DB: st.DB}
	devices := auth.DeviceTokens{DB: st.DB}
	uid := addUser(t, st, "alice", false)

	cookie, err := sessions.Create(uid)
	if err != nil {
		t.Fatal(err)
	}
	device, err := devices.Create(uid, "Pixel")
	if err != nil {
		t.Fatal(err)
	}

	// What a password change does today.
	if err := sessions.DeleteAllForUser(uid); err != nil {
		t.Fatal(err)
	}

	if _, _, _, err := sessions.Validate(cookie); err == nil {
		t.Fatal("browser sessions must be revoked on password change")
	}
	if _, _, _, err := devices.Validate(device); err != nil {
		t.Fatalf("device tokens must survive a password change: %v", err)
	}
}

func TestDeviceTokenCascadesOnUserDelete(t *testing.T) {
	st := newDB(t)
	d := auth.DeviceTokens{DB: st.DB}
	uid := addUser(t, st, "alice", false)

	token, err := d.Create(uid, "Pixel")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := st.DB.Exec(`DELETE FROM users WHERE id = ?`, uid); err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := d.Validate(token); err == nil {
		t.Fatal("a deleted user's device token must stop working")
	}
}

// last_seen_at powers the Settings device list, but writing it on every request
// would turn each read into a write on the single SQLite writer — the exact
// cost Sessions.Validate already avoids. It updates at most hourly.
func TestDeviceTokenLastSeenThrottled(t *testing.T) {
	st := newDB(t)
	d := auth.DeviceTokens{DB: st.DB}
	uid := addUser(t, st, "alice", false)

	token, err := d.Create(uid, "Pixel")
	if err != nil {
		t.Fatal(err)
	}

	lastSeen := func() string {
		t.Helper()
		var v string
		if err := st.DB.QueryRow(
			`SELECT COALESCE(last_seen_at, '') FROM device_tokens`).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}

	if lastSeen() != "" {
		t.Fatal("last_seen_at should start NULL")
	}

	// First use stamps it.
	if _, _, _, err := d.Validate(token); err != nil {
		t.Fatal(err)
	}
	first := lastSeen()
	if first == "" {
		t.Fatal("first use should stamp last_seen_at")
	}

	// An immediate second use must not write again.
	if _, _, _, err := d.Validate(token); err != nil {
		t.Fatal(err)
	}
	if got := lastSeen(); got != first {
		t.Fatalf("last_seen_at rewritten within the hour: %q -> %q", first, got)
	}

	// Once it is stale, the next use refreshes it.
	if _, err := st.DB.Exec(
		`UPDATE device_tokens SET last_seen_at = datetime('now', '-2 hours')`); err != nil {
		t.Fatal(err)
	}
	stale := lastSeen()
	if _, _, _, err := d.Validate(token); err != nil {
		t.Fatal(err)
	}
	if lastSeen() == stale {
		t.Fatal("a stale last_seen_at should be refreshed on use")
	}
}

// List backs the Settings panel; it must never hand back the token or its hash.
func TestDeviceTokenList(t *testing.T) {
	st := newDB(t)
	d := auth.DeviceTokens{DB: st.DB}
	alice := addUser(t, st, "alice", false)
	bob := addUser(t, st, "bob", false)

	if _, err := d.Create(alice, "Pixel"); err != nil {
		t.Fatal(err)
	}
	if _, err := d.Create(bob, "Bob's Pixel"); err != nil {
		t.Fatal(err)
	}

	devices, err := d.List(alice)
	if err != nil {
		t.Fatal(err)
	}
	if len(devices) != 1 {
		t.Fatalf("got %d devices want 1 (bob's must not leak)", len(devices))
	}
	if devices[0].Name != "Pixel" {
		t.Fatalf("name: %q", devices[0].Name)
	}
	if devices[0].CreatedAt == "" {
		t.Fatal("created_at should be populated")
	}
	if devices[0].LastSeenAt != "" {
		t.Fatal("an unused device should report no last-seen")
	}
}
