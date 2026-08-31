package olog

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// TestCodesDocumented enforces that the Code Registry (codes.go) and the operator
// lookup (docs/troubleshoot.md) stay in lockstep: every registered code has a row
// in the doc, and every code mentioned in the doc is registered with a non-empty
// description. This is what keeps "grep the log for the code, look it up" from
// silently rotting as codes are added.
func TestCodesDocumented(t *testing.T) {
	const docPath = "../../docs/troubleshoot.md"
	body, err := os.ReadFile(docPath)
	if err != nil {
		t.Fatalf("read %s: %v", docPath, err)
	}
	codeRe := regexp.MustCompile(`TIP-[A-Z]+-[0-9]+`)
	inDoc := map[string]bool{}
	for _, m := range codeRe.FindAllString(string(body), -1) {
		inDoc[m] = true
	}

	for code, desc := range Registry {
		if strings.TrimSpace(desc) == "" {
			t.Errorf("code %s has an empty description in Registry", code)
		}
		if !inDoc[string(code)] {
			t.Errorf("code %s is in Registry (codes.go) but has no row in %s", code, docPath)
		}
	}
	for c := range inDoc {
		if _, ok := Registry[Code(c)]; !ok {
			t.Errorf("code %s appears in %s but is not in Registry (codes.go)", c, docPath)
		}
	}
}

// TestEveryDeclaredCodeIsRegistered closes the gap the test above cannot see.
//
// THE FAILURE IT CATCHES ACTUALLY HAPPENED. TIP-META-016 was declared in this
// file, logged from metadata_library.go, and never added to Registry — so the
// lockstep check above, which walks Registry, had nothing to notice, and the code
// went out with no row in the operator's lookup. A reader who grepped their log
// for it found the one place it is not written down.
//
// It reads the source rather than reflecting, because a Go constant block is not
// enumerable at runtime and the declaration IS the thing being checked.
func TestEveryDeclaredCodeIsRegistered(t *testing.T) {
	const src = "codes.go"
	body, err := os.ReadFile(src)
	if err != nil {
		t.Fatalf("read %s: %v", src, err)
	}
	// `CodeSomething Code = "TIP-AREA-NNN"` — the one shape this file declares in.
	declRe := regexp.MustCompile(`(?m)^\s*(Code[A-Za-z0-9_]*)\s+Code\s*=\s*"(TIP-[A-Z]+-[0-9]+)"`)
	found := 0
	for _, m := range declRe.FindAllStringSubmatch(string(body), -1) {
		found++
		if _, ok := Registry[Code(m[2])]; !ok {
			t.Errorf("%s (%s) is declared in %s but is not a Registry key — nothing documents it and nothing can look it up", m[1], m[2], src)
		}
	}
	// A regex that matched nothing would pass this file forever.
	if found < 20 {
		t.Fatalf("only %d code declarations matched in %s; the pattern has gone stale", found, src)
	}
}

// TestEveryTestedPackageIsInTheNightlySweep reads ci.yml and asserts the sharded
// -race matrix lists every package that has tests.
//
// THE FAILURE IT CATCHES IS A SWEEP THAT SWEEPS NOTHING. The nightly used to be
// `./...`, which cannot miss a package; sharding it bought a readable result and
// sold that guarantee, because the list is now written by hand. A package added
// later — or renamed — simply stops being raced, and the job goes green faster
// than before while covering less. Nothing errors and nothing logs.
//
// It is the same false green the per-push job already guards against with its
// "every name must appear as a PASS" check, and it cost this repo a release once
// (v1.7.4, a -run filter that matched nothing and exited 0).
//
// It lives in internal/olog because that is where the repo already keeps the
// tests that read a file outside their own package to hold two things in step.
func TestEveryTestedPackageIsInTheNightlySweep(t *testing.T) {
	const ci = "../../.github/workflows/ci.yml"
	body, err := os.ReadFile(ci)
	if err != nil {
		t.Fatalf("read %s: %v", ci, err)
	}
	listed := map[string]bool{}
	for _, m := range regexp.MustCompile(`(?m)^\s*- \./(\S+)\s*$`).FindAllStringSubmatch(string(body), -1) {
		listed[m[1]] = true
	}
	if len(listed) < 5 {
		t.Fatalf("only %d packages parsed out of %s; the pattern has gone stale", len(listed), ci)
	}

	// Every directory under the module that holds a _test.go file. Walked rather
	// than asked of `go list`, so this needs no toolchain and no network.
	root := "../.."
	tested := map[string]bool{}
	err = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			switch d.Name() {
			case "node_modules", ".git", "dist":
				return fs.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(d.Name(), "_test.go") {
			return nil
		}
		rel, err := filepath.Rel(root, filepath.Dir(path))
		if err != nil {
			return err
		}
		tested[filepath.ToSlash(rel)] = true
		return nil
	})
	if err != nil {
		t.Fatalf("walk: %v", err)
	}
	if len(tested) < 5 {
		t.Fatalf("only %d tested packages found; the walk has gone stale", len(tested))
	}

	for pkg := range tested {
		if !listed[pkg] {
			t.Errorf("./%s has tests but is not in ci.yml's nightly -race matrix — it is never raced", pkg)
		}
	}
	for pkg := range listed {
		if !tested[pkg] {
			t.Errorf("ci.yml races ./%s, which has no tests — the shard runs and proves nothing", pkg)
		}
	}
}
