# ADR-0617: docs/wiki/Design-decisions.md stays; ROADMAP.md and MILESTONE-3.md go

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.3.1

**Decided.** `ROADMAP.md` was replaced by `docs/roadmap.html`, `docs/MILESTONE-3.md` was removed as a one-off build record referenced from nowhere, and `docs/wiki/Design-decisions.md` stays.

**Why.** Design-decisions.md is cited from roughly 148 places in the code as the record of *why*, and deleting it would orphan all of them. Release history is not duplicated in the roadmap, since the changelog and the releases page already hold it.

**Approved.** My call on all three, and I approved keeping the one with inbound citations rather than the one that read best.

<sub>1.3.1 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
