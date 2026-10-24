# ADR-0361: Quote-card images render entirely in the browser

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `web/frontend/src/share.jsx` · `web/frontend/src/quoteImage.js`

**Decided.** The share image is drawn on a `<canvas>` on the device. No server round-trip, no external font or image fetch, and the photograph of whoever said it never leaves the machine.

**Why.** The alternative is a rendering endpoint, which means the server needs a font stack, an image pipeline and a queue, and it means every quote you share passes through it. On a NAS with a zero-idle CPU budget that is the wrong place for it, and on a self-hosted personal library it is the wrong shape for it. It also keeps the CSP at `default-src 'self'` — a canvas that fetched a web font would need that relaxed for everyone. The panel text says so plainly to the reader rather than leaving it as an implementation detail. My call.

<sub>`web/frontend/src/share.jsx` · `web/frontend/src/quoteImage.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
