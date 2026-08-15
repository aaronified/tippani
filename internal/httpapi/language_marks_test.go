package httpapi

// languageMarks — the mark a proverb card wears instead of a face.
//
// It is one string holding JSON, which is the shape most likely to rot quietly:
// the field round-trips through a login, a partial PUT must not clear it, and a
// blob that got corrupted must not lock somebody out of their own account.

import (
	"net/http"
	"testing"
)

func TestLanguageMarksNormalise(t *testing.T) {
	cases := []struct {
		name, in, want string
		ok             bool
	}{
		{"empty stays empty", "", "", true},
		{"blank stays empty", "   ", "", true},
		{"one mark", `{"Bengali":"🇧🇩"}`, `{"bengali":"🇧🇩"}`, true},
		// The key folds: the board form seeds a free-text field, so both
		// spellings arrive, and two entries for one language is a mark that
		// depends on how it was typed.
		{"names fold", `{"BENGALI":"অ","bengali":"অ"}`, `{"bengali":"অ"}`, true},
		// Stable output, or prefs compare unequal to themselves and every save
		// looks like a change.
		{"keys sort", `{"urdu":"ی","bengali":"অ"}`, `{"bengali":"অ","urdu":"ی"}`, true},
		// An empty mark means "back to the script letter", and the absence IS
		// the default — so it is dropped rather than stored as "".
		{"empty mark drops", `{"bengali":""}`, "", true},
		{"a subdivision flag fits", `{"scots":"🏴󠁧󠁢󠁳󠁣󠁴󠁿"}`, `{"scots":"🏴󠁧󠁢󠁳󠁣󠁴󠁿"}`, true},

		{"not JSON", `bengali=flag`, "", false},
		{"not an object", `["bengali"]`, "", false},
		{"a mark that is a sentence", `{"bengali":"the language of Bengal"}`, "", false},
		{"a control character", "{\"bengali\":\"\"}", "", false},
		{"an empty name", `{"":"অ"}`, "", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, ok := normalizeLanguageMarks(c.in)
			if ok != c.ok {
				t.Fatalf("normalizeLanguageMarks(%q) ok = %v, want %v", c.in, ok, c.ok)
			}
			if ok && got != c.want {
				t.Fatalf("normalizeLanguageMarks(%q) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}

// The blob is stable through a round trip, which is what the sorted marshalling
// is for: normalising an already-normal value must be a no-op, or every read
// would rewrite the row.
func TestLanguageMarksRoundTripIsStable(t *testing.T) {
	once, _ := normalizeLanguageMarks(`{"Urdu":"🇵🇰","bengali":"অ","HINDI":"अ"}`)
	twice, ok := normalizeLanguageMarks(once)
	if !ok || twice != once {
		t.Fatalf("re-normalising moved the value: %q then %q", once, twice)
	}
}

func TestLanguageMarksSurviveALoginAndAPartialSave(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"languageMarks": `{"Bengali":"🇧🇩"}`,
	}, http.StatusOK)

	read := func() string {
		me := decode[struct {
			Preferences struct {
				LanguageMarks string `json:"languageMarks"`
			} `json:"preferences"`
		}](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK))
		return me.Preferences.LanguageMarks
	}
	if got := read(); got != `{"bengali":"🇧🇩"}` {
		t.Fatalf("after save, languageMarks = %q", got)
	}

	// A PUT about something else must not clear it — the failure every partial
	// merge in this file exists to prevent.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"accent": "olive"}, http.StatusOK)
	if got := read(); got != `{"bengali":"🇧🇩"}` {
		t.Fatalf("an unrelated save cleared the marks: %q", got)
	}

	// And an explicit empty string DOES clear them, because "back to the script
	// letters" has to be sayable.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"languageMarks": ""}, http.StatusOK)
	if got := read(); got != "" {
		t.Fatalf("an explicit clear left %q", got)
	}
}

func TestLanguageMarksRefusesWhatItCannotStore(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	for _, bad := range []string{`not json`, `["a"]`, `{"bengali":"an entire sentence about it"}`} {
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{"languageMarks": bad}, http.StatusBadRequest)
	}
}
