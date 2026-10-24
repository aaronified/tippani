# ADR-0534: Keeping something out of the quiz is a column on the row, not a flag on the schedule

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.11.1

**Decided.** Migration 0033 adds `review_excluded` to `books`, `movies`, `annotations`, `dialogues` and `utterances`. The rule lives in `reviewSource.where()`, the one string every deck query splices. The API says `review: true|false` — what the reader wants — and inverts it once, at the write.

**Why.** `item_reviews` is where a scheduling fact looks like it belongs, and it is a trap: that table has NO ROW for a quote never reviewed, so excluding an unseen one means inserting a bare row — and four separate queries read "a row exists" as "this card has been seen". Excluding a quote and putting it back would silently promote it from never-seen to seen-and-overdue: a lie about the reader's own history, told by a preference they set for an unrelated reason. There is a test whose whole job is to assert that a round trip changes nothing.

A column on the row also travels for free everywhere a quote already travels — the bin snapshots with `SELECT *`, the account backup does the same, the export carries the row — so three features support it without knowing it exists.

**The flag is on the WORKS too**, because "this book is not for quizzing" is a fact about the book rather than about the forty highlights it has today: exclude a reference manual and the highlight added to it tomorrow is excluded as well, which is what somebody who excluded a manual meant. The deck already joins each child quote to its parent for ownership, so the parent's flag costs one term and no new join.

`where()` is the choke point on purpose. FIVE queries splice it — three candidate fetches, the cards-left count, the status breakdown — and a rule reaching four of them is a badge counting a card the deck will never serve, which reads as the quiz being broken rather than as a filter being inconsistent.

**Instead of.** A flag on `item_reviews` (invents review history). A separate `review_exclusions` table (a fourth polymorphic table with no foreign keys, three more delete triggers, and additions to the bin and the account snapshot — all to store one bit).

**Approved.** Mine. This is the roadmap's "suspend a quote from rotation", built when the selection bar gave it somewhere to live.

<sub>1.11.1 — `internal/store/migrations/0033_review_exclusion.sql` · `internal/httpapi/review_handlers.go` · `internal/httpapi/bulk_handlers.go` · `internal/httpapi/review_exclusion_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
