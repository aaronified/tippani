# ADR-0263: itemAgeDays and ownsItem switch exhaustively

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** Both switch on the review kind with no default arm that reaches a table. `itemAgeDays` returns "very old" plus an error for an unknown kind; `ownsItem` answers "no".

**Why.** Both used to fall through to `annotations`, so a mistyped kind would have silently aged somebody's annotation by that id instead of failing — and `ownsItem` is the only thing standing between a review write and someone else's row. This is the same defaulting fault that, in the orphan sweep, would have deleted people: a switch written for exactly three kinds, correct only for that reason.

**Approved.** My call after the sweep bug, and I approved auditing the other switches rather than fixing the one that had bitten.

<sub>1.5.0 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
