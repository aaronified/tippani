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

// RESETTING A SECTION PUTS IT BACK, AND THE NEXT LOAD AGREES.
//
// WHAT THIS GUARDS, AND IT SHIPPED BROKEN. Settings' "Reset section" wrote
// through the ordinary preferences PUT, sending "" for every key in the section.
// That route's convention is that an empty value means "leave this alone", so
// six of the ten review keys were silently skipped — and the other four could not
// unmarshal from a string at all (`srSeen` is a float; `srPracticeCounts`,
// `srLadder` and `srSubmit` are bools), so the request was rejected whole and the
// six were not written either. The reader watched every row return to its default
// and the next load brought all of it back.
//
// THE ASSERTION IS THE SECOND READ, not the response code. A reset that answers
// 200 and changes nothing is exactly the bug that was there.
func TestResettingASectionRestoresItsDefaults(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	// Move the whole review section off its defaults — one of each shape, because
	// the shapes are what the old route choked on.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srDaily":          20,
		"srTier":           "hard",
		"srReviewScope":    "books",
		"srSeen":           1.4,
		"srPracticeCounts": true,
		"srSubmit":         true,
	}, 200)

	if p := getPrefs(t, c); p.SRDaily != 20 || p.SRTier != "hard" || !p.SRPracticeCounts {
		t.Fatalf("the section never moved off its defaults, so the reset proves nothing: %+v", p)
	}

	c.mustDo("POST", "/auth/me/preferences/reset", map[string]any{
		"keys": []string{
			"srDaily", "srReviewScope", "srQuestions", "srTuning", "srSeen",
			"srPracticeCounts", "srLadder", "srTier", "srStart", "srSubmit",
		},
	}, 200)

	p := getPrefs(t, c)
	if p.SRDaily != reviewQuota {
		t.Errorf("srDaily is %d, want the default %d", p.SRDaily, reviewQuota)
	}
	if p.SRTier != tierMedium {
		t.Errorf("srTier is %q, want the default %q", p.SRTier, tierMedium)
	}
	if p.SRReviewScope != "both" {
		t.Errorf("srReviewScope is %q, want the default %q", p.SRReviewScope, "both")
	}
	if p.SRSeen != reviewSeen {
		t.Errorf("srSeen is %v, want the default %v", p.SRSeen, reviewSeen)
	}
	if p.SRPracticeCounts {
		t.Error("srPracticeCounts is still on")
	}
	if p.SRSubmit {
		t.Error("srSubmit is still on")
	}
}

// A RESET REACHES ONLY THE KEYS IT NAMES. The section rail hands this route one
// section's list; a reset of Review that also cleared the reader's theme would be
// the worst kind of working button.
func TestResettingASectionLeavesTheOthersAlone(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"theme": "dark", "accent": "ochre", "srTier": "hard",
	}, 200)

	c.mustDo("POST", "/auth/me/preferences/reset", map[string]any{
		"keys": []string{"srTier"},
	}, 200)

	p := getPrefs(t, c)
	if p.SRTier != tierMedium {
		t.Errorf("the named key did not reset: srTier is %q", p.SRTier)
	}
	if p.Theme != "dark" || p.Accent != "ochre" {
		t.Errorf("the reset reached past the keys it was given: theme %q, accent %q", p.Theme, p.Accent)
	}
}
