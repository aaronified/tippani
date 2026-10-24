# ADR-0773: A generation guards every owner across a file swap

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** The store counts its swaps — each restore, recovery and factory reset — as a generation. `requireAuth` reads it before it resolves the session, and the id on every job row and line travels with the generation it was read under. An in-request job whose generation is stale when it is written lands with no owner, which makes it the admin's; a job line from another generation is not written into this file; a press made across a swap is refused as busy, and the same press again goes ahead. A job is also written under an account only while that account exists under that name — the check is inside the transaction that adds the row — so the worker's check at the claim can be by id alone, with 0079's trigger clearing `user_id` on every job of an account that is deleted.

**Why.** `users.id` is reused, and a restore can put anybody behind an id. Reading the generation before the session is the order whose only failure is a good id dropped as stale; read after, an old id would pass for whoever holds it in the restored file. Checking the name at the claim as well, which the design first asked for, would fail a waiting job whose owner renamed themselves.

**Instead of.** Rewriting `jobs.username` on a rename: the column records who started the job. A foreign key with `ON DELETE SET NULL`, which is also checked on insert and would fail a whole batch of the log over one row whose account went in the meantime.

<sub>3.1.0 — `internal/store/store.go` · `internal/jobs/logbook.go` · `internal/jobs/runner.go` · `internal/store/migrations/0079_jobs.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
