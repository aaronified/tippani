// Package search builds safe FTS5 MATCH expressions.
//
// User input passed to MATCH is parsed as FTS5 *query syntax* even when it is
// parameter-bound (AND/OR/NOT/NEAR, col:, -, *, ^, quotes). Never pass raw
// input; always go through Query. See docs/PLAN.md §4.
package search

import "strings"

// Query turns free text into a safe FTS5 expression: each whitespace token is
// double-quoted (embedded quotes doubled), joined with implicit AND.
//
//	`foo bar"baz` -> `"foo" "bar""baz"`
func Query(q string) string {
	fields := strings.Fields(q)
	if len(fields) == 0 {
		return `""`
	}
	for i, tok := range fields {
		fields[i] = `"` + strings.ReplaceAll(tok, `"`, `""`) + `"`
	}
	return strings.Join(fields, " ")
}

// PrefixQuery is Query with a trailing * on the final token, for typeahead.
func PrefixQuery(q string) string {
	esc := Query(q)
	if esc == `""` {
		return esc
	}
	return esc + "*"
}
