# ADR-0430: A pure-CSS hover bubble and a viewport-pinned long-press pill — two mechanisms, both of which widened the page

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.1 (reversal)

**Decided.** This is the state 1.4.1 replaced. Hover was an absolutely-positioned CSS bubble inside the tooltip wrapper; touch was a pill pinned to the top of the screen, centred with `left:50%` + `translateX(-50%)`.

**Why.** Both were wrong in the same way — neither could be kept inside the viewport. An `opacity:0` bubble still has a border box, so one hanging off a control near the right edge widened the page's scrollable area; the pill's centring cannot be clamped at all, so a label wider than the viewport hung off both edges. Between them, Library and Settings could be panned sideways into blank space on a phone, and iOS drags `position:fixed` overlays along with that pan. The pill was also detached from its control, so it answered "what is this?" without saying which "this" — and several 44px glyphs sit within a thumb's width of each other in these bars.

**Reversal.** Reversed in 1.4.1. What I got wrong was solving the same problem twice, badly, in two technologies, and then not testing either at a screen edge.

**Approved.** Both were my designs and the demolition was my call; I approved replacing them together rather than patching the pill, because the fault was shared.

<sub>1.4.1 (reversal) — `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
