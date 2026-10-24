# ADR-0117: completed is settled, but clearing to empty stays legal from every state as the undo for a mis-tap

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.3.0

**Decided.** `statusTransitionAllowed` enforces exactly one rule: from `completed`, the only move is to the in-progress status for that side. Pausing or abandoning something already finished answers 409. Clearing back to `''` is legal from every status, `completed` included.

**Why.** Pausing something you already finished is not a thing that happens, so it is refused rather than quietly accepted. But clearing is not a lifecycle move — it is the undo for a mis-tap, and without it a wrong click would be permanent.

**Instead of.** A full state machine over all five states — rejected; one real rule is all the lifecycle actually has, and inventing four more would refuse things people legitimately do.

**Approved.** I approved keeping the gate this small on purpose. A validation rule that exists to look thorough is a rule that eventually blocks someone for no reason.

<sub>1.3.0 — `internal/httpapi/shelf.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
