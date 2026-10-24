# ADR-0911: No shadow on text, and the same on its icon

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

A text shadow made labels harder to read. The owner's rule: no shadow on text, and if a shadow is ever used, the same on the icon
beside it; the same principle everywhere. `test/rules/no-text-shadow.test.js` keeps text-shadow out of the stylesheet.

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
