// Package changelog serves the release history the running binary was built
// from, parsed out of the project's own CHANGELOG.md.
//
// WHY EMBEDDED RATHER THAN FETCHED. The obvious reading of "show me the
// changelog" is "ask GitHub", and this app deliberately does not work that way.
// The promise is stated in three places and is load-bearing: "zero background
// jobs (no pollers, timers, or cron)", "nothing external is required to run",
// and PLAN §193's "Tippani never contacts the network on its own", whose own
// justification is that it is the honest reading of "self-hosted". A changelog
// that is blank on a LAN-only NAS, or behind a firewall, or when GitHub's 60
// requests an hour have already gone on the update check, is blank in exactly
// the situation this app is built for.
//
// And a changelog is a fact about the binary you are RUNNING, not about the
// internet. The embedded copy answers "what is in this thing" exactly, forever,
// offline. Notes for a version you have not installed are a different question,
// and the update card already answers it with a link.
//
// THE FILE IS A COPY, AND THAT IS A COST WORTH NAMING. //go:embed cannot reach
// outside its own package directory and there is no Go package at the repo root,
// so the canonical CHANGELOG.md at the top of the tree cannot be embedded from
// here. A copy lives beside this file. Two copies of anything is a drift surface
// — this repo has already lost that fight once with web/dist — so the drift is
// not left to discipline: changelog_test.go reads ../../CHANGELOG.md and fails
// when the two differ, with the command to fix it in the failure message.
package changelog

import (
	_ "embed"
	"strings"
	"sync"
)

//go:embed CHANGELOG.md
var source string

// Release is one version's worth of notes.
//
// Date is whatever the heading said, verbatim and unparsed: it is written for a
// reader, the file is the only thing that knows the format, and re-formatting it
// here would be this package having an opinion about a string it does not own.
type Release struct {
	Version  string    `json:"version"`
	Date     string    `json:"date"`
	Sections []Section `json:"sections"`
}

// Section is one "### Added" group. Title is verbatim, so a heading nobody
// anticipated (this file already holds Added, Changed, Fixed, Removed, Security,
// Internal, Migration, Notes, API and Settings) arrives intact rather than being
// dropped by a switch that only knows five of them.
type Section struct {
	Title   string   `json:"title"`
	Entries []string `json:"entries"`
}

// ENTRIES STAY AS MARKDOWN, on purpose.
//
// The client renders the inline spans — **bold**, `code`, [links](url) — with a
// thirty-line renderer rather than this package emitting HTML. Two reasons, and
// the second is the real one. There is no markdown dependency in the frontend and
// no `dangerouslySetInnerHTML` anywhere in it, and adding either for a dialog
// nobody opens twice a month is a poor trade. And an inline span that is rendered
// as React nodes inherits the app's own type scale, which HTML dropped into a
// card does not.
//
// What this DOES do is the part a naive split gets wrong: a bullet in this file
// routinely runs to several indented continuation lines, and sometimes to whole
// indented paragraphs. Those belong to the bullet above them. Flattening or
// dropping them is the failure mode, and it is silent — the dialog just quietly
// says less than the file does.

var (
	once   sync.Once
	parsed []Release
)

// Releases returns the history, newest first — which is simply document order,
// because the file is maintained that way. Parsed once, on the first request, so
// an instance nobody ever asks pays nothing.
func Releases() []Release {
	once.Do(func() { parsed = parse(source) })
	return parsed
}

// Latest is the version at the top of the file, or "" for an empty changelog.
// Used by the drift test rather than by a handler, but it is the natural way to
// ask and belongs with the parser.
func Latest() string {
	rs := Releases()
	if len(rs) == 0 {
		return ""
	}
	return rs[0].Version
}

func parse(md string) []Release {
	var out []Release
	var cur *Release
	var sec *Section
	// The bullet being accumulated, and the indent that decides whether a line
	// continues it.
	var entry []string

	flushEntry := func() {
		if len(entry) == 0 || sec == nil {
			entry = nil
			return
		}
		sec.Entries = append(sec.Entries, strings.TrimRight(strings.Join(entry, "\n"), "\n"))
		entry = nil
	}
	flushSection := func() {
		flushEntry()
		if sec != nil && cur != nil {
			cur.Sections = append(cur.Sections, *sec)
		}
		sec = nil
	}
	flushRelease := func() {
		flushSection()
		if cur != nil {
			out = append(out, *cur)
		}
		cur = nil
	}

	for _, line := range strings.Split(strings.ReplaceAll(md, "\r\n", "\n"), "\n") {
		switch {
		case strings.HasPrefix(line, "## "):
			flushRelease()
			v, d := splitHeading(strings.TrimPrefix(line, "## "))
			cur = &Release{Version: v, Date: d, Sections: []Section{}}

		case strings.HasPrefix(line, "### "):
			// A section heading before any release heading belongs to nothing, and
			// silently starting a release for it would invent a version.
			if cur == nil {
				continue
			}
			flushSection()
			sec = &Section{Title: strings.TrimSpace(strings.TrimPrefix(line, "### ")), Entries: []string{}}

		case strings.HasPrefix(line, "- "):
			flushEntry()
			if sec != nil {
				entry = []string{strings.TrimSpace(strings.TrimPrefix(line, "- "))}
			}

		case strings.TrimSpace(line) == "":
			// A blank line inside a bullet is a paragraph break WITHIN it, not the
			// end of it — the next non-blank line decides. Held rather than acted
			// on, because acting on it here is what turns a two-paragraph entry
			// into one paragraph and an orphan.
			if len(entry) > 0 {
				entry = append(entry, "")
			}

		default:
			// An indented line under an open bullet continues it. Anything else at
			// column zero (a stray paragraph, the file's own preamble) ends it.
			if len(entry) > 0 && strings.HasPrefix(line, "  ") {
				entry = append(entry, strings.TrimSpace(line))
				continue
			}
			flushEntry()
		}
	}
	flushRelease()

	// Trim the trailing blank a held paragraph break leaves on the last line of an
	// entry, and drop entries that turned out to be nothing at all.
	for i := range out {
		for j := range out[i].Sections {
			kept := out[i].Sections[j].Entries[:0]
			for _, e := range out[i].Sections[j].Entries {
				if e = strings.TrimSpace(e); e != "" {
					kept = append(kept, e)
				}
			}
			out[i].Sections[j].Entries = kept
		}
	}
	return out
}

// splitHeading reads "[1.11.2] - 2026-08-14" into its two halves.
//
// Tolerant on purpose: a heading with no date, or with brackets missing, still
// yields a version rather than dropping the release. The file is hand-written and
// a release whose notes vanish because somebody typed an en-dash is a worse
// outcome than a slightly odd version string.
func splitHeading(h string) (version, date string) {
	h = strings.TrimSpace(h)
	if i := strings.Index(h, "]"); strings.HasPrefix(h, "[") && i > 0 {
		version = h[1:i]
		h = strings.TrimSpace(h[i+1:])
	} else {
		// No brackets: take the first field as the version.
		parts := strings.Fields(h)
		if len(parts) == 0 {
			return "", ""
		}
		version = parts[0]
		h = strings.TrimSpace(strings.TrimPrefix(h, parts[0]))
	}
	date = strings.TrimSpace(strings.TrimLeft(h, "-–— "))
	return version, date
}
