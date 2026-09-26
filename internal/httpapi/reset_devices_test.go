package httpapi

import (
	"net/http"
	"testing"
)

// A PHONE CAN BE PAIRED AFTER A FACTORY RESET, AND AFTER A REINDEX THAT HAD TO
// RECOVER. Both swap the database handle, and both repointed the session store at
// the new one and left the device-token store on the closed old handle, so every
// pairing and every phone's request after them failed until a restart. The
// restore path already repointed both, through rebindDB.
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
