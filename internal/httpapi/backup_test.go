package httpapi

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// The password every test account uses (see signupAdmin), and therefore the one
// half of every account-keyed archive's passphrase.
const testPw = "supersecret"

// restoreUpload POSTs a multipart restore upload the way the frontend does: the
// credential fields (any left empty are omitted) written BEFORE the file part.
func (c *testClient) restoreUpload(path string, fields map[string]string, archive []byte) *httptest.ResponseRecorder {
	c.t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for k, v := range fields {
		if v == "" {
			continue
		}
		if err := mw.WriteField(k, v); err != nil {
			c.t.Fatal(err)
		}
	}
	fw, err := mw.CreateFormFile("file", "backup"+backupExt)
	if err != nil {
		c.t.Fatal(err)
	}
	if _, err := fw.Write(archive); err != nil {
		c.t.Fatal(err)
	}
	_ = mw.Close()
	return c.doRaw("POST", path, &buf, mw.FormDataContentType())
}

// pwUpload is the ordinary account-keyed upload: just the password.
func pwUpload() map[string]string { return map[string]string{"password": testPw} }

// backupNow creates a sealed archive keyed on the caller's own account password.
func backupNow(c *testClient) *httptest.ResponseRecorder {
	c.t.Helper()
	return c.mustDo("POST", "/admin/backup", map[string]any{"password": testPw}, 200)
}

// plaintextOf strips the encryption envelope from an archive, so a test can look
// inside the tar the way a person with the credentials would.
func plaintextOf(t *testing.T, archive []byte, secret string) []byte {
	t.Helper()
	dec, _, err := newBackupDecReader(bytes.NewReader(archive), secret)
	if err != nil {
		t.Fatalf("decrypt archive: %v", err)
	}
	out, err := io.ReadAll(dec)
	if err != nil {
		t.Fatalf("read decrypted archive: %v", err)
	}
	return out
}

// plainArchive writes an UNENCRYPTED tar.gz — a pre-1.4.1 archive, or a hostile
// one. `entries` is name → contents; a name ending in "/" is a directory.
func plainArchive(t *testing.T, dest string, entries [][2]string) {
	t.Helper()
	f, err := os.Create(dest)
	if err != nil {
		t.Fatal(err)
	}
	gz := gzip.NewWriter(f)
	tw := tar.NewWriter(gz)
	for _, e := range entries {
		if err := tw.WriteHeader(&tar.Header{Name: e[0], Mode: 0o600, Size: int64(len(e[1]))}); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte(e[1])); err != nil {
			t.Fatal(err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
}

type backupMetaResp struct {
	Backup *struct {
		Name    string `json:"name"`
		Created string `json:"created"`
		Size    int64  `json:"size"`
		Key     string `json:"key"`
		Account string `json:"account"`
	} `json:"backup"`
}

// listBackups returns the archive names currently in <DataDir>/backups.
func listBackups(t *testing.T, srv *Server) []string {
	t.Helper()
	entries, err := os.ReadDir(srv.backupsDir())
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, e := range entries {
		names = append(names, e.Name())
	}
	return names
}

func TestBackupCreateDownloadRetention(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	anon := &testClient{t: t, h: h}

	// Seed: one book and one stored media file.
	admin.mustDo("POST", "/books", map[string]any{"title": "Original", "author": "Backup Author"}, 201)
	cover := filepath.Join(srv.coversDir(), "aabbccdd00112233.png")
	if err := os.WriteFile(cover, pngHeader, 0o600); err != nil {
		t.Fatal(err)
	}

	// A backup needs a key. No password and no passphrase is a 400, a WRONG
	// password is a 401 — the archive must never be sealed with a key the operator
	// cannot reproduce, and a typo is exactly how that happens.
	if rec := admin.do("POST", "/admin/backup", nil); rec.Code != http.StatusBadRequest {
		t.Fatalf("backup with no key: %d %s", rec.Code, rec.Body)
	}
	if rec := admin.do("POST", "/admin/backup", map[string]any{"password": "notmypassword"}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("backup with the wrong password: %d %s", rec.Code, rec.Body)
	}
	if rec := admin.do("POST", "/admin/backup", map[string]any{"passphrase": "short"}); rec.Code != http.StatusBadRequest {
		t.Fatalf("backup with a too-short passphrase: %d %s", rec.Code, rec.Body)
	}
	if names := listBackups(t, srv); len(names) != 0 {
		t.Fatalf("a refused backup left files behind: %v", names)
	}

	// No backup yet.
	var st backupMetaResp
	_ = json.Unmarshal(admin.mustDo("GET", "/admin/backup", nil, 200).Body.Bytes(), &st)
	if st.Backup != nil {
		t.Fatalf("expected no backup, got %+v", st.Backup)
	}
	if rec := admin.doRaw("GET", "/admin/backup/download", nil, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("download with no backup: got %d, want 404", rec.Code)
	}

	// Create.
	var created backupMetaResp
	_ = json.Unmarshal(backupNow(admin).Body.Bytes(), &created)
	if created.Backup == nil || !strings.HasPrefix(created.Backup.Name, backupPrefix) || created.Backup.Size == 0 {
		t.Fatalf("create meta: %+v", created.Backup)
	}
	if !strings.HasSuffix(created.Backup.Name, backupExt) {
		t.Fatalf("a sealed archive must not be named .tar.gz: %s", created.Backup.Name)
	}
	// The status endpoint reports which credential a restore will want, and whose.
	if created.Backup.Key != "account" || created.Backup.Account != "alice" {
		t.Fatalf("key metadata = %q / %q, want account/alice", created.Backup.Key, created.Backup.Account)
	}
	if names := listBackups(t, srv); len(names) != 1 {
		t.Fatalf("backups dir after create: %v", names)
	}

	// Download and inspect the archive.
	rec := admin.doRaw("GET", "/admin/backup/download", nil, "")
	if rec.Code != 200 {
		t.Fatalf("download: %d %s", rec.Code, rec.Body)
	}
	if cd := rec.Header().Get("Content-Disposition"); !strings.Contains(cd, created.Backup.Name) {
		t.Fatalf("content-disposition = %q", cd)
	}
	// It is sealed on the wire: the bytes are NOT gzip, and the plaintext only
	// appears once the account passphrase is applied.
	if _, err := gzip.NewReader(bytes.NewReader(rec.Body.Bytes())); err == nil {
		t.Fatal("the downloaded archive gunzipped — it is not encrypted")
	}
	if bytes.Contains(rec.Body.Bytes(), []byte("Backup Author")) {
		t.Fatal("library text is readable in the sealed archive")
	}
	if _, _, err := newBackupDecReader(bytes.NewReader(rec.Body.Bytes()), accountSecret("alice", "wrong")); !errors.Is(err, errBadKey) {
		t.Fatalf("wrong key opened the archive: %v", err)
	}
	plain := plaintextOf(t, rec.Body.Bytes(), accountSecret("alice", testPw))
	gz, err := gzip.NewReader(bytes.NewReader(plain))
	if err != nil {
		t.Fatalf("gunzip: %v", err)
	}
	tr := tar.NewReader(gz)
	found := map[string]bool{}
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("tar: %v", err)
		}
		found[hdr.Name] = true
		if strings.HasPrefix(hdr.Name, backupsDirName+"/") || strings.HasSuffix(hdr.Name, "-wal") {
			t.Fatalf("archive contains excluded entry %s", hdr.Name)
		}
		if hdr.Name == "tippani.db" {
			head := make([]byte, 16)
			_, _ = io.ReadFull(tr, head)
			if string(head) != "SQLite format 3\x00" {
				t.Fatalf("tippani.db is not sqlite: %q", head)
			}
		}
	}
	if !found["tippani.db"] || !found["MediaCover/aabbccdd00112233.png"] {
		t.Fatalf("archive missing expected entries: %v", found)
	}

	// Retention: a second create keeps only the newest archive.
	time.Sleep(1100 * time.Millisecond) // the name has second precision
	var second backupMetaResp
	_ = json.Unmarshal(backupNow(admin).Body.Bytes(), &second)
	names := listBackups(t, srv)
	if len(names) != 1 || names[0] != second.Backup.Name || names[0] == created.Backup.Name {
		t.Fatalf("retention: %v (first %s, second %s)", names, created.Backup.Name, second.Backup.Name)
	}

	// Auth: anon 401, non-admin 403 — checked BEFORE the key, so a non-admin with
	// a valid password of their own still cannot back the instance up.
	if rec := anon.do("POST", "/admin/backup", map[string]any{"password": testPw}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("anon create: %d", rec.Code)
	}
	if rec := bob.do("POST", "/admin/backup", map[string]any{"password": testPw}); rec.Code != http.StatusForbidden {
		t.Fatalf("non-admin create: %d", rec.Code)
	}
	if rec := bob.do("GET", "/admin/backup", nil); rec.Code != http.StatusForbidden {
		t.Fatalf("non-admin status: %d", rec.Code)
	}
	if rec := bob.do("POST", "/admin/restore", map[string]any{"password": testPw}); rec.Code != http.StatusForbidden {
		t.Fatalf("non-admin restore: %d", rec.Code)
	}
	if rec := bob.doRaw("GET", "/admin/backup/download", nil, ""); rec.Code != http.StatusForbidden {
		t.Fatalf("non-admin download: %d", rec.Code)
	}
}

func TestRestoreRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)

	admin.mustDo("POST", "/books", map[string]any{"title": "Original", "author": "Keeper"}, 201)
	cover := filepath.Join(srv.coversDir(), "eeff001122334455.png")
	if err := os.WriteFile(cover, pngHeader, 0o600); err != nil {
		t.Fatal(err)
	}
	backupNow(admin)

	// Diverge from the backup: an extra book and an extra media file.
	admin.mustDo("POST", "/books", map[string]any{"title": "Extra", "author": "Goner"}, 201)
	extraCover := filepath.Join(srv.coversDir(), "ffff001122334455.png")
	if err := os.WriteFile(extraCover, pngHeader, 0o600); err != nil {
		t.Fatal(err)
	}

	// Guards: the key IS the guard for a sealed archive. No credential is a 401,
	// a wrong one is a 401, and neither touches the live data (checked below by the
	// "Extra" book still being there when the real restore removes it).
	if rec := admin.do("POST", "/admin/restore", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("restore with no credential: %d %s", rec.Code, rec.Body)
	}
	if rec := admin.do("POST", "/admin/restore", map[string]any{"password": "wrongpassword"}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("restore with the wrong password: %d %s", rec.Code, rec.Body)
	}
	if rec := admin.do("POST", "/admin/restore", map[string]any{"passphrase": "notthekeyhere"}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("restore with a passphrase against an account-keyed archive: %d %s", rec.Code, rec.Body)
	}
	// A refused restore swapped nothing.
	if rec := admin.mustDo("GET", "/books", nil, 200); !bytes.Contains(rec.Body.Bytes(), []byte("Extra")) {
		t.Fatalf("a refused restore swapped data: %s", rec.Body)
	}

	rec := admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, 200)
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"ok":true`)) {
		t.Fatalf("restore: %s", rec.Body)
	}

	// The old session may be stale — log in fresh against the restored DB.
	fresh := &testClient{t: t, h: h}
	lrec := fresh.do("POST", "/auth/login", map[string]string{"username": "alice", "password": "supersecret"})
	if lrec.Code != 200 {
		t.Fatalf("login after restore: %d %s", lrec.Code, lrec.Body)
	}
	fresh.cookie = cookieOf(t, lrec)

	var books struct {
		Books []struct {
			Title string `json:"title"`
		} `json:"books"`
	}
	_ = json.Unmarshal(fresh.mustDo("GET", "/books", nil, 200).Body.Bytes(), &books)
	titles := map[string]bool{}
	for _, b := range books.Books {
		titles[b.Title] = true
	}
	if !titles["Original"] || titles["Extra"] {
		t.Fatalf("restored books = %+v", books.Books)
	}
	if _, err := os.Stat(cover); err != nil {
		t.Fatalf("restored media file missing: %v", err)
	}
	if _, err := os.Stat(extraCover); err == nil {
		t.Fatalf("post-backup media file survived the restore")
	}

	// Exactly one safety generation is kept, holding the pre-restore data.
	entries, _ := os.ReadDir(srv.DataDir)
	var pre []string
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), preRestorePrefix) {
			pre = append(pre, e.Name())
		}
	}
	if len(pre) != 1 {
		t.Fatalf("pre-restore generations: %v", pre)
	}
	if _, err := os.Stat(filepath.Join(srv.DataDir, pre[0], "MediaCover", "ffff001122334455.png")); err != nil {
		t.Fatalf("safety copy missing pre-restore media: %v", err)
	}

	// Search works against the restored database (FTS healed on reopen).
	if rec := fresh.doRaw("GET", "/search?q=Original&scope=books", nil, ""); rec.Code != 200 || !bytes.Contains(rec.Body.Bytes(), []byte("Original")) {
		t.Fatalf("search after restore: %d %s", rec.Code, rec.Body)
	}
}

// TestOnboardRestore covers the first-run restore path: /auth/status surfaces
// the kept archive while onboarding is open, POST /auth/restore restores it on
// a box with no users, and both close once a user exists.
func TestOnboardRestore(t *testing.T) {
	// Build an archive on a seeded "old" server.
	old := newTestServer(t)
	admin := signupAdmin(t, old.Handler())
	admin.mustDo("POST", "/books", map[string]any{"title": "Original", "author": "Keeper"}, 201)
	backupNow(admin)
	name, _ := old.newestBackup()
	archive, err := os.ReadFile(filepath.Join(old.backupsDir(), name))
	if err != nil {
		t.Fatal(err)
	}

	// A fresh box: no users, no archive → status has backup:null, restore 400.
	srv := newTestServer(t)
	h := srv.Handler()
	anon := &testClient{t: t, h: h}
	if rec := anon.do("GET", "/auth/status", nil); !bytes.Contains(rec.Body.Bytes(), []byte(`"backup":null`)) {
		t.Fatalf("status without archive: %s", rec.Body)
	}
	if rec := anon.do("POST", "/auth/restore", map[string]any{"password": testPw}); rec.Code != http.StatusBadRequest {
		t.Fatalf("restore without archive: %d %s", rec.Code, rec.Body)
	}

	// Drop the old box's archive in: status reports it, restore applies it.
	if err := os.MkdirAll(srv.backupsDir(), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srv.backupsDir(), name), archive, 0o600); err != nil {
		t.Fatal(err)
	}
	// Status names the archive AND which credential opens it, because a fresh box
	// has no session to infer the account from — the operator has to be told whose
	// password to type.
	statusBody := anon.do("GET", "/auth/status", nil).Body.Bytes()
	if !bytes.Contains(statusBody, []byte(name)) {
		t.Fatalf("status with archive: %s", statusBody)
	}
	if !bytes.Contains(statusBody, []byte(`"key":"account"`)) || !bytes.Contains(statusBody, []byte(`"account":"alice"`)) {
		t.Fatalf("status does not say how the archive is keyed: %s", statusBody)
	}
	// The key is still required here: nothing to lose does not mean nothing to open.
	if rec := anon.do("POST", "/auth/restore", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("onboarding restore with no credential: %d %s", rec.Code, rec.Body)
	}
	if rec := anon.do("POST", "/auth/restore", map[string]any{"password": "wrongpassword"}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("onboarding restore with the wrong password: %d %s", rec.Code, rec.Body)
	}
	if rec := anon.do("POST", "/auth/restore", map[string]any{"username": "alice", "password": testPw}); rec.Code != 200 {
		t.Fatalf("onboarding restore: %d %s", rec.Code, rec.Body)
	}

	// Onboarding is closed; the restored credentials log in and see the data.
	if rec := anon.do("GET", "/auth/status", nil); !bytes.Contains(rec.Body.Bytes(), []byte(`"needs_onboarding":false`)) {
		t.Fatalf("status after restore: %s", rec.Body)
	}
	user := &testClient{t: t, h: h}
	lrec := user.do("POST", "/auth/login", map[string]string{"username": "alice", "password": "supersecret"})
	if lrec.Code != 200 {
		t.Fatalf("login after onboarding restore: %d %s", lrec.Code, lrec.Body)
	}
	user.cookie = cookieOf(t, lrec)
	if rec := user.mustDo("GET", "/books", nil, 200); !bytes.Contains(rec.Body.Bytes(), []byte("Original")) {
		t.Fatalf("restored books: %s", rec.Body)
	}

	// With a user present the route is closed and status hides the backup.
	if rec := anon.do("POST", "/auth/restore", map[string]any{"password": testPw}); rec.Code != http.StatusForbidden {
		t.Fatalf("restore after onboarding: %d", rec.Code)
	}
	if rec := anon.do("GET", "/auth/status", nil); bytes.Contains(rec.Body.Bytes(), []byte(`"backup"`)) {
		t.Fatalf("status leaks backup existence after onboarding: %s", rec.Body)
	}
}

// TestSignupSerializesWithRestore proves the TOCTOU guard: while a restore holds
// backupMu (as it does across its whole swap), neither a signup nor a second
// restore may proceed — both get 409 — so a signup can never commit an admin
// mid-restore that the swap would then discard. Once the lock frees, signup works.
func TestSignupSerializesWithRestore(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	anon := &testClient{t: t, h: h}

	// Stand in for an in-progress restore holding the lock across its swap.
	srv.backupMu.Lock()
	if rec := anon.do("POST", "/auth/signup", map[string]string{"username": "alice", "password": "supersecret"}); rec.Code != http.StatusConflict {
		t.Fatalf("signup while a restore holds the lock: got %d, want 409: %s", rec.Code, rec.Body)
	}
	if rec := anon.do("POST", "/auth/restore", map[string]any{"password": testPw}); rec.Code != http.StatusConflict {
		t.Fatalf("restore while a restore holds the lock: got %d, want 409", rec.Code)
	}
	srv.backupMu.Unlock()

	// Lock free again → onboarding signup succeeds.
	if rec := anon.do("POST", "/auth/signup", map[string]string{"username": "alice", "password": "supersecret"}); rec.Code != 200 {
		t.Fatalf("signup after the lock freed: got %d: %s", rec.Code, rec.Body)
	}
}

func TestRestoreValidation(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)

	// No backup on the server yet.
	if rec := admin.do("POST", "/admin/restore", map[string]any{"password": testPw}); rec.Code != http.StatusBadRequest {
		t.Fatalf("restore without backup: %d", rec.Code)
	}

	// These hostile archives are deliberately UNENCRYPTED .tar.gz files, which is
	// also the pre-1.4.1 shape — so this test covers the legacy path at the same
	// time: an unsealed archive has no key to stand for intent, so it still needs
	// the typed RESTORE, and it must still be extracted under every guard.
	if err := os.MkdirAll(srv.backupsDir(), 0o700); err != nil {
		t.Fatal(err)
	}
	evil := filepath.Join(srv.backupsDir(), backupPrefix+"99991231-235959"+backupLegacyExt)
	plainArchive(t, evil, [][2]string{{"../evil.txt", "boom"}})
	// Without the typed confirmation an unsealed archive is refused outright.
	if rec := admin.do("POST", "/admin/restore", nil); rec.Code != http.StatusBadRequest {
		t.Fatalf("unsealed archive with no confirm: %d %s", rec.Code, rec.Body)
	}
	if rec := admin.do("POST", "/admin/restore", map[string]any{"confirm": "nope"}); rec.Code != http.StatusBadRequest {
		t.Fatalf("unsealed archive with a bad confirm: %d", rec.Code)
	}
	if rec := admin.do("POST", "/admin/restore", map[string]any{"confirm": "RESTORE"}); rec.Code != http.StatusBadRequest {
		t.Fatalf("traversal archive: %d", rec.Code)
	}
	if _, err := os.Stat(filepath.Join(srv.DataDir, "..", "evil.txt")); err == nil {
		t.Fatalf("traversal escaped the staging dir")
	}

	// A structurally valid archive whose tippani.db is garbage.
	_ = os.Remove(evil)
	garbage := filepath.Join(srv.backupsDir(), backupPrefix+"99991231-235958"+backupLegacyExt)
	plainArchive(t, garbage, [][2]string{{"tippani.db", "not a db!"}})
	if rec := admin.do("POST", "/admin/restore", map[string]any{"confirm": "RESTORE"}); rec.Code != http.StatusBadRequest {
		t.Fatalf("garbage db archive: %d", rec.Code)
	}

	// Live data untouched throughout.
	if rec := admin.mustDo("GET", "/auth/me", nil, 200); !bytes.Contains(rec.Body.Bytes(), []byte("alice")) {
		t.Fatalf("live data damaged: %s", rec.Body)
	}
}

// TestRestoreUpload covers the admin upload-restore path: an archive built on a
// DIFFERENT server is uploaded and applied through the same pipeline, replacing
// this server's data; bad/missing/out-of-order confirmations are rejected with
// the live data untouched.
func TestRestoreUpload(t *testing.T) {
	// Donor server: a distinctive book + media, backed up, its archive read out.
	donor := newTestServer(t)
	dAdmin := signupAdmin(t, donor.Handler())
	dAdmin.mustDo("POST", "/books", map[string]any{"title": "FromDonor", "author": "Donor"}, 201)
	dCover := filepath.Join(donor.coversDir(), "abcabcabc1234567.png")
	if err := os.WriteFile(dCover, pngHeader, 0o600); err != nil {
		t.Fatal(err)
	}
	backupNow(dAdmin)
	dName, _ := donor.newestBackup()
	archive, err := os.ReadFile(filepath.Join(donor.backupsDir(), dName))
	if err != nil {
		t.Fatal(err)
	}

	// Target server: its own admin and a book that must NOT survive the restore.
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("POST", "/books", map[string]any{"title": "TargetOnly", "author": "Target"}, 201)

	// Guards: no credential and a wrong one are both 401, and they swap nothing —
	// the target's own book must still be there afterward. Note the donor's admin
	// happens to share this target's username and password, which is the realistic
	// case (one person, two boxes) and does not weaken the check: "wrongpassword"
	// is neither account's.
	if rec := admin.restoreUpload("/admin/restore/upload", nil, archive); rec.Code != http.StatusUnauthorized {
		t.Fatalf("upload with no credential: %d %s", rec.Code, rec.Body)
	}
	if rec := admin.restoreUpload("/admin/restore/upload", map[string]string{"password": "wrongpassword"}, archive); rec.Code != http.StatusUnauthorized {
		t.Fatalf("upload with the wrong password: %d", rec.Code)
	}
	if rec := admin.mustDo("GET", "/books", nil, 200); !bytes.Contains(rec.Body.Bytes(), []byte("TargetOnly")) {
		t.Fatalf("a rejected upload swapped data: %s", rec.Body)
	}

	// Happy path — deliberately order-INDEPENDENT: write the file BEFORE the
	// credential fields, which must still restore (there is no field-ordering
	// contract, and browsers do not promise one).
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("file", "backup"+backupExt)
	_, _ = fw.Write(archive)
	_ = mw.WriteField("username", "alice")
	_ = mw.WriteField("password", testPw)
	_ = mw.Close()
	rec := admin.doRaw("POST", "/admin/restore/upload", &body, mw.FormDataContentType())
	if rec.Code != 200 || !bytes.Contains(rec.Body.Bytes(), []byte(`"ok":true`)) {
		t.Fatalf("upload restore (file before credentials): %d %s", rec.Code, rec.Body)
	}

	// The server now serves the donor's data; the target-only book is gone.
	fresh := &testClient{t: t, h: h}
	lrec := fresh.do("POST", "/auth/login", map[string]string{"username": "alice", "password": "supersecret"})
	if lrec.Code != 200 {
		t.Fatalf("login after upload restore: %d %s", lrec.Code, lrec.Body)
	}
	fresh.cookie = cookieOf(t, lrec)
	var books struct {
		Books []struct {
			Title string `json:"title"`
		} `json:"books"`
	}
	_ = json.Unmarshal(fresh.mustDo("GET", "/books", nil, 200).Body.Bytes(), &books)
	titles := map[string]bool{}
	for _, b := range books.Books {
		titles[b.Title] = true
	}
	if !titles["FromDonor"] || titles["TargetOnly"] {
		t.Fatalf("restored books = %+v", books.Books)
	}
	if _, err := os.Stat(filepath.Join(srv.coversDir(), "abcabcabc1234567.png")); err != nil {
		t.Fatalf("donor media missing after upload restore: %v", err)
	}

	// Exactly one .pre-restore safety generation, holding the pre-restore data.
	entries, _ := os.ReadDir(srv.DataDir)
	pre := 0
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), preRestorePrefix) {
			pre++
		}
	}
	if pre != 1 {
		t.Fatalf("pre-restore generations: %d", pre)
	}
}

// TestRestoreTwiceSameSecond guards the .pre-restore-<ts> uniqueness fix: two
// restores landing in the same wall-clock second must both succeed. The safety
// dir name previously used second precision and collided, failing the second
// restore (and aliasing the safety generation onto the previous one).
func TestRestoreTwiceSameSecond(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("POST", "/books", map[string]any{"title": "Keep", "author": "A"}, 201)
	backupNow(admin)

	// Two back-to-back restores (well within one second) both succeed; the swap
	// expires the caller's cookie, so log back in between rounds.
	for i := 0; i < 2; i++ {
		if rec := admin.do("POST", "/admin/restore", map[string]any{"password": testPw}); rec.Code != 200 {
			t.Fatalf("restore #%d: %d %s", i+1, rec.Code, rec.Body)
		}
		fresh := &testClient{t: t, h: h}
		lrec := fresh.do("POST", "/auth/login", map[string]string{"username": "alice", "password": "supersecret"})
		if lrec.Code != 200 {
			t.Fatalf("login after restore #%d: %d %s", i+1, lrec.Code, lrec.Body)
		}
		fresh.cookie = cookieOf(t, lrec)
		admin = fresh
	}

	// Still exactly one safety generation, and the data survived both swaps.
	entries, _ := os.ReadDir(srv.DataDir)
	pre := 0
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), preRestorePrefix) {
			pre++
		}
	}
	if pre != 1 {
		t.Fatalf("pre-restore generations after two restores: %d", pre)
	}
	if rec := admin.mustDo("GET", "/books", nil, 200); !bytes.Contains(rec.Body.Bytes(), []byte("Keep")) {
		t.Fatalf("data lost across two restores: %s", rec.Body)
	}
}

// TestOnboardRestoreUpload covers the first-run upload path: a fresh box with no
// users restores a backup uploaded from another server (no confirm, no SSH), and
// the route closes once a user exists.
func TestOnboardRestoreUpload(t *testing.T) {
	old := newTestServer(t)
	oAdmin := signupAdmin(t, old.Handler())
	oAdmin.mustDo("POST", "/books", map[string]any{"title": "Original", "author": "Keeper"}, 201)
	backupNow(oAdmin)
	name, _ := old.newestBackup()
	archive, err := os.ReadFile(filepath.Join(old.backupsDir(), name))
	if err != nil {
		t.Fatal(err)
	}

	srv := newTestServer(t)
	h := srv.Handler()
	anon := &testClient{t: t, h: h}

	// Fresh box, no users: the upload restore applies with no CONFIRMATION — but
	// still with the key, because the archive is sealed either way.
	if rec := anon.restoreUpload("/auth/restore/upload", nil, archive); rec.Code != http.StatusUnauthorized {
		t.Fatalf("onboarding upload with no credential: %d %s", rec.Code, rec.Body)
	}
	if rec := anon.restoreUpload("/auth/restore/upload", pwUpload(), archive); rec.Code != 200 {
		t.Fatalf("onboarding upload restore: %d %s", rec.Code, rec.Body)
	}

	// Onboarding is now closed; the restored credentials log in and see the data.
	if rec := anon.do("GET", "/auth/status", nil); !bytes.Contains(rec.Body.Bytes(), []byte(`"needs_onboarding":false`)) {
		t.Fatalf("status after upload restore: %s", rec.Body)
	}
	user := &testClient{t: t, h: h}
	lrec := user.do("POST", "/auth/login", map[string]string{"username": "alice", "password": "supersecret"})
	if lrec.Code != 200 {
		t.Fatalf("login after onboarding upload restore: %d %s", lrec.Code, lrec.Body)
	}
	user.cookie = cookieOf(t, lrec)
	if rec := user.mustDo("GET", "/books", nil, 200); !bytes.Contains(rec.Body.Bytes(), []byte("Original")) {
		t.Fatalf("restored books: %s", rec.Body)
	}

	// With a user present the route is closed.
	if rec := anon.restoreUpload("/auth/restore/upload", pwUpload(), archive); rec.Code != http.StatusForbidden {
		t.Fatalf("upload restore after onboarding: %d", rec.Code)
	}
}
