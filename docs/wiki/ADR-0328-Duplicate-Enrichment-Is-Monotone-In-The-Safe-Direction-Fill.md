# ADR-0328: Duplicate enrichment is monotone in the safe direction: fill empty, upgrade colour off yellow, favourite only upward, tags union

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** `enrichStagedQuote` fills note, date and both locator sets only where they are absent, upgrades `color` only when the stored value is the yellow default and the incoming one is not, takes `MAX(favorite, ?)`, and unions tags case-insensitively. Existing values always win, so the first copy in the file is the one whose edits survive. The `_orig` snapshots follow their live column, so a locator arriving only on the second copy is still resettable.

**Why.** Every rule moves in one direction only, so enrichment can never lose information no matter how many copies a file carries. Yellow is the unset default rather than a chosen category, which is what makes "upgrade off yellow" a fill rather than an overwrite. A note-only first copy followed by a quoted duplicate keeps the quote too, because the hash is over quote-or-note and both are the same passage.

**Instead of.** Last-writer-wins — rejected; it makes the outcome depend on file order.

**Approved.** Mine, and I approved the monotonicity as the property to hold rather than the individual rules — it is what makes the whole thing reasonable about without tracing every path.

<sub>1.2.0 — `internal/httpapi/import_staging.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
