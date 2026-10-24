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

