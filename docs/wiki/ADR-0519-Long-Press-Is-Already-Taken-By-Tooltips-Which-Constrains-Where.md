# ADR-0519: Long-press is already taken by tooltips, which constrains where the menu can be bound

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.10.0 · works 1.11.1

**Decided.** The context menu's long-press goes on the **card body**; `Tooltip`'s label long-press stays on **controls**. Any long-press whose target closes on `.tp-tip-wrap, button, a, input` is ignored.

**Why.** `Tooltip` opens its label after `LONG_PRESS_MS = 500` on touch, because a phone has no hover and the glyph-only buttons introduced in 1.5.0 would otherwise be unlabelled. A card contains those buttons, so "long-press opens a menu" and "long-press shows a label" are live on the same square inch. They coexist only because of what each is attached to, and writing that down before building the menu is what stops the menu being built first and the conflict discovered on a phone. I approved binding the *new* gesture around the existing one rather than reworking tooltips, because the tooltip is the accessibility affordance and the menu is the convenience.

<sub>1.10.0 · works 1.11.1 — `web/frontend/src/actions.jsx` · `web/frontend/src/selection.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
