# ADR-0429: A replace is previewed because its damage is the only kind you cannot see

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.16.x

**Decided.** Find-and-replace over a selection is two endpoints — `/replace/preview` writes nothing, `/replace/apply` writes everything — and takes literal text with optional case-matching and whole-word, never a regular expression.

**Why the split rather than a flag.** Every other bulk action in this app leaves evidence: a wrong tag is a tag you can see and remove, a wrong colour is a colour. A wrong replace has rewritten the words, and the words are the thing the app exists to keep. So the preview returns the before and after of every row it would touch, and the decision is made against what will happen rather than against a pattern somebody believes they understand. Two routes also mean a caller cannot reach the destructive one by getting a boolean wrong.

**No regular expressions**, and that is a decision rather than an unfinished feature: `.*` is one keystroke away from `.` and would empty every quote in the selection. Literal text covers the actual post-import complaints — a doubled space, a stray running head, a mangled quote mark — and cannot express "delete everything". Whole-word is implemented without a pattern for the same reason.

**An empty `find` is refused outright.** It matches at every position, so it would thread the replacement through every character of every quote in the selection — the most destructive thing the endpoint could be asked to do, and the easiest to ask for by accident by leaving a box blank.

**Unlike the bulk field editor, the quote's own words ARE replaceable here**, and the preview is what makes the difference legitimate: bulk-setting a quote replaces forty different sentences with one, while replacing "teh" with "the" leaves forty different sentences forty different sentences.

<sub>1.16.x — `internal/httpapi/replace_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
