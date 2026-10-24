# ADR-0309: The recall log is one row per answer, beside a schedule that is one row per card

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** Migration 0064 adds `item_recalls` — the result, the half-life that stood after it, the gap since the previous review, and the time — written from `handleReviewAnswer` inside the same transaction as the schedule update, for every answer including skips. A failed insert is logged (`TIP-REVIEW-002`) and carried on from rather than rolled back. It is in `accountTables`, so it travels in every backup. 0065 gives it the third delete trigger `item_reviews` never needed, and `GET /review/card` is the only thing that reads it.

**Why.** The owner asked for a popup behind the repetition mark: *"it should show a popup for the halflife status, and recall history (will need to create a recall history table)"*. `item_reviews` is a current state with no memory, so the answer before last is gone and nothing can say when a card was forgotten or how a thirty-day half-life was arrived at. The log sits BESIDE the schedule rather than inside it: rolling a transaction back because a history row would not write would cost the reader the grade they earned. It carries a `user_id` even though `item_reviews` has none, because the repo's isolation invariant is stated flatly and a later stats screen reads a log per reader.

**Instead of.** Deriving the history from the schedule — impossible, it holds one row. And a scheduler that replays this log to decide anything, which is a different design: nothing reads it to schedule, deliberately, with an overhaul coming. If that overhaul wants a replay it can build one from here with no migration to fill the history, because the history will already be there.

**Approved.** Mine. The trigger is 0065's own migration rather than an edit to 0064, which was already on the branch the owner runs — editing it would leave the trigger out of every database that had applied it.

<sub>3.1.0 — `internal/store/migrations/0064_recall_log.sql` · `internal/store/migrations/0065_recall_log_utterances.sql` · `internal/httpapi/review_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
