# ADR-0431: One tooltip implementation: measured, clamped, anchored to its control, serving hover, keyboard focus and long press

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.1

**Decided.** One `HintBubble`, placed in script, anchored to the control's bounding box, clamped on both axes, with a `max-width: min(260px, calc(100vw - 16px))`. Hover, keyboard focus and long press all open the same bubble; only what opens and closes it differs.

**Why.** It is always wholly on screen and always attributable. One implementation means one set of clamping rules, so a fix on one input style is a fix on all of them. Placement needs the bubble's real size, which needs a paint, so the first frame renders hidden and `useLayoutEffect` measures and places it before the browser shows anything.

**Instead of.** CSS placement — impossible by construction: to know it is off screen a popup has to measure the viewport, and an absolutely-positioned element is placed against its offset parent, which knows nothing about where on the screen it ended up.

**Approved.** My call, and I approved moving placement into JS knowing it is the less fashionable answer; CSS anchor positioning would do it natively and is not yet safe to rely on.

<sub>1.4.1 — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
