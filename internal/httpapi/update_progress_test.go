package httpapi

// WHERE THE APPLY GOT TO — the record, and the failure it exists to make visible.
//
// The reported bug, in the owner's words: "the page gets stuck on this message,
// and the app is not even posting any update command on the docker shell." Two
// earlier fixes to this screen shipped and neither touched it, because nothing in
// the app could say WHICH of the four steps had stopped: the apply pulls two
// images before it writes a byte, the server's write timeout is sixty seconds, so
// on any real connection the answer never arrives and the browser is left with no
// status at all. It guessed "probably running" for every failure alike.
//
// So these pin the two claims the page now depends on:
//
//   1. the record names the step the apply was ABOUT to attempt, so a record that
//      stops names the thing that did not come back;
//   2. a failure carries the Engine's own words, because "a Docker call failed"
//      is not something an operator can act on.

import (
	"net/http"
	"testing"
)

// state reads the endpoint the page polls.
func updateState(t *testing.T, c *testClient) map[string]any {
	t.Helper()
	return decode[map[string]any](t, c.mustDo("GET", "/admin/update/state", nil, 200))
}

func TestUpdateProgressRecordsEveryStep(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	fake := &fakeDocker{avail: true, name: "tippani", image: "ghcr.io/aaronified/tippani:latest"}
	srv.newDocker = func() UpdateDocker { return fake }

	// NOTHING YET is an answer, not a 404. "There has never been an update on
	// this box" is a thing the page draws.
	if got := updateState(t, c); got["attempted"] != false {
		t.Fatalf("a box that has never updated: %+v", got)
	}

	c.mustDo("POST", "/admin/update/apply", map[string]any{"confirm": "UPDATE"}, 200)

	got := updateState(t, c)
	if got["attempted"] != true {
		t.Fatalf("apply left no record: %+v", got)
	}
	if got["phase"] != updatePhaseLaunched {
		t.Fatalf("phase = %v, want %q — the recreater ran, so that is where it got to", got["phase"], updatePhaseLaunched)
	}
	// What it was working ON, which is half of what makes a stalled record
	// readable: a phase without an image says "pulling" and not "pulling what".
	if got["image"] != "ghcr.io/aaronified/tippani:latest" || got["container"] != "tippani" {
		t.Fatalf("record does not name the work: %+v", got)
	}
	if got["error"] != "" {
		t.Fatalf("a launched apply recorded an error: %+v", got["error"])
	}
	// The version answering RIGHT NOW rides along, so the page asks "is it back
	// yet" and "what did it do" in one request and the two cannot disagree.
	if got["current"] == nil || got["current"] == "" {
		t.Fatalf("no current version in the state reply: %+v", got)
	}
	if got["user"] != "alice" {
		t.Fatalf("user = %v, want the admin who pressed it", got["user"])
	}
}

func TestUpdateStateIsAdminOnly(t *testing.T) {
	// The record names an image, a container and an Engine error — the operator's
	// own deployment, and nobody else's business.
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	srv.newDocker = func() UpdateDocker { return &fakeDocker{avail: false} }
	bob := addUser(t, h, admin, "bob")
	bob.mustDo("GET", "/admin/update/state", nil, http.StatusForbidden)
}
