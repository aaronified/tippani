# ADR-0244: Repetition statuses renamed to describe recall, and derived live

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.5.0

**Decided.** Soon / later / someday became remembered / forgetting / probably forgotten, with a fourth for unseen, computed at read time from recall probability and never stored.

**Why.** The old names described the raw half-life bucket, which is a fact about the schedule. The new ones answer the question the reader is actually asking, which is whether they can recall the quote now.

**Approved.** My call, approved with the derivation kept at read time so a rename could never leave a stored value behind meaning the old thing.

<sub>0.5.0 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
