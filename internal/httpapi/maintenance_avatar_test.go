package httpapi

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// Two handler files arrived with no HTTP-level coverage at all: avatar_handlers.go
// (nothing in the suite even mentioned "avatar") and maintenance_handlers.go,
// whose store-layer primitives are exercised by store/repair_test.go but whose
// HTTP wrappers — the admin gate, the confirm phrase, the session/media cleanup
// that only the handler does — were never called. Both are in this file because
// they share one shape: an endpoint that mutates state living OUTSIDE the row it
// answers with (a file under MediaCover, the whole database), where the
// interesting assertions are about the side effects rather than the JSON body.

// ---- helpers ---------------------------------------------------------------

// uploadAvatar posts a multipart image to POST /auth/me/avatar the way the
// browser does, following sticker_test.go's uploadSticker. It deliberately
// returns the raw recorder rather than fataling on a non-200: half of what I
// want to test here IS the rejection path, so the caller decides what "success"
// means for its case.
func uploadAvatar(t *testing.T, c *testClient, filename string, content []byte) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fw.Write(content); err != nil {
		t.Fatal(err)
	}
	_ = mw.Close()
	return c.doRaw("POST", "/auth/me/avatar", &buf, mw.FormDataContentType())
}

// avatarReply is the {avatar_path} body both avatar handlers answer with.
type avatarReply struct {
	AvatarPath string `json:"avatar_path"`
}

// avatarOf reads the caller's avatar back through GET /auth/me rather than
// straight out of the users table. The point is to prove the upload is visible
// on the endpoint the UI actually reads on load — a handler that wrote the file
// but not the row, or wrote a row /auth/me doesn't join, would still pass a
// direct SQL assertion.
func avatarOf(t *testing.T, c *testClient) string {
	t.Helper()
	return decode[struct {
		AvatarPath string `json:"avatar_path"`
	}](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK)).AvatarPath
}

// mediaNames lists MediaCover, sorted. Avatars share the covers/posters
// directory and the same server-generated hex naming, so counting the directory
// is how I catch a handler that orphans the file it replaced — the leak nothing
// in the API response would ever reveal.
func mediaNames(t *testing.T, srv *Server) []string {
	t.Helper()
	entries, err := os.ReadDir(filepath.Join(srv.DataDir, "MediaCover"))
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		t.Fatalf("read MediaCover: %v", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)
	return names
}

func mediaFileExists(t *testing.T, srv *Server, name string) bool {
	t.Helper()
	if name == "" {
		return false
	}
	_, err := os.Stat(filepath.Join(srv.DataDir, "MediaCover", name))
	return err == nil
}

// ---- avatars ---------------------------------------------------------------

// TestAvatarUploadReplaceDelete walks the whole lifecycle the Profile page
// drives: upload, replace, delete. The replace step is the one worth having —
// the handler stores the new file, points the row at it and only then removes
// the old one, so an off-by-one there either leaves the previous avatar
// orphaned on disk forever or (worse) deletes the file it just wrote.
func TestAvatarUploadReplaceDelete(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	if got := avatarOf(t, c); got != "" {
		t.Fatalf("a fresh account should have no avatar, got %q", got)
	}

	// Upload. The name is server-generated (16 hex + sniffed extension), never
	// the client's filename — I send a misleading ".gif" name over PNG bytes to
	// prove the extension comes from the sniff and not from the multipart part.
	first := decode[avatarReply](t, mustAvatar(t, uploadAvatar(t, c, "me.gif", pngMagic)))
	if !coverFile.MatchString(first.AvatarPath) {
		t.Fatalf("avatar_path %q is not a server-generated media name", first.AvatarPath)
	}
	if !strings.HasSuffix(first.AvatarPath, ".png") {
		t.Fatalf("extension should come from the sniffed bytes, got %q", first.AvatarPath)
	}
	if !mediaFileExists(t, srv, first.AvatarPath) {
		t.Fatalf("uploaded avatar %q did not land under MediaCover", first.AvatarPath)
	}
	if got := avatarOf(t, c); got != first.AvatarPath {
		t.Fatalf("/auth/me avatar_path = %q, want %q", got, first.AvatarPath)
	}
	// It is served back through the same endpoint that serves covers.
	c.mustDo("GET", "/covers/"+first.AvatarPath, nil, http.StatusOK)

	// Replace: new file on disk, row repointed, old file collected.
	second := decode[avatarReply](t, mustAvatar(t, uploadAvatar(t, c, "me2.png", pngMagic)))
	if second.AvatarPath == first.AvatarPath {
		t.Fatalf("replacement reused the old name %q", second.AvatarPath)
	}
	if !mediaFileExists(t, srv, second.AvatarPath) {
		t.Fatalf("replacement avatar %q missing from MediaCover", second.AvatarPath)
	}
	if mediaFileExists(t, srv, first.AvatarPath) {
		t.Fatalf("replaced avatar %q was orphaned on disk", first.AvatarPath)
	}
	if got := avatarOf(t, c); got != second.AvatarPath {
		t.Fatalf("/auth/me avatar_path after replace = %q, want %q", got, second.AvatarPath)
	}
	if names := mediaNames(t, srv); len(names) != 1 {
		t.Fatalf("MediaCover should hold exactly the current avatar, got %v", names)
	}

	// Delete clears the column and removes the file; the UI falls back to the
	// username initial, which only works if the column really is empty.
	del := decode[avatarReply](t, c.mustDo("DELETE", "/auth/me/avatar", nil, http.StatusOK))
	if del.AvatarPath != "" {
		t.Fatalf("delete answered avatar_path %q, want empty", del.AvatarPath)
	}
	if got := avatarOf(t, c); got != "" {
		t.Fatalf("/auth/me avatar_path after delete = %q, want empty", got)
	}
	if names := mediaNames(t, srv); len(names) != 0 {
		t.Fatalf("MediaCover should be empty after delete, got %v", names)
	}

	// Deleting again is a no-op, not an error: the Profile page fires DELETE
	// without first checking whether an avatar exists, and removeCoverFile("")
	// has to survive the empty name it gets handed.
	if again := decode[avatarReply](t, c.mustDo("DELETE", "/auth/me/avatar", nil, http.StatusOK)); again.AvatarPath != "" {
		t.Fatalf("second delete answered %q, want empty", again.AvatarPath)
	}
}

// mustAvatar fails the test unless the upload was accepted, printing the body —
// a 400 here is otherwise a bare status with the reason hidden in the JSON.
func mustAvatar(t *testing.T, rec *httptest.ResponseRecorder) *httptest.ResponseRecorder {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("upload avatar: %d %s", rec.Code, rec.Body)
	}
	return rec
}

// TestAvatarPerUserIsolation is the security assertion for these two handlers.
//
// A note on the house "foreign row answers 404, not 403" rule: there is no
// foreign row to ask for here. Both routes are /auth/me/avatar — the target is
// the session's own user id (userID(r)) and no id ever travels in the path or
// the body, so the isolation property can't be expressed as a status code on
// someone else's id. What it CAN be expressed as, and what this test asserts,
// is that neither handler can be made to reach a row that isn't the caller's:
// Bob uploading or deleting must leave Alice's column and Alice's file exactly
// as they were. That is the same property the 404 rule protects elsewhere,
// checked at the only place this endpoint exposes it.
func TestAvatarPerUserIsolation(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	aliceAvatar := decode[avatarReply](t, mustAvatar(t, uploadAvatar(t, alice, "alice.png", pngMagic))).AvatarPath
	bobAvatar := decode[avatarReply](t, mustAvatar(t, uploadAvatar(t, bob, "bob.png", pngMagic))).AvatarPath

	if aliceAvatar == bobAvatar {
		t.Fatalf("both users ended up on the same avatar file %q", aliceAvatar)
	}
	// Bob's upload must not have overwritten Alice's column.
	if got := avatarOf(t, alice); got != aliceAvatar {
		t.Fatalf("alice's avatar changed to %q when bob uploaded, want %q", got, aliceAvatar)
	}
	if got := avatarOf(t, bob); got != bobAvatar {
		t.Fatalf("bob's avatar = %q, want %q", got, bobAvatar)
	}
	if names := mediaNames(t, srv); len(names) != 2 {
		t.Fatalf("want one file per user under MediaCover, got %v", names)
	}

	// Bob deleting his own avatar must not touch Alice's row OR her file. The
	// file half matters most: both live in one flat directory keyed only by a
	// random name, so a handler that cleared the wrong name would silently
	// delete another account's image with no error anywhere.
	bob.mustDo("DELETE", "/auth/me/avatar", nil, http.StatusOK)
	if got := avatarOf(t, bob); got != "" {
		t.Fatalf("bob's avatar survived his own delete: %q", got)
	}
	if got := avatarOf(t, alice); got != aliceAvatar {
		t.Fatalf("bob's delete cleared alice's avatar (%q, want %q)", got, aliceAvatar)
	}
	if !mediaFileExists(t, srv, aliceAvatar) {
		t.Fatalf("bob's delete removed alice's file %q", aliceAvatar)
	}
	if mediaFileExists(t, srv, bobAvatar) {
		t.Fatalf("bob's own file %q survived his delete", bobAvatar)
	}

	// The admin user list is the one place avatars are reported per-user, so it
	// is where a crossed wire between rows would surface in the UI.
	users := decode[struct {
		Users []userRow `json:"users"`
	}](t, alice.mustDo("GET", "/admin/users", nil, http.StatusOK))
	// The count is asserted first on purpose: without it the loop below passes
	// vacuously on an empty list, which is exactly what a renamed JSON key or a
	// scan error swallowed by handleListUsers would produce.
	if len(users.Users) != 2 {
		t.Fatalf("admin list should carry both accounts, got %+v", users.Users)
	}
	for _, u := range users.Users {
		want := ""
		if u.Username == "alice" {
			want = aliceAvatar
		}
		if u.AvatarPath != want {
			t.Fatalf("admin list: %s has avatar_path %q, want %q", u.Username, u.AvatarPath, want)
		}
	}

	// Neither route is reachable without a credential — requireAuth answers 401,
	// and it has to be 401 rather than 400, because the handler dereferences a
	// user id it can only get from the auth context.
	anon := &testClient{t: t, h: h}
	if rec := uploadAvatar(t, anon, "anon.png", pngMagic); rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous upload: got %d want 401: %s", rec.Code, rec.Body)
	}
	anon.mustDo("DELETE", "/auth/me/avatar", nil, http.StatusUnauthorized)
	// Alice is still untouched after all of that.
	if got := avatarOf(t, alice); got != aliceAvatar {
		t.Fatalf("alice's avatar after the anonymous attempts = %q, want %q", got, aliceAvatar)
	}
}

// ---- maintenance -----------------------------------------------------------

// TestMaintenanceRequiresAdmin covers the gate in front of both endpoints. 403
// (not 404) is correct here and does not contradict the per-user isolation rule:
// nothing is being hidden, because /admin/search/reindex and /admin/reset are
// not rows anyone can own — they are server-wide operations that exist for every
// user and are simply refused to non-admins. The rule about a foreign row
// answering 404 is about not leaking whether someone else's row exists.
//
// The reset case sends the CORRECT confirmation phrase on purpose: the admin
// check has to win before the body is read, or a non-admin could still trip the
// destructive path.
func TestMaintenanceRequiresAdmin(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	alice.mustDo("POST", "/books", map[string]any{"title": "Moby Dick"}, http.StatusCreated)

	bob.mustDo("POST", "/admin/search/reindex", nil, http.StatusForbidden)
	bob.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusForbidden)

	anon := &testClient{t: t, h: h}
	anon.mustDo("POST", "/admin/search/reindex", nil, http.StatusUnauthorized)
	anon.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusUnauthorized)

	// Nothing was reset: Alice still has her account, her session and her book.
	books := decode[struct {
		Books []bookDetail `json:"books"`
	}](t, alice.mustDo("GET", "/books", nil, http.StatusOK))
	if len(books.Books) != 1 {
		t.Fatalf("a refused reset still emptied the library: %+v", books.Books)
	}
	if st := decode[struct {
		NeedsOnboarding bool `json:"needs_onboarding"`
	}](t, alice.mustDo("GET", "/auth/status", nil, http.StatusOK)); st.NeedsOnboarding {
		t.Fatal("a refused reset wiped the users table")
	}
}

// TestReindexEscalationRepointsSessions covers the one line of handleReindexFTS
// that the happy path above cannot reach: `s.Sessions.DB = s.Store.DB`.
//
// I only noticed the hole by deleting that line — every assertion in
// TestReindexFTSEndpoint still passed, because an in-place rebuild never swaps
// the handle, so the repoint there is a no-op. It only matters when ReindexFTS
// gives up on rebuilding in place and escalates to store.Recover, which
// rebuilds the database into a fresh FILE and reopens s.Store.DB on it. The
// session store captured the old *sql.DB when the server was constructed; if
// the handler doesn't re-read it, every cookie in every browser starts failing
// against a closed connection the moment an admin presses "Rebuild search
// index" on a badly damaged database — the exact situation where the operator
// least wants to be locked out.
//
// Dropping books_fts is how I force the escalation: rebuildFTSTable replays the
// table's own CREATE statement out of sqlite_master, so with the table gone
// there is nothing to replay and the in-place path fails for real, rather than
// being faked with a seam.
func TestReindexEscalationRepointsSessions(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{"title": "Moby Dick"}, http.StatusCreated)

	// The sync triggers on `books` still name books_fts, so this leaves the
	// database in the shape Recover exists for: intact content, unusable index.
	if _, err := srv.Store.DB.Exec(`DROP TABLE books_fts`); err != nil {
		t.Fatalf("drop books_fts: %v", err)
	}

	res := decode[struct {
		OK     bool     `json:"ok"`
		Failed []string `json:"failed"`
	}](t, c.mustDo("POST", "/admin/search/reindex", nil, http.StatusOK))
	if !res.OK || len(res.Failed) != 0 {
		t.Fatalf("recovery should still report a clean rebuild, got %+v", res)
	}

	// The pre-existing cookie still authenticates: this is the assertion the
	// repoint owns, and it fails outright without it.
	list := decode[struct {
		Books []bookDetail `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 || list.Books[0].Title != "Moby Dick" {
		t.Fatalf("recovery should copy content forward, got %+v", list.Books)
	}
	// And the index really was rebuilt on the recovered file, triggers included.
	if r := decode[searchResults](t, c.mustDo("GET", "/search?q=Moby", nil, http.StatusOK)); len(r.Books) != 1 {
		t.Fatalf("search after recovery found %+v", r.Books)
	}
	post := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Leviathan Rising"}, http.StatusCreated))
	after := decode[searchResults](t, c.mustDo("GET", "/search?q=Leviathan", nil, http.StatusOK))
	if len(after.Books) != 1 || after.Books[0].ID != post.ID {
		t.Fatalf("a book added after the recovery is not searchable: %+v", after.Books)
	}
}

// TestResetDatabaseConfirmGuard: the endpoint is one POST away from destroying
// everything, so the confirmation phrase is the only thing standing between a
// mis-routed request and the whole library. Every non-exact phrase must be a 400
// that changes nothing.
func TestResetDatabaseConfirmGuard(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{"title": "Moby Dick"}, http.StatusCreated)

	for _, body := range []any{
		nil,
		map[string]string{},
		map[string]string{"confirm": ""},
		map[string]string{"confirm": "reset"},   // case matters
		map[string]string{"confirm": " RESET "}, // no trimming
		map[string]string{"confirm": "RESET ALL"},
	} {
		c.mustDo("POST", "/admin/reset", body, http.StatusBadRequest)
	}
	// Undecodable JSON: the handler ignores the decode error and falls through
	// to the confirm check, which is still a 400 — the safe direction.
	if rec := c.doRaw("POST", "/admin/reset", strings.NewReader("{not json"), "application/json"); rec.Code != http.StatusBadRequest {
		t.Fatalf("malformed body: got %d want 400: %s", rec.Code, rec.Body)
	}

	list := decode[struct {
		Books []bookDetail `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 {
		t.Fatalf("a refused reset touched the library: %+v", list.Books)
	}
}

// TestResetDatabaseEmptiesEverything is the destructive path end to end. The
// store's own TestReset proves the file is wiped and the schema comes back; what
// only the handler does is the rest of the blast radius — repointing the session
// store at the new *sql.DB, clearing MediaCover, expiring the caller's cookie —
// and that is what this asserts, finishing on the state a real operator lands in:
// first-run onboarding with an empty library.
func TestResetDatabaseEmptiesEverything(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	book := decode[bookDetail](t, alice.mustDo("POST", "/books",
		map[string]any{"title": "Moby Dick", "genres": []string{"Classics"}}, http.StatusCreated))
	alice.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Call me Ishmael.",
	}, http.StatusCreated)
	bob.mustDo("POST", "/books", map[string]any{"title": "Bob's Book"}, http.StatusCreated)
	avatar := decode[avatarReply](t, mustAvatar(t, uploadAvatar(t, alice, "alice.png", pngMagic))).AvatarPath
	if !mediaFileExists(t, srv, avatar) {
		t.Fatalf("avatar %q should exist before the reset", avatar)
	}

	safetyBackup(t, alice)
	rec := alice.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusOK)
	if !decode[struct {
		OK bool `json:"ok"`
	}](t, rec).OK {
		t.Fatalf("reset answered %s", rec.Body)
	}

	// The caller's cookie is expired in the same response — their session row is
	// gone with the database, so leaving a live cookie in the browser would just
	// produce a confusing 401 on the next click instead of onboarding.
	var expired bool
	for _, ck := range rec.Result().Cookies() {
		if ck.Name == sessionCookie && ck.MaxAge < 0 {
			expired = true
		}
	}
	if !expired {
		t.Fatalf("reset did not expire the session cookie: %+v", rec.Result().Cookies())
	}

	// Orphaned media is gone — every row that referenced it was deleted.
	if names := mediaNames(t, srv); len(names) != 0 {
		t.Fatalf("MediaCover survived the reset: %v", names)
	}

	// Both users' credentials are dead, and the app is back at first run. This
	// also proves the handler repointed Sessions at the new *sql.DB: against the
	// closed old handle these would still 401, but /auth/status (which reads
	// s.Store.DB) and the signup below would fail outright.
	alice.mustDo("GET", "/books", nil, http.StatusUnauthorized)
	bob.mustDo("GET", "/books", nil, http.StatusUnauthorized)
	if st := decode[struct {
		NeedsOnboarding bool `json:"needs_onboarding"`
	}](t, (&testClient{t: t, h: h}).mustDo("GET", "/auth/status", nil, http.StatusOK)); !st.NeedsOnboarding {
		t.Fatal("reset should leave the app needing onboarding")
	}

	// Onboarding works against the fresh database and the library is empty —
	// not just unreadable, actually gone.
	fresh := signupAdmin(t, h)
	if l := decode[struct {
		Books []bookDetail `json:"books"`
	}](t, fresh.mustDo("GET", "/books", nil, http.StatusOK)); len(l.Books) != 0 {
		t.Fatalf("books survived the reset: %+v", l.Books)
	}
	if l := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, fresh.mustDo("GET", "/annotations", nil, http.StatusOK)); len(l.Annotations) != 0 {
		t.Fatalf("annotations survived the reset: %+v", l.Annotations)
	}
	if g := decode[namesResp](t, fresh.mustDo("GET", "/genres", nil, http.StatusOK)); len(g.Genres) != 0 {
		t.Fatalf("genres survived the reset: %v", g.Genres)
	}
	if got := avatarOf(t, fresh); got != "" {
		t.Fatalf("the new account inherited an avatar: %q", got)
	}
	users := decode[struct {
		Users []userRow `json:"users"`
	}](t, fresh.mustDo("GET", "/admin/users", nil, http.StatusOK))
	if len(users.Users) != 1 {
		t.Fatalf("want exactly the re-onboarded admin, got %+v", users.Users)
	}
	// Search answers against the fresh schema (the FTS tables were re-created,
	// not merely emptied).
	if res := decode[searchResults](t, fresh.mustDo("GET", "/search?q=Moby", nil, http.StatusOK)); len(res.Books) != 0 {
		t.Fatalf("search found pre-reset rows: %+v", res.Books)
	}
}
