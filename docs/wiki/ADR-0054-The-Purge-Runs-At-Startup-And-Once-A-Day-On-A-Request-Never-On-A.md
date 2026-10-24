# ADR-0054: The purge runs at startup and once a day on a request, never on a ticker

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** Two triggers, no scheduler: immediately after `st.Migrate()` at startup, and once a day on the first request that observes the date has changed since the last sweep, from a date stamp in settings. Nothing to leak, and nothing running on an idle instance — which is PLAN §2's no-pollers rule holding. The semantics that falls out is also the better one: nothing is expiring while nothing is running, so "30 days" means 30 days of the app being alive, which is the honest reading on a self-hosted box that gets switched off. I approved the mechanism for the CPU budget and kept it for the semantics.

**Instead of.** A background ticker goroutine.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
