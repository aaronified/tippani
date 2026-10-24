# ADR-0238: quiz results was replaced by quiz sessions, and the old score history dropped

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.5.0

**Decided.** 0015 replaces 0014's `quiz_results` with `quiz_sessions` — one row per reviewer-local day per mode. The previous multiple-choice score history is not carried over.

**Why.** `quiz_results` modelled the old MCQ round and cannot express the daily-versus-practice split. Migrating it would have meant inventing a mode for every historical row. The schedule itself — the part that matters — is fully preserved.

**Instead of.** Mapping every old row to `mode='daily'` — rejected as fabricating history.

**Approved.** I approved the drop, and made it say so in the release notes rather than letting people discover an empty chart.

<sub>0.5.0 — `internal/store/migrations/0015_review_rework.sql` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
