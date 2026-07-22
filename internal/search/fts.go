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

// PrefixQuery makes every whitespace token a prefix match, for typeahead: each
// token is double-quoted (embedded quotes doubled) with a trailing *, joined
// with implicit AND. So "shaw red" -> `"shaw"* "red"*`, which matches
// "Shawshank Redemption" as you type. Raw input never reaches MATCH.
//
//	`shaw red` -> `"shaw"* "red"*`
func PrefixQuery(q string) string {
	fields := strings.Fields(q)
	if len(fields) == 0 {
		return `""`
	}
	for i, tok := range fields {
		fields[i] = `"` + strings.ReplaceAll(tok, `"`, `""`) + `"*`
	}
	return strings.Join(fields, " ")
}

// ColumnPrefixQuery scopes PrefixQuery to the given FTS columns via an FTS5
// column filter, so a facet query matches ONLY those columns ("{author} :
// ("orw"*)" finds Orwell in the author column, not a book titled "Orwell").
// cols is a fixed space-separated column list written by the caller — never
// user input; the user text still goes through PrefixQuery's quoting.
//
//	`author`, `shaw red` -> `{author} : ("shaw"* "red"*)`
func ColumnPrefixQuery(cols, q string) string {
	return "{" + cols + "} : (" + PrefixQuery(q) + ")"
}
