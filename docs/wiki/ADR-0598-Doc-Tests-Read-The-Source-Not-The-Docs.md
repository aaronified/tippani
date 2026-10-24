# ADR-0598: Doc tests read the source, not the docs

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.6.0

**Decided.** `help.test.jsx` asserts that every screen a nav list can reach has a help entry and that a control the app labels is a control the help names — reading the *source* for those labels rather than the help file.

**Why.** A doc test that only reads the docs agrees with itself forever. It found three real gaps on its first run: the whole Quotes filter row, the Catalogue's group-by, and an "Export all" button that had stopped meaning "all" when the list screens started exporting the filtered view. All three had been read past repeatedly.

**Approved.** Mine, and I approved the source-reading version after the glossary generator had already demonstrated the self-agreeing failure.

<sub>1.6.0 — `CHANGELOG.md` · `How-this-was-written.md` · `web/frontend/test/rules/help.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
