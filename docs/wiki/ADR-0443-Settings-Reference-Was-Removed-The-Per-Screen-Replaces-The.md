# ADR-0443: Settings → Reference was removed; the per-screen ? replaces the glossary link and the roadmap link moved to Updates

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.0

**Decided.** The Reference card's two link-outs were the UI glossary and the roadmap. The card is gone from Settings and from the demo.

**Why.** The per-screen `?` does what the glossary link was for, and better: help that sits beside the control, cannot 404, and cannot lag the code by a release. The roadmap link survives in the Updates card, where "what version am I on" and "what is coming" are the same question asked twice. The glossary itself is still published and still linked from the README and the roadmap — it was the *link from Settings* that stopped earning its place, not the document.

**Approved.** I approved deleting a card I had built two releases earlier, once the thing that replaced it was demonstrably better rather than merely newer.

<sub>1.4.0 — `CHANGELOG.md` · `web/frontend/src/Settings.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
