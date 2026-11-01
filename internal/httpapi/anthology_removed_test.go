package httpapi

// WHAT WAS TAKEN OUT OF AN ANTHOLOGY STAYS OUT (0088).
//
// The failure these guard: removing a passage was a plain delete, so a rule that fills the
// anthology put it straight back the next time it ran. Each test is something the reader sees.

import (
	"net/http"
	"testing"
)

type removedList struct {
	Removed []anthologyRemovedRow `json:"removed"`
}

func removedOf(t *testing.T, c *testClient, id int64) []anthologyRemovedRow {
	t.Helper()
	return decode[removedList](t, c.mustDo("GET", "/anthologies/"+itoa(id)+"/removed", nil, http.StatusOK)).Removed
}

func removeEntry(t *testing.T, c *testClient, id int64, kind string, item int64) {
	t.Helper()
	c.mustDo("DELETE", "/anthologies/"+itoa(id)+"/entries/"+kind+"/"+itoa(item), nil, http.StatusNoContent)
}

func TestAFillDoesNotPutBackWhatWasRemoved(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	a, _, _, _ := taggedShelf(t, c)
	an := newAnthology(t, c, "Stoics")
	first := fill(t, c, an.ID, "tag=stoicism", false)

	removeEntry(t, c, an.ID, "book", a)
	again := fill(t, c, an.ID, "tag=stoicism", false)

	if again.Added != 0 {
		t.Errorf("the fill added %d after a removal, want 0", again.Added)
	}
	if again.Removed != 1 {
		t.Errorf("the fill said it passed over %d removed, want 1", again.Removed)
	}
	if n := len(getAnthology(t, c, an.ID).Entries); n != first.Added-1 {
		t.Errorf("%d entries, want %d (the removed one stays out)", n, first.Added-1)
	}
}

func TestAPreviewKnowsAboutTheRemoval(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	a, _, _, _ := taggedShelf(t, c)
	an := newAnthology(t, c, "Stoics")
	fill(t, c, an.ID, "tag=stoicism", false)
	removeEntry(t, c, an.ID, "book", a)

	got := decode[anthologyFillResp](t, c.mustDo("POST", "/anthologies/"+itoa(an.ID)+"/fill",
		map[string]any{"rule": "tag=stoicism", "preview": true}, http.StatusOK))
	if got.Added != 0 || got.Removed != 1 {
		t.Errorf("preview says added %d, removed %d; want 0 and 1", got.Added, got.Removed)
	}
}

func TestARemovedPassageIsListedAndComesBackWhereItWasWithItsNote(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	a, b, cq, _ := taggedShelf(t, c)
	an := newAnthology(t, c, "Stoics")
	addEntries(t, c, an.ID, []map[string]any{
		{"kind": "book", "item_id": a}, {"kind": "book", "item_id": b}, {"kind": "book", "item_id": cq},
	})
	c.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/entries", map[string]any{
		"kind": "book", "item_id": b, "note": "Why this one sits second.",
	}, http.StatusNoContent)

	removeEntry(t, c, an.ID, "book", b)
	list := removedOf(t, c, an.ID)
	if len(list) != 1 || list[0].ItemID != b || list[0].Quote != "Waste no more time arguing." || list[0].Source != "Meditations" {
		t.Fatalf("the removed list was %+v", list)
	}

	c.mustDo("POST", "/anthologies/"+itoa(an.ID)+"/removed/book/"+itoa(b), nil, http.StatusNoContent)
	got := getAnthology(t, c, an.ID)
	if order := entryOrder(got); len(order) != 3 || order[1] != "book:"+itoa(b) {
		t.Errorf("order after bringing it back = %v, want it second again", order)
	}
	for _, e := range got.Entries {
		if e.ItemID == b && e.Note != "Why this one sits second." {
			t.Errorf("the commentary did not come back: %q", e.Note)
		}
	}
	if n := len(removedOf(t, c, an.ID)); n != 0 {
		t.Errorf("%d still listed as removed after bringing it back", n)
	}
}

func TestAddingARemovedPassageByHandClearsItFromTheRemovedList(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	a, _, _, _ := taggedShelf(t, c)
	an := newAnthology(t, c, "Stoics")
	addEntries(t, c, an.ID, []map[string]any{{"kind": "book", "item_id": a}})
	removeEntry(t, c, an.ID, "book", a)

	addEntries(t, c, an.ID, []map[string]any{{"kind": "book", "item_id": a}})

	if n := len(removedOf(t, c, an.ID)); n != 0 {
		t.Errorf("the passage was added back by hand and is still listed as removed (%d)", n)
	}
	if n := len(getAnthology(t, c, an.ID).Entries); n != 1 {
		t.Errorf("%d entries, want 1", n)
	}
}

func TestDeletingAQuoteClearsItFromTheRemovedList(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	a, _, _, _ := taggedShelf(t, c)
	an := newAnthology(t, c, "Stoics")
	addEntries(t, c, an.ID, []map[string]any{{"kind": "book", "item_id": a}})
	removeEntry(t, c, an.ID, "book", a)

	c.mustDo("DELETE", "/annotations/"+itoa(a), nil, http.StatusOK)

	if n := len(removedOf(t, c, an.ID)); n != 0 {
		t.Errorf("a deleted quote is still listed as removed (%d)", n)
	}
}

func TestBinningAndRestoringAQuoteKeepsItsRemovals(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	a, _, _, _ := taggedShelf(t, c)
	an := newAnthology(t, c, "Stoics")
	fill(t, c, an.ID, "tag=stoicism", false)
	removeEntry(t, c, an.ID, "book", a)

	del := decode[struct {
		TrashID int64 `json:"trash_id"`
	}](t, c.mustDo("DELETE", "/annotations/"+itoa(a), nil, http.StatusOK))
	c.mustDo("POST", "/trash/"+itoa(del.TrashID)+"/restore", nil, http.StatusOK)

	if list := removedOf(t, c, an.ID); len(list) != 1 || list[0].ItemID != a {
		t.Errorf("after binning and restoring, the removed list was %+v", list)
	}
	if again := fill(t, c, an.ID, "tag=stoicism", false); again.Added != 0 {
		t.Errorf("a fill put back %d after the quote came back from the bin", again.Added)
	}
}

func TestAQuoteComesBackFromTheBinAfterItsAnthologyWasDeleted(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	a, _, _, _ := taggedShelf(t, c)
	an := newAnthology(t, c, "Stoics")
	addEntries(t, c, an.ID, []map[string]any{{"kind": "book", "item_id": a}})
	removeEntry(t, c, an.ID, "book", a)

	del := decode[struct {
		TrashID int64 `json:"trash_id"`
	}](t, c.mustDo("DELETE", "/annotations/"+itoa(a), nil, http.StatusOK))
	c.mustDo("DELETE", "/anthologies/"+itoa(an.ID), nil, http.StatusNoContent)

	// Its removal pointed at a document that is gone; the quote is what was asked for.
	c.mustDo("POST", "/trash/"+itoa(del.TrashID)+"/restore", nil, http.StatusOK)
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM annotations WHERE id = ?`, a).Scan(&n); err != nil || n != 1 {
		t.Errorf("the quote did not come back (n=%d, err=%v)", n, err)
	}
}

func TestSomebodyElsesAnthologyHasNoRemovedList(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	an := newAnthology(t, c, "Mine")
	bob := addUser(t, h, c, "bob")
	bob.mustDo("GET", "/anthologies/"+itoa(an.ID)+"/removed", nil, http.StatusNotFound)
	bob.mustDo("POST", "/anthologies/"+itoa(an.ID)+"/removed/book/1", nil, http.StatusNotFound)
}

func TestAnAccountRoundTripKeepsItsRemovedPassages(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	book := decode[bookDetail](t, bob.mustDo("POST", "/books", map[string]any{"title": "Dune"}, http.StatusCreated))
	ann := decode[annotationRow](t, bob.mustDo("POST", "/annotations",
		map[string]any{"book_id": book.ID, "quote": "Fear is the mind-killer."}, http.StatusCreated)).ID
	an := newAnthology(t, bob, "Litany")
	addEntries(t, bob, an.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	removeEntry(t, bob, an.ID, "book", ann)

	var bobID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'bob'`).Scan(&bobID); err != nil {
		t.Fatal(err)
	}
	admin.mustDo("DELETE", "/admin/users/"+itoa(bobID), nil, http.StatusOK)
	restore(t, admin, binOf(t, admin).Trash[0].ID, http.StatusOK)

	again := &testClient{t: t, h: h}
	rec := again.do("POST", "/auth/login", map[string]string{"username": "bob", "password": "supersecret"})
	if rec.Code != 200 {
		t.Fatalf("bob cannot log in after the restore: %d", rec.Code)
	}
	again.cookie = cookieOf(t, rec)
	if list := removedOf(t, again, an.ID); len(list) != 1 || list[0].ItemID != ann {
		t.Errorf("after the account came back, the removed list was %+v", list)
	}
}
