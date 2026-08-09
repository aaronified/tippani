package httpapi

import (
	"net/http"
	"testing"
)

// Who can take admin rights away from whom.
//
// The rule is asymmetric on purpose: GRANTING is something you do to others,
// REVOKING is something you do to yourself. Without that, admin is not a role
// but a race — two admins, and whichever opens the page first is the only one
// left. There is no seniority here to appeal to, no founder flag, no audit
// trail, and nothing to undo it with once your own rights are gone.
//
// None of this is enforceable in the UI. Hiding a button is a courtesy to the
// person who was not going to press it; the request is four words of curl, and
// the account it demotes is the one that could have stopped it.

// adminOf promotes an existing member and returns their session, which is the
// supported route to a second admin: no fixture writes is_admin directly,
// because a rule about who may promote whom is worth exercising through the
// endpoint that enforces it.
func promote(t *testing.T, by *testClient, id int64) {
	t.Helper()
	by.mustDo("PATCH", "/admin/users/"+itoa(id), map[string]bool{"is_admin": true}, 200)
}

func userIDNamed(t *testing.T, c *testClient, name string) int64 {
	t.Helper()
	users := decode[struct {
		Users []userRow `json:"users"`
	}](t, c.mustDo("GET", "/admin/users", nil, 200))
	for _, u := range users.Users {
		if u.Username == name {
			return u.ID
		}
	}
	t.Fatalf("no user named %q", name)
	return 0
}

func TestAnAdminCannotRevokeAnotherAdmin(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	bobID := userIDNamed(t, alice, "bob")

	// Promoting a member is the half that stays allowed.
	promote(t, alice, bobID)
	bob.mustDo("GET", "/admin/users", nil, 200)

	// Neither direction, and it is worth asserting BOTH: a rule written as
	// "the first admin is protected" would pass one of these.
	aliceID := userIDNamed(t, alice, "alice")
	alice.mustDo("PATCH", "/admin/users/"+itoa(bobID), map[string]bool{"is_admin": false}, http.StatusForbidden)
	bob.mustDo("PATCH", "/admin/users/"+itoa(aliceID), map[string]bool{"is_admin": false}, http.StatusForbidden)

	// And the refusal is a refusal, not a 200 that did nothing.
	if !isAdminNow(t, srv, bobID) {
		t.Fatal("bob lost his rights to a request that was refused")
	}
	if !isAdminNow(t, srv, aliceID) {
		t.Fatal("alice lost her rights to a request that was refused")
	}
}

func TestAnAdminCanStepDownWhileAnotherRemains(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	bobID := userIDNamed(t, alice, "bob")
	aliceID := userIDNamed(t, alice, "alice")
	promote(t, alice, bobID)

	// The handover, which must still work end to end — the point of the rule is
	// to stop one person doing both halves, not to freeze the roster.
	alice.mustDo("PATCH", "/admin/users/"+itoa(aliceID), map[string]bool{"is_admin": false}, 200)
	alice.mustDo("GET", "/admin/users", nil, http.StatusForbidden)
	bob.mustDo("GET", "/admin/users", nil, 200)
}

func TestTheLastAdminCannotStepDown(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	aliceID := userIDNamed(t, alice, "alice")

	// 409, not 403: this one IS about the state of the instance, and the same
	// request succeeds the moment there is a second admin.
	alice.mustDo("PATCH", "/admin/users/"+itoa(aliceID), map[string]bool{"is_admin": false}, http.StatusConflict)
	if !isAdminNow(t, srv, aliceID) {
		t.Fatal("the instance lost its last admin")
	}
}

func TestAnAdminCannotBeDeletedByAnother(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	addUser(t, h, alice, "bob")
	bobID := userIDNamed(t, alice, "bob")

	// A member is deletable — the guard must not have swallowed the ordinary case.
	carol := addUser(t, h, alice, "carol")
	_ = carol
	carolID := userIDNamed(t, alice, "carol")
	alice.mustDo("DELETE", "/admin/users/"+itoa(carolID), nil, 200)

	// An admin is not, and this is the bypass the revoke rule needs closed:
	// refusing to take someone's rights while allowing their whole account to be
	// removed protects nothing at all.
	promote(t, alice, bobID)
	alice.mustDo("DELETE", "/admin/users/"+itoa(bobID), nil, http.StatusForbidden)
	if !isAdminNow(t, srv, bobID) {
		t.Fatal("bob was removed by a request that was refused")
	}
}

// isAdminNow reads the flag straight out of the database. Asserting on the
// response alone would pass for a handler that refuses loudly and updates
// anyway — which is the one failure this whole file exists to catch.
func isAdminNow(t *testing.T, srv *Server, id int64) bool {
	t.Helper()
	var v bool
	if err := srv.Store.DB.QueryRow(`SELECT is_admin FROM users WHERE id = ?`, id).Scan(&v); err != nil {
		t.Fatalf("read is_admin for %d: %v", id, err)
	}
	return v
}
