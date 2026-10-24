package httpapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"tippani/internal/i18n"
)

// GET /locales, and the locale preference.
//
// The format's own tests live in internal/i18n. These are about the two things
// only a server can be wrong about: what the route serves out of the data
// directory, and what the preferences blob accepts.

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

// The locator shapes these cover are the real ones: Kindle location integers, a
// PDF page prefix, a page range, a percentage, and a film timestamp.
func TestApplyLocFormula(t *testing.T) {
	cases := []struct {
		name      string
		cur, orig string
		op        string
		value     float64
		text      string
		want      string
	}{
		// A PDF whose pages run five ahead of the print edition.
		{"prefix subtract", "p.142", "p.142", locOpSubtract, 5, "", "p.137"},
		{"prefix add", "p.142", "p.142", locOpAdd, 5, "", "p.147"},
		// A range moves at both ends.
		{"range", "610-612", "610-612", locOpSubtract, 10, "", "600-602"},
		{"range add", "610-612", "610-612", locOpAdd, 1, "", "611-613"},
		// Kindle location -> page: a division that rounds.
		{"divide rounds", "1234", "1234", locOpDivide, 16.69, "", "74"},
		{"divide rounds half up", "5", "5", locOpDivide, 2, "", "3"},
		{"multiply", "12", "12", locOpMultiply, 3, "", "36"},
		// Percentages keep their sign.
		{"percent", "42%", "42%", locOpDivide, 2, "", "21%"},
		{"decimal keeps precision", "12.5%", "12.5%", locOpMultiply, 2, "", "25.0%"},
		// Zero is the floor: a formula that overshoots does not invent negatives.
		{"clamps at zero", "p.3", "p.3", locOpSubtract, 5, "", "p.0"},
		// Leading zeros survive, so a padded locator stays padded.
		{"keeps zero padding", "p.007", "p.007", locOpAdd, 1, "", "p.008"},
		{"padding widens", "0099", "0099", locOpAdd, 1, "", "0100"},
		// Timestamps go through seconds, not through the digits.
		{"timestamp add", "01:02:03", "01:02:03", locOpAdd, 60, "", "01:03:03"},
		{"timestamp subtract over minute", "01:00:03", "01:00:03", locOpSubtract, 5, "", "00:59:58"},
		{"timestamp two components", "12:30", "12:30", locOpAdd, 60, "", "13:30"},
		{"timestamp keeps component count", "59:30", "59:30", locOpAdd, 60, "", "60:30"},
		{"timestamp clamps", "00:00:10", "00:00:10", locOpSubtract, 30, "", "00:00:00"},
		{"timestamp with prefix text", "~01:02:03", "~01:02:03", locOpAdd, 60, "", "~01:03:03"},
		{"timestamp multiply", "00:01:00", "00:01:00", locOpMultiply, 2, "", "00:02:00"},
		// chapter:verse is not a clock — the minute field must be two digits.
		{"colon but not a timestamp", "3:1", "3:1", locOpAdd, 1, "", "4:2"},
		// set and reset.
		{"set", "p.142", "p.142", locOpSet, 0, "p.1", "p.1"},
		{"reset restores the snapshot", "p.99", "p.142", locOpReset, 0, "", "p.142"},
		{"reset over an emptied value", "", "01:02:03", locOpReset, 0, "", "01:02:03"},
		// An absent locator stays absent rather than becoming "0".
		{"empty stays empty", "", "", locOpAdd, 5, "", ""},
		{"blank stays blank", "   ", "   ", locOpSubtract, 5, "", "   "},
		// Text with no numbers is left alone.
		{"no digits", "front matter", "front matter", locOpAdd, 5, "", "front matter"},

		// --- the cases the adversarial review turned up ---

		// A chapter:verse locator with a multi-digit verse partially matches the
		// clock pattern. Rewriting that match would strand the extra digit beside a
		// re-rendered time ("2:265"), so a digit-adjacent match is not a clock.
		{"verse locator, not a clock", "2:255", "2:255", locOpAdd, 1, "", "3:256"},
		{"verse locator, leading digits", "12999:30", "12999:30", locOpAdd, 1, "", "13000:31"},
		// A timestamp RANGE moves at both ends, like a page range.
		{"timestamp range", "01:02:03 - 01:04:10", "01:02:03 - 01:04:10", locOpAdd, 60, "", "01:03:03 - 01:05:10"},
		{"two clocks, subtitle shape", "00:01:23 --> 00:01:26", "00:01:23 --> 00:01:26", locOpAdd, 60, "", "00:02:23 --> 00:02:26"},
		// Overflow is clamped rather than rendered as "+Inf" or a negative clock.
		{"multiply overflow clamps", "p.142", "p.142", locOpMultiply, 1e308, "", "p.1000000000000000"},
		{"timestamp overflow clamps", "01:02:03", "01:02:03", locOpMultiply, 1e16, "", "277777777777:46:40"},
		// A thousands-separated number is one number, and stays grouped.
		{"grouped digits", "1,234", "1,234", locOpAdd, 1, "", "1,235"},
		{"grouped digits divide", "1,234", "1,234", locOpDivide, 2, "", "617"},
		{"grouped crossing a group", "9,999", "9,999", locOpAdd, 1, "", "10,000"},
		// A comma-separated LIST is still shifted element by element.
		{"comma list", "12, 15", "12, 15", locOpAdd, 1, "", "13, 16"},
		// A date is not a clock and not grouped — plain runs, as documented.
		{"a date shifts its runs", "2026-08-03", "2026-08-03", locOpAdd, 1, "", "2027-09-04"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := &locFormula{Field: "location", Op: tc.op, Value: tc.value, Text: tc.text}
			if msg := f.validate(); msg != "" {
				t.Fatalf("validate: %s", msg)
			}
			if got := applyLocFormula(f, tc.cur, tc.orig); got != tc.want {
				t.Fatalf("%s %v on %q: got %q want %q", tc.op, tc.value, tc.cur, got, tc.want)
			}
		})
	}
}

func TestLocFormulaValidate(t *testing.T) {
	cases := []struct {
		name string
		f    locFormula
		want string
	}{
		{"defaults field to location", locFormula{Op: locOpAdd, Value: 1}, ""},
		{"timestamp field", locFormula{Field: "timestamp", Op: locOpAdd, Value: 1}, ""},
		{"unknown field", locFormula{Field: "chapter", Op: locOpAdd}, "formula field must be location or timestamp"},
		{"unknown op", locFormula{Field: "location", Op: "square"}, "formula op must be add, subtract, multiply, divide, set or reset"},
		{"empty op", locFormula{Field: "location"}, "formula op must be add, subtract, multiply, divide, set or reset"},
		{"divide by zero", locFormula{Field: "location", Op: locOpDivide, Value: 0}, "cannot divide a location by zero"},
		{"reset needs nothing", locFormula{Field: "location", Op: locOpReset}, ""},
		{"set is capped", locFormula{Field: "location", Op: locOpSet, Text: string(make([]byte, 129))}, "formula text too long (max 128 characters)"},
		{"case-insensitive op", locFormula{Field: "location", Op: "ADD", Value: 2}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := tc.f
			if got := f.validate(); got != tc.want {
				t.Fatalf("validate: got %q want %q", got, tc.want)
			}
		})
	}
	// Multiply by zero is legal (it collapses a locator), unlike divide.
	f := locFormula{Field: "location", Op: locOpMultiply, Value: 0}
	if msg := f.validate(); msg != "" {
		t.Fatalf("multiply by zero should be allowed: %s", msg)
	}
	if got := applyLocFormula(&f, "p.142", "p.142"); got != "p.0" {
		t.Fatalf("multiply by zero: got %q", got)
	}
}
