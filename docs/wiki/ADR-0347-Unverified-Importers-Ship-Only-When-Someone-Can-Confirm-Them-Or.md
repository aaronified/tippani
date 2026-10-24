# ADR-0347: Unverified importers ship only when someone can confirm them, or ship labelled experimental

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** ongoing

**Decided.** Kobo (`KoboReader.sqlite`) stays on the backlog rather than shipping, because I have no device here to test a real file against. The Grimmory sync source is marked unverified until I can test it against a real box. The Kindle clippings importer shipped labelled *experimental*.

**Why.** An importer that has never met a real file is a guess wearing the clothes of a feature. There are two honest ways out — do not ship it, or ship it saying so — and which one applies depends on whether the format degrades gracefully. Kindle clippings does: an unknown locale costs a less precise field, never a lost quote. A misparsed SQLite schema does not.

**Approved.** Mine, and I approved holding Kobo back specifically because it is the most-requested of the three, which is the case where the temptation to ship on a guess is highest.

<sub>ongoing — `docs/roadmap.html` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
