package httpapi

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// EVERY `INSERT ... (columns) VALUES (...)` IN THIS PACKAGE BALANCES.
//
// WHY THIS IS A TEST AND NOT A HABIT. Adding a column to an INSERT is three
// edits — the column list, the VALUES list, the Go args — and removing one is the
// same three. The compiler checks none of them: a statement with one column too
// many builds, ships, and fails at run time with "SQL logic error: 26 values for
// 25 columns", from whichever request first reaches it.
//
// IT HAS HAPPENED THREE TIMES IN ONE DAY of this package's life, in both
// directions. 0069 added `transliteration` to the utterances INSERT and forgot the
// placeholder: POST /quotes answered 500 and nothing else did, so it looked like
// one broken endpoint. 0072 removed the column from eight statements and left
// every placeholder behind: ninety-two tests failed at once, every one of them an
// import round trip, and the failure the reader would have seen is "the import
// added nothing" with no error on screen.
//
// AND A HAND AUDIT DOES NOT WORK, which is the other half of the argument. A
// script written for exactly this reported eleven mismatches including statements
// nobody had touched, because `\(([^)]*)\)` stops at the first `)` — which is
// inside `COALESCE(?, datetime('now'))`. So the split below counts TOP-LEVEL
// commas with a paren-depth counter, which is the only way to read
// `COALESCE(?, datetime('now'))` and `(SELECT ... WHERE id = ?)` as one value each.
func TestEveryInsertBalancesItsColumnsAndValues(t *testing.T) {
	// The whole statement in one match: the table, its column list, its VALUES.
	// Anchored on the closer the codebase actually uses — `ON CONFLICT` or the
	// closing backtick of the raw string — so a VALUES clause is never cut short.
	stmt := regexp.MustCompile("(?s)INSERT (?:OR IGNORE )?INTO (\\w+)\\s*\\n?\\s*\\(([^)]*)\\)\\s*\\n?\\s*VALUES\\s*\\((.*?)\\)(?:\\s*ON CONFLICT|\\s*`)")

	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatal(err)
	}
	consts := packageConsts(t, files)
	checked := 0
	for _, f := range files {
		if strings.HasSuffix(f, "_test.go") {
			continue
		}
		src, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range stmt.FindAllStringSubmatch(string(src), -1) {
			table, cols, vals := m[1], m[2], m[3]
			// A COLUMN LIST CAN BE SPLICED FROM A CONSTANT — `anthologyFieldCols` is
			// six columns behind one identifier — and a splitter counting commas sees
			// one. Resolved from the package's own consts, so the statement is checked
			// rather than skipped: skipping is what a guard does right before the
			// mistake lands in the part it skipped.
			cols = expandConsts(cols, consts)
			nc, nv := len(topLevelItems(cols)), len(topLevelItems(vals))
			checked++
			if nc != nv {
				t.Errorf("%s: INSERT INTO %s has %d columns and %d values\n  columns: %v\n  values:  %v",
					f, table, nc, nv, topLevelItems(cols), topLevelItems(vals))
			}
		}
	}
	// A REGEX THAT MATCHES NOTHING PASSES SILENTLY, and that is the way this guard
	// dies: someone reformats a statement, the pattern stops matching, and the test
	// goes on reporting success over zero statements. The floor is well under the
	// count today (14 at the time of writing) so ordinary churn does not trip it,
	// and a rewrite that hides half the package does.
	if checked < 10 {
		t.Fatalf("only %d INSERT statements matched; the pattern has probably stopped fitting the code", checked)
	}
}

// packageConsts collects `const name = "..."` string constants declared anywhere
// in the package, so a column list assembled as `"a, b, " + someCols` can be read
// as the columns it actually names.
func packageConsts(t *testing.T, files []string) map[string]string {
	t.Helper()
	decl := regexp.MustCompile("(?m)^\\s*(?:const\\s+)?(\\w+)\\s*=\\s*`([^`]*)`")
	out := map[string]string{}
	for _, f := range files {
		src, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range decl.FindAllStringSubmatch(string(src), -1) {
			out[m[1]] = m[2]
		}
	}
	return out
}

// expandConsts replaces every `\`+ident+\“ splice in a raw-string column list
// with that constant's own text. Unknown identifiers are left alone: they then
// count as one column and the mismatch message prints them, which is a louder
// failure than silently assuming they are one.
func expandConsts(cols string, consts map[string]string) string {
	splice := regexp.MustCompile("`\\s*\\+\\s*(\\w+)\\s*\\+\\s*`")
	return splice.ReplaceAllStringFunc(cols, func(m string) string {
		name := splice.FindStringSubmatch(m)[1]
		if v, ok := consts[name]; ok {
			return v
		}
		return m
	})
}

// topLevelItems splits a comma-separated SQL list, treating anything inside
// parentheses as one item and dropping `--` comments — which the dialogues INSERT
// carries inside its VALUES list, explaining the inherited review flag.
func topLevelItems(s string) []string {
	// Comments first: a `--` runs to end of line and can contain commas and parens.
	var clean strings.Builder
	for _, line := range strings.Split(s, "\n") {
		if i := strings.Index(line, "--"); i >= 0 {
			line = line[:i]
		}
		clean.WriteString(line)
		clean.WriteString(" ")
	}
	out := []string{}
	depth, start := 0, 0
	body := clean.String()
	for i, r := range body {
		switch r {
		case '(':
			depth++
		case ')':
			depth--
		case ',':
			if depth == 0 {
				if item := strings.TrimSpace(body[start:i]); item != "" {
					out = append(out, item)
				}
				start = i + 1
			}
		}
	}
	if item := strings.TrimSpace(body[start:]); item != "" {
		out = append(out, item)
	}
	return out
}
