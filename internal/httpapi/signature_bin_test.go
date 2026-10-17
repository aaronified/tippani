package httpapi

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

// A SIGNATURE TRAVELS THROUGH THE BIN WITH ITS PERSON, AND A FILE TWO READERS SHARE
// IS NEVER LOST TO ONE OF THEM.
//
// What a person would say: delete a person and bring them back, and their signature
// is there; delete one whose signature I share with another reader, and neither of
// us loses it; empty my bin, and the other reader's signature is still theirs.
//
// What the tests know, declared: the covers dir and the bin's corner of it (where a
// parked file waits), the bin's own routes, and the person routes. Nothing about
// which function parks a file.

func inCovers(srv *Server, name string) bool {
	_, err := os.Stat(filepath.Join(srv.coversDir(), name))
	return err == nil
}

func inBin(srv *Server, name string) bool {
	_, err := os.Stat(filepath.Join(srv.trashDir(), name))
	return err == nil
}

func TestABinnedPersonsSignatureIsParkedAndComesBack(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := makePerson(t, c, "Ursula Writer")
	if rec := postSignature(c, fmt.Sprintf("/people/id/%d/signature", id), aSignaturePhoto(t), nil); rec.Code != 200 {
		t.Fatalf("save = %d: %s", rec.Code, rec.Body)
	}
	name, _ := signatureOf(t, c, id)

	c.mustDo("DELETE", fmt.Sprintf("/people/%d", id), nil, http.StatusOK)
	if inCovers(srv, name) || !inBin(srv, name) {
		t.Fatalf("after the delete the signature is in covers=%v, in the bin=%v; want parked", inCovers(srv, name), inBin(srv, name))
	}

	bin := binOf(t, c).Trash
	if len(bin) != 1 {
		t.Fatalf("bin holds %d entries, want 1", len(bin))
	}
	restore(t, c, bin[0].ID, http.StatusOK)
	if !inCovers(srv, name) || inBin(srv, name) {
		t.Errorf("after the restore the signature is in covers=%v, in the bin=%v; want back in covers", inCovers(srv, name), inBin(srv, name))
	}
	if got, src := signatureOf(t, c, id); got != name || src != "manual" {
		t.Errorf("the restored person has signature %q (%s), want %q (manual)", got, src, name)
	}
}

func TestASignatureTwoReadersShareSurvivesEitherOfThemBinningIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	photo := aSignaturePhoto(t)
	a := makePerson(t, alice, "Ursula Writer")
	b := makePerson(t, bob, "Ursula Writer")
	for _, who := range []struct {
		c  *testClient
		id int64
	}{{alice, a}, {bob, b}} {
		if rec := postSignature(who.c, fmt.Sprintf("/people/id/%d/signature", who.id), photo, nil); rec.Code != 200 {
			t.Fatalf("save = %d: %s", rec.Code, rec.Body)
		}
	}
	name, _ := signatureOf(t, alice, a)

	// ALICE BINS HER PERSON. Bob still names the file, so it is not moved, and his
	// signature still draws.
	alice.mustDo("DELETE", fmt.Sprintf("/people/%d", a), nil, http.StatusOK)
	if !inCovers(srv, name) {
		t.Fatal("alice binning her person moved the file bob's signature names")
	}
	if got, _ := signatureOf(t, bob, b); got != name {
		t.Errorf("bob's signature is %q after alice binned hers, want %q", got, name)
	}

	// BOB TAKES HIS OFF. Alice's bin entry still holds a claim on the name, so the
	// file stays: her restore must find it.
	bob.mustDo("PUT", fmt.Sprintf("/people/id/%d", b), map[string]any{"clear_signature": true}, http.StatusOK)
	if !inCovers(srv, name) {
		t.Fatal("bob removing his signature deleted a file alice's bin entry is waiting to restore")
	}
	bin := binOf(t, alice).Trash
	restore(t, alice, bin[0].ID, http.StatusOK)
	if got, _ := signatureOf(t, alice, a); got != name || !inCovers(srv, name) {
		t.Errorf("alice's restored signature is %q (file present: %v), want %q", got, inCovers(srv, name), name)
	}
}

func TestEmptyingABinReleasesASignatureNobodyElseNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	photo := aSignaturePhoto(t)
	a := makePerson(t, alice, "Ursula Writer")
	b := makePerson(t, bob, "Ursula Writer")
	for _, who := range []struct {
		c  *testClient
		id int64
	}{{alice, a}, {bob, b}} {
		postSignature(who.c, fmt.Sprintf("/people/id/%d/signature", who.id), photo, nil)
	}
	name, _ := signatureOf(t, alice, a)

	// Alice bins her person (the file stays, bob names it); bob removes his
	// signature (it stays, alice's bin names it). Alice then empties her bin: nothing
	// names the file any more, so it goes. Without the release it would sit in the
	// cover store for good, named by nothing.
	alice.mustDo("DELETE", fmt.Sprintf("/people/%d", a), nil, http.StatusOK)
	bob.mustDo("PUT", fmt.Sprintf("/people/id/%d", b), map[string]any{"clear_signature": true}, http.StatusOK)
	if !inCovers(srv, name) {
		t.Fatal("the file went while alice's bin entry still named it")
	}
	alice.mustDo("DELETE", "/trash", nil, http.StatusOK)
	if inCovers(srv, name) || inBin(srv, name) {
		t.Errorf("after the last claim went the file is in covers=%v, in the bin=%v; want gone", inCovers(srv, name), inBin(srv, name))
	}
}

func TestEmptyingABinNeverTakesASignatureAPersonStillNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	photo := aSignaturePhoto(t)
	a := makePerson(t, alice, "Ursula Writer")
	b := makePerson(t, bob, "Ursula Writer")
	for _, who := range []struct {
		c  *testClient
		id int64
	}{{alice, a}, {bob, b}} {
		postSignature(who.c, fmt.Sprintf("/people/id/%d/signature", who.id), photo, nil)
	}
	name, _ := signatureOf(t, alice, a)

	alice.mustDo("DELETE", fmt.Sprintf("/people/%d", a), nil, http.StatusOK)
	alice.mustDo("DELETE", "/trash", nil, http.StatusOK)
	if !inCovers(srv, name) {
		t.Fatal("emptying alice's bin deleted the file bob's signature names")
	}
	if got, _ := signatureOf(t, bob, b); got != name {
		t.Errorf("bob's signature is %q, want %q", got, name)
	}
}

func TestDeletingAnAccountKeepsASignatureAnotherReaderShares(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	photo := aSignaturePhoto(t)
	a := makePerson(t, alice, "Ursula Writer")
	b := makePerson(t, bob, "Ursula Writer")
	for _, who := range []struct {
		c  *testClient
		id int64
	}{{alice, a}, {bob, b}} {
		postSignature(who.c, fmt.Sprintf("/people/id/%d/signature", who.id), photo, nil)
	}
	name, _ := signatureOf(t, alice, a)

	var bobID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'bob'`).Scan(&bobID); err != nil {
		t.Fatal(err)
	}
	alice.mustDo("DELETE", "/admin/users/"+itoa(bobID), nil, http.StatusOK)
	if !inCovers(srv, name) {
		t.Fatal("deleting bob's account moved the file alice's signature names")
	}
	if got, _ := signatureOf(t, alice, a); got != name {
		t.Errorf("alice's signature is %q after bob's account went, want %q", got, name)
	}
}

// A SIGNATURE COMES BACK WITH A RESTORED BACKUP: the row says whose it is, and the
// archive carries the data directory, MediaCover included, so the file is in it.
//
// The decisive step is the restore: the signature is taken off first (its file goes
// with it, nothing else naming it), so what is there afterwards can only have come
// out of the archive.
func TestASignatureSurvivesABackupAndRestore(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	id := makePerson(t, admin, "Ursula Writer")
	if rec := postSignature(admin, fmt.Sprintf("/people/id/%d/signature", id), aSignaturePhoto(t), nil); rec.Code != 200 {
		t.Fatalf("save = %d: %s", rec.Code, rec.Body)
	}
	name, _ := signatureOf(t, admin, id)
	backupNow(admin)

	admin.mustDo("PUT", fmt.Sprintf("/people/id/%d", id), map[string]any{"clear_signature": true}, http.StatusOK)
	if got, _ := signatureOf(t, admin, id); got != "" || inCovers(srv, name) {
		t.Fatalf("before the restore: signature %q, file present %v; want none and gone", got, inCovers(srv, name))
	}

	safetyBackup(t, admin)
	admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)

	fresh := &testClient{t: t, h: h}
	lrec := fresh.do("POST", "/auth/login", map[string]string{"username": "alice", "password": "supersecret"})
	if lrec.Code != 200 {
		t.Fatalf("login after restore: %d %s", lrec.Code, lrec.Body)
	}
	fresh.cookie = cookieOf(t, lrec)

	if got, src := signatureOf(t, fresh, id); got != name || src != "manual" {
		t.Errorf("after the restore the person's signature is %q (%s), want %q (manual)", got, src, name)
	}
	if !inCovers(srv, name) {
		t.Errorf("after the restore the signature file %s is not in the cover store", name)
	}
	fresh.mustDo("GET", "/covers/"+name, nil, http.StatusOK)
}
