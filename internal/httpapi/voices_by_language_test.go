package httpapi

import (
	"strings"
	"testing"
)

type voicePrefs struct {
	Preferences struct {
		VoicesByLanguage string `json:"voicesByLanguage"`
		FontsByLanguage  string `json:"fontsByLanguage"`
	} `json:"preferences"`
}

// The read-aloud voice table is in the struct, the update and the response, or the picker looks saved and
// the next sign-in has no voice. It round-trips, keys are folded to lower case, an empty name is dropped,
// and clearing it is a real request that leaves the neighbouring table alone.
func TestTheVoiceTableRoundTripsThroughPreferences(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"fontsByLanguage":  `{"German":"literata"}`,
		"voicesByLanguage": `{"BN":"Microsoft Heera","pt-BR":"Luciana","en":"  "}`,
	}, 200)
	p := decode[voicePrefs](t, c.mustDo("GET", "/auth/me", nil, 200)).Preferences
	if !strings.Contains(p.VoicesByLanguage, `"bn":"Microsoft Heera"`) || !strings.Contains(p.VoicesByLanguage, `"pt-br":"Luciana"`) {
		t.Fatalf("the voice table did not survive, or its keys were not folded: %q", p.VoicesByLanguage)
	}
	if strings.Contains(p.VoicesByLanguage, `"en"`) {
		t.Fatalf("an empty voice name was stored: %q", p.VoicesByLanguage)
	}

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"voicesByLanguage": ""}, 200)
	p = decode[voicePrefs](t, c.mustDo("GET", "/auth/me", nil, 200)).Preferences
	if p.VoicesByLanguage != "" {
		t.Fatalf("clearing left %q behind", p.VoicesByLanguage)
	}
	if p.FontsByLanguage == "" {
		t.Fatal("clearing the voices cleared the type table")
	}
}

// A malformed table is a 400, not a silent drop: it is a client sending something it invented.
func TestAMalformedVoiceTableIsA400(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	for _, bad := range []string{
		`not json`,
		`{"not a code":"Heera"}`,
		`{"bn":"` + strings.Repeat("x", 201) + `"}`,
	} {
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{"voicesByLanguage": bad}, 400)
	}
	many := map[string]string{}
	for i := 0; i < 65; i++ {
		many[string(rune('a'+i%26))+string(rune('a'+i/26))+"x"] = "v"
	}
	raw := "{"
	n := 0
	for k := range many {
		if n > 0 {
			raw += ","
		}
		raw += `"` + k + `":"v"`
		n++
	}
	raw += "}"
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"voicesByLanguage": raw}, 400)
}
