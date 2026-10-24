# ADR-0196: Where metadata comes from moved from Settings to Metadata, whole and unchanged

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** The API-key block, the Google fallback, the credit separators and the language marks left `Settings.jsx` for `MetadataSources.jsx` and are the fifth section of the Metadata screen. The code moved verbatim; Settings' remaining cards are redealt around the gap.

**Why.** Every one of those settings configures something the Metadata screen is *looking at* — a work filtered by *no source*, a name split by a separator — and the fix for what you are looking at sat two navigations away on a different screen. A reader who had just filtered the catalogue by "no source" had to leave the console to fix the reason it was empty.

**Instead of.** Duplicating the block on both screens — two forms writing one settings row, which is the defect class this log carries five times. A link from Metadata to Settings — a link to a form is not a form, and the reader would still lose their filter.

**Nothing in the block changed in the move,** deliberately: a move and a redesign in one commit is a redesign whose regressions look like a move.

<sub>3.1.0 — `web/frontend/src/MetadataSources.jsx` · `web/frontend/src/Settings.jsx` · `web/frontend/src/MetadataPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
