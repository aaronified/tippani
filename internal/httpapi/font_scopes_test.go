package httpapi

import (
	"encoding/json"
	"strings"
	"testing"
)

// THE TWO TYPE TABLES, STORED.
//
// WHAT IS WORTH TESTING HERE IS THE SAME THING text_order_test.go tests: not that
// a valid blob survives, but what gets DROPPED and what gets REFUSED. Both tables
// exist to make "has this reader chosen anything" answerable, and a normaliser
// that stores an empty entry, or a locale row with nothing in it, makes that
// question unanswerable in a way no screen can show.
//
// AND THE ONE THING BOTH TABLES MUST NEVER DO is accept a key or a role this
// server cannot spell. A face token that is stored but unresolvable is a face
// nobody can see and nobody can clear.

func TestQuoteFacesRefuseATokenThisServerCannotSpell(t *testing.T) {
	// Refused rather than dropped, the rule normalizeTextOrder follows: a value
	// this server cannot spell is a client sending something it invented.
	for _, raw := range []string{
		`{"german":"Literata Regular"}`, // spaces are not a slug
		`{"german":"‹script›"}`,         // nor is anything outside the token set
		`["german"]`,                    // not an object at all
	} {
		if _, ok := normalizeFontsByLanguage(raw); ok {
			t.Errorf("%s was accepted", raw)
		}
	}
}

func TestLocaleFacesKeepOneLocalesPartialAnswer(t *testing.T) {
	got, ok := normalizeFontsByLocale(`{"BN":{"display":"tiro-bangla","displayStyle":"italic,bold"}}`)
	if !ok {
		t.Fatal("a valid overlay was refused")
	}
	var out map[string]map[string]string
	if err := json.Unmarshal([]byte(got), &out); err != nil {
		t.Fatalf("the stored blob does not parse: %v", err)
	}
	// NormalizeCode is the whole of the check on the key — design §4, the same
	// rule the Locale field itself follows.
	row, has := out["bn"]
	if !has {
		t.Fatalf("the locale code was not normalised: %v", out)
	}
	if row["display"] != "tiro-bangla" {
		t.Errorf("display = %q, want tiro-bangla", row["display"])
	}
	// The style list is sorted so one selection has one spelling, exactly as the
	// flat fields are — see normalizeFontStyles.
	if row["displayStyle"] != "bold,italic" {
		t.Errorf("displayStyle = %q, want bold,italic", row["displayStyle"])
	}
	// AND ONLY WHAT IT SAID DIFFERENTLY. A partial is the point: the five roles
	// this locale never touched must keep following the flat fields, and an
	// overlay that filled them in would freeze them at today's built-ins.
	if len(row) != 2 {
		t.Errorf("the overlay gained entries nobody set: %v", row)
	}
}

func TestLocaleFacesRefuseARoleThisServerDoesNotHave(t *testing.T) {
	// The one mistake a client can make here that a reader would never see: the
	// picker looks saved, the interface does not change, and nothing says why.
	for _, raw := range []string{
		`{"bn":{"heading":"literata"}}`,       // no such role
		`{"bn":{"headingStyle":"bold"}}`,      // nor a style for one
		`{"bn":{"display":"a b"}}`,            // not a token
		`{"bn":{"displayStyle":"underline"}}`, // not a modifier the client offers
		`{"":{"display":"literata"}}`,         // not a locale code
	} {
		if _, ok := normalizeFontsByLocale(raw); ok {
			t.Errorf("%s was accepted", raw)
		}
	}
}

func TestBothTablesReadAsNothingRatherThanFailingALogin(t *testing.T) {
	// loadPrefs' direction of failure: a blob already in the database that this
	// cannot read reads as no per-language type at all. A preference about fonts
	// must never be able to stop an account from opening.
	p := prefs{FontsByLanguage: `{"german":"a b"}`, FontsByLocale: `not json`}
	if v, ok := normalizeFontsByLanguage(p.FontsByLanguage); ok || v != "" {
		t.Errorf("a corrupt quote table normalised to %q ok=%v", v, ok)
	}
	if v, ok := normalizeFontsByLocale(p.FontsByLocale); ok || v != "" {
		t.Errorf("a corrupt locale table normalised to %q ok=%v", v, ok)
	}
}

// ---- and through the door a client actually uses ---------------------------
//
// THE NORMALISERS ABOVE CAN ALL BE RIGHT while the preference never reaches the
// browser, and that failure is silent in exactly the way a test is for: the PUT
// answers 200, the picker looks saved, and the next login has no per-language
// type because the field was never in the struct, or never in the response.

type fontScopePrefs struct {
	Preferences struct {
		FontsByLanguage string `json:"fontsByLanguage"`
		FontsByLocale   string `json:"fontsByLocale"`
	} `json:"preferences"`
}

func TestTheTwoTypeTablesRoundTripThroughPreferences(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"fontsByLanguage": `{"German":"literata"}`,
		"fontsByLocale":   `{"bn":{"ui":"hind-siliguri"}}`,
	}, 200)

	p := decode[fontScopePrefs](t, c.mustDo("GET", "/auth/me", nil, 200)).Preferences
	if !strings.Contains(p.FontsByLanguage, `"german":"literata"`) {
		t.Fatalf("the quote table did not survive: %q", p.FontsByLanguage)
	}
	if !strings.Contains(p.FontsByLocale, `"hind-siliguri"`) {
		t.Fatalf("the locale overlay did not survive: %q", p.FontsByLocale)
	}

	// AND CLEARING IS A REAL REQUEST, which is why both fields are pointers in the
	// PUT input: "" has to be distinguishable from "not sent".
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"fontsByLanguage": ""}, 200)
	p = decode[fontScopePrefs](t, c.mustDo("GET", "/auth/me", nil, 200)).Preferences
	if p.FontsByLanguage != "" {
		t.Fatalf("clearing left %q behind", p.FontsByLanguage)
	}
	if p.FontsByLocale == "" {
		t.Fatal("clearing one table cleared the other")
	}
}

func TestAnInventedRoleIsA400RatherThanASilentDrop(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/auth/me/preferences",
		map[string]any{"fontsByLocale": `{"bn":{"heading":"literata"}}`}, 400)
	c.mustDo("PUT", "/auth/me/preferences",
		map[string]any{"fontsByLanguage": `{"german":"not a token"}`}, 400)
}
