# ADR-0449: Two icon-button sizes only, and IconButton renders its own tooltip from its ariaLabel rather than being wrapped at forty call sites

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.0

**Decided.** 44px (`IconButton`, the standard) and 34px (`.field-icon-btn`, for controls inside a form row). `IconButton` wraps itself in a `Tooltip` whose label defaults to its own `ariaLabel`; pass `tooltip` to differ, or `tooltip={null}` for the rare button whose label is already visible beside it.

**Why.** A button with no words has to say what it is on every device, and threading a wrapper through forty call sites is how half of them end up without one. `ariaLabel` and the tooltip should say the same thing anyway, so defaulting one to the other removes a pair of strings that can drift. The `danger` prop exists for the same class of reason: Library and Movies were each reaching past the component with an inline style to recolour the delete button, and since `style` arrives in `...rest` and lands after the component's own, a caller doing that had to restate all four sizing properties or lose the 44px box — `style` is merged now, so a partial override is a partial override.

**Instead of.** Wrapping at the call sites — rejected on the drift argument, with the evidence being that it had already happened.

**Approved.** Mine, and I approved defaulting the tooltip to the aria-label rather than requiring both, because a required duplicate string is a duplicate string that goes stale.

<sub>1.4.0 — `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
