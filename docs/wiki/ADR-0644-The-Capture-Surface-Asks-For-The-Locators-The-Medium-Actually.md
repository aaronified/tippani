# ADR-0644: The capture surface asks for the locators the medium actually has

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.17.0

**Decided.** A game's capture form offers Act and Quest and no Timestamp; a show's offers the episode's name beside its numbers; a book's offers a Character. All four columns already existed (0047) and the API already accepted them.

**Why it is a bug and not a gap.** The timestamp box on a game was WORSE than a missing field: `normalizeLocator` clears a timestamp on a game's line, so the form asked a question and the server threw the answer away without a word. And act and quest are in the dedupe hash — a bark reused in two quests is two quotes — so a form that could not say which quest could only ever store the first of them, with the second silently folded into it as a duplicate.

**The book's character is the same shape of omission.** 0047 gave `annotations` a `character` column and argued for it at length; no form ever got a box, so the only ways to fill it were the bulk field editor and an import. A novel has speakers.

<sub>1.17.0 — `web/frontend/src/AddSurface.jsx` · `web/frontend/src/Library.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
