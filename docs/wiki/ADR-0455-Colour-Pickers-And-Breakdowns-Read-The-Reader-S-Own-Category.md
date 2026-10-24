# ADR-0455: Colour pickers and breakdowns read the reader's own category names, not the storage colour word

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** post-1.4.0

**Decided.** `categoryName(token)` returns the reader's name for a slot if they gave one, else the built-in name for that slot, else the colour word. Slot 1 returns "Uncategorised" rather than "Yellow". Every picker, tooltip, aria-label and breakdown resolves through it.

**Why.** "Pick blue" is a description of a highlighter, and the whole point of naming a category is that the picker then asks the question you actually have. Slot 1 is the unset default that a quote lands on when nobody chose, so calling it "Yellow" invites you to read it as one deliberate category among the others, which it is not — saying it is the absence of a choice is the honest answer. What is *stored* never changes: the value in the database and in every Markdown export stays the colour word, so the naming is a display layer and nothing more. A hidden slot is dropped from the choices but never from a quote already wearing it — hiding is about tidying a picker you have stopped using, and a quote silently changing colour because of a preference would be the app editing your library.

**Approved.** Mine, and the slot-1 rule is the one I approved most deliberately: it is the difference between a default and a category.

<sub>post-1.4.0 — `web/frontend/src/theme.js` · `web/frontend/src/ui.jsx` · `README.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
