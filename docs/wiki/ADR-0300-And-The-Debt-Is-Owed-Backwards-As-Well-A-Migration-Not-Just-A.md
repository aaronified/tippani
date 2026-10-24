# ADR-0300: And the debt is owed backwards as well: a migration, not just a create path

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 2.1.3

**Decided.** `0046_review_exclusion_backfill.sql` writes `review_excluded = 1` onto every quote of every work that already carries it. One direction: an excluded work stamps its children, an included work clears nothing.

**Why the two entries above did not finish the job.** Both are about paths that run *from now on* — the toggle, the three create sites. Neither looked at the rows that were already there. Under 0033 a work's children never needed the flag, because the deck ANDed the parent's; the moment 1.15.0 stopped reading it, every book anybody had ever skipped quietly put its highlights back into the deck. The report, third of its kind: *"Homo Deus is skipped from the daily quiz. So is Sapiens. Yet both are coming in quizzes. Only one quote has the skip mark, which I manually added."*

**Why nobody would have found it by looking.** The work keeps its own flag, so the tile keeps its mark, the edit form keeps its state, and every screen goes on agreeing that the book is skipped. The only surface that disagrees is the deck, which is the one surface that never explains why it chose a card. And it is not historical: a restore of any backup taken before 1.15.0 lands the same state on a current build.

**What it costs, stated rather than discovered.** Excluding a work and then putting one quote of it back is a reachable state this section deliberately supports — and in the data it is indistinguishable from a stale row, both being a work at 1 with a child at 0. So that child is re-excluded. The conservative rule that suggests itself, *skip any work that already has an excluded child*, would have left the reported library broken, because that library is precisely a skipped book with one hand-skipped quote in it. A re-excluded card is one press and a visible mark away from fixed; a book that goes on being asked about is the bug.

**Instead of** a repair pass in Go beside `BackfillDialogueHashes`, which is where a rule that cannot be expressed in SQL goes. This one is two `UPDATE`s.

**Approved.** The reader's, from the report.

<sub>2.1.3 — `internal/store/migrations/0046_review_exclusion_backfill.sql` · `internal/store/migrate_review_backfill_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
