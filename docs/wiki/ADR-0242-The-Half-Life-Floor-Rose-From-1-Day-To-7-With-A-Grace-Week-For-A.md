# ADR-0242: The half-life floor rose from 1 day to 7, with a grace week for a new quote

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.8.6

**Decided.** `reviewMinStability` is 7 days — the ladder's first rung, the floor applied to stored stabilities in the due-ness SQL, and the unseen-card default. `reviewNewItemDays` gives a quote its first week reading "remembered" and not yet due, from `created_at`. A recorded lapse still wins over the grace week.

**Why.** A one-day floor asks you about a quote you wrote down yesterday, which is not a memory test. Having just written something down counts as knowing it. The floor is applied in the queries rather than by rewriting rows, because a stored stability can predate a floor raise.

**Approved.** I approved both numbers, and specifically the exception that a lapse beats the grace — otherwise a wrong answer would be silently forgiven for a week.

<sub>0.8.6 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
