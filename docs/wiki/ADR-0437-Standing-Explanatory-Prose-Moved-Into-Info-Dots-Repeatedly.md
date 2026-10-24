# ADR-0437: Standing explanatory prose moved into info dots, repeatedly, across four releases — label and state stay, explanation moves

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 0.6.9 → 1.7.2

**Decided.** The rule is a three-way split: a **label** (what this control is) and its **state** (what is true right now) stay on the page; an **explanation** (why it exists, what the trade-off is) moves into an info dot. Applied in 0.6.9 (Settings help), 1.4.0 (Settings' Devices, Onboarding and Multi-author credits, and the metadata sources block; the Metadata console's duplicates, speaker remap and mobile actions; Profile's maintenance tools; the Practice card; the tour's step copy), and again in 1.7.2 (each share format's syntax reference; the colour-categories microcopy).

**Why.** Tippani explained itself in standing prose — Settings card copy, drawer subtexts, microcopy under every control. It is good writing and there is a lot of it, and on a 390px screen it meant scrolling past the explanation to reach the single control each card exists for. On the tour specifically, six steps were a scrolling paragraph and the paragraph was the part people skipped.

**Approved.** Mine each time. Recording it as four passes rather than one is the honest version: I did not find the rule and apply it, I applied it to the worst screen and then kept finding more.

<sub>0.6.9 → 1.7.2 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
