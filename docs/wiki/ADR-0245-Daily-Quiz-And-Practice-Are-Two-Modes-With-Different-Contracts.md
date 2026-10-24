# ADR-0245: Daily Quiz and Practice are two modes with different contracts

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.5.0

**Decided.** Daily Quiz is the authoritative scheduler: due cards only, no skip, every answer recorded, always moves the half-life, permanent per-day history and streak. Practice is unlimited, skippable, covers the whole in-scope pool, and by default does not move the schedule — `srPracticeCounts` opts in — with its own resettable score.

**Why.** One surface trying to be both is a surface where you cannot tell whether answering costs you anything. Separating them means Practice can be used freely without consequences, which is the only way it gets used.

**Approved.** Mine, and I approved the default being off: opting *into* consequences is the safe direction.

<sub>0.5.0 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
