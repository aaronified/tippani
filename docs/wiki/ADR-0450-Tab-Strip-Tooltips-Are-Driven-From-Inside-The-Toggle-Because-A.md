# ADR-0450: Tab-strip tooltips are driven from inside the Toggle, because a wrapper would reset every offsetLeft the thumb is positioned from

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.1

**Decided.** A third element in a `Toggle` option tuple is its hover label, opened by calling `showHint` directly from the option button's `onPointerEnter` rather than by wrapping each button in a `<Tooltip>`.

**Why.** The sliding thumb is positioned from each option's `offsetLeft`, and `.tp-tip-wrap` is `position: relative` — so a wrapper would reset every offset to roughly 0 and park the thumb under the first tab forever. Since 1.4.1 the bubble is script-driven, so it can be asked for directly with no DOM at all, which is what makes the exception cheap rather than a second implementation. Clicking also closes the label, because it describes where you were about to go and would otherwise hang over the screen you have arrived at.

**Instead of.** Wrapping the options — tried in effect, and it breaks the thumb.

**Approved.** My call, and the script-driven bubble is what earned the approval: an exception that costs one call is acceptable where an exception that costs a parallel mechanism is not.

<sub>1.4.1 — `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
