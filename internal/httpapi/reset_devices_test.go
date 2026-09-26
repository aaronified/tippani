package httpapi

import (
	"net/http"
	"os"
	"testing"
)

// A PHONE CAN BE PAIRED AFTER A FACTORY RESET. A reset swaps the database handle,
// and the handler repointed the session store at the new one and left the
// device-token store on the closed old handle, so pairing a phone after it failed
// until a restart. (Phones paired before a reset lose their tokens with the
// database, restart or not.) The restore path already repointed both, through
// rebindDB.
//
// THE REINDEX HALF OF THE SAME FIX IS NOT EXERCISED HERE. A search reindex swaps
// the handle only when it has to escalate to a whole-database Recover, which
// needs an FTS index damaged past rebuilding in place, and there is no route or
// fixture that produces that on purpose. The handler calls the same rebindDB.
//
// WHAT IT KNOWS: nothing past the routes. It resets, onboards again, pairs a phone
// through the pairing routes a phone uses, and reads with its token.
func TestAPhoneCanBePairedAfterAFactoryReset(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	safetyBackup(t, admin)
	admin.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusOK)

	fresh := signupAdmin(t, h)
	code := startPairing(t, fresh).Code
	rec := claim(t, h, code, "alice's Pixel")
	if rec.Code != http.StatusCreated {
		t.Fatalf("claiming a pairing code after a factory reset: got %d %s", rec.Code, rec.Body)
	}
	phone := &testClient{t: t, h: h, bearer: decode[claimResp](t, rec).Token}
	phone.mustDo("GET", "/books", nil, http.StatusOK)
}

// A PAIRING CODE MINTED BEFORE A FACTORY RESET DOES NOT OUTLIVE IT. A code is a
// credential for the account that minted it, held by user id, and the admin who
// onboards the emptied server gets that id again: a code that survived would pair
// a phone to them.
func TestAPairingCodeFromBeforeAFactoryResetIsRefused(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	stale := startPairing(t, admin).Code
	safetyBackup(t, admin)
	admin.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusOK)
	signupAdmin(t, h)
	if rec := claim(t, h, stale, "someone else's phone"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("a pairing code minted before the reset was claimed after it: got %d %s, want 401", rec.Code, rec.Body)
	}
}

// A FACTORY RESET THAT FAILS PARTWAY STILL LEAVES SIGN-IN WORKING. Reset closes
// the database before it deletes anything, and a delete it cannot make reopens
// the existing file, so the auth stores have to be repointed on that exit too, or
// every session answers 401 against a closed handle until a restart. And the
// pairing codes minted before it are gone even so.
//
// WHAT IT KNOWS, declared: the server's data directory (srv.DataDir), which it
// makes unwritable so the reset's delete fails. Nothing a reader can do makes a
// reset fail halfway. Root deletes from a directory it cannot write, so the case
// skips there.
func TestAFailedFactoryResetLeavesSignInWorking(t *testing.T) {
	if os.Getuid() == 0 {
		t.Skip("root deletes from a directory it cannot write, so the reset would not fail")
	}
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	stale := startPairing(t, admin).Code
	safetyBackup(t, admin)
	if err := os.Chmod(srv.DataDir, 0o500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.Chmod(srv.DataDir, 0o700) })
	admin.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusInternalServerError)
	if err := os.Chmod(srv.DataDir, 0o700); err != nil {
		t.Fatal(err)
	}
	admin.mustDo("GET", "/books", nil, http.StatusOK)
	if rec := claim(t, h, stale, "someone's phone"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("a pairing code minted before a failed reset was claimed after it: got %d %s, want 401", rec.Code, rec.Body)
	}
}

// A PAIRING CODE MINTED BEFORE A RESTORE DOES NOT OUTLIVE IT, for the same reason
// as a reset: the restored database gives account ids out again, and a code is
// held by id.
func TestAPairingCodeFromBeforeARestoreIsRefused(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	backupNow(admin)
	stale := startPairing(t, admin).Code
	safetyBackup(t, admin)
	admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)
	if rec := claim(t, h, stale, "someone else's phone"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("a pairing code minted before a restore was claimed after it: got %d %s, want 401", rec.Code, rec.Body)
	}
}
