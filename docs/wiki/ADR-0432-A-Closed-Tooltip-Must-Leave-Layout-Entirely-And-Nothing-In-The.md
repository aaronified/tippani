# ADR-0432: A closed tooltip must leave layout entirely, and nothing in the app is allowed to widen the page

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.1

**Decided.** A closed tooltip renders nothing — the bubble is portal-rendered only while a hint is showing, and `.tp-tip-wrap` owns only the inline box around the control. As a backstop, `html` carries `overflow-x: hidden` followed by `overflow-x: clip`.

**Why.** An invisible element with a border box is still layout. Nothing in this app relies on page-level horizontal scroll — wide tables and nav strips scroll inside their own contained wrappers — so `clip` is correct rather than merely defensive: it removes the horizontal scroll region outright, which mobile browsers honour more reliably than `hidden`.

**Approved.** I approved the belt-and-braces version. The structural fix is the one that matters, and the CSS backstop is there because this class of bug is invisible until someone drags a page sideways.

<sub>1.4.1 — `web/frontend/src/index.css` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
