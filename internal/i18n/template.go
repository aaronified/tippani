// The template a translator fills in, written into the data directory by the
// running app.
//
// WHY THE APP WRITES IT AND NOT A SCRIPT. This was `scripts/locale-template.mjs`,
// which generated exactly these bytes and could only be run from a git checkout
// with Node on the path. Design §4's whole promise is that adding a language needs
// no rebuild — and the person taking that promise up is running a container, has
// no checkout, and asked the only question that matters: *"my config folder shows
// this. where will i put my translations?"* There was no answer. The directory did
// not exist, nothing in the app said its name, and the file listing every key they
// needed was in a repository they had never cloned.
//
// So the binary that holds the strings is what writes them out. One
// implementation, and it ships to everyone rather than to contributors.
//
// THIS OVERRULES A STATED DESIGN DECISION, which is worth naming rather than
// quietly reversing: the comment on DirName said "Nothing creates it: design §3
// requires an absent one to be survivable, so an operator who never adds a
// language never has the directory." The survivability half still holds and is
// still tested — Files() treats an absent directory as nothing to report, and none
// of that changed. What did not follow is the conclusion. A directory nobody
// creates is not a small mercy for the operator who never wants it; it is a locked
// door for the one who does, and "the folder appears when the app starts" is how
// every other thing in the data directory already behaves.
//
// WHY IT IS NOT PARSED WITH Parse(). Parse answers "what does this file MEAN" and
// throws away the two things a template is made of: the order the keys were
// written in, and the `#` comments above them. Those comments are the translator's
// only context — design §2 puts real weight on them, they are what replaces
// having the English visible at the call site — so this walks the lines instead.
// A different question over the same format, not a second parser: the only rules
// it repeats are "the first = splits" and "a leading # is a comment".

package i18n

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// TemplateName is the file the template is written as.
//
// THE LEADING UNDERSCORE IS LOAD-BEARING. Files() reads every *.txt in the
// directory and takes the name before the extension as a language code, and
// NormalizeCode rejects an underscore — so `_TEMPLATE.txt` is skipped, while
// `TEMPLATE.txt` would have appeared in the picker as a language called
// "template" at 0% coverage. It also matches the convention already in the
// format: `_name`, `_fallback` and `_dir` are the keys that are metadata rather
// than strings, and this is the file that is metadata rather than a language.
const TemplateName = "_TEMPLATE" + Ext

// entry is one key as a template needs it: where it came in the file, what it
// says, and the comment block directly above it.
type entry struct {
	notes []string
	value string
}

// walk reads a locale file for its ORDER and its COMMENTS, which Parse discards.
//
// A BLANK LINE ENDS A COMMENT BLOCK, which is what separates a key's own context
// from the file's header and from a section divider. It is also how en.txt is
// written, so the rule and the file agree rather than one apologising for the
// other.
func walk(src string) ([]string, map[string]entry) {
	src = strings.TrimPrefix(src, "\uFEFF") // as an escape: a literal BOM in source is invisible
	src = strings.ReplaceAll(src, "\r\n", "\n")
	src = strings.ReplaceAll(src, "\r", "\n")
	var order []string
	out := map[string]entry{}
	var pending []string
	for _, raw := range strings.Split(src, "\n") {
		line := trim(raw)
		if line == "" {
			pending = nil
			continue
		}
		if strings.HasPrefix(line, "#") {
			pending = append(pending, trim(strings.TrimPrefix(line, "#")))
			continue
		}
		eq := strings.Index(line, "=")
		if eq < 0 {
			pending = nil
			continue // a mangled line costs one string here too
		}
		key := trim(line[:eq])
		if key == "" || strings.HasPrefix(key, "_") {
			pending = nil
			continue
		}
		if _, seen := out[key]; !seen {
			order = append(order, key)
		}
		e := entry{value: trim(line[eq+1:])}
		if len(pending) > 0 {
			e.notes = pending
		}
		out[key] = e
		pending = nil
	}
	return order, out
}

// Template renders the file. Deterministic: the same two built-ins always produce
// the same bytes, which is what lets EnsureTemplate leave an up-to-date file
// alone.
func Template() string {
	enOrder, en := walk(builtinEN)
	bnOrder, bn := walk(builtinBN)

	// The union, in en's order first, then anything only bn has. A union for the
	// same reason coverage is measured against one: neither language is the
	// source, so a key either of them has is a key the template has to offer.
	keys := make([]string, 0, len(enOrder)+8)
	seen := make(map[string]bool, len(enOrder))
	for _, k := range enOrder {
		keys = append(keys, k)
		seen[k] = true
	}
	for _, k := range bnOrder {
		if !seen[k] {
			keys = append(keys, k)
			seen[k] = true
		}
	}

	var b strings.Builder
	say := func(line string) { b.WriteString(line); b.WriteByte('\n') }

	say("# A tippani language, and every string in the app, waiting to be filled in.")
	say("#")
	say("# WRITTEN BY THE APP, and rewritten whenever the app's own strings change, so")
	say("# this file is always the current list. Do not translate in here — it is not")
	say("# read as a language and your work would be overwritten on the next start.")
	say("#")
	say("# COPY IT to your language code and translate the copy:")
	say("#")
	say("#     " + TemplateName + "  ->  fr.txt        (or pt-br.txt, ta.txt, sw.txt …)")
	say("#")
	say("# Leave it in this same folder. It appears in Settings > Language the moment")
	say("# it is saved — no rebuild, no restart, no container to replace.")
	say("#")
	say("# THE FORMAT, in full:")
	say("#")
	say("#   One key = value per line. The FIRST = splits, so a value may contain =.")
	say("#   A line starting with # is a comment. Blank lines are ignored.")
	say("#   Both halves are trimmed, so a value cannot start or end with a space.")
	say("#   There are no escapes and no line continuations: a value is one line.")
	say("#   An empty value counts as NOT TRANSLATED and falls back to a language")
	say("#   that has it — so a half-finished file is safe to use from the first key,")
	say("#   and the picker shows how far you have got.")
	say("#   A line with no = at all costs exactly that one string; the rest loads.")
	say("#   {name} and {n} are holes the app fills in. Keep them exactly as they")
	say("#   are, move them where your language needs them, and translate around")
	say("#   them. A hole you drop leaves a sentence with a gap in it.")
	say("#")
	say("# EACH KEY CARRIES UP TO THREE COMMENTS: what it is for and where it")
	say("# appears, then the English, then the Bengali. Translate from whichever of")
	say("# the two you read more comfortably.")
	say("")
	say("# --- the three reserved keys ---------------------------------------------")
	say("")
	say("# REQUIRED. How your language is named in the picker, written in your own")
	say("# language — Français, not French. A file with no _name is offered under its")
	say("# own code, which nobody reads as an invitation.")
	say("_name =")
	say("")
	say("# Optional. Which language fills your gaps before a built-in does. Useful for")
	say("# a dialect: pt-br falling back to pt before English. A cycle between two")
	say("# files is detected and broken, so it costs nothing to get wrong.")
	say("# _fallback = en")
	say("")
	say("# Optional, and honest about its limits: rtl flips TEXT DIRECTION only. The")
	say("# layout has NOT been audited for right-to-left — expect misplaced icons and")
	say("# edges. It is offered because no direction at all is worse.")
	say("# _dir = rtl")
	say("")
	plural := "s"
	if len(keys) == 1 {
		plural = ""
	}
	say(fmt.Sprintf("# --- %d string%s ---------------------------------------------------", len(keys), plural))

	for _, key := range keys {
		say("")
		notes := en[key].notes
		if len(notes) == 0 {
			notes = bn[key].notes
		}
		for _, note := range notes {
			say("# " + note)
		}
		// TrimRight, so an untranslated reference reads `# bn:` rather than
		// `# bn: ` with a trailing space nobody typed.
		say(strings.TrimRight("# en: "+en[key].value, " "))
		say(strings.TrimRight("# bn: "+bn[key].value, " "))
		say(key + " =")
	}
	return b.String()
}

// EnsureTemplate creates <root>/Locales and puts the current template in it.
// Returns the path and whether it wrote.
//
// IT REWRITES A STALE ONE AND LEAVES A CURRENT ONE ALONE, which is the whole
// reason it runs at boot rather than once at install: keys are added to the
// built-ins every time a screen gains a string, and a template written at 3,222
// keys is a lie the day the 3,223rd lands. Compared by content rather than by
// mtime — an upgrade that changes nothing about the strings must not touch the
// file, or every restart looks like an edit to whatever is watching the folder.
//
// A TRANSLATION IS NEVER AT RISK. The only name it writes is TemplateName, whose
// leading underscore is exactly what keeps it from being a language file; every
// other *.txt in the directory is somebody's work and is not read, moved or
// touched here.
//
// EVERY FAILURE IS SURVIVABLE and none of them is fatal. A read-only mount, a
// directory owned by another uid, a full disk: the app runs perfectly well with no
// Locales directory at all, and refusing to start over a convenience would turn a
// missing folder into a missing library.
func EnsureTemplate(root string) (string, bool, error) {
	dir := filepath.Join(root, DirName)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", false, err
	}
	path := filepath.Join(dir, TemplateName)
	want := []byte(Template())
	switch have, err := os.ReadFile(path); {
	case err == nil && bytes.Equal(have, want):
		return path, false, nil
	case err != nil && !errors.Is(err, fs.ErrNotExist):
		// Unreadable but present — a permission problem, most likely. Writing over
		// it is the wrong reflex when we cannot tell what is in it.
		return path, false, err
	}
	// 0o644 rather than 0o600: this file exists to be opened, copied and edited by
	// a person, and in a container that person is a different uid from the one the
	// app runs as. The directory above it is still 0o700, so this is not a
	// widening of what the data directory exposes.
	if err := os.WriteFile(path, want, 0o644); err != nil {
		return path, false, err
	}
	return path, true, nil
}
