package changelog

import (
	"os"
	"strings"
	"testing"
)

// THE DRIFT TEST, and the reason the copy is allowed to exist at all.
//
// //go:embed cannot reach outside its own package directory and there is no Go
// package at the repo root, so the canonical CHANGELOG.md cannot be embedded from
// here. A copy is the only way, and two copies of anything is a drift surface —
// this repo already lost that fight once with web/dist and had to add a CI gate.
//
// So the alarm ships in the same commit as the copy, not later. The failure
// message carries the fix, because the person who hits this is mid-release and
// should not have to work out what the second file is for.
func TestTheEmbeddedCopyMatchesTheRealChangelog(t *testing.T) {
	root, err := os.ReadFile("../../CHANGELOG.md")
	if err != nil {
		t.Fatalf("cannot read the canonical CHANGELOG.md: %v", err)
	}
	// Compared with line endings normalised: the working tree is CRLF on Windows
	// and LF in git, and a test that failed on that would fail on one machine and
	// pass on the other — which is worse than no test.
	norm := func(b []byte) string { return strings.ReplaceAll(string(b), "\r\n", "\n") }
	if norm(root) != norm([]byte(source)) {
		t.Fatalf("internal/changelog/CHANGELOG.md has drifted from the root CHANGELOG.md.\n" +
			"The embedded copy is what the app SHOWS, so releasing now would ship the old notes.\n" +
			"Fix:  cp CHANGELOG.md internal/changelog/CHANGELOG.md")
	}
}

func TestTheNewestReleaseIsFirst(t *testing.T) {
	// "The latest release will be on the top" is the requirement, and it is a
	// property of the FILE — which is maintained newest-first — preserved by the
	// parser keeping document order. Asserted rather than sorted, because sorting
	// semantic versions is a second opinion about ordering that could disagree
	// with the file.
	rs := Releases()
	if len(rs) < 10 {
		t.Fatalf("expected a real changelog, got %d releases", len(rs))
	}
	if rs[0].Version != Latest() {
		t.Errorf("Latest() disagrees with the first release: %q vs %q", Latest(), rs[0].Version)
	}
	// Every version is non-empty and none repeats — a duplicate heading means the
	// parser split one release in two.
	seen := map[string]bool{}
	for i, r := range rs {
		if r.Version == "" {
			t.Errorf("release %d has no version", i)
		}
		if seen[r.Version] {
			t.Errorf("version %q appears twice", r.Version)
		}
		seen[r.Version] = true
	}
}

func TestEveryReleaseHasSomethingToSay(t *testing.T) {
	for _, r := range Releases() {
		if len(r.Sections) == 0 {
			t.Errorf("%s parsed with no sections at all", r.Version)
			continue
		}
		total := 0
		for _, s := range r.Sections {
			if s.Title == "" {
				t.Errorf("%s has a section with no title", r.Version)
			}
			total += len(s.Entries)
		}
		if total == 0 {
			t.Errorf("%s parsed with no entries — the bullets were dropped", r.Version)
		}
	}
}

// THE FAILURE A NAIVE LINE-SPLITTER HAS. Bullets in this file routinely run to
// several indented continuation lines and sometimes to whole indented paragraphs,
// and those belong to the bullet above them. Flattening them into the previous
// entry, or dropping them, is silent: the dialog just quietly says less than the
// file does.
func TestAContinuationParagraphStaysWithItsBullet(t *testing.T) {
	const md = `# Changelog

## [9.9.9] - 2026-01-01

### Added

- **A thing.** The first paragraph of it, which
  wraps across two source lines.

  And a second paragraph, indented under the same bullet.

- A short one.

### Fixed

- Something else.
`
	rs := parse(md)
	if len(rs) != 1 {
		t.Fatalf("expected one release, got %d", len(rs))
	}
	if rs[0].Version != "9.9.9" || rs[0].Date != "2026-01-01" {
		t.Fatalf("heading: %+v", rs[0])
	}
	if len(rs[0].Sections) != 2 {
		t.Fatalf("expected two sections, got %d", len(rs[0].Sections))
	}
	added := rs[0].Sections[0]
	if added.Title != "Added" || len(added.Entries) != 2 {
		t.Fatalf("Added: %+v", added)
	}
	first := added.Entries[0]
	if !strings.Contains(first, "wraps across two source lines") {
		t.Errorf("the wrapped line was dropped:\n%s", first)
	}
	if !strings.Contains(first, "And a second paragraph") {
		t.Errorf("the continuation PARAGRAPH was dropped — the silent one:\n%s", first)
	}
	if !strings.Contains(first, "\n\n") {
		t.Errorf("the paragraph break was flattened, so it reads as one run-on:\n%s", first)
	}
	if added.Entries[1] != "A short one." {
		t.Errorf("the continuation leaked into the next bullet: %q", added.Entries[1])
	}
}

func TestInlineMarkdownIsLeftAlone(t *testing.T) {
	// The client renders the spans. If this package ever starts emitting HTML the
	// frontend will render it as text, which is a visible mess rather than a
	// silent one — but the contract is worth stating anyway.
	const md = "## [1.0.0] - 2026-01-01\n\n### Added\n\n- **Bold** and `code` and [a link](https://example.com).\n"
	e := parse(md)[0].Sections[0].Entries[0]
	for _, want := range []string{"**Bold**", "`code`", "[a link](https://example.com)"} {
		if !strings.Contains(e, want) {
			t.Errorf("%q was rewritten: %s", want, e)
		}
	}
}

func TestAHeadingWithoutBracketsOrADateStillYieldsARelease(t *testing.T) {
	// The file is hand-written. A release whose notes vanish because somebody
	// typed an en-dash is a worse outcome than an odd version string.
	for _, h := range []string{
		"## [2.0.0] - 2026-02-02",
		"## [2.0.0] – 2026-02-02",
		"## 2.0.0 - 2026-02-02",
		"## [2.0.0]",
	} {
		rs := parse(h + "\n\n### Added\n\n- Something.\n")
		if len(rs) != 1 || rs[0].Version != "2.0.0" {
			t.Errorf("%q parsed as %+v", h, rs)
		}
	}
}

func TestThePreambleIsNotMistakenForARelease(t *testing.T) {
	// The real file opens with "# Changelog" and two paragraphs of prose, one of
	// them containing links. None of it belongs to a version.
	rs := Releases()
	for _, r := range rs {
		if strings.Contains(r.Version, "Changelog") || strings.Contains(r.Version, "Keep") {
			t.Fatalf("the preamble was parsed as a release: %+v", r)
		}
	}
}
