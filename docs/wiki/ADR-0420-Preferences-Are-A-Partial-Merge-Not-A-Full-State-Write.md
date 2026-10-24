# ADR-0420: Preferences are a partial merge, not a full-state write

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 0.4.3, duplicate removed 1.1.1

**Decided.** `PUT /auth/me/preferences` merges. Every caller goes through one shared full-state helper where a full-state PUT is genuinely needed.

**Why.** Each setting has to save without disturbing the others. The cost of getting it wrong is on record: the post-import review panel kept its *own* copy of the full-state PUT helper, and that copy omitted the three sticker fields the shared one carries for exactly this reason — so filling in a page number sent nulls for the sticker and its seal position and destroyed both. A duplicated full-state helper is a data-loss bug waiting for the next field.

**Approved.** Mine, and I approved deleting the duplicate rather than adding the three fields to it.

<sub>0.4.3, duplicate removed 1.1.1 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
