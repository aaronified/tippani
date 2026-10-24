# ADR-0059: What travels with a deleted thing is DECLARED, because the foreign-key graph is incomplete

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** The writer carries a hand-listed set of tables per kind — the row, its quote children, their tag joins, the tag and genre ROWS by name, `item_reviews` and `work_reads` — rather than walking `PRAGMA foreign_key_list`.

**Why.** The FK walk is the obviously-robust choice and it silently loses data here. `item_reviews` is polymorphic `(kind, item_id)` and `work_reads` is `(kind, work_id)`; neither can hold a real foreign key to three parents, so both are cleared by AFTER DELETE TRIGGERS instead (0015, 0024, restated in 0029). A walk of the FK graph finds neither, and the restore that follows looks perfect: the book is back, the quotes are back, and a year of review history is quietly a new card. Nothing throws and nothing logs.

Tags and genres travel by NAME as well as by id for a related reason: both outlive the rows that used them — a tag is managed vocabulary, and a genre is garbage-collected when its last work goes — so between the delete and the restore an id can be gone or belong to something else. The name is the stable thing.

**Instead of** the FK walk, and this entry exists mostly to argue against it, because it is what the next person will reach for and for good reasons.

**Approved.** Mine, on the strength of the verification rather than the plan: the plan said "follow the cascade edges rather than a hand-written list", and the schema disagreed.

<sub>1.8.0 — `internal/httpapi/trash.go` · `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash_test.go` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
