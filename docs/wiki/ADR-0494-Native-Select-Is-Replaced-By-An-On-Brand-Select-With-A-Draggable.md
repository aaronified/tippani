# ADR-0494: Native <select> is replaced by an on-brand Select with a draggable thumb

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx`

**Decided.** A house `Select` with the same textured thumb the toggle uses. The thumb drags — the same interaction, rotated vertical — and on a list long enough to scroll it stays mouse-only.

**Why.** A native select is the one control that cannot be skinned, so a page of house controls with three OS dropdowns in it reads as unfinished. The thumb drag was an inconsistency worth closing: the toggle's selected-option pill has always been grab-and-slide, and the dropdown rendered the identical thumb but only ever moved it by hover or arrow keys — the same picture behaving two ways. Mouse-only on a scrolling list is a genuine limitation rather than a shortcut: `touch-action` cannot serve both the thumb and the scroller, and if one has to lose it is the thumb, since the list is still fully usable by tapping. I approved shipping it with that gap stated rather than fighting it.

<sub>`web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
