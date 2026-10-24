# ADR-0452: Word buttons become glyphs only where the glyph is unambiguous

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.0

**Decided.** Export, the cover controls, lookup matches, the duplicate scan, the bulk bar's Clear, the filter sheet's Reset and the tour's Back become glyphs; buttons whose visible words are their label are deliberately left alone.

**Why.** A tooltip repeating a word is noise. The rule is stated as a boundary rather than a blanket conversion, which is what stops the sweep from continuing into controls where it costs comprehension.

**Approved.** Mine, and I approved stating it as a boundary in the changelog itself — a sweep with no stated stopping point is a sweep that keeps going.

<sub>1.4.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
