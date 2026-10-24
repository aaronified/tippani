# ADR-0065: Dialogues shipped without colour, tags or importers

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** Pre-1.0, in §3b as first written

**Decided.** When films arrived, a dialogue carried `timestamp`, `character` and `actor` in place of chapter and location, and deliberately had no colour, no tags and no importers.

**Why.** V3 of this plan says it in as many words: "not needed — YAGNI". I thought a film line was a different kind of object from a book highlight, and that nobody highlights a film in four colours.

**Reversal.** Wrong, and the rest of this section is the repair bill. Tags came later, colour in migration 0021, `noted_at` and `source` in 1.1.0, and importers after that. What I got wrong was not the individual omissions but the premise: each gap stayed invisible until somebody went looking for a feature on the wrong kind of quote.

**Approved.** Mine, and I approved it at the time on exactly the reasoning above.

<sub>Pre-1.0, in §3b as first written — `docs/wiki/Design-decisions.md` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
