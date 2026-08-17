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

		// ---- the 1.15.x shape, which every existing account still stores -----
		//
		// A bare string is the whole entry. There is no migration step for a
		// per-user preference string, so this is read forever: an account that had
		// set a mark would otherwise open Settings to find it gone.
		{"a legacy bare mark becomes an object", `{"Bengali":"🇧🇩"}`, `{"bengali":{"m":"🇧🇩"}}`, true},
		// The key folds: the board form seeds a free-text field, so both spellings
		// arrive, and two entries for one language is a mark that depends on how it
		// was typed.
		{"names fold", `{"BENGALI":"অ","bengali":"অ"}`, `{"bengali":{"m":"অ"}}`, true},
		// Stable output, or prefs compare unequal to themselves and every save looks
		// like a change.
		{"keys sort", `{"urdu":"ی","bengali":"অ"}`, `{"bengali":{"m":"অ"},"urdu":{"m":"ی"}}`, true},
		// An empty mark means "back to the script letter", and the absence IS the
		// default — so it is dropped rather than stored as "".
		{"empty mark drops", `{"bengali":""}`, "", true},
		// Both shapes in one blob, which is what a browser refresh across the
		// upgrade actually produces.
		{"mixed shapes in one blob", `{"hindi":"अ","bengali":{"m":"ক"}}`,
			`{"bengali":{"m":"ক"},"hindi":{"m":"अ"}}`, true},

		// ---- the 1.16.0 shape -----------------------------------------------
		{"customs survive in order", `{"bengali":{"m":"ক","c":["✦","🌙"]}}`,
			`{"bengali":{"m":"ক","c":["✦","🌙"]}}`, true},
		{"a rename survives on its own", `{"bengali":{"n":"বাংলা"}}`, `{"bengali":{"n":"বাংলা"}}`, true},
		// A name that folds to its own key is KEPT here, and the reason is the bug
		// an earlier draft shipped: for a language the reader added, the key is the
		// folded name and the display name is the only record of what they typed, so
		// dropping it deleted the language on the next save. Whether a name is
		// redundant needs the starter list, which is a client concept.
		{"a name that folds to its key is the client's business", `{"bengali":{"n":"Bengali"}}`,
			`{"bengali":{"n":"Bengali"}}`, true},
		{"an added language keeps the capitals it was typed with", `{"yoruba":{"n":"Yoruba"}}`,
			`{"yoruba":{"n":"Yoruba"}}`, true},
		{"an entry with nothing in it drops", `{"bengali":{}}`, "", true},
		{"duplicate customs collapse", `{"bengali":{"c":["✦","✦"]}}`, `{"bengali":{"c":["✦"]}}`, true},
		{"a blank custom is skipped, not stored", `{"bengali":{"m":"ক","c":["","✦"]}}`,
			`{"bengali":{"m":"ক","c":["✦"]}}`, true},

		{"not JSON", `bengali=flag`, "", false},
		{"not an object", `["bengali"]`, "", false},
		{"a mark that is a sentence", `{"bengali":"the language of Bengal"}`, "", false},
		{"a control character", "{\"bengali\":\"\"}", "", false},
		{"an empty name", `{"":"অ"}`, "", false},
		{"an entry that is neither shape", `{"bengali":42}`, "", false},
		// The bound is why the whole blob stays small, and it is refused rather than
		// truncated: silently dropping the fifth mark somebody just added looks
		// exactly like the save not working.
		{"a fifth custom is refused", `{"bengali":{"c":["1","2","3","4","5"]}}`, "", false},
		{"a custom that is a sentence", `{"bengali":{"c":["the language of Bengal"]}}`, "", false},
		{"a display name that is a paragraph",
			`{"bengali":{"n":"the language spoken either side of a border, and in its diaspora too"}}`, "", false},
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
	once, _ := normalizeLanguageMarks(`{"Urdu":"🇵🇰","bengali":{"m":"অ","c":["✦"]},"HINDI":{"n":"हिन्दी"}}`)
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
	if got := read(); got != `{"bengali":{"m":"🇧🇩"}}` {
		t.Fatalf("after save, languageMarks = %q", got)
	}

	// A PUT about something else must not clear it — the failure every partial
	// merge in this file exists to prevent.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"accent": "olive"}, http.StatusOK)
	if got := read(); got != `{"bengali":{"m":"🇧🇩"}}` {
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
