# ADR-0163: Where the facts come from lives beside the records it configures

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** The metadata sources block — the eight provider keys, the Google fallback, the credit separators and the language-marks door — is a section of the **Metadata screen**, not a card on Settings. `SETTINGS_LAYOUT` is redealt around its absence and `SectionTitle` moves to `ui.jsx`, because eight Settings cards and one other screen now use it.

**Why.** Everything on that block configures the screen it was two clicks away from. A reader looking at a work the catalogue had filed under *no source* had to leave the console, find a settings card, fix the key and come back to press Fetch — and the card's own comments were already making that argument without following it, since the credit separators were justified by "a lookup returns 'Gaiman & Pratchett' as one string" and the marks door by "a language mark is what a quote with nobody to credit says it is". Both sentences are about the records, not about the app's settings.

**What it costs.** Settings loses its tallest card — 780px of a page whose column balance is a measurement written down beside the layout — so the layout is not the old one minus a row. It is redealt, and the new numbers are recorded the same way. Two pinned rules went with the card: *colours sits directly under metadata*, which had nothing left to pair with, and *the marks door hangs off Metadata*, which is now a claim about a different screen. Both tests were rewritten to assert what survives rather than deleted.

**Instead of** leaving it on Settings and linking to it from the console, which was the cheaper move and is the wrong one: a link is a promise that the thing is elsewhere, and the reason it was hard to find is that it *was* elsewhere.

**Nothing in the block changed in the move** — same components, same copy, same endpoints. A move that also rewrites is a move nobody can review. The one thing that did change was an accident and is worth recording: `toast` was called by two handlers and left behind by the import, so every key save threw after a successful PUT. `icon-imports.test.js` read JSX tags only and could not see a helper CALL; it reads a named list of shared helpers now, which is the same class-not-spelling widening that file already did once.

<sub>`web/frontend/src/MetadataSources.jsx` · `web/frontend/src/Settings.jsx` (`SETTINGS_LAYOUT`) · `web/frontend/test/rules/icon-imports.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
