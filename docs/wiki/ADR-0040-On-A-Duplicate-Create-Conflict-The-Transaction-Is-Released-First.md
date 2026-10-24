# ADR-0040: On a duplicate-create conflict the transaction is released first

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.1.1

**Decided.** The duplicate-create path reads the existing row so a retried write is idempotent, and it used to read it through the pool while still holding its own INSERT transaction — which needs a *second* connection. The pool caps at four, so once those were in use the handler blocked waiting for a connection only it could free, and the request hung until `busy_timeout` turned it into a 500. It is reachable by the least exotic client behaviour there is: re-posting the same captures, which is what an offline queue does. The transaction is now rolled back before the read, which is safe and complete because the failed INSERT matched nothing and has no work to commit. I approved this fix the hour I understood it.

**Instead of.** Raising the pool size, which moves the cliff rather than removing it.

**Reversal.** None. A related wrinkle on the same path was fixed alongside: a row deleted concurrently between the failed insert and the read used to give a 500 and now gives a plain 409.

<sub>1.1.1 — `internal/httpapi/annotation_handlers.go` · `internal/httpapi/conflict_pool_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
