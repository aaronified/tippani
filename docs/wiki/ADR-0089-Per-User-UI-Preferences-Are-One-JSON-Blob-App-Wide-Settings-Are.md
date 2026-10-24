# ADR-0089: Per-user UI preferences are one JSON blob; app-wide settings are their own table

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 0.x

**Decided.** Migration 0005 adds `users.preferences TEXT NOT NULL DEFAULT '{}'` and a separate `settings(key, value)` table.

**Why.** A preference belongs to a person and is read whole on every `GET /auth/me`, so one blob with defaults applied on read costs one column and no migration per new key, and `PUT /auth/me/preferences` is a partial merge. A metadata API key belongs to the instance rather than to a reader, there is exactly one of each, and the server never sends a stored secret back — a key/value table is the honest shape for that and keeps it out of a document the browser is handed on every login.

**Approved.** Mine, and I approved the split rather than folding the keys into the same blob for convenience.

<sub>0.x — `internal/store/migrations/0005_ui_prefs.sql` · `docs/wiki/Design-decisions.md` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
