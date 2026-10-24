# ADR-0410: Detail screens reach help through the ⋯ menu

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.4.0

**Decided.** The two work-detail screens carry help as a row in their `⋯` menu rather than as a fifth control in the bar. The full-screen Profile page carries its own.

**Why.** That phone bar already holds a back arrow, a filter, a ＋ and a ⋯, and a fifth 44px control would have left a book title about eighty pixels to live in. The exceptions exist because the shell bar is not on screen there at all.

**Approved.** I approved the exception explicitly rather than letting it be an omission — a rule with an undocumented hole is a rule nobody can apply.

<sub>1.4.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
