# ADR-0260: An unparseable or unknown scope means everything, never nothing

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.7.0

**Decided.** `scopeFlags` returns all three media when nothing recognisable parsed. `srScopeValid` separately *rejects* a list containing an unknown token rather than quietly dropping it. `parseScope` on the client mirrors the server's table.

**Why.** A deck that serves no cards because a preference failed to parse is indistinguishable from a deck you have finished, and it would be silent. On the write side the opposite rule applies: a scope that silently becomes a different scope is how somebody ends up wondering why their films stopped appearing. Two copies of a table is a drift risk, so the client's is asserted against the same rules, including this one.

**Approved.** Mine, and I approved the asymmetry between reading and writing deliberately — they are failing in different directions.

<sub>1.7.0 — `internal/httpapi/review_handlers.go` · `web/frontend/test/pure/review-scope.test.js` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
