# ADR-0473: Flip only when the preferred side cannot fit and the other is roomier; always cap

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx`

**Decided.** `POPUP_MARGIN = 8`, `POPUP_GAP = 4`, `minHeight = 120`. `down = fits || roomier`. `maxHeight` is always the room actually available. Measurement uses `scrollHeight`, never `offsetHeight`.

**Why.** "Flip whenever it does not fit" thrashes the popup between sides when neither fits, which is the common case for a long list on a phone — and then the cap, not the side, is what makes it usable. The cap is the half that matters most: flipping alone still leaves a forty-option list taller than the window, so the list has to scroll *itself*. `scrollHeight` is load-bearing rather than stylistic — once a cap has been applied the element's own height *is* the capped one, so re-measuring `offsetHeight` on the next scroll event ratchets the popup smaller every time. Below `minHeight`, flipping beats a scrollable sliver. Approved by me, with the whole decision expressed as arithmetic so it can be tested rather than looked at.

<sub>`web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
