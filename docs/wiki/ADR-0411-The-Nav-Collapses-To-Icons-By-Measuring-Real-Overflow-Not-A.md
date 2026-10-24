# ADR-0411: The nav collapses to icons by measuring real overflow, not a breakpoint

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 0.6.7, corrected in 0.6.9

**Decided.** When a smaller desktop window would clip the labelled tabs behind the ＋ Add button, the nav collapses to icons and expands back once there is room — measured off the actual overflow.

**Why.** A breakpoint guesses; the content is what determines whether the labels fit, and it changes with the tab list. The measurement only fires because `.topbar-nav-group` holds its natural width with `flex: none` — before that, a tight window squeezed the toggles and sheared labels mid-glyph without ever tripping the collapse, so the mechanism existed and could not be reached.

**Approved.** Mine, and I approved the `flex: none` as part of the same decision — the measurement is worthless without it.

<sub>0.6.7, corrected in 0.6.9 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
