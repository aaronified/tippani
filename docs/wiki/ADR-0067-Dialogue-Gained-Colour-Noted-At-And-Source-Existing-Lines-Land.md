# ADR-0067: Dialogue gained colour, noted at and source; existing lines land on yellow

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.1.0

**Decided.** Migration 0021 gave dialogues the same four-value `color` CHECK annotations had; 1.1.0 added `noted_at` and `source` to both quote kinds. Every line already on disk was backfilled to `yellow`.

**Why.** These were the holes the 0003 near-copy left, and filling them made "mirror" literal rather than aspirational. Yellow is the column default and what an import writes when the source named no colour, so backfilling to it asserts nothing about the line — "nothing looks categorised that wasn't."

**Approved.** I approved this, including the yellow backfill, which was the only part with a wrong answer available.

<sub>1.1.0 — `CHANGELOG.md` · `internal/store/migrations/0021_dialogue_color.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
