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

// ---- exact phrases (roadmap §3) --------------------------------------------
//
// `"to be or not to be"` is one FTS5 phrase, not six independent prefix terms.
// For a library MADE of phrases there was no way to ask for one at all, which
// is the odd gap in a search that is otherwise good at half-remembering.
//
// THE PREFIX STAR MUST NOT GO INSIDE A PHRASE. `"to be or not to be"*` is a
// different query — it asks for a phrase ending in a word beginning "be" — and
// is not the one anybody typed. So a quoted run is emitted verbatim and only
// the loose words keep the typeahead behaviour they have always had.
//
// AN UNBALANCED QUOTE IS NOT AN ERROR. Somebody typing a quotation mark
// mid-search should get results, not a red box, so an unclosed quote is treated
// as an ordinary character and its words search loosely — the same forgiveness
// `note\:` gets in the facet grammar. That is also why this cannot simply split
// on `"`: an odd number of them has to fall back rather than swallow the tail.

// SplitPhrases separates a query into its quoted runs and its loose words.
// Returns nil phrases when the quotes do not balance, so the caller can treat
// the whole thing as loose text.
func SplitPhrases(q string) (phrases []string, loose string) {
	if strings.Count(q, `"`)%2 != 0 {
		return nil, q
	}
	var out []string
	var rest strings.Builder
	for {
		i := strings.Index(q, `"`)
		if i < 0 {
			rest.WriteString(q)
			break
		}
		j := strings.Index(q[i+1:], `"`)
		if j < 0 { // unreachable while the count is even, but never trust that
			rest.WriteString(q)
			break
		}
		rest.WriteString(q[:i])
		rest.WriteString(" ")
		if p := strings.TrimSpace(q[i+1 : i+1+j]); p != "" {
			out = append(out, p)
		}
		q = q[i+j+2:]
	}
	return out, rest.String()
}

// PhraseQuery is PrefixQuery with quoted runs kept whole.
//
//	`"to be" hamlet` -> `"to be" "hamlet"*`
//
// A query that is ONLY a phrase produces only that phrase, so nothing is
// widened by a stray prefix term; a query with no quotes at all is exactly
// PrefixQuery, which is what every existing caller and test already expects.
func PhraseQuery(q string) string {
	phrases, loose := SplitPhrases(q)
	if len(phrases) == 0 {
		// `loose`, not `q`. They are the same string when the quotes did not
		// balance — which is the forgiving path — but differ when every quoted
		// run was EMPTY (`"" hamlet`): using q there would feed the bare quote
		// marks to PrefixQuery, which quotes them again and searches for nothing.
		return PrefixQuery(loose)
	}
	parts := make([]string, 0, len(phrases)+1)
	for _, p := range phrases {
		parts = append(parts, `"`+strings.ReplaceAll(p, `"`, `""`)+`"`)
	}
	if strings.TrimSpace(loose) != "" {
		parts = append(parts, PrefixQuery(loose))
	}
	return strings.Join(parts, " ")
}

// ColumnPhraseQuery is ColumnPrefixQuery with phrase support, for the sectioned
// search's per-column queries.
func ColumnPhraseQuery(cols, q string) string {
	return "{" + cols + "} : (" + PhraseQuery(q) + ")"
}
