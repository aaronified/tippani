# ADR-0045: Open-ended vocabularies are validated in app code, never in a CHECK

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 0.4.x (migration 0004)

**Decided.** Migration 0004 dropped the `CHECK` on `annotations.source` because the importer list keeps growing — `md`, `bookcision`, `hardcover_html`, `readest`, `ocr` — and SQLite cannot alter a constraint. Every open-ended vocabulary since has followed: shelf status (`normalizeStatus`), review outcomes, the work `kind`. Two costs justify it. Altering a `CHECK` means a full table rebuild, and these are FK parents with cascading children — the most dangerous migration class in this repo. And a migration that fails means the application does not start, so a constraint that has to change on every vocabulary addition is a constraint that can take the box down over a new import format. Closed vocabularies — the six colours, the five sticker styles — keep their `CHECK`, because they are not open-ended. I settled this in 0004 and have applied it consistently since.

**Instead of.** Rebuilding the table each time the vocabulary grows. Rejected on both costs above.

<sub>0.4.x (migration 0004) — `internal/store/migrations/0004_quote_meta.sql` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
