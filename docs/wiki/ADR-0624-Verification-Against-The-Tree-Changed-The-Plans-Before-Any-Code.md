# ADR-0624: Verification against the tree changed the plans before any code was written

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.x

**Decided.** Each plan opens with a "What already exists" table verified against a named commit — `09f8a5b` (v1.7.3) — and records what verification changed.

**Why.** Verification moved real claims. The trash plan's earlier draft budgeted work for reindexing after a restore; the FTS triggers already cover insert and delete, so the index follows the rows and the worry was unfounded — worth stating precisely because 1.7.1 genuinely was bitten by an external-content index. It also found that `id INTEGER PRIMARY KEY` is a rowid alias on all five tables, so SQLite *does* reuse a freed id when the deleted row held the highest — which is the common case, since you delete the thing you just added — and that turned "restore the original id" from a one-line decision into an open question with three costed answers. The search plan found the context-aware half already built and already deliberate; what was missing was that nothing on screen said which scope you got.

**Approved.** Mine, and I approved planning against the tree rather than against my memory of it.

<sub>1.7.x — retired into this document at 1.14.2; the plans are in git</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
