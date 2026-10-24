# ADR-0216: ftsQuery repairs in-request, and refuses to escalate on the hot path

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 0.6.4

**Decided.** `ftsQuery` runs the `MATCH`, and on failure calls `Store.RepairIndex` — DROP the triggers and the virtual table, recreate both from DDL read out of `sqlite_master`, then `'rebuild'` — and retries once. Search recovers within the same request. What it deliberately does *not* do is escalate to `Recover()`, even though that is the strictly more powerful repair, because `Recover` swaps `s.DB` and would race in-flight request goroutines on the hot path. The rare case where even `DROP` fails is left to `RepairFTS` → `Recover` on the next (now-clean) restart, or to the admin "Rebuild search index" action. Repairs serialise on `repairMu`, so two concurrent searches hitting the same corrupt index cannot race on the DROP. I approved the deliberate ceiling; a self-heal that can swap the database out from under a live request is not a self-heal.

**Instead of.** Escalating in-request, which is the tempting completeness.

<sub>0.6.4 — `internal/store/repair.go` · `internal/httpapi/search_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
