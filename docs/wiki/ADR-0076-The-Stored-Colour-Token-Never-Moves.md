# ADR-0076: The stored colour token never moves

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.7.0

**Decided.** `yellow|blue|pink|orange|green|purple` stays the value in every table and every Markdown export. What a slot is called, what it looks like and whether it is offered are all presentation.

**Why.** A rename must not be able to break a round trip. There is a test whose entire job is to prove an export is byte-identical before and after one, because a year of highlights that stopped importing would be discovered by the person re-importing them.

**Approved.** I approved this as the precondition for the whole feature — the naming was only worth building because it could not touch stored data.

<sub>1.7.0 — `web/frontend/src/theme.js` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
