# ADR-0512: The timeline dates a quote by its work, draws empty buckets, and lets the reader pick the scale

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/test/pure/timeline-buckets.test.js`

**Decided.** A quote sits at its work's year. Decade, century or year is selectable. Empty stretches are drawn.

**Why.** Every book and film has carried a year since the first migration and nothing answered "when are the things I read *from*" — the activity calendar answers when I saved them, which is a different question. Dating a quote by its work is what makes a line copied out of the Analects last week belong at 479 BCE. The scale is selectable because a library spanning two and a half millennia and a shelf of films want different bucket sizes and neither is a sensible default for the other. Drawing the empty stretches is the part that is a decision rather than a rendering detail: two bars side by side read as two adjacent periods rather than as two thousand years apart, so omitting the gaps would make the chart lie about the shape of the library. My call.

<sub>`web/frontend/test/pure/timeline-buckets.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
