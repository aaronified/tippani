# ADR-0498: Details replaced the whole-record Edit form

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/WorkDetails.jsx` · `web/frontend/src/index.css`

**Decided.** A work's Details panel is a list of `InlineField`s — read at rest, pencil to edit, ✓ to save that field. Each field writes on its own, and a failed write keeps the editor open with what you typed still in it.

**Why.** A full-state PUT of a whole record is a large blast radius for changing a page number, and it makes every save an all-or-nothing act. Per-field saving also removes the "did I remember to press Save" question entirely. Returning whether the write landed is the part that had to be got right: discarding the editor on failure throws away the text the user just typed and gives them nothing to retry with, which is the worst possible response to a network blip. Mine, and it is why `FormModal` had to learn that some forms have no header ✓.

<sub>`web/frontend/src/WorkDetails.jsx` · `web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
