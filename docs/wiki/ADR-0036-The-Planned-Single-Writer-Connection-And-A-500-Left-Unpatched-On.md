# ADR-0036: The planned single-writer connection, and a 500 left unpatched on purpose

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.1.1

**Decided.** PLAN §8 specified a single writer connection. `store.Open` allowed four. When 1.1.1's adversarial re-read turned up concurrent writes still returning a 500, I deliberately did not patch it in that release, on the reasoning that it needed the single-writer design the plan had always specified rather than a spot fix. I recorded it in *Known bugs* on the roadmap and shipped without it. That was the right instinct about process and the wrong diagnosis about cause, and I own both halves — the bug then sat in the roadmap for two releases.

**Instead of.** An in-process mutex around the two write paths that had reproduced, shipped in 1.1.1. Rejected as a patch over a design.

**Reversal.** Reversed in full by 3.5. The design I was protecting was not the fix.

<sub>1.1.1 — `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
