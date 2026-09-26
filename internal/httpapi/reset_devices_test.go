package httpapi

import (
	"net/http"
	"testing"
)

// A PHONE CAN BE PAIRED AFTER A FACTORY RESET. A reset swaps the database handle,
// and the handler repointed the session store at the new one and left the
// device-token store on the closed old handle, so every pairing and every phone's
// request after it failed until a restart. The restore path already repointed
// both, through rebindDB.
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
