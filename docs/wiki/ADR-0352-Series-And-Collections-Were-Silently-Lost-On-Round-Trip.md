# ADR-0352: Series and collections were silently lost on round-trip

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `internal/httpapi/export_handlers.go`

**Decided.** Both renderers emit a `Name #1.5` value — books as `series:`, films and shows as `collection:` — and both parsers read it back, fill-empty-only.

**Why.** The frontmatter carried title, author, year and genres and never the series, so a library rebuilt from its own export silently lost every series and collection it had. Silently is the word that matters: nothing failed, the books all came back, and the structure did not. Fill-empty-only on the way in means a value already on the row wins, so re-importing an old export cannot undo a series you have since corrected. There was a second, unplanned benefit: `collection:` is written only by the catalogue export, so it became a decisive routing signal for a film with no director. I approved fixing both renderers and both parsers in one change, because half of it would have produced files that only round-trip one way.

<sub>`internal/httpapi/export_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
