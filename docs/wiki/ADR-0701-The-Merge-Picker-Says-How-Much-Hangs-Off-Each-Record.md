# ADR-0701: The merge picker says how much hangs off each record

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — `GET /people/search` returns a `works` count per hit (credits plus roles),
  and the panel draws it beside the name.
- **Why.** The case this control exists to resolve is two records spelled the same, and a
  list of bare names cannot tell them apart — so the reader would be choosing which of two
  identical rows to destroy by guessing. It is the rule 0056 already set for the character
  picker, applied to the other table.

<sub>Unreleased — `internal/httpapi/identity_handlers.go` · `web/frontend/src/identity.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
