package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

// The retention sweep.
//
// Every assertion here is about a DELETION, which makes this the most dangerous
// code in the feature and the reason the cases come in pairs: for each thing the
// purge should remove, there is a case that something else was left alone. A sweep
// that is one comparison the wrong way round empties the bin it was meant to keep,
// and there is nothing to report it — the entries are simply not there any more.

// backdate moves an entry's deletion time into the past, which is the only way to
// test a 30-day window without waiting a month. It writes the same format SQLite
// writes, through SQLite, so the comparison under test is the real one.
func backdate(t *testing.T, srv *Server, id int64, days int) {
	t.Helper()
	if _, err := srv.Store.DB.Exec(
		`UPDATE trash SET deleted_at = datetime('now', ?) WHERE id = ?`,
		itoa(int64(-days))+" days", id); err != nil {
		t.Fatal(err)
	}
}

func binNow(t *testing.T, c *testClient, title string) int64 {
	t.Helper()
	id := createBook(t, c, title)
	c.mustDo("DELETE", "/books/"+itoa(id), nil, http.StatusOK)
	return id
}

func TestPurgeTakesTheExpiredAndLeavesTheRest(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	binNow(t, c, "Old Enough")
	binNow(t, c, "Still Fresh")
	bin := binOf(t, c).Trash
	if len(bin) != 2 {
		t.Fatalf("bin: %+v", bin)
	}
	byLabel := map[string]int64{}
	for _, e := range bin {
		byLabel[e.Label] = e.ID
	}
	backdate(t, srv, byLabel["Old Enough"], 31)
	backdate(t, srv, byLabel["Still Fresh"], 29)

	srv.PurgeTrash()

	left := binOf(t, c).Trash
	if len(left) != 1 || left[0].Label != "Still Fresh" {
		t.Fatalf("after the purge the bin holds %+v", left)
	}
}

func TestPurgeRemovesTheFilesItWasHolding(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	id := createBook(t, c, "The Dispossessed")
	cover := "cafebabecafebabe.png"
	if err := os.WriteFile(filepath.Join(srv.coversDir(), cover), pngMagic, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`UPDATE books SET cover_path = ? WHERE id = ?`, cover, id); err != nil {
		t.Fatal(err)
	}
	c.mustDo("DELETE", "/books/"+itoa(id), nil, http.StatusOK)
	parked := filepath.Join(srv.trashDir(), cover)
	if _, err := os.Stat(parked); err != nil {
		t.Fatalf("the cover was not parked: %v", err)
	}

	backdate(t, srv, binOf(t, c).Trash[0].ID, 31)
	srv.PurgeTrash()

	if _, err := os.Stat(parked); !os.IsNotExist(err) {
		t.Error("the purge left the parked cover on disk — thirty days later it is still costing space")
	}
}

func TestNeverMeansNever(t *testing.T) {
	// -1 is the window that does not expire, and this is the case that would break
	// if somebody "simplified" it back to 0: an unset preference reads as 0, so 0
	// meaning never would turn the purge off for every account that has not touched
	// the setting.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	binNow(t, c, "Kept Forever")
	backdate(t, srv, binOf(t, c).Trash[0].ID, 4000)

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"trashDays": -1}, 200)
	srv.PurgeTrash()
	if left := binOf(t, c).Trash; len(left) != 1 {
		t.Fatalf("a never-expire bin lost its entry: %+v", left)
	}

	// And the complement: switch to a real window and the same entry goes, so the
	// test above is not passing because the purge does nothing at all.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"trashDays": 90}, 200)
	srv.PurgeTrash()
	if left := binOf(t, c).Trash; len(left) != 0 {
		t.Fatalf("a 90-day window kept a 4000-day-old entry: %+v", left)
	}
}

func TestTheWindowIsPerAccount(t *testing.T) {
	// The setting is per user, so the sweep has to ask each owner rather than
	// applying one number to the table. Two accounts, two windows, one entry each
	// at the same age.
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	binNow(t, admin, "Admin's Book")
	binNow(t, bob, "Bob's Book")
	backdate(t, srv, binOf(t, admin).Trash[0].ID, 20)
	backdate(t, srv, binOf(t, bob).Trash[0].ID, 20)

	admin.mustDo("PUT", "/auth/me/preferences", map[string]any{"trashDays": 7}, 200)
	bob.mustDo("PUT", "/auth/me/preferences", map[string]any{"trashDays": 90}, 200)
	srv.PurgeTrash()

	if left := binOf(t, admin).Trash; len(left) != 0 {
		t.Errorf("the admin's 7-day window kept a 20-day-old entry: %+v", left)
	}
	if left := binOf(t, bob).Trash; len(left) != 1 {
		t.Errorf("bob's 90-day window dropped a 20-day-old entry: %+v", left)
	}
}

func TestSweepCollectsAParkedFileNobodyReferences(t *testing.T) {
	// Parking is the one step outside the transaction and it fails towards KEEPING
	// the file, so orphans are expected by design. They are also the only cleanup
	// path for a deleted account's parked covers: the trash rows cascade with the
	// user row and the files do not.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// One orphan, and one file a live bin entry still needs.
	if err := os.MkdirAll(srv.trashDir(), 0o700); err != nil {
		t.Fatal(err)
	}
	orphan := filepath.Join(srv.trashDir(), "deadbeefdeadbeef.png")
	if err := os.WriteFile(orphan, pngMagic, 0o600); err != nil {
		t.Fatal(err)
	}
	id := createBook(t, c, "Sandworm Studies")
	kept := "feedfacefeedface.png"
	if err := os.WriteFile(filepath.Join(srv.coversDir(), kept), pngMagic, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`UPDATE books SET cover_path = ? WHERE id = ?`, kept, id); err != nil {
		t.Fatal(err)
	}
	c.mustDo("DELETE", "/books/"+itoa(id), nil, http.StatusOK)

	srv.PurgeTrash()

	if _, err := os.Stat(orphan); !os.IsNotExist(err) {
		t.Error("the sweep left a parked file no entry references")
	}
	if _, err := os.Stat(filepath.Join(srv.trashDir(), kept)); err != nil {
		t.Errorf("the sweep took a file a live bin entry still needs: %v", err)
	}
}

func TestTheDailySweepRunsOnceADay(t *testing.T) {
	// The scheduler, such as it is: a date stamp in settings, checked by every
	// authenticated request. What matters is that it does not run on every request
	// — a sweep per request on a busy instance is a full table scan per request —
	// and that it does run again tomorrow.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	binNow(t, c, "Old Enough")
	backdate(t, srv, binOf(t, c).Trash[0].ID, 31)

	// Today's sweep already happened — the signup itself tripped it — so the stamp
	// is cleared here to stand in for "the first request after midnight". Doing it
	// this way round is deliberate: it proves the stamp is what gates the sweep,
	// rather than the sweep being unconditional.
	if err := srv.Store.SetSetting(purgeStampKey, ""); err != nil {
		t.Fatal(err)
	}
	if left := binOf(t, c).Trash; len(left) != 0 {
		t.Fatalf("the first request of the day did not sweep: %+v", left)
	}
	today, err := srv.today()
	if err != nil {
		t.Fatal(err)
	}
	if got, _ := srv.Store.GetSetting(purgeStampKey); got != today {
		t.Fatalf("stamp = %q, want today (%q)", got, today)
	}

	// A second expired entry with the stamp still on today: nothing sweeps it.
	binNow(t, c, "Also Old")
	backdate(t, srv, binOf(t, c).Trash[0].ID, 31)
	c.mustDo("GET", "/books", nil, 200)
	if left := binOf(t, c).Trash; len(left) != 1 {
		t.Fatalf("the sweep ran twice in one day: %+v", left)
	}

	// Yesterday's stamp is what tomorrow looks like from here.
	if err := srv.Store.SetSetting(purgeStampKey, "2000-01-01"); err != nil {
		t.Fatal(err)
	}
	c.mustDo("GET", "/books", nil, 200)
	if left := binOf(t, c).Trash; len(left) != 0 {
		t.Fatalf("a new day did not sweep: %+v", left)
	}
}
