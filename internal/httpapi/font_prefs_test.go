package httpapi

import (
	"net/http"
	"testing"
)

func TestFontTokenNormalisation(t *testing.T) {
	for _, c := range []struct {
		in   string
		want string
		ok   bool
	}{
		{"", "", true},
		{"Source-Serif-4", "source-serif-4", true},
		{" literata ", "literata", true},
		{"upload:12", "upload:12", true},
		{"a font name", "", false},
		{"drop table;", "", false},
	} {
		got, ok := normalizeFontToken(c.in)
		if ok != c.ok || (ok && got != c.want) {
			t.Errorf("normalizeFontToken(%q) = %q,%v want %q,%v", c.in, got, ok, c.want, c.ok)
		}
	}
}

func TestFontStyleNormalisation(t *testing.T) {
	for _, c := range []struct {
		in   string
		want string
		ok   bool
	}{
		{"", "", true},
		// Sorted, so one selection has one spelling — otherwise every round trip
		// of "italic,bold" looks like a change.
		{"italic,bold", "bold,italic", true},
		{"bold, italic", "bold,italic", true},
		{"BOLD", "bold", true},
		{"bold,bold", "bold", true},
		// Refused rather than dropped: a silently discarded modifier is a switch
		// that flips itself off with no message.
		{"bold,neon", "", false},
		// Asked for, and deliberately not a token — no CSS makes a proportional
		// face monospaced, so this could only lie.
		{"monospace", "", false},
	} {
		got, ok := normalizeFontStyles(c.in)
		if ok != c.ok || (ok && got != c.want) {
			t.Errorf("normalizeFontStyles(%q) = %q,%v want %q,%v", c.in, got, ok, c.want, c.ok)
		}
	}
}

func TestFontPrefsSurviveAPartialSave(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"fontDisplay": "literata", "fontDisplayStyle": "italic,bold", "fontBengali": "hind-siliguri",
	}, http.StatusOK)

	read := func() prefs {
		return decode[struct {
			Preferences prefs `json:"preferences"`
		}](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK)).Preferences
	}
	p := read()
	if p.FontDisplay != "literata" || p.FontDisplayStyle != "bold,italic" || p.FontBengali != "hind-siliguri" {
		t.Fatalf("after save: %+v", p)
	}

	// A PUT about something else must not clear the type.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"accent": "olive"}, http.StatusOK)
	if p2 := read(); p2.FontDisplay != "literata" || p2.FontDisplayStyle != "bold,italic" {
		t.Fatalf("an unrelated save cleared the type: %+v", p2)
	}

	// And an explicit empty string puts a role back to the built-in.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"fontDisplay": ""}, http.StatusOK)
	if p3 := read(); p3.FontDisplay != "" {
		t.Fatalf("an explicit clear left %q", p3.FontDisplay)
	}

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"fontMono": "a font name"}, http.StatusBadRequest)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"fontMonoStyle": "monospace"}, http.StatusBadRequest)
}
