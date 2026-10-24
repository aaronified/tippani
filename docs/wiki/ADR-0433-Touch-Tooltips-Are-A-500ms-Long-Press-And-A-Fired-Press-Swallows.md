# ADR-0433: Touch tooltips are a 500ms long press, and a fired press swallows the click behind it

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.1

**Decided.** `LONG_PRESS_MS = 500`, with `LONG_PRESS_SLOP = 10` px of drift allowed. A fired press calls `preventDefault` and `stopPropagation` on the click that follows. `onContextMenu` is suppressed on the wrapper.

**Why.** 500ms is the platform long-press convention, and the margin matters more than it looks: because a fired press swallows the click, a merely slow tap that crosses the threshold silently does nothing, and 500ms keeps that out of ordinary tapping. Swallowing the click is not optional — holding a Delete button to find out what it does must never also delete the thing, which is what Material does too. A drag is a scroll, not a question, so the timer is released the moment the finger leaves the control, or every flick down a list would flash a label. The box is read at *fire* time rather than press time, because the hold lasts half a second and a list can still be settling under the finger. Long-pressing on Android would otherwise raise the text-selection handles over the label just shown.

**Approved.** Mine, and the slow-tap cost is the trade I approved explicitly: it is a real regression for a small number of taps, bought against a class of accidental destruction.

<sub>1.4.1 — `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
