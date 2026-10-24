# ADR-0253: Every third Daily slot is reserved for a never-seen card

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.0.0

**Decided.** `reviewUnseenShare = 3` — at the default quota of 8, two unseen a day. Either bucket yields its slots when empty. Practice deliberately does not inherit the reservation.

**Why.** It is a policy trade-off, not a derivation, and the arithmetic is written down: a brand-new card takes the 7-day rung on its first correct recall, so it returns at +7 and again at +37 before reaching 100 — two returns per admission, plus N/100 a day of maintenance once a library matures. Holding intake to a third keeps that inside a default quota for a few hundred cards; past that the quota is the reader's lever. Deferring a due card does not make the schedule lie: the header promises a due *state*, the seen bucket stays ordered most-overdue-first, and a backlog degrades into honest FIFO by overdue-ness. Practice has no schedule to honour, so reserving slots there would make an already-reviewed card several times *more* likely to come up than an unreviewed one.

**Approved.** I approved the ratio and the reasoning behind refusing it to Practice, which is the half people would expect to be symmetric.

<sub>1.0.0 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
