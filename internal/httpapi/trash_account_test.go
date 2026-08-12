package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// Deleting a member is not final either.
//
// This is the largest thing the bin holds and the one with the most to lose: a
// whole library, its vocabulary, its review history and its pictures, plus the
// login itself. It is also the one entry whose restore can be refused by something
// outside the payload — a username somebody else has taken since.
//
// The table list is DECLARED, so the test that matters most here is not about any
// one restore: it is the one that fails the build when a new user-owned table
// appears in the schema and nobody adds it to the snapshot. Without that, adding a
// table means deleting an account silently drops it, and the loss shows up on a
// restore months later.

func TestEveryUserOwnedTableIsInTheAccountSnapshot(t *testing.T) {
	srv := newTestServer(t)

	// Every table with a user_id column, straight from the schema.
	rows, err := srv.Store.DB.Query(`
		SELECT m.name FROM sqlite_master m
		WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE '%_fts%'
		  AND EXISTS (SELECT 1 FROM pragma_table_info(m.name) WHERE name = 'user_id')
		ORDER BY m.name`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	covered := map[string]bool{}
	for _, n := range accountTables {
		covered[n] = true
	}
	var missing []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		if name == "trash" || accountSkipTables[name] || covered[name] {
			continue
		}
		missing = append(missing, name)
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		t.Fatalf("these tables belong to a user and are not in accountTables: %v\n"+
			"add them there (so a deleted account keeps them) or to accountSkipTables with a reason", missing)
	}
}

func TestDeletingAnAccountBinsItWholeAndRestoringBringsItBack(t *testing.T) {
	srv := newTestServer(t)
	srv.SeedNewUsers = true // stickers and tags, so the vocabulary is really exercised
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	// Bob's library: a book with a cover, a quote with a tag and a review row, and
	// a standalone quote.
	bookID := idOf(t, bob.mustDo("POST", "/books", map[string]any{
		"title": "Sandworm Studies", "author": "Liet Kynes", "genres": []string{"ecology"},
	}, 201).Body.Bytes())
	cover := "1111222233334444.png"
	if err := os.WriteFile(filepath.Join(srv.coversDir(), cover), pngMagic, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`UPDATE books SET cover_path = ? WHERE id = ?`, cover, bookID); err != nil {
		t.Fatal(err)
	}
	annID := idOf(t, bob.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "The spice must flow", "tags": []string{"politics"}, "color": "blue",
	}, 201).Body.Bytes())
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO item_reviews (kind, item_id, stability, review_count, last_result, last_touched_at)
		 VALUES ('book', ?, 21.5, 3, 'got', '2026-07-01T00:00:00Z')`, annID); err != nil {
		t.Fatal(err)
	}
	bob.mustDo("POST", "/quotes", map[string]any{"quote": "Fear is the mind-killer", "speaker": "Paul"}, 201)

	var bobID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'bob'`).Scan(&bobID); err != nil {
		t.Fatal(err)
	}
	admin.mustDo("DELETE", "/admin/users/"+itoa(bobID), nil, http.StatusOK)

	// Gone: the account, the library, and the cover has left the cover store.
	var users, books, anns int
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE id = ?`, bobID).Scan(&users)
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM books WHERE user_id = ?`, bobID).Scan(&books)
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM annotations WHERE id = ?`, annID).Scan(&anns)
	if users != 0 || books != 0 || anns != 0 {
		t.Fatalf("after the delete: users=%d books=%d annotations=%d", users, books, anns)
	}
	if _, err := os.Stat(filepath.Join(srv.trashDir(), cover)); err != nil {
		t.Fatalf("the cover was not parked: %v", err)
	}

	// The entry is in the ADMIN's bin, not bob's — bob has no bin, because bob has
	// no row for one to hang off.
	bin := binOf(t, admin).Trash
	if len(bin) != 1 || bin[0].Kind != "account" || bin[0].Label != "bob" {
		t.Fatalf("admin's bin: %+v", bin)
	}
	if bin[0].ChildCount != 2 {
		t.Errorf("child_count = %d, want 2 (one highlight, one standalone quote)", bin[0].ChildCount)
	}

	restore(t, admin, bin[0].ID, http.StatusOK)

	// The account is back, with its id, and can log in again.
	var name string
	var isAdminFlag bool
	if err := srv.Store.DB.QueryRow(`SELECT username, is_admin FROM users WHERE id = ?`, bobID).
		Scan(&name, &isAdminFlag); err != nil {
		t.Fatalf("the account did not come back: %v", err)
	}
	if name != "bob" || isAdminFlag {
		t.Fatalf("account came back as %q admin=%v", name, isAdminFlag)
	}
	again := &testClient{t: t, h: h}
	rec := again.do("POST", "/auth/login", map[string]string{"username": "bob", "password": "supersecret"})
	if rec.Code != 200 {
		t.Fatalf("bob cannot log in after the restore: %d %s", rec.Code, rec.Body)
	}
	again.cookie = cookieOf(t, rec)

	// And his library is his again, from his own session — the strongest form of
	// this assertion, since it goes through the same ownership filters everything
	// else does.
	b := decode[struct {
		Title  string   `json:"title"`
		Cover  string   `json:"cover_path"`
		Genres []string `json:"genres"`
	}](t, again.mustDo("GET", "/books/"+itoa(bookID), nil, 200))
	if b.Title != "Sandworm Studies" || b.Cover != cover {
		t.Fatalf("book came back as %+v", b)
	}
	if len(b.Genres) != 1 || b.Genres[0] != "Ecology" {
		t.Errorf("genres came back as %+v", b.Genres)
	}
	anlist := decode[annList](t, again.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, 200)).Annotations
	if len(anlist) != 1 || anlist[0].Quote != "The spice must flow" || anlist[0].Color != "blue" {
		t.Fatalf("quote came back as %+v", anlist)
	}
	if len(anlist[0].Tags) != 1 || anlist[0].Tags[0] != "politics" {
		t.Errorf("tags came back as %+v", anlist[0].Tags)
	}
	// The review history, and the seeded stickers, which are the two things nobody
	// would notice missing until much later.
	var stability float64
	if err := srv.Store.DB.QueryRow(
		`SELECT stability FROM item_reviews WHERE kind = 'book' AND item_id = ?`, annID).Scan(&stability); err != nil {
		t.Fatalf("the review row did not come back: %v", err)
	}
	if stability != 21.5 {
		t.Errorf("stability = %v, want 21.5", stability)
	}
	if got := listStickers(t, again); len(got) != len(defaultStickers) {
		t.Errorf("stickers came back: %d, want %d", len(got), len(defaultStickers))
	}
	// The cover is back where the app serves it from.
	if _, err := os.Stat(filepath.Join(srv.coversDir(), cover)); err != nil {
		t.Errorf("the cover did not come back: %v", err)
	}
}

func TestRestoringAnAccountWhoseNameWasTakenSaysSo(t *testing.T) {
	// The one refusal that comes from outside the payload. It has to name the
	// clash: "restore failed" against a UNIQUE constraint tells an admin nothing
	// about what to do next, and the answer (rename the other account) is not
	// guessable from the error.
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	addUser(t, h, admin, "bob")

	var bobID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'bob'`).Scan(&bobID); err != nil {
		t.Fatal(err)
	}
	admin.mustDo("DELETE", "/admin/users/"+itoa(bobID), nil, http.StatusOK)
	addUser(t, h, admin, "bob") // somebody else takes the name

	entry := binOf(t, admin).Trash[0]
	rec := admin.do("POST", "/trash/"+itoa(entry.ID)+"/restore", nil)
	if rec.Code != http.StatusConflict {
		t.Fatalf("restore = %d, want 409: %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), "bob") {
		t.Errorf("the error should name the account in the way: %s", rec.Body)
	}
	// The entry survives, so the admin can rename and try again.
	if left := binOf(t, admin).Trash; len(left) != 1 {
		t.Fatalf("a refused restore consumed the entry: %+v", left)
	}
}

func TestOnlyAnAdminCanRestoreAnAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	addUser(t, h, admin, "carol")

	var carolID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'carol'`).Scan(&carolID); err != nil {
		t.Fatal(err)
	}
	admin.mustDo("DELETE", "/admin/users/"+itoa(carolID), nil, http.StatusOK)
	entry := binOf(t, admin).Trash[0]

	// Bob cannot even see the admin's bin, so this is 404 rather than 403 — the
	// house rule, and the reason the admin-only check is a second gate behind it
	// rather than the only one.
	restore(t, bob, entry.ID, http.StatusNotFound)

	// And the gate itself: the entry is in the admin's bin, and the admin is the
	// only one who can act on it.
	restore(t, admin, entry.ID, http.StatusOK)
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE username = 'carol'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("carol's account did not come back: %d rows", n)
	}
}

func TestARefusedAccountDeleteLeavesNothingInTheBin(t *testing.T) {
	// The last admin cannot be removed, and the snapshot is written BEFORE that
	// guard runs — so the rollback has to take the bin entry with it. Otherwise the
	// bin fills up with entries for accounts that still exist, and restoring one
	// would duplicate a live user.
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)

	// Deleting yourself is refused earlier, so promote a second admin and try that.
	addUser(t, h, admin, "bob")
	var bobID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'bob'`).Scan(&bobID); err != nil {
		t.Fatal(err)
	}
	admin.mustDo("PATCH", "/admin/users/"+itoa(bobID), map[string]any{"is_admin": true}, http.StatusOK)
	// An admin may not delete another admin.
	admin.mustDo("DELETE", "/admin/users/"+itoa(bobID), nil, http.StatusForbidden)

	if left := binOf(t, admin).Trash; len(left) != 0 {
		t.Fatalf("a refused delete left %+v in the bin", left)
	}
}
