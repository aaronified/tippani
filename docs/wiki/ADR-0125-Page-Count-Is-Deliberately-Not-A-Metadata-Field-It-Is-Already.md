# ADR-0125: Page count is deliberately not a metadata field — it is already the progress denominator

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** not built (recorded on the backlog)

**Decided.** Page count is excluded from the planned book-fields list (format, language, publisher, translator, subtitle), by name and with a reason.

**Why.** It is already stored as `pos_total`, the progress bar's denominator. A second metadata-sourced page count would give the app two numbers that can disagree about the same book. If it is ever wanted as canonical metadata it should *feed* that one, not sit beside it.

**Approved.** I approved naming the exclusion in the backlog rather than leaving it out silently, because "page count" is the first field anyone would think to add and the omission would otherwise read as an oversight.

<sub>not built (recorded on the backlog) — `docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
