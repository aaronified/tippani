# ADR-0557: Every label is five words or fewer, and longer copy goes behind an info dot

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.4.1

**Decided.** A house rule with a test: `button-labels.test.jsx` and `labels.test.jsx`
check it, and a bubble that needs a paragraph is an info dot instead.

**Why.** The label bubble is measured and placed in script, anchored to its control and
clamped on both axes — a long one is a layout problem before it is a reading problem. But
the real reason is editorial: a control whose name needs a sentence is usually a control
that is doing two things, and the word limit surfaces that rather than papering over it.

**Approved.** Mine, and I enforce it on my own copy first — several rewrites in 1.7.x
were nothing but this rule applied to text that had accumulated.

<sub>1.4.1 — `web/frontend/test/dom/button-labels.test.jsx` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
