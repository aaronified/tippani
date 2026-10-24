# ADR-0297: Measured difficulty feeds the schedule, beside the fixed ladder

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** The deck counts its own **plausible** distractors per card — candidates scoring above the same-medium floor — and that number reaches the grader. A correct answer on a card the deck knows was easy does not earn the full step up the ladder; **a lapse on a card the deck knows was unfair is not decisive.**

**Why the defensive half ships first.** It is the one that stops damage. Until the series grain lands, every series card is an unfair card, and each one is resetting the half-life of a line that was known.

**It does not become a column.** This section's founding constraint is that recall is computed at query time from a stored half-life, with no sweep and no cached derivation. Difficulty is a property of the pool at the moment of asking, so it is computed then, like everything else here.

**Not self-reported.** Self-graded recall was removed and restored once already; a second judgement per card spends the reader's attention on calibrating the app rather than on the line.

**This section already reserves the shape** — *the fixed ladder stays the default; adaptive intervals would ship beside it*. This is that, with a difficulty signal that is measured rather than guessed.

**Approved.** The reader's, in the form "Difficulty feeds the schedule - yes."

<sub>Not shipped</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
