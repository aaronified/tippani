# ADR-0249: The quiz option's expander is its own button

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.5.2

**Decided.** Each option's "show the rest of it" control is a separate button beside the option, not a tap on the option itself.

**Why.** Choosing an option answers the question. There is one shot per card and the grade posts immediately, so an expand gesture sharing that hit area would eventually grade a card because somebody wanted to finish reading it.

**Approved.** My call, approved as part of the same change — sending the whole quote without this would have traded one defect for a worse one.

<sub>1.5.2 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
