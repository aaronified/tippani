# ADR-0068: One deliberate asymmetry: note-only is a book's privilege

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.1.0, extended to the third kind in 1.5.0

**Decided.** `annotations` keeps `CHECK (quote IS NOT NULL OR note IS NOT NULL)`. `dialogues.quote` and `utterances.quote` are `NOT NULL`.

**Why.** A thought about a page with no passage attached is a real annotation. A thought about a film belongs on the film, not on a line nobody said. 0026 puts the third kind bluntly: "An utterance with no words is not a quote by anything it could mean."

**Instead of.** Making all three note-capable for symmetry — rejected, since the symmetry would have been the point rather than the behaviour.

**Approved.** Mine. I signed this off as the one difference worth keeping after the parity work removed every other one.

<sub>1.1.0, extended to the third kind in 1.5.0 — `docs/wiki/Design-decisions.md` · `internal/store/migrations/0026_utterances.sql` · `internal/store/migrations/0029_six_colours.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
