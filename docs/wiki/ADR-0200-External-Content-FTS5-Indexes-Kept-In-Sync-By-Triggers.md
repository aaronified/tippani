# ADR-0200: External-content FTS5 indexes, kept in sync by triggers

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** from 0.1.0

**Decided.** Five virtual tables — `books_fts`, `annotations_fts`, `movies_fts`, `dialogues_fts`, `utterances_fts` — declared `content='<table>'` with `content_rowid='id'`, kept in step by AFTER INSERT / DELETE / UPDATE triggers (the update trigger issues an FTS `'delete'` row then re-inserts). External content means the index stores terms and not text, so a quote is not stored twice. The plan attaches a condition to that choice which turned out to be the important one: keep an `INSERT INTO x_fts(x_fts) VALUES('rebuild')` maintenance path. Because the index is derived, a corrupt one loses nothing recoverable — it can always be rebuilt from the content it mirrors, and every repair in this section rests on that. I approved the design at plan time and the escape hatch with it.

**Instead of.** A contentless or self-contained FTS5 table, which stores the text again.

<sub>from 0.1.0 — `docs/wiki/Design-decisions.md` · `internal/store/repair.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
