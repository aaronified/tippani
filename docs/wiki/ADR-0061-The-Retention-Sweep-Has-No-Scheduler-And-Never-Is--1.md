# ADR-0061: The retention sweep has no scheduler, and "never" is -1

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** The purge runs once at boot and then at most once a calendar day, from whichever authenticated request is first after midnight — a date stamp in `settings`, checked in `requireAuth`. The window is a per-user preference of 7, 30, 90, or **-1** for never.

**Why.** A ticker means a goroutine and a wakeup on a machine that is otherwise asleep, which is the frugality budget this whole app is built inside. It also means "30 days" would be a promise made by a program that is not running: a self-hosted box gets switched off, and thirty days OF THE APP BEING ALIVE is the honest reading.

The stamp is written BEFORE the sweep, not after: two requests can arrive in the same millisecond after midnight, and the loser should do nothing rather than run a second concurrent sweep over the same rows.

`-1` for never is the subtle half. Preferences are one JSON blob with defaults applied on read, so a field nobody has set unmarshals to 0 — if 0 meant "never", every account that predates the bin would read as never-expire and the purge would never run for any of them. 0 stays "not saying" on the way in too, so a client can PUT the whole preferences struct without knowing this field exists.

**Instead of** a cron entry or a background goroutine (the budget), and instead of one instance-wide window (the setting is per person, so the sweep asks each owner).

**Approved.** Mine, including the -1, which I would defend hardest: it is the difference between a feature that works on a fresh install and one that works on every install.

<sub>1.8.0 — `internal/httpapi/trash.go` · `internal/httpapi/auth_handlers.go` · `cmd/tippani/main.go` · `internal/httpapi/trash_purge_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
