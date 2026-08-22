package i18n

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The template, and the four ways a file that looks right is useless.
//
// The reader's question was "my config folder shows this. where will i put my
// translations?" — so the answer has to be a real file, in a real directory, that
// the app itself made, and every one of these cases is a way that answer can be
// true and worthless anyway: the folder is there but the file is not read, the
// file is there but the loader offers it as a language, the file is there but a
// translated copy is silently too big, the file is there but a month out of date.

func TestTemplateIsEveryKeyAndNoValues(t *testing.T) {
	tpl := Template()
	f := Parse(tpl)

	// Nothing renderable, everything present. An empty value is ABSENT to the
	// resolver, which is exactly what makes a half-filled copy safe to use from
	// the first key — and what makes this file safe to sit in the directory.
	if len(f.Keys) != 0 {
		t.Errorf("the template carries %d translated strings; it must carry none", len(f.Keys))
	}
	if len(f.Bad) != 0 {
		t.Errorf("the template has unparseable lines: %v", f.Bad)
	}

	// Every key both built-ins have, offered. Counted against the union for the
	// same reason coverage is: neither language is the source.
	want := map[string]bool{}
	for _, code := range Builtins {
		src, _ := Builtin(code)
		for k := range Parse(src).Keys {
			want[k] = true
		}
	}
	empty := map[string]bool{}
	for _, k := range f.Empty {
		empty[k] = true
	}
	var missing []string
	for k := range want {
		if !empty[k] {
			missing = append(missing, k)
		}
	}
	if len(missing) != 0 {
		t.Errorf("%d keys are in a shipped language and not in the template, e.g. %v", len(missing), missing[:min(5, len(missing))])
	}
	if !empty["_name"] {
		t.Error("_name is not offered: a language with no name is offered under its code")
	}

	// The two kinds of comment the reader asked for, in the order they asked for
	// them: what the key is for, then the English to translate from.
	if !strings.Contains(tpl, "# en: ") {
		t.Error("no English reference lines: the translator has nothing to translate FROM")
	}
	if !strings.Contains(tpl, "# bn: ") {
		t.Error("no Bengali reference lines")
	}
	// A context comment lifted from en.txt, proving the notes are carried and not
	// only the values. This key's comment block is the one above it in en.txt.
	if !strings.Contains(tpl, "# REQUIRED.") {
		t.Error("the reserved keys lost their explanations")
	}
}

// A TRANSLATED TEMPLATE MUST FIT THROUGH THE LOADER, and it did not.
//
// maxBytes was 512 KB, described as twelve times the size of a complete language.
// The migration ended with bn.txt at 493 KB — within 4% of the cap — and the
// template at 652 KB, over it. So the app would have written a file, told the
// reader to fill it in and copy it, and then skipped the copy for being too
// large, with nothing on any screen saying so. The most demoralising possible
// outcome for somebody who just translated three thousand strings.
func TestATranslatedTemplateFitsThroughTheLoader(t *testing.T) {
	size := int64(len(Template()))
	if size > maxBytes {
		t.Fatalf("the template is %d bytes and the loader skips anything over %d: the file the app hands out cannot be loaded back", size, maxBytes)
	}
	// Filling it in only makes it bigger, and a script that is not Latin makes it
	// bigger again — three bytes a character in UTF-8 for most of Asia. The
	// headroom is asserted rather than hoped for.
	if size*2 > maxBytes {
		t.Errorf("the template is %d bytes against a %d cap: a filled-in copy in a non-Latin script has nowhere to grow", size, maxBytes)
	}
	for _, code := range Builtins {
		src, _ := Builtin(code)
		if int64(len(src)) > maxBytes {
			t.Errorf("%s.txt is %d bytes: an operator overriding it in data/Locales would be silently ignored", code, len(src))
		}
	}
}

func TestEnsureTemplateWritesOnceAndIsNotALanguage(t *testing.T) {
	root := t.TempDir()

	path, wrote, err := EnsureTemplate(root)
	if err != nil {
		t.Fatalf("EnsureTemplate: %v", err)
	}
	if !wrote {
		t.Error("nothing was written into an empty data directory")
	}
	if got := filepath.Base(path); got != TemplateName {
		t.Errorf("wrote %q, want %q", got, TemplateName)
	}

	// THE LOADER MUST NOT SEE IT AS A LANGUAGE. Files() takes the name before the
	// extension as a language code, so TEMPLATE.txt would have appeared in the
	// picker as "template" at 0%; the leading underscore is what NormalizeCode
	// rejects. This is the assertion that keeps the name from being tidied.
	var o Overrides
	if files := o.Files(root); len(files) != 0 {
		t.Errorf("the loader offers %v as languages; the template must be invisible to it", keysOf(files))
	}

	// Idempotent: this runs on every boot, and rewriting an unchanged file makes
	// every restart look like an edit to whatever is watching the folder.
	if _, wrote, err := EnsureTemplate(root); err != nil || wrote {
		t.Errorf("second call wrote=%v err=%v, want false/nil", wrote, err)
	}

	// Stale is rewritten, which is the reason it runs at boot at all: keys land in
	// the built-ins whenever a screen gains a string.
	if err := os.WriteFile(path, []byte("# from an older release\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, wrote, err := EnsureTemplate(root); err != nil || !wrote {
		t.Errorf("a stale template was left in place (wrote=%v err=%v)", wrote, err)
	}

	// And somebody's translation beside it is not touched, read or replaced.
	fr := filepath.Join(root, DirName, "fr.txt")
	body := "_name = Français\ncommon.action.save.label = Enregistrer\n"
	if err := os.WriteFile(fr, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, _, err := EnsureTemplate(root); err != nil {
		t.Fatal(err)
	}
	after, err := os.ReadFile(fr)
	if err != nil || string(after) != body {
		t.Errorf("fr.txt was disturbed: %q (%v)", string(after), err)
	}
	var o2 Overrides
	files := o2.Files(root)
	if len(files) != 1 || files["fr"].Keys["common.action.save.label"] != "Enregistrer" {
		t.Errorf("the real language beside the template did not load: %v", keysOf(files))
	}
}

func keysOf(m map[string]File) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
