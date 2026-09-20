package httpapi

import (
	"net/http"
	"testing"
)

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

func TestResettingRefusesAnEmptyOrOversizedKeyList(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	c.mustDo("POST", "/auth/me/preferences/reset",
		map[string]any{"keys": []string{}}, http.StatusBadRequest)

	many := make([]string, 101)
	for i := range many {
		many[i] = "srTier"
	}
	c.mustDo("POST", "/auth/me/preferences/reset",
		map[string]any{"keys": many}, http.StatusBadRequest)
}
