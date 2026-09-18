package httpapi

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

// THE DEFAULTS THE CLIENT COMPARES AGAINST ARE THE DEFAULTS THIS PACKAGE APPLIES.
//
// WHY THIS CONTRACT HAS TO BE TESTED AT ALL. `loadPrefs` fills in a default for
// anything unset and returns it, so what reaches the browser for a reader who has
// never opened Settings is `theme: "system"`, `accent: "terracotta"`, `srDaily: 8`
// and the rest — not an absent field. The information "they never set this" is
// destroyed here, on purpose, because every other consumer wants the effective
// value.
//
// Settings' changed-count needs the fact back. It holds the same table in
// `web/frontend/src/prefDefaults.json` and counts a preference as changed when it
// differs from it. Two copies of one fact is the shape this repository keeps
// pulling apart, and the copies cannot be collapsed — Go cannot import a React
// module and the browser cannot call loadPrefs — so the next best thing is a test
// that fails the moment they disagree.
//
// WHAT IT CAUGHT ON THE WAY IN. The count was first written to treat any non-zero
// value as "the reader set this", which made a freshly created account report
// "4 changed" on Theme and "4 changed" on Review — one for every field this
// function defaults. No test saw it; a screenshot did.
func TestClientPrefDefaultsMatchTheOnesApplied(t *testing.T) {
	raw, err := os.ReadFile("../../web/frontend/src/prefDefaults.json")
	if err != nil {
		t.Fatalf("reading the client's copy: %v", err)
	}
	var client map[string]any
	if err := json.Unmarshal(raw, &client); err != nil {
		t.Fatalf("the client's copy is not JSON: %v", err)
	}

	// A user who has never set anything: the stored blob is empty, so every field
	// here is one loadPrefs filled in.
	srv := newTestServer(t)
	_ = signupAdmin(t, srv.Handler())
	var uid int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users ORDER BY id LIMIT 1`).Scan(&uid); err != nil {
		t.Fatalf("finding the account: %v", err)
	}
	got, err := srv.loadPrefs(uid)
	if err != nil {
		t.Fatalf("loadPrefs: %v", err)
	}
	blob, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshalling defaults: %v", err)
	}
	var server map[string]any
	if err := json.Unmarshal(blob, &server); err != nil {
		t.Fatalf("unmarshalling defaults: %v", err)
	}

	for key, want := range client {
		have, ok := server[key]
		if !ok {
			t.Errorf("%s: the client has a default for a preference the server does not send", key)
			continue
		}
		if !reflect.DeepEqual(want, have) {
			t.Errorf("%s: client says %#v, a fresh account is served %#v", key, want, have)
		}
	}

	// AND THE OTHER DIRECTION, which is the one that rots quietly: a field this
	// package starts defaulting to something non-empty, with no entry on the
	// client, reads there as a value the reader chose — and puts a number on a tab
	// nobody has opened.
	for key, have := range server {
		if _, listed := client[key]; listed {
			continue
		}
		switch v := have.(type) {
		case string:
			if v != "" {
				t.Errorf("%s: the server defaults it to %q and the client has no entry for it", key, v)
			}
		case float64:
			if v != 0 {
				t.Errorf("%s: the server defaults it to %v and the client has no entry for it", key, v)
			}
		case bool:
			if v {
				t.Errorf("%s: the server defaults it to true and the client has no entry for it", key)
			}
		}
	}
}
