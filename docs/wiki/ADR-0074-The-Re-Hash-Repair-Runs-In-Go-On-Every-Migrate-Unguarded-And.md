# ADR-0074: The re-hash repair runs in Go on every Migrate, unguarded and idempotent

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.3.1, amended in 1.5.0

**Decided.** `BackfillDialogueHashes` rewrites `dedupe_hash` wherever a row carries an episode and still holds the old text-only hash. It runs from `Migrate` rather than from a migration file, is deliberately unguarded and re-run every time, and a row whose UPDATE hits the UNIQUE is logged and skipped.

**Why.** SQLite has no `sha256`, so the value can only be computed in Go. Unguarded is what makes it idempotent and self-healing on all four `Migrate` paths, including the two repair paths that copy base tables into a fresh database and could otherwise carry stale hashes back in past a one-shot flag. The skip matters more: this runs from `Migrate`, so a returned error means the application does not start, and refusing to boot over a pair of near-identical quotes is a far worse outcome than leaving one of them on its old hash. The consequence of skipping is bounded and visible — that row can still be duplicated by a future import, exactly as it could before.

**Instead of.** A settings-flag guard so it runs once — rejected; it would have defeated the two restore paths.

**Approved.** My decision on both halves, and I approved the log-and-skip after 1.5.0 made a collision possible for the first time.

<sub>1.3.1, amended in 1.5.0 — `internal/store/hash.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
