package httpapi

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
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

// restoreUpload POSTs a multipart restore upload the way the frontend does: an
// optional confirm field (empty string = omit it) written BEFORE the file part.
func (c *testClient) restoreUpload(path, confirm string, archive []byte) *httptest.ResponseRecorder {
	c.t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	if confirm != "" {
		if err := mw.WriteField("confirm", confirm); err != nil {
			c.t.Fatal(err)
		}
	}
	fw, err := mw.CreateFormFile("file", "backup.tar.gz")
	if err != nil {
		c.t.Fatal(err)
	}
	if _, err := fw.Write(archive); err != nil {
		c.t.Fatal(err)
	}
	_ = mw.Close()
	return c.doRaw("POST", path, &buf, mw.FormDataContentType())
}

type backupMetaResp struct {
	Backup *struct {
		Name    string `json:"name"`
		Created string `json:"created"`
		Size    int64  `json:"size"`
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
	_ = json.Unmarshal(admin.mustDo("POST", "/admin/backup", nil, 200).Body.Bytes(), &created)
	if created.Backup == nil || !strings.HasPrefix(created.Backup.Name, backupPrefix) || created.Backup.Size == 0 {
		t.Fatalf("create meta: %+v", created.Backup)
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
	gz, err := gzip.NewReader(bytes.NewReader(rec.Body.Bytes()))
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
	_ = json.Unmarshal(admin.mustDo("POST", "/admin/backup", nil, 200).Body.Bytes(), &second)
	names := listBackups(t, srv)
	if len(names) != 1 || names[0] != second.Backup.Name || names[0] == created.Backup.Name {
		t.Fatalf("retention: %v (first %s, second %s)", names, created.Backup.Name, second.Backup.Name)
	}

	// Auth: anon 401, non-admin 403.
	if rec := anon.do("POST", "/admin/backup", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("anon create: %d", rec.Code)
	}
	if rec := bob.do("POST", "/admin/backup", nil); rec.Code != http.StatusForbidden {
		t.Fatalf("non-admin create: %d", rec.Code)
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
	admin.mustDo("POST", "/admin/backup", nil, 200)

	// Diverge from the backup: an extra book and an extra media file.
	admin.mustDo("POST", "/books", map[string]any{"title": "Extra", "author": "Goner"}, 201)
	extraCover := filepath.Join(srv.coversDir(), "ffff001122334455.png")
	if err := os.WriteFile(extraCover, pngHeader, 0o600); err != nil {
		t.Fatal(err)
	}

	// Guards: wrong confirm.
	if rec := admin.do("POST", "/admin/restore", map[string]any{"confirm": "nope"}); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad confirm: %d", rec.Code)
	}

	rec := admin.mustDo("POST", "/admin/restore", map[string]any{"confirm": "RESTORE"}, 200)
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
	admin.mustDo("POST", "/admin/backup", nil, 200)
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
	if rec := anon.do("POST", "/auth/restore", nil); rec.Code != http.StatusBadRequest {
		t.Fatalf("restore without archive: %d %s", rec.Code, rec.Body)
	}

	// Drop the old box's archive in: status reports it, restore applies it.
	if err := os.MkdirAll(srv.backupsDir(), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srv.backupsDir(), name), archive, 0o600); err != nil {
		t.Fatal(err)
	}
	if rec := anon.do("GET", "/auth/status", nil); !bytes.Contains(rec.Body.Bytes(), []byte(name)) {
		t.Fatalf("status with archive: %s", rec.Body)
	}
	if rec := anon.do("POST", "/auth/restore", nil); rec.Code != 200 {
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
	if rec := anon.do("POST", "/auth/restore", nil); rec.Code != http.StatusForbidden {
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
	if rec := anon.do("POST", "/auth/restore", nil); rec.Code != http.StatusConflict {
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
	if rec := admin.do("POST", "/admin/restore", map[string]any{"confirm": "RESTORE"}); rec.Code != http.StatusBadRequest {
		t.Fatalf("restore without backup: %d", rec.Code)
	}

	// A hostile archive: path traversal must be rejected with nothing written.
	if err := os.MkdirAll(srv.backupsDir(), 0o700); err != nil {
		t.Fatal(err)
	}
	evil := filepath.Join(srv.backupsDir(), backupPrefix+"99991231-235959.tar.gz")
	f, err := os.Create(evil)
	if err != nil {
		t.Fatal(err)
	}
	gz := gzip.NewWriter(f)
	tw := tar.NewWriter(gz)
	_ = tw.WriteHeader(&tar.Header{Name: "../evil.txt", Mode: 0o600, Size: 4})
	_, _ = tw.Write([]byte("boom"))
	_ = tw.Close()
	_ = gz.Close()
	_ = f.Close()
	if rec := admin.do("POST", "/admin/restore", map[string]any{"confirm": "RESTORE"}); rec.Code != http.StatusBadRequest {
		t.Fatalf("traversal archive: %d", rec.Code)
	}
	if _, err := os.Stat(filepath.Join(srv.DataDir, "..", "evil.txt")); err == nil {
		t.Fatalf("traversal escaped the staging dir")
	}

	// A structurally valid archive whose tippani.db is garbage.
	garbage := filepath.Join(srv.backupsDir(), backupPrefix+"99991231-235958.tar.gz")
	_ = os.Remove(evil)
	f2, err := os.Create(garbage)
	if err != nil {
		t.Fatal(err)
	}
	gz2 := gzip.NewWriter(f2)
	tw2 := tar.NewWriter(gz2)
	_ = tw2.WriteHeader(&tar.Header{Name: "tippani.db", Mode: 0o600, Size: 9})
	_, _ = tw2.Write([]byte("not a db!"))
	_ = tw2.Close()
	_ = gz2.Close()
	_ = f2.Close()
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
	dAdmin.mustDo("POST", "/admin/backup", nil, 200)
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

	// Guards: wrong confirm and missing confirm are both 400, and they swap
	// nothing — the target's own book must still be there afterward.
	if rec := admin.restoreUpload("/admin/restore/upload", "nope", archive); rec.Code != http.StatusBadRequest {
		t.Fatalf("wrong confirm: %d", rec.Code)
	}
	if rec := admin.restoreUpload("/admin/restore/upload", "", archive); rec.Code != http.StatusBadRequest {
		t.Fatalf("missing confirm: %d", rec.Code)
	}
	if rec := admin.mustDo("GET", "/books", nil, 200); !bytes.Contains(rec.Body.Bytes(), []byte("TargetOnly")) {
		t.Fatalf("a rejected upload swapped data: %s", rec.Body)
	}

	// Happy path — deliberately order-INDEPENDENT: write the file BEFORE the
	// confirm field, which must still restore (there is no field-ordering contract).
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("file", "backup.tar.gz")
	_, _ = fw.Write(archive)
	_ = mw.WriteField("confirm", "RESTORE")
	_ = mw.Close()
	rec := admin.doRaw("POST", "/admin/restore/upload", &body, mw.FormDataContentType())
	if rec.Code != 200 || !bytes.Contains(rec.Body.Bytes(), []byte(`"ok":true`)) {
		t.Fatalf("upload restore (file before confirm): %d %s", rec.Code, rec.Body)
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
	admin.mustDo("POST", "/admin/backup", nil, 200)

	// Two back-to-back restores (well within one second) both succeed; the swap
	// expires the caller's cookie, so log back in between rounds.
	for i := 0; i < 2; i++ {
		if rec := admin.do("POST", "/admin/restore", map[string]any{"confirm": "RESTORE"}); rec.Code != 200 {
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
	oAdmin.mustDo("POST", "/admin/backup", nil, 200)
	name, _ := old.newestBackup()
	archive, err := os.ReadFile(filepath.Join(old.backupsDir(), name))
	if err != nil {
		t.Fatal(err)
	}

	srv := newTestServer(t)
	h := srv.Handler()
	anon := &testClient{t: t, h: h}

	// Fresh box, no users: the upload restore applies with no confirmation.
	if rec := anon.restoreUpload("/auth/restore/upload", "", archive); rec.Code != 200 {
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
	if rec := anon.restoreUpload("/auth/restore/upload", "", archive); rec.Code != http.StatusForbidden {
		t.Fatalf("upload restore after onboarding: %d", rec.Code)
	}
}
