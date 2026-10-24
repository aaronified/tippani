# ADR-0262: A Daily re-answer on the same local day is an idempotent echo

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.x

**Decided.** If the mode is `daily` and the card was already touched today, the handler replies with the current state and writes nothing.

**Why.** The deck already excludes cards answered today, so a well-behaved client never re-answers one — but a stale second device or a retried POST can, and re-applying growth would compound the half-life and double-count the tally. Answering with the real state rather than an error means a retry succeeds, which is what a retry is for.

**Approved.** Mine, approved as an echo rather than a 409, because a client that cannot tell a duplicate from a failure drops the answer.

<sub>1.x — `internal/httpapi/review_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
