# ADR-0354: type: is the decisive import signal, with the heuristics kept for hand-written files

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `internal/httpapi/export_handlers.go` · `internal/httpapi/export_quotes.go`

**Decided.** The catalogue export always writes `type: movie` or `type: show`; the quotes export always writes `type: quotes` and nothing else; the book export deliberately writes no `type:` at all, so its absence is the book signal. The old heuristics still run.

**Why.** Six characters of frontmatter is a cheap price for a file that cannot be misread, and having exactly one line decide the routing means routing no longer depends on which optional fields happen to be filled in. The book export stays silent rather than gaining `type: book`, because the three-way discrimination is already complete once the other two announce themselves, and a book export is the one people are most likely to hand-write. The heuristics are kept for exactly those hand-written files and for exports written before the line became unconditional. I approved leaving the book exporter alone, which is the part of this that looks like an inconsistency and is not.

<sub>`internal/httpapi/export_handlers.go` · `internal/httpapi/export_quotes.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
