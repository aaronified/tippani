package httpapi

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// sealed builds an encrypted archive around `payload` and hands back the bytes,
// so the tests below can corrupt them in specific ways. `instKey` may be nil (no
// recovery wrap).
func sealed(t *testing.T, mode byte, account, secret string, instKey, payload []byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	w, err := newBackupEncWriter(&buf, mode, account, secret, instKey)
	if err != nil {
		t.Fatalf("new writer: %v", err)
	}
	if _, err := w.Write(payload); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}
	return buf.Bytes()
}

// openSealed opens an archive with a typed secret, the portable path.
func openSealed(t *testing.T, archive []byte, secret string) ([]byte, error) {
	t.Helper()
	r := bytes.NewReader(archive)
	h, err := readBackupHeader(r)
	if err != nil {
		return nil, err
	}
	key, err := h.UnwrapSecret(secret)
	if err != nil {
		return nil, err
	}
	dec, err := newBackupDecReader(r, h, key)
	if err != nil {
		return nil, err
	}
	return io.ReadAll(dec)
}

// openRecovered opens an archive with the instance recovery key, the durable path.
func openRecovered(t *testing.T, archive, instKey []byte) ([]byte, error) {
	t.Helper()
	r := bytes.NewReader(archive)
	h, err := readBackupHeader(r)
	if err != nil {
		return nil, err
	}
	key, err := h.UnwrapRecovery(instKey)
	if err != nil {
		return nil, err
	}
	dec, err := newBackupDecReader(r, h, key)
	if err != nil {
		return nil, err
	}
	return io.ReadAll(dec)
}

func testKey(b byte) []byte { return bytes.Repeat([]byte{b}, backupKeyLen) }

// TestBackupEnvelopeRoundTrip covers the envelope at the sizes that actually
// differ: nothing, less than a frame, exactly a frame boundary (the off-by-one
// that decides whether the final frame is empty), and several frames — through
// both ways in.
func TestBackupEnvelopeRoundTrip(t *testing.T) {
	inst := testKey(0x5a)
	sizes := []int{0, 1, 5000, backupChunk - 1, backupChunk, backupChunk + 1, 3*backupChunk + 77}
	for _, n := range sizes {
		payload := make([]byte, n)
		for i := range payload {
			payload[i] = byte(i*7 + 3)
		}
		archive := sealed(t, backupModePassword, "alice", "supersecret", inst, payload)
		got, err := openSealed(t, archive, "supersecret")
		if err != nil {
			t.Fatalf("size %d: password path: %v", n, err)
		}
		if !bytes.Equal(got, payload) {
			t.Fatalf("size %d: password path round trip differs (%d bytes back)", n, len(got))
		}
		got, err = openRecovered(t, archive, inst)
		if err != nil {
			t.Fatalf("size %d: recovery path: %v", n, err)
		}
		if !bytes.Equal(got, payload) {
			t.Fatalf("size %d: recovery path round trip differs", n)
		}
	}
}

// TestBackupKeyIsPasswordOnly is v2's headline: the account name is a label, not
// an input to the key, so it can be anything — including a name containing the
// "#" that made v1's "<username>#<password>" secret ambiguous.
func TestBackupKeyIsPasswordOnly(t *testing.T) {
	a := sealed(t, backupModePassword, "alice", "supersecret", nil, []byte("x"))
	// A different label, same password: still opens. In v1 this was the whole key.
	if _, err := openSealed(t, a, "supersecret"); err != nil {
		t.Fatalf("password alone did not open the archive: %v", err)
	}
	b := sealed(t, backupModePassword, "someone-else-entirely", "supersecret", nil, []byte("x"))
	if _, err := openSealed(t, b, "supersecret"); err != nil {
		t.Fatalf("the label changed the key: %v", err)
	}
	// v1's collision: accountSecret("a#b","cd") == accountSecret("a","b#cd").
	// There is no such pair to collide any more — the name is not in the key.
	c := sealed(t, backupModePassword, "a#b", "cd", nil, []byte("x"))
	if _, err := openSealed(t, c, "cd"); err != nil {
		t.Fatalf("a # in the label broke the key: %v", err)
	}
	if _, err := openSealed(t, c, "b#cd"); !errors.Is(err, errBadKey) {
		t.Fatalf("v1's ambiguous secret still opens a v2 archive: %v", err)
	}
}

// TestBackupEnvelopeHeader checks what the header promises the UI: the mode, the
// account label, whether a recovery wrap is present — and that a passphrase
// archive records neither a name nor a recovery wrap, since choosing a passphrase
// is choosing not to tie the archive to this instance or any login.
func TestBackupEnvelopeHeader(t *testing.T) {
	inst := testKey(0x11)
	pw := sealed(t, backupModePassword, "alice", "supersecret", inst, []byte("x"))
	h, err := readBackupHeader(bytes.NewReader(pw))
	if err != nil {
		t.Fatalf("header: %v", err)
	}
	if h.Mode != backupModePassword || h.Account != "alice" || h.Version != backupCryptoV2 {
		t.Fatalf("password header = %+v", h)
	}
	if !h.Recoverable() {
		t.Fatal("a password archive built with an instance key carries no recovery wrap")
	}

	// Passphrase mode ignores both the label and the instance key it was handed.
	pp := sealed(t, backupModePassphrase, "alice", "a-long-passphrase", inst, []byte("x"))
	h2, err := readBackupHeader(bytes.NewReader(pp))
	if err != nil {
		t.Fatalf("header: %v", err)
	}
	if h2.Mode != backupModePassphrase || h2.Account != "" {
		t.Fatalf("passphrase header leaks an account: %+v", h2)
	}
	if h2.Recoverable() {
		t.Fatal("a passphrase archive carries a recovery wrap — it must be the passphrase or nothing")
	}
	if _, err := openRecovered(t, pp, inst); !errors.Is(err, errBadKey) {
		t.Fatalf("the instance key opened a passphrase archive: %v", err)
	}

	// A plain gzip stream is not corruption — it is a pre-1.4.1 archive.
	if _, err := readBackupHeader(bytes.NewReader([]byte{0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0})); !errors.Is(err, errNotEncrypted) {
		t.Fatalf("plain gzip should read as unencrypted, got %v", err)
	}
}

// TestBackupV1Refused: 1.4.1's format is refused by name, with an actionable
// message. It shipped for about an hour and no archive of it exists outside this
// repository's tests, and reading it would mean keeping the ambiguous
// "<username>#<password>" secret alive.
func TestBackupV1Refused(t *testing.T) {
	v1 := sealed(t, backupModePassword, "alice", "supersecret", nil, []byte("x"))
	v1[4] = backupCryptoV1
	_, err := readBackupHeader(bytes.NewReader(v1))
	if err == nil {
		t.Fatal("a v1 header was accepted")
	}
	if errors.Is(err, errNotEncrypted) {
		t.Fatalf("a v1 header read as an unencrypted archive: %v", err)
	}
	if !strings.Contains(err.Error(), "1.4.1") {
		t.Fatalf("the v1 refusal does not say which version wrote it: %v", err)
	}
	// A version from the future is a different message: update, do not re-backup.
	v9 := sealed(t, backupModePassword, "alice", "supersecret", nil, []byte("x"))
	v9[4] = 99
	if _, err := readBackupHeader(bytes.NewReader(v9)); err == nil || !strings.Contains(err.Error(), "newer") {
		t.Fatalf("a future version should ask for an update: %v", err)
	}
}

// TestBackupNoncesAreFresh guards the one misuse AES-GCM does not survive. The
// instance recovery key is reused across every archive a box writes — the first
// key in this format that is not per-archive — so its wrap nonce must be fresh
// every time. Two archives that shared one would leak their archive keys' XOR and
// the GHASH subkey, which makes the wrap forgeable, and the whole header is the
// frames' AAD.
func TestBackupNoncesAreFresh(t *testing.T) {
	inst := testKey(0x77)
	const n = 8
	salts := map[string]bool{}
	kwNonces := map[string]bool{}
	rwNonces := map[string]bool{}
	baseNonces := map[string]bool{}
	for i := 0; i < n; i++ {
		h, err := readBackupHeader(bytes.NewReader(
			sealed(t, backupModePassword, "alice", "supersecret", inst, []byte("same payload every time"))))
		if err != nil {
			t.Fatal(err)
		}
		salts[string(h.Salt)] = true
		baseNonces[string(h.Nonce)] = true
		kwNonces[string(h.KeyWrap[:backupNonceLen])] = true
		rwNonces[string(h.RecWrap[:backupNonceLen])] = true
	}
	for what, seen := range map[string]map[string]bool{
		"salt": salts, "frame base nonce": baseNonces, "keyWrap nonce": kwNonces, "recWrap nonce": rwNonces,
	} {
		if len(seen) != n {
			t.Errorf("%s repeated across %d archives (%d distinct)", what, n, len(seen))
		}
	}
}

// TestBackupEnvelopeRejects is the point of the whole exercise: every way an
// archive can be wrong has to be refused, and — new in v2 — a wrong CREDENTIAL and
// a DAMAGED body have to be told apart. Reporting damage as "wrong password" sends
// an operator whose archive has been tampered with to go and doubt their memory.
func TestBackupEnvelopeRejects(t *testing.T) {
	inst := testKey(0x23)
	payload := bytes.Repeat([]byte("tippani"), 400_000) // spans several frames
	archive := sealed(t, backupModePassword, "alice", "supersecret", inst, payload)

	t.Run("wrong password is errBadKey", func(t *testing.T) {
		if _, err := openSealed(t, archive, "supersecrez"); !errors.Is(err, errBadKey) {
			t.Fatalf("got %v, want errBadKey", err)
		}
	})
	t.Run("wrong instance key is errBadKey", func(t *testing.T) {
		if _, err := openRecovered(t, archive, testKey(0x24)); !errors.Is(err, errBadKey) {
			t.Fatalf("got %v, want errBadKey", err)
		}
	})
	t.Run("altered body is damage, not a wrong key", func(t *testing.T) {
		bad := append([]byte(nil), archive...)
		bad[len(bad)-30] ^= 0xff
		_, err := openSealed(t, bad, "supersecret")
		if err == nil {
			t.Fatal("an altered archive opened cleanly")
		}
		if errors.Is(err, errBadKey) {
			t.Fatalf("tampering reported as a wrong password: %v", err)
		}
	})
	t.Run("truncated tail is truncation, not a wrong key", func(t *testing.T) {
		_, err := openSealed(t, archive[:len(archive)-200], "supersecret")
		if err == nil {
			t.Fatal("a truncated archive opened cleanly")
		}
		if errors.Is(err, errBadKey) {
			t.Fatalf("truncation reported as a wrong password: %v", err)
		}
		if !strings.Contains(err.Error(), "truncat") {
			t.Fatalf("truncation not named as such: %v", err)
		}
	})
	t.Run("header only is truncation", func(t *testing.T) {
		h, err := readBackupHeader(bytes.NewReader(archive))
		if err != nil {
			t.Fatal(err)
		}
		_, err = openSealed(t, archive[:h.Size], "supersecret")
		if err == nil {
			t.Fatal("an archive with no frames opened cleanly")
		}
		if errors.Is(err, errBadKey) {
			t.Fatalf("a bodiless archive reported as a wrong password: %v", err)
		}
	})
	t.Run("altered label breaks both wraps", func(t *testing.T) {
		// The prefix is the wraps' AAD, so swapping the recorded account name for
		// one whose password an attacker knows cannot be got away with.
		bad := append([]byte(nil), archive...)
		i := bytes.Index(bad, []byte("alice"))
		if i < 0 {
			t.Fatal("account label not found in header")
		}
		copy(bad[i:], []byte("bobby"))
		if _, err := openSealed(t, bad, "supersecret"); !errors.Is(err, errBadKey) {
			t.Fatalf("a label-swapped archive opened: %v", err)
		}
		if _, err := openRecovered(t, bad, inst); !errors.Is(err, errBadKey) {
			t.Fatalf("a label-swapped archive opened via recovery: %v", err)
		}
	})
	t.Run("stripped recovery wrap breaks every frame", func(t *testing.T) {
		// An attacker who removes recWrap to force a password prompt changes the
		// frames' AAD, so the body no longer opens even with the right password.
		h, err := readBackupHeader(bytes.NewReader(archive))
		if err != nil {
			t.Fatal(err)
		}
		cut := h.Size - (2 + backupWrapLen)
		bad := append([]byte(nil), archive[:cut]...)
		bad = append(bad, 0x00, 0x00) // rwLen = 0
		bad = append(bad, archive[h.Size:]...)
		h2, err := readBackupHeader(bytes.NewReader(bad))
		if err != nil {
			t.Fatalf("the stripped header should still parse: %v", err)
		}
		if h2.Recoverable() {
			t.Fatal("the wrap was not actually stripped")
		}
		// The key still unwraps — keyWrap's AAD is only the prefix — and then every
		// frame fails, which is exactly the distinction v2 draws.
		if _, err := openSealed(t, bad, "supersecret"); err == nil || errors.Is(err, errBadKey) {
			t.Fatalf("a stripped recovery wrap was tolerated: %v", err)
		}
	})
	t.Run("spliced archives", func(t *testing.T) {
		other := sealed(t, backupModePassword, "alice", "supersecret", inst, payload)
		spliced := append(append([]byte(nil), archive[:len(archive)/2]...), other[len(other)/2:]...)
		if _, err := openSealed(t, spliced, "supersecret"); err == nil {
			t.Fatal("a spliced archive opened cleanly")
		}
	})
	t.Run("hostile frame length", func(t *testing.T) {
		bad := append([]byte(nil), archive...)
		h, err := readBackupHeader(bytes.NewReader(bad))
		if err != nil {
			t.Fatal(err)
		}
		bad[h.Size+1] = 0xff
		bad[h.Size+2] = 0xff
		bad[h.Size+3] = 0xff
		bad[h.Size+4] = 0xff
		if _, err := openSealed(t, bad, "supersecret"); err == nil {
			t.Fatal("a hostile frame length opened cleanly")
		}
	})
	t.Run("hostile wrap length", func(t *testing.T) {
		bad := append([]byte(nil), archive...)
		// kwLen sits immediately after the prefix.
		h, err := readBackupHeader(bytes.NewReader(bad))
		if err != nil {
			t.Fatal(err)
		}
		at := len(h.Prefix)
		bad[at] = 0xff
		bad[at+1] = 0xff
		if _, err := readBackupHeader(bytes.NewReader(bad)); err == nil {
			t.Fatal("a 64 KiB wrap length was accepted")
		}
	})
}

// TestBackupSaltIsPerArchive: the same payload under the same secret must produce
// different bytes each time. Otherwise an archive would be a fingerprint of its
// own contents, and two backups could be compared for "did anything change".
func TestBackupSaltIsPerArchive(t *testing.T) {
	a := sealed(t, backupModePassword, "alice", "supersecret", nil, []byte("identical payload"))
	b := sealed(t, backupModePassword, "alice", "supersecret", nil, []byte("identical payload"))
	if bytes.Equal(a, b) {
		t.Fatal("two archives of the same payload are byte-identical — the salt is not per-archive")
	}
	for i, arc := range [][]byte{a, b} {
		if got, err := openSealed(t, arc, "supersecret"); err != nil || string(got) != "identical payload" {
			t.Fatalf("archive %d: %q %v", i, got, err)
		}
	}
}

// ---- the recovery key, over HTTP -------------------------------------------

// TestRecoveryKeySurvivesPasswordChange is the bug this release exists to fix: an
// archive sealed under one password, restored after the password has changed,
// using only the NEW password.
func TestRecoveryKeySurvivesPasswordChange(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("POST", "/books", map[string]any{"title": "Kept", "author": "K"}, 201)
	backupNow(admin)

	// Diverge, then change the password.
	admin.mustDo("POST", "/books", map[string]any{"title": "Doomed", "author": "G"}, 201)
	const newPw = "brandnewpass1"
	// A password change revokes every session and re-issues one for the caller, so
	// the client has to pick up the new cookie or the next request is anonymous.
	prec := admin.mustDo("POST", "/auth/password", map[string]string{"current": testPw, "new": newPw}, 200)
	admin.cookie = cookieOf(t, prec)

	// The OLD password no longer exists as a login, and the archive predates the
	// new one — in 1.4.1 that archive was scrap. Here the new password opens it.
	if rec := admin.mustDo("POST", "/admin/restore", map[string]any{"password": newPw}, 200); !bytes.Contains(rec.Body.Bytes(), []byte(`"ok":true`)) {
		t.Fatalf("restore after a password change: %s", rec.Body)
	}

	// The restored database is the pre-change one, so the OLD password logs in.
	fresh := &testClient{t: t, h: h}
	lrec := fresh.do("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw})
	if lrec.Code != 200 {
		t.Fatalf("login after restore: %d %s", lrec.Code, lrec.Body)
	}
	fresh.cookie = cookieOf(t, lrec)
	body := fresh.mustDo("GET", "/books", nil, 200).Body.Bytes()
	if !bytes.Contains(body, []byte("Kept")) || bytes.Contains(body, []byte("Doomed")) {
		t.Fatalf("restored books = %s", body)
	}
}

// TestRecoveryKeyIsNeverArchived: an archive that carries the key to itself is not
// an encrypted archive. The key must also survive the restore that rearranges the
// data directory around it — the two halves controlEntry buys.
func TestRecoveryKeyIsNeverArchived(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("POST", "/books", map[string]any{"title": "Kept", "author": "K"}, 201)
	backupNow(admin)

	keyPath := filepath.Join(srv.DataDir, recoveryKeyFile)
	before, err := os.ReadFile(keyPath)
	if err != nil {
		t.Fatalf("the recovery key was not created by a backup: %v", err)
	}
	if len(before) != backupKeyLen {
		t.Fatalf("recovery key is %d bytes, want %d", len(before), backupKeyLen)
	}

	// Not in the archive, under any name — and its bytes appear nowhere in it.
	name, _ := srv.newestBackup()
	enc, err := os.ReadFile(filepath.Join(srv.backupsDir(), name))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(enc, before) {
		t.Fatal("the recovery key's bytes appear in the archive")
	}
	plain := plaintextOf(t, enc, "supersecret")
	if bytes.Contains(plain, before) {
		t.Fatal("the recovery key's bytes appear in the archive's contents")
	}
	for _, n := range tarNames(t, plain) {
		if strings.Contains(n, recoveryKeyFile) {
			t.Fatalf("the archive contains %s", n)
		}
	}

	// Survives a restore: the swap moves everything else aside around it.
	admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, 200)
	after, err := os.ReadFile(keyPath)
	if err != nil {
		t.Fatalf("the recovery key did not survive a restore: %v", err)
	}
	if !bytes.Equal(before, after) {
		t.Fatal("the recovery key changed across a restore")
	}
}

// TestRecoveryKeyNotSharedAcrossInstances: the durable path is deliberately
// local. An archive carried to another box must fall back to its own password,
// and the refusal has to SAY that rather than looking like a typo.
func TestRecoveryKeyNotSharedAcrossInstances(t *testing.T) {
	donor := newTestServer(t)
	dAdmin := signupAdmin(t, donor.Handler())
	dAdmin.mustDo("POST", "/books", map[string]any{"title": "FromDonor", "author": "D"}, 201)
	backupNow(dAdmin)
	dName, _ := donor.newestBackup()
	archive, err := os.ReadFile(filepath.Join(donor.backupsDir(), dName))
	if err != nil {
		t.Fatal(err)
	}

	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	// Give this box a recovery key of its own, so the "wrong instance" branch is
	// the one under test rather than "no key yet".
	backupNow(admin)

	rec := admin.restoreUpload("/admin/restore/upload", map[string]string{"password": "notthedonors"}, archive)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("a foreign archive with a wrong password: %d %s", rec.Code, rec.Body)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte("not made on this server")) {
		t.Fatalf("the refusal does not explain that the archive is foreign: %s", rec.Body)
	}
	// The donor's own password does open it — the portable path travels.
	if rec := admin.restoreUpload("/admin/restore/upload", pwUpload(), archive); rec.Code != 200 {
		t.Fatalf("a foreign archive with its own password: %d %s", rec.Code, rec.Body)
	}
}

// TestBackupStatusReportsRecoverable: the restore prompt must be able to say
// "your password will open this" rather than naming an account and hoping.
func TestBackupStatusReportsRecoverable(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	backupNow(admin)

	st := decode[backupMetaResp](t, admin.mustDo("GET", "/admin/backup", nil, 200))
	if st.Backup == nil || st.Backup.Key != "password" || st.Backup.Account != "alice" {
		t.Fatalf("key metadata = %+v", st.Backup)
	}
	if !st.Backup.Recoverable {
		t.Fatal("a password archive made on this box is not reported as recoverable")
	}

	// A passphrase archive is not recoverable, by design.
	admin.mustDo("POST", "/admin/backup", map[string]any{"passphrase": "correct-horse!"}, 200)
	st2 := decode[backupMetaResp](t, admin.mustDo("GET", "/admin/backup", nil, 200))
	if st2.Backup == nil || st2.Backup.Key != "passphrase" || st2.Backup.Recoverable {
		t.Fatalf("passphrase archive metadata = %+v", st2.Backup)
	}
	// And the instance key does not open it, however local it is.
	if rec := admin.do("POST", "/admin/restore", map[string]any{"password": testPw}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("a password opened a passphrase archive: %d %s", rec.Code, rec.Body)
	}
}

// TestSecretShapeRules pins the password and passphrase alphabets. The upper bound
// and the ASCII-only rule are not cosmetic: a password is also a backup key, so a
// character that arrives as different bytes on a different keyboard is an archive
// that will not open.
func TestSecretShapeRules(t *testing.T) {
	for _, tc := range []struct {
		name, pw string
		ok       bool
	}{
		{"minimum", "12345678", true},
		{"maximum", strings.Repeat("a", 20), true},
		{"punctuation", "p@ssw0rd!#$%^&*", true},
		{"space", "two words here", true},
		{"too short", "1234567", false},
		{"too long", strings.Repeat("a", 21), false},
		{"accented", "pásswórd1", false},
		{"non latin", "パスワード1234", false},
		{"emoji", "password🔐", false},
		{"control char", "pass\tword", false},
	} {
		if got := passwordProblem(tc.pw) == ""; got != tc.ok {
			t.Errorf("passwordProblem(%s) accepted=%v, want %v (%q)", tc.name, got, tc.ok, passwordProblem(tc.pw))
		}
	}
	// The passphrase floor is higher — it is opt-in, so it should mean something.
	if passphraseProblem("123456789") == "" {
		t.Error("a nine-character passphrase was accepted")
	}
	if msg := passphraseProblem("1234567890"); msg != "" {
		t.Errorf("a ten-character passphrase was refused: %s", msg)
	}
	if passphraseProblem(strings.Repeat("a", 21)) == "" {
		t.Error("a 21-character passphrase was accepted")
	}
	if passphraseProblem("pässphrase") == "" {
		t.Error("an accented passphrase was accepted")
	}
}

// TestPasswordRulesEnforcedOverHTTP checks the rules are applied where accounts
// are actually created and changed, not only in the helper.
func TestPasswordRulesEnforcedOverHTTP(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	anon := &testClient{t: t, h: h}

	if rec := anon.do("POST", "/auth/signup", map[string]string{"username": "alice", "password": strings.Repeat("a", 21)}); rec.Code != http.StatusBadRequest {
		t.Fatalf("signup with a 21-character password: %d %s", rec.Code, rec.Body)
	}
	if rec := anon.do("POST", "/auth/signup", map[string]string{"username": "alice", "password": "pásswórd1"}); rec.Code != http.StatusBadRequest {
		t.Fatalf("signup with an accented password: %d %s", rec.Code, rec.Body)
	}

	admin := signupAdmin(t, h)
	if rec := admin.do("POST", "/admin/users", map[string]string{"username": "bob", "password": "wörterbuch"}); rec.Code != http.StatusBadRequest {
		t.Fatalf("add user with an accented password: %d %s", rec.Code, rec.Body)
	}
	if rec := admin.do("POST", "/auth/password", map[string]string{"current": testPw, "new": strings.Repeat("z", 21)}); rec.Code != http.StatusBadRequest {
		t.Fatalf("password change to 21 characters: %d %s", rec.Code, rec.Body)
	}
	admin.mustDo("POST", "/auth/password", map[string]string{"current": testPw, "new": "newpass!123"}, 200)
}
