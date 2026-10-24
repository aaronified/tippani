# ADR-0374: categoryHex is the one place a real hex value is still required

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `web/frontend/src/theme.js` · `web/frontend/src/share.jsx`

**Decided.** Every surface resolves a colour through `categoryVar` — `var(--hl-N)` — except the share canvas, which calls `categoryHex`.

**Why.** A custom property updates itself when a category is recoloured; a copied hex does not, so the app-wide rule is that nobody copies. `ctx.fillStyle` parses neither `var()` nor `color-mix()`, so the canvas physically cannot read the property every other surface reads. Isolating that to one exported function with a comment saying it is the *one* place is what stops a second call site quietly appearing. Mine, and naming the exception is the whole of the decision.

<sub>`web/frontend/src/theme.js` · `web/frontend/src/share.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
