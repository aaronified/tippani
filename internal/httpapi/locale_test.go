package httpapi

// GET /locales, and the locale preference.
//
// The format's own tests live in internal/i18n. These are about the two things
// only a server can be wrong about: what the route serves out of the data
// directory, and what the preferences blob accepts.

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"tippani/internal/i18n"
)

type localesResp struct {
	Builtin []string             `json:"builtin"`
	Files   map[string]i18n.File `json:"files"`
}

// writeLocale drops a file into <DataDir>/Locales, creating the directory. The
// server never creates it — design §3 requires an absent one to be survivable —
// so a test that wants one has to make it.
func writeLocale(t *testing.T, srv *Server, name, body string) {
	t.Helper()
	dir := filepath.Join(srv.DataDir, i18n.DirName)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestLocalesIsPublicAndAnEmptyDataDirDegradesToTheBuiltins(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	// NO CREDENTIAL AT ALL. The login screen and the first-run screen render
	// before a session exists, so a 401 here is the two screens a reader who does
	// not read English meets first, stuck in a language they did not choose.
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/locales", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d — GET /locales must be reachable with no session", rec.Code)
	}
	got := decode[localesResp](t, rec)
	if len(got.Builtin) != 2 || got.Builtin[0] != "en" || got.Builtin[1] != "bn" {
		t.Errorf("builtin: %v, want [en bn]", got.Builtin)
	}
	// `{}` rather than `null`, so a client has one shape to read.
	if got.Files == nil {
		t.Error("files is null; it should be an empty object on an instance with no Locales directory")
	}
	if len(got.Files) != 0 {
		t.Errorf("files: %#v, want none", got.Files)
	}
}

func TestADataDirFileOverridesTheCompiledInCopyForBothEnglishAndBengali(t *testing.T) {
	// Design §5: the override path privileges nobody. What the client does with
	// these is resolve them over the compiled-in table per key; what the server
	// owes is to hand both over on equal terms.
	srv := newTestServer(t)
	h := srv.Handler()
	writeLocale(t, srv, "en.txt", "settings.language.title = Tongue\n")
	writeLocale(t, srv, "bn.txt", "settings.language.title = Bhasha\n")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/locales", nil))
	got := decode[localesResp](t, rec)
	if got.Files["en"].Keys["settings.language.title"] != "Tongue" {
		t.Errorf("en override missing: %#v", got.Files["en"])
	}
	if got.Files["bn"].Keys["settings.language.title"] != "Bhasha" {
		t.Errorf("bn override missing: %#v", got.Files["bn"])
	}
}

func TestANewLanguageAppearsWithNoRestartAndAMangledLineIsReported(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	ask := func() localesResp {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/locales", nil))
		return decode[localesResp](t, rec)
	}
	if len(ask().Files) != 0 {
		t.Fatal("started with files")
	}
	// Design §4: drop it in and it appears. No code change, no rebuild — and no
	// restart, which is the part a parse-once cache would have broken.
	writeLocale(t, srv, "fr.txt", "_name = Français\n_dir = ltr\nthis line has no equals sign\na.key = un\n")
	got := ask()
	fr, ok := got.Files["fr"]
	if !ok {
		t.Fatalf("fr did not appear: %#v", got.Files)
	}
	if fr.Reserved["_name"] != "Français" {
		t.Errorf("_name: %#v", fr.Reserved)
	}
	if fr.Keys["a.key"] != "un" {
		t.Errorf("the string after the mangled line was lost: %#v", fr.Keys)
	}
	if len(fr.Bad) != 1 || fr.Bad[0] != 3 {
		t.Errorf("bad lines: %v, want [3] — a mangled line is reported, not hidden", fr.Bad)
	}
}

func TestTheLocalePreferenceIsOpenAndRoundTrips(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	type meLocale struct {
		Preferences struct {
			Locale string `json:"locale"`
		} `json:"preferences"`
	}
	me := decode[meLocale](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.Locale != "" {
		t.Fatalf("a fresh account should have chosen nothing: %q", me.Preferences.Locale)
	}

	// A language this server has never heard of is a VALID preference: design §4
	// says the value is validated against what exists rather than against a
	// hardcoded list, and what exists is a file the operator may add tomorrow.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"locale": "pt-br"}, 200)
	me = decode[meLocale](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.Locale != "pt-br" {
		t.Fatalf("after PUT: %q", me.Preferences.Locale)
	}
	// Folded and trimmed, so one language is not two preferences.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"locale": "  EN  "}, 200)
	me = decode[meLocale](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.Locale != "en" {
		t.Fatalf("folded: %q", me.Preferences.Locale)
	}
	// Empty is a real value — "I have not chosen" — and clears it.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"locale": ""}, 200)
	me = decode[meLocale](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.Locale != "" {
		t.Fatalf("cleared: %q", me.Preferences.Locale)
	}
	// The SHAPE is refused, because a code has to be usable as a file name.
	for _, bad := range []string{"../../etc/passwd", "en/us", "en_US", "français"} {
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{"locale": bad}, http.StatusBadRequest)
	}

	// An unrecognised value already IN the database reads as unset rather than
	// failing the login — the same rule every other field in loadPrefs follows.
	if _, err := srv.Store.DB.Exec(
		`UPDATE users SET preferences = '{"locale":"../nope"}' WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	me = decode[meLocale](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.Locale != "" {
		t.Fatalf("a bad stored code should read as unset: %q", me.Preferences.Locale)
	}
}
