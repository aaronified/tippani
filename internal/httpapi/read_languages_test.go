package httpapi

// THE DECLARATION, AS THE SERVER KEEPS IT.
//
// It decides which of a quote's two texts a card puts in the big type, so what is
// worth pinning is the round trip: what a reader typed comes back as one stable
// blob whatever order or case they typed it in, and a blob the server cannot read
// means "no declaration" rather than "I read nothing" — because the second reading
// would reorder every card in the library for a preference nobody expressed.

import (
	"net/http"
	"testing"
)

func TestTheDeclarationFoldsDedupesAndSorts(t *testing.T) {
	cases := []struct {
		name, in, want string
		ok             bool
	}{
		{"nothing declared stays nothing", "", "", true},
		{"one language", `["Bengali"]`, `["bengali"]`, true},
		// FOLDED, because the language box is free text and both spellings arrive —
		// language_marks.go folds its keys the same way and for the same reason.
		{"case folds", `["Bengali","bengali","BENGALI"]`, `["bengali"]`, true},
		{"whitespace folds", `["  French  "]`, `["french"]`, true},
		// SORTED, so adding a language and removing it again produces the same
		// bytes and a diff of two accounts' preferences means something.
		{"sorted", `["urdu","bengali","french"]`, `["bengali","french","urdu"]`, true},
		{"an empty array is a withdrawal", `[]`, "", true},
		{"a blank entry is not a language", `["  "]`, "", false},
		{"not an array", `{"bengali":true}`, "", false},
		{"not JSON", `bengali`, "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := normalizeReadLanguages(tc.in)
			if ok != tc.ok {
				t.Fatalf("normalizeReadLanguages(%q) ok=%v, want %v (got %q)", tc.in, ok, tc.ok, got)
			}
			if got != tc.want {
				t.Errorf("normalizeReadLanguages(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

// AND AN UNREADABLE BLOB READS AS NO DECLARATION, not as "I read nothing".
//
// THE DIRECTION IS THE WHOLE POINT. An empty set makes canReadLanguage true for
// everything, so a corrupt preference leaves every card exactly as it was. The
// opposite failure — every translated quote in the library suddenly leading with
// its translation — is what a "safe" default of "declares nothing, so reads
// nothing" would produce, from a blob the reader never saw.
func TestACorruptDeclarationChangesNoCard(t *testing.T) {
	if got, ok := normalizeReadLanguages(`{"not":"a list"}`); ok || got != "" {
		t.Fatalf("a bad blob normalised to %q ok=%v", got, ok)
	}
	set := readLanguageSet("")
	for _, lang := range []string{"bengali", "German", "", "klingon"} {
		if !canReadLanguage(set, lang) {
			t.Errorf("with nothing declared, %q reads as unreadable — every translated quote in the "+
				"library would lead with its translation", lang)
		}
	}
}

func TestWhatTheReaderDeclaredIsWhatTheyCanRead(t *testing.T) {
	blob, ok := normalizeReadLanguages(`["Bengali","English"]`)
	if !ok {
		t.Fatal("the fixture did not normalise")
	}
	set := readLanguageSet(blob)
	for _, lang := range []string{"bengali", "Bengali", "  english  "} {
		if !canReadLanguage(set, lang) {
			t.Errorf("%q was declared and reads as unreadable", lang)
		}
	}
	for _, lang := range []string{"german", "French"} {
		if canReadLanguage(set, lang) {
			t.Errorf("%q was not declared and reads as readable", lang)
		}
	}
	// AND A QUOTE WITH NO LANGUAGE IS NOT A FOREIGN QUOTE — the commonest row in
	// any library, and the one a stricter reading would flip.
	if !canReadLanguage(set, "") {
		t.Error("a quote with no language reads as unreadable")
	}
}

func TestTheDeclarationSurvivesTheRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/auth/me/preferences",
		map[string]any{"readLanguages": `["French","bengali","FRENCH"]`}, http.StatusOK)
	me := decode[struct {
		Preferences struct {
			ReadLanguages string `json:"readLanguages"`
		} `json:"preferences"`
	}](t, c.mustDo("GET", "/auth/me", nil, 200))
	if want := `["bengali","french"]`; me.Preferences.ReadLanguages != want {
		t.Errorf("stored %q, want %q", me.Preferences.ReadLanguages, want)
	}
	// A REFUSAL RATHER THAN A SILENT NORMALISATION, because a client sending an
	// object here has a bug and hiding it means the reader's declaration quietly
	// is not what the screen shows.
	c.mustDo("PUT", "/auth/me/preferences",
		map[string]any{"readLanguages": `{"bengali":true}`}, http.StatusBadRequest)
}
