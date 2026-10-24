# ADR-0083: Tags are one per-user vocabulary across every medium, with no auto-GC

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 0.x, GC removed with the managed vocabulary

**Decided.** One `tags` table per user, joined by `annotation_tags`, `dialogue_tags` and `utterance_tags`. Colour and style columns since 0005. Names are trimmed, capped at 64 runes and deduped case-insensitively; `setTags` and the importers auto-create unknown names with the yellow/sticker defaults. A tag that drops to zero usage keeps its colour and style until `DELETE /tags/{id}`, and the join rows cascade from there.

**Why.** One vocabulary is what makes "grief" mean the same thing on a book highlight, a film line and a speech. The garbage collector went because a tag is a vocabulary entry, not a join count: sweeping it at zero usage throws away the colour and the style you set the first time you used it, and you find out the next time you use the name.

**Approved.** Mine, and I approved removing the GC rather than making it smarter about what it kept.

<sub>0.x, GC removed with the managed vocabulary — `docs/wiki/Design-decisions.md` · `internal/store/migrations/0026_utterances.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
