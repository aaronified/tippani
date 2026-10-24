# ADR-0007: Layout work that can happen on the reader's device does: sticker text flow is client-side, code-split and lazy-loaded

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** The quote-flows-around-a-sticker layout runs entirely in the browser. `@chenglou/pretext` is loaded by a bare `await import('@chenglou/pretext')` inside the relayout effect, so it is its own chunk and arrives only when a quote with a seal is on screen.

**Why.** Zero NAS cost is the point. pretext measures each quote once and reflows with arithmetic rather than DOM reflow; the plan budgets the chunk at ~17 KB gzip. It falls back to a plain paragraph with the seal floated under `prefers-reduced-motion`, with no seal, and until the chunk lands — so the feature degrades to text rather than to nothing.

**Instead of.** Server-side layout — never seriously entertained; it is the exact shape of work this host cannot afford.

**Approved.** My call. The general rule I approved here is the one that decides the OCR and speech questions further down: if the reader's device can do it, the NAS does not.

<sub>pre-1.0 — `web/frontend/src/flow.jsx` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
