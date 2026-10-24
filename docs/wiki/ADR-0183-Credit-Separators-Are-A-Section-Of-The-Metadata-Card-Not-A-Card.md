# ADR-0183: Credit separators are a section of the Metadata card, not a card of their own

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `web/frontend/src/Settings.jsx`

**Decided.** Four chips and a label at the bottom of Metadata sources; `none` is the explicit off switch rather than an empty string.

**Why.** Four chips and a label is not a subject; it is a footnote to one, and the subject is the card it now sits at the bottom of — a lookup returns "Gaiman & Pratchett" as one string and this decides whether that is one person or two, so the question only arises because of the sources above it. A card with four chips in it was claiming the same share of a settings page as the keys every lookup runs on. `none` is stored explicitly because an empty string would read as "unset" and fall back to the default on the server. The author string stored on each book is never rewritten — only the people views split — so the setting is safe to flip at any time. I approved the demotion; it is a smaller change than it looks and it is the kind the page needed a dozen of.

**Instead of.** A standalone Credits card (out of proportion). Empty string for off (indistinguishable from unset).

<sub>`web/frontend/src/Settings.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
