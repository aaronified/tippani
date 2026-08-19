// Package i18n owns the locale FILE FORMAT and the two copies that ship inside
// the binary. It holds the canonical bytes for both sides of the app: the
// frontend imports en.txt and bn.txt from this directory too (see
// web/frontend/src/i18n.js), so there is exactly one copy of every string and no
// drift test to write.
//
// WHY THE BYTES LIVE HERE RATHER THAN IN THE FRONTEND TREE. //go:embed cannot
// reach outside its own package directory — internal/changelog exists entirely
// to work around that, and pays for it with a duplicated CHANGELOG.md and a
// drift test that fails when the two differ. Vite has no such limit: a `?raw`
// import resolves any path in the repository. So the constraint runs one way
// only, and the file goes where the constrained side can see it. The frontend
// build stage in the Dockerfile copies internal/i18n/*.txt for the same reason.
//
// TWO NAMED DIRECTIVES, NOT A GLOB. `//go:embed *.txt` would mirror
// seed_stickers.go and store/migrate.go, and is wrong here for a design reason:
// dropping fr.txt beside this file would silently compile a third language in,
// and design §4 says any language beyond en and bn is CONFIG ONLY. Two named
// directives make "both ship in the box" a compile-time fact and a third
// language a deliberate edit.
//
// WHAT THIS PACKAGE DOES NOT DO. It does not resolve a string for a reader and
// it holds no fallback chain. Nothing the Go side prints is translated yet — the
// server's own error strings are a separate pass — so a resolver here would be
// an unused second implementation of the one in i18n.js, which is the shape this
// repository keeps having to pull apart. What the server owes the client is the
// bytes it cannot see for itself: the contents of data/Locales.
package i18n

import (
	_ "embed"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

//go:embed en.txt
var builtinEN string

//go:embed bn.txt
var builtinBN string

// Builtins are the languages compiled in, in picker order. Both, always: design
// §3 says neither is the source language and neither is the other's fallback of
// last resort, so this list is an inventory and not a precedence.
var Builtins = []string{"en", "bn"}

// Builtin returns the raw bytes of a compiled-in language, and whether there is
// one. Raw rather than parsed, because the frontend wants exactly these bytes
// and a caller that wants a table can Parse them.
func Builtin(code string) (string, bool) {
	switch code {
	case "en":
		return builtinEN, true
	case "bn":
		return builtinBN, true
	}
	return "", false
}

// ---- the format ------------------------------------------------------------

// File is one parsed locale file. The shape is shared with the JS parser in
// web/frontend/src/i18n.js and pinned by testdata/agree.json, which BOTH suites
// compare against — neither parser generates the other's answer, so either one
// drifting goes red on its own.
type File struct {
	// Keys are the renderable strings: not reserved, and not empty.
	Keys map[string]string `json:"keys"`
	// Reserved are the underscore keys — _name, _fallback, _dir — which are
	// metadata and are never rendered as UI text.
	Reserved map[string]string `json:"reserved"`
	// Empty are keys that appeared with nothing after the =, sorted.
	//
	// PRESENT BUT ABSENT, and this is the rule that makes the generated template
	// safe to drop in half-finished. `some.key =` is not the empty string; it is
	// a line nobody has filled in. It is not in Keys, so the resolver walks past
	// it, and it does not count towards coverage. Recorded rather than discarded
	// because "the translator has seen this key and left it" is worth being able
	// to ask about.
	Empty []string `json:"empty"`
	// Bad are the 1-based line numbers of lines with no = at all, or with nothing
	// before it. Design §5: a mangled line costs exactly that one string and
	// never takes the app down.
	Bad []int `json:"bad"`
}

// trimSet is the whitespace both parsers agree on, named explicitly because the
// two languages disagree about what "whitespace" means. Go's strings.TrimSpace
// trims every Unicode space character; JavaScript's String.trim trims a
// different set (U+0085 is in one and not the other, and NBSP is in JS's set and
// not in a naive ASCII one). Neither default is wrong; two different defaults
// across one file format is.
//
// NBSP IS DELIBERATELY NOT IN HERE. A leading or trailing non-breaking space is
// a real character a translator typed on purpose — French punctuation needs one
// before a colon — and trimming it would silently correct their language.
const trimSet = " \t\n\r\v\f"

func trim(s string) string { return strings.Trim(s, trimSet) }

// Parse reads a locale file. It never fails: every recoverable problem is
// recorded in the result and the rest of the file loads.
//
// THE RULES, in the order they apply, and the JS parser applies the same ones:
//
//  1. a leading U+FEFF byte-order mark is dropped from the document, once. An
//     editor that writes one would otherwise leave the mark glued to the first key,
//     which resolves nowhere and looks like a typo nobody can see.
//  2. CRLF and lone CR both become LF, so a file edited on Windows or by an
//     older Mac editor parses the same as one edited on Linux.
//  3. a line that trims to nothing is skipped.
//  4. a line that trims to something starting with # is a comment.
//  5. the FIRST = splits key from value, so a value may contain =.
//  6. both halves are trimmed.
//  7. no =, or an empty key, is a bad line: recorded, skipped, parsing continues.
//  8. a duplicate key is LAST WINS. A file is read top to bottom and the later
//     line is the later edit; refusing the file over it would cost every other
//     string in it.
func Parse(src string) File {
	out := File{Keys: map[string]string{}, Reserved: map[string]string{}, Empty: []string{}, Bad: []int{}}
	src = strings.TrimPrefix(src, "\uFEFF") // as an escape: a literal BOM in source is invisible
	src = strings.ReplaceAll(src, "\r\n", "\n")
	src = strings.ReplaceAll(src, "\r", "\n")
	empty := map[string]bool{}
	for i, line := range strings.Split(src, "\n") {
		lineNo := i + 1
		s := trim(line)
		if s == "" || strings.HasPrefix(s, "#") {
			continue
		}
		eq := strings.Index(s, "=")
		if eq < 0 {
			out.Bad = append(out.Bad, lineNo)
			continue
		}
		key := trim(s[:eq])
		if key == "" {
			out.Bad = append(out.Bad, lineNo)
			continue
		}
		val := trim(s[eq+1:])
		// A key re-appearing with an empty value un-sets it, and one re-appearing
		// with a value un-empties it. Last wins means last wins in both
		// directions, or the two maps disagree about the same file.
		delete(out.Keys, key)
		delete(out.Reserved, key)
		delete(empty, key)
		if val == "" {
			empty[key] = true
			continue
		}
		if strings.HasPrefix(key, "_") {
			out.Reserved[key] = val
			continue
		}
		out.Keys[key] = val
	}
	for k := range empty {
		out.Empty = append(out.Empty, k)
	}
	sort.Strings(out.Empty) // stable output: a map's range order is not
	return out
}

// ---- data/Locales ----------------------------------------------------------

const (
	// DirName is the sub-directory of the data dir a language file goes in.
	// Nothing creates it: design §3 requires an absent one to be survivable, so
	// an operator who never adds a language never has the directory.
	DirName = "Locales"
	// Ext is the only extension read. .txt and not .md, because the Docker build
	// context excludes *.md and a locale asset named .md would compile locally
	// and fail in the image.
	Ext = ".txt"
	// maxBytes bounds one file. This directory is served to an unauthenticated
	// caller (the login screen has to be readable), so its size is somebody
	// else's decision and needs a ceiling. Half a megabyte is about twelve times
	// the size of a complete language.
	maxBytes = 512 << 10
	// maxFiles bounds how many are read. Same reasoning; the count is not the
	// interesting attack but an unbounded loop over a directory is a bad shape.
	maxFiles = 64
)

// Dir reads and parses every language file in data/Locales.
//
// A MISSING DIRECTORY IS NOT AN ERROR, and neither is an unreadable file. Both
// are the ordinary state of a fresh install, and design §3 is explicit that a
// missing, empty or corrupted config directory must not leave the app with no
// text: the compiled-in copies cover it. So this returns what it could read and
// says nothing about what it could not.
//
// THE RESULT IS CACHED ON THE DIRECTORY'S OWN SHAPE, not once for the process
// life. internal/changelog parses once behind a sync.Once because its source is
// embedded and cannot change; these files can be edited under a running server,
// and design §4's promise is "drop it in and it appears", which a permanent
// cache would break. The signature is every entry's name, size and mtime, which
// is one ReadDir per call and no re-read when nothing moved.
type Overrides struct {
	mu    sync.Mutex
	sig   string
	files map[string]File
}

// Files returns the parsed contents of root/Locales, keyed by language code.
func (o *Overrides) Files(root string) map[string]File {
	dir := filepath.Join(root, DirName)
	entries, err := os.ReadDir(dir)
	if err != nil {
		// Absent, or not a directory. Nothing to report and nothing to serve. The
		// cache is left alone rather than cleared: nothing reads it on this path,
		// and the signature below cannot match an absent directory anyway.
		return nil
	}
	type cand struct {
		code string
		path string
	}
	var cands []cand
	var sig strings.Builder
	sig.WriteString(dir)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasSuffix(strings.ToLower(name), Ext) {
			continue
		}
		code := NormalizeCode(strings.TrimSuffix(name, filepath.Ext(name)))
		if code == "" {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.Size() > maxBytes {
			continue
		}
		sig.WriteString("\x00")
		sig.WriteString(name)
		sig.WriteString("\x00")
		sig.WriteString(info.ModTime().UTC().Format("20060102150405.000000000"))
		sig.WriteString("\x00")
		sig.WriteString(itoa(info.Size()))
		cands = append(cands, cand{code: code, path: filepath.Join(dir, name)})
		if len(cands) >= maxFiles {
			break
		}
	}
	key := sig.String()
	o.mu.Lock()
	if o.sig == key && o.files != nil {
		out := o.files
		o.mu.Unlock()
		return out
	}
	o.mu.Unlock()

	out := map[string]File{}
	for _, c := range cands {
		b, err := os.ReadFile(c.path)
		if err != nil {
			continue // unreadable: the built-in covers it
		}
		out[c.code] = Parse(string(b))
	}
	o.mu.Lock()
	o.sig, o.files = key, out
	o.mu.Unlock()
	return out
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}

// NormalizeCode accepts a language code and returns "" for anything that is not
// one. SHAPE ONLY, exactly as normalizeFontToken validates a face token and
// nothing more: design §4 says the locale preference is not a closed enum
// validated against a hardcoded list, so the server has no business rejecting a
// code because it has not heard of the language.
//
// It is also what keeps a file name out of a path: a code is lower-case letters,
// digits and hyphens, so it can never be "..", a separator, or a drive letter.
func NormalizeCode(raw string) string {
	s := strings.ToLower(trim(raw))
	if s == "" || len(s) > 16 {
		return ""
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-':
		default:
			return ""
		}
	}
	return s
}
