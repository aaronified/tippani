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

// The four text-size dials, and the bug this test was written for: they PUT
// fields the server did not have.
//
// encoding/json ignores what it does not recognise, so the request answered 200
// and stored nothing. The dial WORKED — the client applies a size before it asks,
// which is deliberate and right, so the type moved under your finger — and the
// setting was gone on the next load. A control that appears to work and silently
// forgets is worse than one that fails, because there is nothing to report.
func TestTextSizeDialsPersist(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	read := func() prefs {
		return decode[struct {
			Preferences prefs `json:"preferences"`
		}](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK)).Preferences
	}

	// NOT CHOSEN IS ZERO, and that is a correct set of preferences rather than a
	// missing one: the client renders 0 at 100%, so an upgrade that changed the
	// designed sizes still reaches a reader who has never touched a dial.
	if p := read(); p.SizeDisplay != 0 || p.SizeUI != 0 || p.SizeMono != 0 || p.SizeHand != 0 {
		t.Fatalf("a fresh account has sizes already set: %+v", p)
	}

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"sizeDisplay": 150, "sizeUi": 125, "sizeMono": 75, "sizeHand": 200,
	}, http.StatusOK)
	p := read()
	if p.SizeDisplay != 150 || p.SizeUI != 125 || p.SizeMono != 75 || p.SizeHand != 200 {
		t.Fatalf("the dials did not persist: %+v", p)
	}

	// One dial at a time, and the others hold — which is what tuning one kind of
	// text away from the global means.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"sizeUi": 175}, http.StatusOK)
	if p2 := read(); p2.SizeUI != 175 || p2.SizeDisplay != 150 || p2.SizeMono != 75 {
		t.Fatalf("a single-dial save disturbed the others: %+v", p2)
	}

	// An unrelated save leaves them alone.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"accent": "olive"}, http.StatusOK)
	if p3 := read(); p3.SizeDisplay != 150 {
		t.Fatalf("an unrelated save cleared a size: %+v", p3)
	}

	// 0 clears one back to the designed size.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"sizeDisplay": 0}, http.StatusOK)
	if p4 := read(); p4.SizeDisplay != 0 {
		t.Fatalf("an explicit clear left %d", p4.SizeDisplay)
	}

	// A CLOSED SET, unlike a face token. A face is open by design — the server has
	// no business knowing which typefaces exist — but a scaling factor is
	// arithmetic both sides have to agree about, and these are not positions the
	// dial has.
	for _, bad := range []any{137, 50, 250, -100, 101} {
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{"sizeMono": bad}, http.StatusBadRequest)
	}
	if p5 := read(); p5.SizeMono != 75 {
		t.Fatalf("a refused save changed the stored size: %+v", p5)
	}
}
