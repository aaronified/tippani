# ADR-0041: Rows are collected before they are updated

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.2.0 (staging), 1.6.0 (people)

**Decided.** Two write paths that iterate and mutate — the staged-quote tag rewrite and the people rename — collect their rewrites into a slice first and apply them after the cursor closes, rather than executing inside the loop. The recorded reasoning is thin, and I am not going to inflate it: the comments say "collect before writing: SQLite dislikes writes mid-cursor" and "no exec while the cursor is open", and the rename adds that a full scan is fine because libraries are hundreds of rows and renaming is rare. That is the whole of what is written down. The rule is mine and I keep it, but it is a habit backed by a caution rather than a reproduction.

**Instead of.** A single `UPDATE` on the rename path, rejected for a separate and better-documented reason: `from` may be one component inside a joined credit ("Neil Gaiman & Terry Pratchett"), which SQL string equality cannot rewrite without clobbering the co-credits.

<sub>1.2.0 (staging), 1.6.0 (people) — `internal/httpapi/import_staged_bulk.go` · `internal/httpapi/people_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
