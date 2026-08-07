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
// so the tests below can corrupt them in specific ways.
func sealed(t *testing.T, mode byte, account, secret string, payload []byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	w, err := newBackupEncWriter(&buf, mode, account, secret)
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

func openSealed(t *testing.T, archive []byte, secret string) ([]byte, error) {
	t.Helper()
	r, _, err := newBackupDecReader(bytes.NewReader(archive), secret)
	if err != nil {
		return nil, err
	}
	return io.ReadAll(r)
}

// TestBackupEnvelopeRoundTrip covers the envelope itself, at the sizes that
// actually differ: nothing, less than a frame, exactly a frame boundary (the
// off-by-one that decides whether the final frame is empty), and several frames.
func TestBackupEnvelopeRoundTrip(t *testing.T) {
	secret := accountSecret("alice", "supersecret")
	sizes := []int{0, 1, 5000, backupChunk - 1, backupChunk, backupChunk + 1, 3*backupChunk + 77}
	for _, n := range sizes {
		payload := make([]byte, n)
		for i := range payload {
			payload[i] = byte(i*7 + 3)
		}
		archive := sealed(t, backupModeAccount, "alice", secret, payload)
		got, err := openSealed(t, archive, secret)
		if err != nil {
			t.Fatalf("size %d: open: %v", n, err)
		}
		if !bytes.Equal(got, payload) {
			t.Fatalf("size %d: round trip differs (%d bytes back)", n, len(got))
		}
	}
}

// TestBackupEnvelopeHeader checks what the header promises the UI: the mode, and
// the account name for mode 1 — and that mode 2 records no name at all, since a
// passphrase-keyed archive has nothing to name and should not hint at the key.
func TestBackupEnvelopeHeader(t *testing.T) {
	acct := sealed(t, backupModeAccount, "alice", accountSecret("alice", "supersecret"), []byte("x"))
	h, err := readBackupHeader(bytes.NewReader(acct))
	if err != nil {
		t.Fatalf("header: %v", err)
	}
	if h.Mode != backupModeAccount || h.Account != "alice" || h.Version != backupCryptoV1 {
		t.Fatalf("account header = %+v", h)
	}

	pass := sealed(t, backupModePassphrase, "alice", "a-long-passphrase", []byte("x"))
	h2, err := readBackupHeader(bytes.NewReader(pass))
	if err != nil {
		t.Fatalf("header: %v", err)
	}
	if h2.Mode != backupModePassphrase || h2.Account != "" {
		t.Fatalf("passphrase header leaks an account: %+v", h2)
	}

	// A plain gzip stream is not corruption — it is a pre-1.4.1 archive.
	if _, err := readBackupHeader(bytes.NewReader([]byte{0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0})); !errors.Is(err, errNotEncrypted) {
		t.Fatalf("plain gzip should read as unencrypted, got %v", err)
	}
}

// TestBackupEnvelopeRejects is the point of the whole exercise: every way an
// archive can be wrong has to be refused, and the truncation case has to be
// refused LOUDLY — a backup silently missing its tail looks like a backup.
func TestBackupEnvelopeRejects(t *testing.T) {
	secret := accountSecret("alice", "supersecret")
	payload := bytes.Repeat([]byte("tippani"), 400_000) // spans several frames
	archive := sealed(t, backupModeAccount, "alice", secret, payload)

	t.Run("wrong password", func(t *testing.T) {
		if _, err := openSealed(t, archive, accountSecret("alice", "supersecrez")); !errors.Is(err, errBadKey) {
			t.Fatalf("got %v, want errBadKey", err)
		}
	})
	t.Run("right password wrong account", func(t *testing.T) {
		// The account name is half the passphrase, so a name mismatch is a key
		// mismatch — which is what makes the name in the header meaningful.
		if _, err := openSealed(t, archive, accountSecret("bob", "supersecret")); !errors.Is(err, errBadKey) {
			t.Fatalf("got %v, want errBadKey", err)
		}
	})
	t.Run("truncated tail", func(t *testing.T) {
		// Drop the last 200 bytes: the final frame never arrives.
		if _, err := openSealed(t, archive[:len(archive)-200], secret); err == nil {
			t.Fatal("a truncated archive opened cleanly")
		}
	})
	t.Run("truncated to first frame only", func(t *testing.T) {
		// A whole first frame, then nothing. It decrypts — and must still fail,
		// because no frame was marked final.
		cut := len(archive) - (len(archive) - 40)/2
		out, err := openSealed(t, archive[:cut], secret)
		if err == nil {
			t.Fatalf("a truncated archive opened cleanly (%d bytes)", len(out))
		}
		if strings.Contains(err.Error(), "password") {
			t.Fatalf("truncation reported as a credential problem: %v", err)
		}
	})
	t.Run("altered ciphertext", func(t *testing.T) {
		bad := append([]byte(nil), archive...)
		bad[len(bad)-30] ^= 0xff
		if _, err := openSealed(t, bad, secret); err == nil {
			t.Fatal("an altered archive opened cleanly")
		}
	})
	t.Run("altered header", func(t *testing.T) {
		// Swap the recorded account name for one whose password an attacker knows.
		// The header is the AEAD's additional data, so this cannot be got away with.
		bad := append([]byte(nil), archive...)
		i := bytes.Index(bad, []byte("alice"))
		if i < 0 {
			t.Fatal("account name not found in header")
		}
		copy(bad[i:], []byte("bobby"))
		if _, err := openSealed(t, bad, accountSecret("bobby", "supersecret")); err == nil {
			t.Fatal("a header-swapped archive opened cleanly")
		}
	})
	t.Run("reordered frames", func(t *testing.T) {
		// Two archives of the same payload under the same secret must not be
		// interchangeable frame-for-frame: the salt and nonce are per-archive.
		other := sealed(t, backupModeAccount, "alice", secret, payload)
		spliced := append(append([]byte(nil), archive[:len(archive)/2]...), other[len(other)/2:]...)
		if _, err := openSealed(t, spliced, secret); err == nil {
			t.Fatal("a spliced archive opened cleanly")
		}
	})
	t.Run("hostile frame length", func(t *testing.T) {
		// A frame claiming 4 GiB must be refused on its length, not allocated.
		bad := append([]byte(nil), archive...)
		hdr, err := readBackupHeader(bytes.NewReader(bad))
		if err != nil {
			t.Fatal(err)
		}
		bad[hdr.Size+1] = 0xff
		bad[hdr.Size+2] = 0xff
		bad[hdr.Size+3] = 0xff
		bad[hdr.Size+4] = 0xff
		if _, err := openSealed(t, bad, secret); err == nil {
			t.Fatal("a hostile frame length opened cleanly")
		}
	})
}

// TestBackupSaltIsPerArchive: the same payload under the same secret must produce
// different bytes each time. Otherwise an archive would be a fingerprint of its
// own contents, and two backups could be compared for "did anything change".
func TestBackupSaltIsPerArchive(t *testing.T) {
	secret := accountSecret("alice", "supersecret")
	a := sealed(t, backupModeAccount, "alice", secret, []byte("identical payload"))
	b := sealed(t, backupModeAccount, "alice", secret, []byte("identical payload"))
	if bytes.Equal(a, b) {
		t.Fatal("two archives of the same payload are byte-identical — the salt is not per-archive")
	}
	// Both still open.
	for i, arc := range [][]byte{a, b} {
		if got, err := openSealed(t, arc, secret); err != nil || string(got) != "identical payload" {
			t.Fatalf("archive %d: %q %v", i, got, err)
		}
	}
}

// TestPassphraseBackupRestore covers the opt-in mode end to end over HTTP: an
// archive sealed with a passphrase must refuse the account password and accept the
// passphrase, and the status endpoint has to say so in advance.
func TestPassphraseBackupRestore(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("POST", "/books", map[string]any{"title": "Sealed", "author": "K"}, 201)

	const phrase = "correct-horse!"
	var created backupMetaResp
	rec := admin.mustDo("POST", "/admin/backup", map[string]any{"passphrase": phrase}, 200)
	created = decode[backupMetaResp](t, rec)
	if created.Backup == nil || created.Backup.Key != "passphrase" {
		t.Fatalf("key metadata = %+v, want passphrase", created.Backup)
	}
	if created.Backup.Account != "" {
		t.Fatalf("a passphrase archive named an account: %q", created.Backup.Account)
	}

	admin.mustDo("POST", "/books", map[string]any{"title": "Doomed", "author": "G"}, 201)

	// The account password is the wrong key here, and says so without swapping.
	if rec := admin.do("POST", "/admin/restore", map[string]any{"password": testPw}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("password against a passphrase archive: %d %s", rec.Code, rec.Body)
	}
	if rec := admin.do("POST", "/admin/restore", map[string]any{"passphrase": "not-the-phrase"}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong passphrase: %d %s", rec.Code, rec.Body)
	}
	if rec := admin.mustDo("GET", "/books", nil, 200); !bytes.Contains(rec.Body.Bytes(), []byte("Doomed")) {
		t.Fatalf("a refused restore swapped data: %s", rec.Body)
	}

	if rec := admin.mustDo("POST", "/admin/restore", map[string]any{"passphrase": phrase}, 200); !bytes.Contains(rec.Body.Bytes(), []byte(`"ok":true`)) {
		t.Fatalf("passphrase restore: %s", rec.Body)
	}
	fresh := &testClient{t: t, h: h}
	lrec := fresh.do("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw})
	if lrec.Code != 200 {
		t.Fatalf("login after restore: %d %s", lrec.Code, lrec.Body)
	}
	fresh.cookie = cookieOf(t, lrec)
	body := fresh.mustDo("GET", "/books", nil, 200).Body.Bytes()
	if !bytes.Contains(body, []byte("Sealed")) || bytes.Contains(body, []byte("Doomed")) {
		t.Fatalf("restored books = %s", body)
	}
}

// TestLegacyPlainArchiveStillRestores is the compatibility promise: an archive
// written before 1.4.1 is a plain tar.gz with no key, and upgrading the server
// must not strand it. It needs the typed RESTORE instead, because there is no key
// there to stand for the intent.
func TestLegacyPlainArchiveStillRestores(t *testing.T) {
	// Build a real database to put inside it, by backing up a seeded server and
	// decrypting that archive — a hand-rolled tar would not survive validation.
	donor := newTestServer(t)
	dAdmin := signupAdmin(t, donor.Handler())
	dAdmin.mustDo("POST", "/books", map[string]any{"title": "FromThePast", "author": "Old"}, 201)
	backupNow(dAdmin)
	dName, _ := donor.newestBackup()
	enc, err := os.ReadFile(filepath.Join(donor.backupsDir(), dName))
	if err != nil {
		t.Fatal(err)
	}
	plain := plaintextOf(t, enc, accountSecret("alice", testPw))

	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("POST", "/books", map[string]any{"title": "Present", "author": "New"}, 201)

	// Dropped into <data>/backups under its old name, as an upgrade would find it.
	if err := os.MkdirAll(srv.backupsDir(), 0o700); err != nil {
		t.Fatal(err)
	}
	legacy := backupPrefix + "20250101-000000" + backupLegacyExt
	if err := os.WriteFile(filepath.Join(srv.backupsDir(), legacy), plain, 0o600); err != nil {
		t.Fatal(err)
	}

	// Reported as unkeyed, so the UI asks for the typed word rather than a password.
	var st backupMetaResp
	st = decode[backupMetaResp](t, admin.mustDo("GET", "/admin/backup", nil, 200))
	if st.Backup == nil || st.Backup.Key != "none" {
		t.Fatalf("legacy archive key metadata = %+v, want none", st.Backup)
	}

	if rec := admin.do("POST", "/admin/restore", map[string]any{"password": testPw}); rec.Code != http.StatusBadRequest {
		t.Fatalf("legacy restore without the typed confirmation: %d %s", rec.Code, rec.Body)
	}
	if rec := admin.mustDo("POST", "/admin/restore", map[string]any{"confirm": "RESTORE"}, 200); !bytes.Contains(rec.Body.Bytes(), []byte(`"ok":true`)) {
		t.Fatalf("legacy restore: %s", rec.Body)
	}
	fresh := &testClient{t: t, h: h}
	lrec := fresh.do("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw})
	if lrec.Code != 200 {
		t.Fatalf("login after legacy restore: %d %s", lrec.Code, lrec.Body)
	}
	fresh.cookie = cookieOf(t, lrec)
	body := fresh.mustDo("GET", "/books", nil, 200).Body.Bytes()
	if !bytes.Contains(body, []byte("FromThePast")) || bytes.Contains(body, []byte("Present")) {
		t.Fatalf("restored books = %s", body)
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

	// Onboarding refuses an out-of-shape password.
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
	// A password inside the rules still changes cleanly.
	admin.mustDo("POST", "/auth/password", map[string]string{"current": testPw, "new": "newpass!123"}, 200)
}
