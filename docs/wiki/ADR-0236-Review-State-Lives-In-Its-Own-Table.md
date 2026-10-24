# ADR-0236: Review state lives in its own table

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.4.0

**Decided.** Migration 0013 put the schedule in `annotation_reviews`, one row per annotation, created lazily on the first answer; rows without one are the unseen pool.

**Why.** So that editing a quote, toggling its heart, or re-importing it never disturbs the schedule. Review state also never enters a dedupe hash and is invisible to FTS, for the same reason.

**Approved.** My call; I approved the separate table over three columns on `annotations`.

<sub>0.4.0 — `docs/wiki/Design-decisions.md` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
