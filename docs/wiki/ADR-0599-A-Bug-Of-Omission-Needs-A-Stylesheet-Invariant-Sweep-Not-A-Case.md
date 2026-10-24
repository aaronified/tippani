# ADR-0599: A bug of omission needs a stylesheet invariant sweep, not a case

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.2, extended 1.7.6

**Decided.** The scroll-chaining fix is one CSS property, and the test is an invariant over the stylesheet — every scroll container declares `overscroll-behavior` — with a named exemption list and a guard that the sweep still matches something. The popup-placement fix inverted the same shape: it no longer checks that two composed rules avoid contradicting each other, it checks that no popup places itself at all.

**Why.** The defect was not a wrong value anywhere; it was that nobody had thought about scroll chaining, so a case fixes the popup that was reported and nothing else. Widening the sweep from vertical to sideways immediately found one nobody had reported — the top navigation, where running off the end is the browser's back gesture, so a nav that navigates away. The floor on what the extractor matches exists because a sweep whose extractor broke reports a clean stylesheet by looking at nothing.

**Approved.** My call, and I approved the exemption list being explicit so a future exemption is a decision rather than a silent miss.

<sub>1.7.2, extended 1.7.6 — `CHANGELOG.md` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
