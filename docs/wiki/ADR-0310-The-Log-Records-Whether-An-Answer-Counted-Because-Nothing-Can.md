# ADR-0310: The log records whether an answer counted, because nothing can work it out later

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** Migration 0066 adds `mode` and `counted` to `item_recalls`, both nullable with no default. `moveSchedule` — `(mode == "daily" || pf.SRPracticeCounts) && result != "skip"` — is written into the row rather than reconstructed from it.

**Why.** Practice moves nothing unless the reader has opted in, so twenty practice answers leave a half-life exactly where it started, and a history showing twenty answers beside seven days reads as the scheduler being broken. `elapsed_days` cannot carry that fact: it is NULL for every uncounted answer AND for a genuine first one, and one field cannot mean two things and be read. And `counted` is not recoverable afterwards even knowing the mode, because `srPracticeCounts` is a setting that can be turned on tomorrow — a log written without it can never be repaired, which is why this went in before the popup rather than after.

**Instead of.** Deriving it in the client, which would be a fourth spelling of `moveSchedule` against a setting whose past value the client does not know. And defaults: `counted = 0` is false of every Daily Quiz answer 0064 had already logged, so NULL is the only true thing a migration can say about those rows, and the panel draws it as silence.

**Approved.** Mine.

<sub>3.1.0 — `internal/store/migrations/0066_recall_log_mode.sql` · `internal/httpapi/review_handlers.go` · `internal/httpapi/review_card.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
