package i18n

// The Go half of the format's tests. The JS half is
// web/frontend/test/pure/locale-parser.test.js, and the two share
// testdata/agree.txt and testdata/agree.json — the fixture and the PINNED
// answer. Neither parser generates the other's expectation, so a drift in either
// one turns its own suite red instead of the two of them quietly agreeing on
// something new.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestTheTwoParsersAgreeOnTheSharedFixture(t *testing.T) {
	src, err := os.ReadFile(filepath.Join("testdata", "agree.txt"))
	if err != nil {
		t.Fatal(err)
	}
	// Read as bytes and parsed as-is: the CR and CRLF line endings in the fixture
	// are the point of it, and .gitattributes marks the file -text so they survive
	// a checkout.
	if !strings.Contains(string(src), "\r") {
		t.Fatal("testdata/agree.txt has lost its carriage returns — check .gitattributes marks it -text")
	}
	want, err := os.ReadFile(filepath.Join("testdata", "agree.json"))
	if err != nil {
		t.Fatal(err)
	}
	var expected File
	if err := json.Unmarshal(want, &expected); err != nil {
		t.Fatal(err)
	}
	got := Parse(string(src))
	if !reflect.DeepEqual(got.Keys, expected.Keys) {
		t.Errorf("keys:\n got %#v\nwant %#v", got.Keys, expected.Keys)
	}
	if !reflect.DeepEqual(got.Reserved, expected.Reserved) {
		t.Errorf("reserved:\n got %#v\nwant %#v", got.Reserved, expected.Reserved)
	}
	if !reflect.DeepEqual(got.Empty, expected.Empty) {
		t.Errorf("empty:\n got %#v\nwant %#v", got.Empty, expected.Empty)
	}
	if !reflect.DeepEqual(got.Bad, expected.Bad) {
		t.Errorf("bad line numbers:\n got %#v\nwant %#v", got.Bad, expected.Bad)
	}
}

func TestAMangledLineCostsOneStringAndTheFileStillLoads(t *testing.T) {
	f := Parse("a.one = first\nnot a line at all\na.two = second\n")
	if len(f.Bad) != 1 || f.Bad[0] != 2 {
		t.Fatalf("bad lines: %v, want [2]", f.Bad)
	}
	if f.Keys["a.one"] != "first" || f.Keys["a.two"] != "second" {
		t.Fatalf("the strings either side of the mangled line were lost: %#v", f.Keys)
	}
}

func TestAValueMayContainAnEqualsSign(t *testing.T) {
	f := Parse("search.hint = press = to compare\n")
	if got := f.Keys["search.hint"]; got != "press = to compare" {
		t.Fatalf("first-equals split: %q", got)
	}
}

func TestAHashIsAComment(t *testing.T) {
	f := Parse("# a.key = never\n   # indented too\na.key = real\n")
	if got := f.Keys["a.key"]; got != "real" {
		t.Fatalf("comment leaked into the table: %q", got)
	}
	if len(f.Keys) != 1 {
		t.Fatalf("keys: %#v", f.Keys)
	}
	// A hash INSIDE a value is not a comment — only a line that starts with one.
	f = Parse("a.key = colour #1\n")
	if got := f.Keys["a.key"]; got != "colour #1" {
		t.Fatalf("hash inside a value: %q", got)
	}
}

func TestABOMDoesNotBreakTheFirstKey(t *testing.T) {
	f := Parse("\uFEFF_name = English\nfirst.key = value\n")
	if f.Reserved["_name"] != "English" {
		t.Fatalf("the byte-order mark ate the first key: %#v", f.Reserved)
	}
	if f.Keys["first.key"] != "value" {
		t.Fatalf("keys: %#v", f.Keys)
	}
}

func TestAnEmptyValueIsAbsentRatherThanEmpty(t *testing.T) {
	// The generated template ships every key with nothing after the =. If that
	// counted as a string, dropping a half-finished template in would blank the
	// interface — which is the exact failure design §8 forbids.
	f := Parse("filled = yes\nunfilled =\n")
	if _, ok := f.Keys["unfilled"]; ok {
		t.Fatal("an empty value became a renderable string")
	}
	if !reflect.DeepEqual(f.Empty, []string{"unfilled"}) {
		t.Fatalf("empty: %#v", f.Empty)
	}
	if len(f.Bad) != 0 {
		t.Fatalf("an empty value is not a mangled line: %#v", f.Bad)
	}
}

func TestAnEmptyFileParsesToNothingAndNotToAnError(t *testing.T) {
	for _, src := range []string{"", "\n\n\n", "# nothing but a comment\n", "\uFEFF"} {
		f := Parse(src)
		if len(f.Keys) != 0 || len(f.Reserved) != 0 || len(f.Bad) != 0 {
			t.Fatalf("%q parsed to %#v", src, f)
		}
	}
}

func TestBothBuiltinsAreCompiledInAndParse(t *testing.T) {
	for _, code := range Builtins {
		raw, ok := Builtin(code)
		if !ok || raw == "" {
			t.Fatalf("%s is not compiled in", code)
		}
		f := Parse(raw)
		if len(f.Bad) != 0 {
			t.Errorf("%s.txt has mangled lines at %v", code, f.Bad)
		}
		// _name is what the picker labels the language with. Without it the row for
		// a language that ships in the box reads as its bare code.
		if f.Reserved["_name"] == "" {
			t.Errorf("%s.txt has no _name", code)
		}
	}
	if _, ok := Builtin("fr"); ok {
		t.Fatal("a third language is compiled in — design §4 says any language beyond en and bn is config only")
	}
}

func TestAMissingDirectoryAndAnEmptyOneBothReadAsNothing(t *testing.T) {
	var o Overrides
	// A data dir with no Locales at all — the ordinary state of a fresh install.
	root := t.TempDir()
	if got := o.Files(root); len(got) != 0 {
		t.Fatalf("missing directory: %#v", got)
	}
	// An empty one.
	if err := os.MkdirAll(filepath.Join(root, DirName), 0o700); err != nil {
		t.Fatal(err)
	}
	if got := o.Files(root); len(got) != 0 {
		t.Fatalf("empty directory: %#v", got)
	}
	// A file that is not a locale file at all.
	if err := os.WriteFile(filepath.Join(root, DirName, "notes.md"), []byte("_name = No\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := o.Files(root); len(got) != 0 {
		t.Fatalf("non-.txt file was read: %#v", got)
	}
}

func TestAFileInTheDataDirIsReadForBothBuiltInLanguages(t *testing.T) {
	// Design §5: the override path privileges nobody. en.txt and bn.txt in the
	// data dir are read exactly as fr.txt is; which of them WINS a key is the
	// client resolver's job, and this is the half the server owes it.
	root := t.TempDir()
	dir := filepath.Join(root, DirName)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	write := func(name, body string) {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	write("en.txt", "settings.language.title = Tongue\n")
	write("bn.txt", "settings.language.title = Bhasha\n")
	write("FR.TXT", "_name = Francais\nsettings.language.title = Langue\n")
	var o Overrides
	got := o.Files(root)
	if len(got) != 3 {
		t.Fatalf("languages read: %d — %#v", len(got), got)
	}
	if got["en"].Keys["settings.language.title"] != "Tongue" {
		t.Errorf("en override: %#v", got["en"].Keys)
	}
	if got["bn"].Keys["settings.language.title"] != "Bhasha" {
		t.Errorf("bn override: %#v", got["bn"].Keys)
	}
	// The code is the file name, lower-cased: an operator on a case-insensitive
	// filesystem must not end up with a language nothing can select.
	if got["fr"].Reserved["_name"] != "Francais" {
		t.Errorf("fr, from FR.TXT: %#v", got["fr"])
	}
}

func TestTheDirectoryIsRereadWhenAFileChanges(t *testing.T) {
	// Design §4's promise is "drop it in and it appears". A parse-once cache like
	// internal/changelog's sync.Once would break it, because unlike an embedded
	// asset these files change under a running server.
	root := t.TempDir()
	dir := filepath.Join(root, DirName)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "fr.txt")
	if err := os.WriteFile(path, []byte("a.key = un\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	var o Overrides
	if got := o.Files(root)["fr"].Keys["a.key"]; got != "un" {
		t.Fatalf("first read: %q", got)
	}
	// A rewrite that changes the SIZE as well as the mtime, because a filesystem's
	// mtime resolution is coarse enough that two writes in one test can share one.
	if err := os.WriteFile(path, []byte("a.key = deux et trois\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := o.Files(root)["fr"].Keys["a.key"]; got != "deux et trois" {
		t.Fatalf("after the edit: %q — the cache did not notice", got)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if got := o.Files(root); len(got) != 0 {
		t.Fatalf("after the delete: %#v", got)
	}
}

func TestNormalizeCodeTakesTheShapeAndNotAnAllowlist(t *testing.T) {
	// Design §4: the preference is validated against what exists, not against a
	// hardcoded list. So a language nobody has heard of is a valid CODE.
	for _, ok := range []string{"en", "bn", "fr", "pt-br", "zh-hans", "qps", "x9"} {
		if NormalizeCode(ok) != ok {
			t.Errorf("%q should be a valid code, got %q", ok, NormalizeCode(ok))
		}
	}
	if got := NormalizeCode("  EN  "); got != "en" {
		t.Errorf("trimmed and folded: %q", got)
	}
	// And the shape is what keeps a file name out of a path.
	for _, bad := range []string{"", "..", "../etc", "en/us", "en_US", "en.txt", "C:", strings.Repeat("a", 17)} {
		if got := NormalizeCode(bad); got != "" {
			t.Errorf("%q should be refused, got %q", bad, got)
		}
	}
}
