# ADR-0444: Button labels are a device-local setting with auto/on/off, and collapsed words are clipped so they stay in the accessibility tree

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.6.0

**Decided.** A button carrying an `icon` renders `.btn-icon` + `.btn-label`, and `html[data-labels="off"]` clips the label span. The preference is `auto` | `on` | `off`, stored in `localStorage` under `tippani:labels`; `auto` resolves against the 768px mobile breakpoint. `theme.js` resolves auto→on/off and writes the concrete value, so `index.css` needs one clip rule rather than one plus a duplicate inside a media query.

**Why.** The words are clipped rather than `display:none`d, so they stay in the accessibility tree — an icon-only row still reads as "Share, Edit, Delete" to a screen reader instead of three unnamed buttons, and no `aria-label` has to be bolted on and then kept in sync with the visible text. The override works in both directions because both are real: a dense desktop user wants the row back, and someone who has not learned the glyphs yet wants the words on a phone more than they want the space. It belongs to the screen rather than to the account — how much room a row has is a property of the monitor, not the reader — and it is deliberately not folded into `applyTheme`, because Settings' Appearance card re-sends every theme field on any change and a label preference riding along would be wiped by an unrelated accent click.

**Instead of.** Storing it as a user preference on the server — rejected on the monitor argument.

**Approved.** Mine, and I approved resolving `auto` in JS rather than CSS specifically to avoid a duplicated clip recipe, which is the kind of thing that gets edited in one place only.

<sub>1.6.0 — `web/frontend/src/theme.js` · `web/frontend/src/index.css` · `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
