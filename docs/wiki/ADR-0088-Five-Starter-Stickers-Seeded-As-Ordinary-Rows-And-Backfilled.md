# ADR-0088: Five starter stickers, seeded as ordinary rows and backfilled once per instance

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.7.9

**Decided.** A heart, a star and three faces ship as embedded SVGs. On account creation — and once, at boot, for accounts that predate the feature — each is copied into that user's own `MediaCover` store with `StoreImage` and inserted into `stickers` exactly like an upload. They are indistinguishable from uploads afterwards: renameable, deletable, served by the cover route, carried in a backup, removed with the user. The backfill is guarded by the `seeded_stickers_v1` key in `settings`.

**Why.** The feature shipped upload-only, so the first thing it asked of a new reader was to go and find a transparent PNG. Five in the box means a seal can be pinned to a quote in the first minute, which is the only way anybody finds out what the seal *is*.

The reason they are ordinary rows rather than built-in ids is the count of places that would otherwise need a branch: the cover serve route, the picker, rename, delete, the annotation/dialogue foreign key, user deletion, and the backup archive. A negative or reserved `sticker_id` would have bought a few kilobytes per account and cost a special case in every one of them, each of which is a place to forget it.

The flag is the whole safety argument for the backfill. Without it the sweep runs on every boot, and a starter sticker somebody deliberately deleted is back after the next restart — a bug that reads as the app not saving anything, and one nobody would report as a sticker bug. The flag is set even where an individual copy failed: a full disk or a read-only volume does not clear up by being retried a thousand times, and `TIP-STICKER-002` is the honest signal instead.

**Instead of** a store migration. Migrations run against the database alone, and this writes image files into the cover store — that is the server's business, not the schema's, and a migration that needed `DataDir` would be the first one to know where the data directory is.

**Approved.** Mine, including the choice to seed rather than to ship a built-in kind.

<sub>1.7.9 — `internal/httpapi/seed_stickers.go` · `internal/httpapi/assets/stickers/` · `internal/httpapi/auth_handlers.go` · `internal/httpapi/admin_handlers.go` · `cmd/tippani/main.go` · `internal/httpapi/seed_stickers_test.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
