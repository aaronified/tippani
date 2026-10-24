# ADR-0267: Practice state persists per user, not per browser

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.9.2

**Decided.** The active deck, position and tally survive a reload, stored against the account.

**Why.** A refresh should drop you back on the same card rather than at the start. Per-browser storage would mean a shared browser shows one account's deck to the next person to sign in, which is a leak of what somebody is reading.

**Approved.** My call; I approved the per-user key specifically because the per-browser one was the obvious implementation.

<sub>0.9.2 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
