# ADR-0618: Docs live as self-contained static HTML with no script

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.3.1 and 1.3.2

**Decided.** The roadmap and the UI glossary are single self-contained files published beside the demo. The cards, the contents rail and its groups are `<details>` elements, deep-linking into a collapsed card is CSS, and the page icon is an inlined data URI so the page renders identically straight off disk.

**Why.** A doc that needs a build or a network to read is a doc that stops being readable at exactly the moment you need it. The rail was sticky-inside-a-grid first and wrong: a sticky element is constrained by its containing block, engines take that to be the nearest block container rather than the grid area, and at the bottom of the page it slid down over the footer with the two drawing on top of each other. Fixed positioning takes it out of flow and the question cannot arise.

**Approved.** Mine, and I approved the no-script constraint as the reason the rail had to be solved rather than scripted.

<sub>1.3.1 and 1.3.2 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
