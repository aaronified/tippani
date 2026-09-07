package changelog

import (
	"fmt"
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

// EVERY BULLET THE FILE DECLARES REACHES THE SCREEN.
//
// THE DEFECT THIS PINS, and it shipped twice in one afternoon. An entry written
// with a stray extra hyphen — `-- **Signing out no longer...` — is not a bullet to
// this parser: the `- ` case does not match, so it falls to `default`, which calls
// `flushEntry()` and drops it. And because the malformed line ATE the hyphen off
// the entry below it, a second, unrelated release note went with it. Nothing threw,
// `go test ./...` stayed green, and two user-visible entries were simply absent
// from the app's own Changelog screen — one of them the note for the very fix that
// commit was shipping.
//
// WHY IT IS THE PARSER'S TEST AND NOT A LINT. The rule is not "the markdown is
// tidy" — it is that the file and the screen agree. So the file is read as a
// READER would count it (a line beginning with a dash under a section heading is an
// entry) and compared against what `parse` produced. A parser change that started
// dropping entries fails here too, which a markdown lint would not catch.
//
// AND IT COUNTS THE WHOLE FILE. The temptation is to check only the newest release,
// which is where a hand-edit lands — but the defect above destroyed an entry in a
// release three versions old, because the damage is to the line ABOVE, and the
// hand-edit's neighbour can be anything.
func TestEveryBulletSurvivesTheParse(t *testing.T) {
	md, err := os.ReadFile("CHANGELOG.md")
	if err != nil {
		t.Fatal(err)
	}
	text := strings.ReplaceAll(string(md), "\r\n", "\n")

	// HOW A READER COUNTS. Inside a release, under a section heading, any line
	// starting at column zero with a dash and then anything is meant to be an
	// entry. `- ` is what the parser accepts; `-- `, `-**` and a bare `-` are all
	// somebody's typo, and this is the one place that says so.
	// HOW A READER COUNTS. Inside a release, under a section heading, any line
	// starting at column zero with a dash and then anything is meant to be an entry.
	// `- ` is what the parser accepts; `-- `, `-**` and a bare `-` are all somebody's
	// typo, and this is the one place that says so.
	//
	// SECTIONS ARE COUNTED BY POSITION, NOT BY TITLE, because a release can hold
	// several `### Fixed` blocks — the Unreleased section has one per pass, sixteen of
	// them at the time of writing. Keying by title collapses them into one bucket and
	// then compares that bucket against the parser's LAST block, which reports 160
	// missing entries and finds nothing. (Written that way first; it failed loudly,
	// which is the only reason this note exists.)
	type block struct {
		release string
		title   string
		count   int
	}
	var blocks []block
	var malformed, sectionless []string
	for i, line := range strings.Split(text, "\n") {
		switch {
		case strings.HasPrefix(line, "## "):
			v, _ := splitHeading(strings.TrimPrefix(line, "## "))
			blocks = append(blocks, block{release: v, title: ""})
		case strings.HasPrefix(line, "### "):
			if len(blocks) == 0 {
				continue // a section before any release belongs to nothing
			}
			blocks = append(blocks, block{
				release: blocks[len(blocks)-1].release,
				title:   strings.TrimSpace(strings.TrimPrefix(line, "### ")),
			})
		case strings.HasPrefix(line, "-"):
			if len(blocks) == 0 {
				continue // the file's own preamble, before any release
			}
			if blocks[len(blocks)-1].title == "" {
				// A BULLET UNDER A RELEASE AND ABOVE ITS FIRST `### Section`. The
				// parser drops it — `flushEntry` runs with `sec == nil` and keeps
				// nothing — and the FIRST version of this test skipped it here,
				// so both sides agreed it had never existed and every number
				// matched. That is the exact failure this file was written to
				// close, shipped inside the closing of it, for a missing section
				// heading rather than a missing hyphen. It is its own list
				// because there is no block to count it against.
				sectionless = append(sectionless, fmt.Sprintf("CHANGELOG.md:%d [%s] %q",
					i+1, blocks[len(blocks)-1].release, trunc(line)))
				continue
			}
			blocks[len(blocks)-1].count++
			if !strings.HasPrefix(line, "- ") {
				malformed = append(malformed, fmt.Sprintf("CHANGELOG.md:%d %q", i+1, trunc(line)))
			}
		}
	}
	// EVERY SECTION, INCLUDING AN EMPTY ONE. A comment here said "the parser drops an
	// empty section, so an empty one here is not a disagreement" — which is the
	// opposite of what `flushSection` does: it appends `*sec` unconditionally. So an
	// empty `### Fixed` made the two lists differ in LENGTH and the test died in
	// `Fatalf` naming no line at all. Kept in on both sides, they agree.
	var want []block
	for _, b := range blocks {
		if b.title != "" {
			want = append(want, b)
		}
	}
	if len(want) < 20 {
		t.Fatalf("the file reads as %d sections with entries, which is far too few — this test is counting the wrong thing", len(want))
	}

	// AND AN ENTRY THAT LOST ITS BULLET ENTIRELY, which is the half the count above
	// cannot see. When the stray `--` ate the hyphen off the note below it, that note
	// became ` **A portrait's caption…` — a line the parser drops AND a line this
	// test's own counter does not count, so both sides agreed it had never existed
	// and the comparison passed. Two entries were gone and every number matched.
	//
	// SO THE SHAPE IS THE SIGNAL. An entry in this file opens bold; a line inside a
	// section that opens bold and is not a bullet is an entry whose bullet is
	// missing, whatever whitespace is in front of it. Nothing legitimate in this
	// file does that, so it fails outright rather than ratcheting.
	//
	// ANYTHING ELSE ODD AT COLUMN ZERO IS RECORDED BY WHAT IT SAYS, not counted.
	//
	// Two prose blocks deliberately sit inside a section and are deliberately
	// dropped by the parser — a `<sub>` verification note in 2.1.1 and a closing
	// paragraph in 2.0.0 — so a rule that banned them outright would be switched off
	// within a week.
	//
	// A COUNT WAS THE WRONG SHAPE FOR THEM, and the way it was wrong is worth the
	// paragraph. It held a ceiling of seven and printed `strayProse[7:]` — the
	// entries past the ceiling in FILE ORDER. New notes are written at the TOP of
	// this file, so five of the six damage shapes failed while naming a line in the
	// 2.0.0 block that nobody had touched: the test was right that something was
	// wrong and pointed at the wrong thing, which is worse than a bare count.
	//
	// So the two known blocks are recorded by their opening words and anything else
	// is named. The list may shrink and never grow, the same idiom as
	// `scripts/screenshots/typescale-baseline.json` — but it names its members, so
	// the report is always about the line somebody just wrote.
	knownStray := []string{
		"<sub>Verification:",
		"database, 1,759 frontend tests.",
		"watching the test fail.</sub>",
		"Four defects in the above,",
		"and all the same shape:",
		"question. Every one is recorded here",
		"because the reason they existed",
	}
	isKnown := func(line string) bool {
		for _, k := range knownStray {
			if strings.HasPrefix(strings.TrimSpace(line), k) {
				return true
			}
		}
		return false
	}

	var lostBullet, strayProse []string
	seenKnown := 0
	{
		release, title := "", ""
		openEntry := false
		for i, line := range strings.Split(text, "\n") {
			switch {
			case strings.HasPrefix(line, "## "):
				release, _ = splitHeading(strings.TrimPrefix(line, "## "))
				title = ""
				openEntry = false
			case strings.HasPrefix(line, "### "):
				title = strings.TrimSpace(strings.TrimPrefix(line, "### "))
				openEntry = false
			case title == "" || strings.TrimSpace(line) == "":
				openEntry = openEntry && strings.TrimSpace(line) == "" // a blank line holds
			case strings.HasPrefix(line, "- "):
				openEntry = true
			// AN INDENTED LINE CONTINUES AN ENTRY ONLY IF THERE IS ONE OPEN, which is
			// the parser's rule and was not this test's. It skipped anything starting
			// with two spaces unconditionally, so `  **A note…**` directly under a
			// section heading — bullet gone, indent added — was dropped by the parser
			// and skipped here, and the comment below claimed the check held
			// "whatever whitespace is in front of it". A rater indented one and walked
			// past.
			case strings.HasPrefix(line, "  ") && openEntry:
			case strings.HasPrefix(strings.TrimLeft(line, " \t"), "**"):
				openEntry = false
				lostBullet = append(lostBullet, fmt.Sprintf("CHANGELOG.md:%d [%s/%s] %q", i+1, release, title, trunc(line)))
			default:
				openEntry = false
				if isKnown(line) {
					seenKnown++
					continue
				}
				strayProse = append(strayProse, fmt.Sprintf("CHANGELOG.md:%d %q", i+1, trunc(line)))
			}
		}
	}

	if len(lostBullet) > 0 {
		t.Errorf("these open an entry and carry no bullet, so the app's Changelog screen never draws them:\n  %s",
			strings.Join(lostBullet, "\n  "))
	}
	if len(strayProse) > 0 {
		t.Errorf("these lines sit inside a section and are neither a bullet nor a continuation, so the parser "+
			"drops every one — if one of them is a release note, it will never be read:\n  %s",
			strings.Join(strayProse, "\n  "))
	}
	// AND THE RECORDED ONES ARE STILL THERE. If a rewrite removes them the list should
	// shrink with it; a list naming lines that no longer exist would quietly stop
	// covering anything.
	if seenKnown != len(knownStray) {
		t.Errorf("%d of the %d recorded stray-prose lines were found; the list names lines this file no longer has, "+
			"so it is exempting nothing and hiding whatever replaces them", seenKnown, len(knownStray))
	}

	if len(sectionless) > 0 {
		t.Errorf("these are entries under a release with no `### Section` heading above them, "+
			"so the parser has nowhere to put them and drops every one:\n  %s",
			strings.Join(sectionless, "\n  "))
	}

	// A LINE THAT IS NOT A BULLET IS THE DEFECT ITSELF, named with its line number so
	// the fix is one edit rather than a hunt.
	if len(malformed) > 0 {
		t.Errorf("these lines read as entries and are not bullets, so the app's Changelog screen drops them "+
			"(and a malformed line can eat the hyphen off the entry below it):\n  %s",
			strings.Join(malformed, "\n  "))
	}

	// AND THE PARSER AGREES, block for block in order. A total would let one section
	// lose an entry while another gained one.
	var got []block
	for _, r := range parse(text) {
		for _, sec := range r.Sections {
			got = append(got, block{r.Version, sec.Title, len(sec.Entries)})
		}
	}
	if len(got) != len(want) {
		t.Fatalf("the file declares %d sections with entries and the parser produced %d", len(want), len(got))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("%s / %s (block %d): the file declares %d entries and the parser produced %s %s with %d — %d note(s) never reach the screen",
				want[i].release, want[i].title, i, want[i].count, got[i].release, got[i].title, got[i].count,
				want[i].count-got[i].count)
		}
	}
}

func trunc(s string) string {
	if len(s) > 64 {
		return s[:64] + "…"
	}
	return s
}
