package web

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// The committed SPA and the sources it was built from, checked here rather than
// only in CI — and checked by `go test`, which is the deliberate part.
//
// WHY THIS IS A GO TEST AND NOT A NODE SCRIPT OR A HOOK. web/dist is committed
// because the binary embeds it, so a change to what the SPA is built from and a
// rebuilt dist are one commit. CI has always enforced that by rebuilding and
// diffing, which works but only speaks after the push — and on the first commit
// after v2.1.3 it spoke after the merge, with main red, about a commit that never
// touched web/frontend: it edited internal/i18n/{en,bn}.txt, which src/i18n.js imports
// with Vite's `?raw`. Editing a .txt file inside a Go package does not look like
// a frontend change, so the rule as written did not reach the person breaking it.
//
// Everything that would have caught it earlier needed something installed: a
// pre-commit hook needs core.hooksPath set in every clone, and the byte-level
// check needs Node and a six-second build. `go test ./...` needs neither and
// everybody working in this repository already runs it, which is the whole
// argument for putting the guard here. A locale edit now fails in the working
// tree, before there is a commit to push.
//
// WHAT THIS DOES AND DOES NOT PROVE. It proves the sources have not moved since
// web/dist-inputs.json was written, and that file is written by `npm run build`
// itself, so it moves only when dist does. It does not read the bundle: two
// builds of identical sources are assumed to produce identical output, which is
// what the lockfile and the Dockerfile's `npm ci` exist to guarantee. CI's
// rebuild-and-diff remains the check that would notice if that assumption ever
// broke; this one is the fast, local, no-toolchain half.
const distInputs = "dist-inputs.json"

// Skipped on both sides — see the same set in scripts/dist-inputs.mjs. These are
// the only files that plausibly differ between the machine that wrote the
// manifest and the machine checking it, and a Finder dropping must not be able
// to report a correct dist as stale.
var junk = map[string]bool{".DS_Store": true, "Thumbs.db": true}

type distManifest struct {
	Trees  []string          `json:"trees"`
	Files  []string          `json:"files"`
	SHA256 map[string]string `json:"sha256"`
}

func TestDistWasBuiltFromTheseInputs(t *testing.T) {
	// Tests run in the package directory; the manifest's paths are relative to
	// the repository root, which is one level up from web/.
	const root = ".."

	raw, err := os.ReadFile(distInputs)
	if err != nil {
		t.Fatalf("reading %s: %v\n\nThis file records what web/dist was built from and is committed. Run `make frontend`.", distInputs, err)
	}
	var m distManifest
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("parsing %s: %v", distInputs, err)
	}
	if len(m.SHA256) == 0 {
		t.Fatalf("%s lists no inputs, which cannot be right. Run `make frontend`.", distInputs)
	}

	// The tree walk is what makes an ADDED source file fail: hashing only the
	// paths the manifest names would pass happily on a new component nobody
	// rebuilt for, which is the same shape of blind spot the locale files were.
	onDisk := map[string]bool{}
	for _, dir := range m.Trees {
		err := filepath.WalkDir(filepath.Join(root, filepath.FromSlash(dir)), func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() || junk[d.Name()] {
				return nil
			}
			rel, err := filepath.Rel(root, p)
			if err != nil {
				return err
			}
			onDisk[filepath.ToSlash(rel)] = true
			return nil
		})
		if err != nil {
			t.Fatalf("walking %s: %v", dir, err)
		}
	}
	// Existence-checked rather than assumed, so a deleted input is reported as
	// gone below instead of failing the hash read with a less helpful message.
	for _, f := range m.Files {
		if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(f))); err == nil {
			onDisk[path.Clean(f)] = true
		}
	}

	var missing, added, changed []string
	for p := range m.SHA256 {
		if !onDisk[p] {
			missing = append(missing, p)
		}
	}
	for p := range onDisk {
		want, listed := m.SHA256[p]
		if !listed {
			added = append(added, p)
			continue
		}
		got, err := hashFile(filepath.Join(root, filepath.FromSlash(p)))
		if err != nil {
			t.Fatalf("hashing %s: %v", p, err)
		}
		if got != want {
			changed = append(changed, p)
		}
	}

	if len(missing) == 0 && len(added) == 0 && len(changed) == 0 {
		return
	}
	var b strings.Builder
	b.WriteString("web/dist is stale: it was built before the sources reached their current state.\n")
	for _, g := range []struct {
		label string
		paths []string
	}{
		{"changed since the build", changed},
		{"added since the build", added},
		{"gone since the build", missing},
	} {
		if len(g.paths) == 0 {
			continue
		}
		sort.Strings(g.paths)
		b.WriteString("\n  " + g.label + ":\n")
		for _, p := range g.paths {
			b.WriteString("    " + p + "\n")
		}
	}
	// Named explicitly, because the surprising case is the one that caused this
	// test to exist: the file that changed may be nothing a person would call
	// the frontend.
	b.WriteString("\nRun `make frontend`, then commit web/dist and web/dist-inputs.json alongside the change.\n")
	b.WriteString("internal/i18n/*.txt count: src/i18n.js imports them, so a locale edit changes the bundle.")
	t.Fatal(b.String())
}

func hashFile(p string) (string, error) {
	b, err := os.ReadFile(p)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:]), nil
}
