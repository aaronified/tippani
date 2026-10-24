# ADR-0105: 'Series' for books, 'collection' for films — a rename that stops at the UI, with the plural carried explicitly

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.0.1

**Decided.** Films and shows say **collection** everywhere a reader looks — filter, sort, group, both edit forms — while books say **series**. Same column, same JSON key, same FTS index.

**Why.** "Series / franchise" reads as a TV field on a page where *series* already means a show. Renaming the column would touch some sixty Go call sites and the tests pinning them, for nothing a reader would see. The UI carries `seriesNoun` plus a separate `seriesNounPlural`, because "series" is its own plural and appending an *s* had produced "all seriess"; the plural defaults to the regular English form so "collection" needed no call-site change.

**Instead of.** Renaming the column and the JSON key — rejected on cost with no visible benefit.

**Approved.** My call, and I stand by the boundary: a vocabulary problem gets a vocabulary fix, not a migration.

<sub>1.0.1 — `CHANGELOG.md` · `web/frontend/src/works.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
