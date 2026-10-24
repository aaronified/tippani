# ADR-0246: Multiple choice was removed for self-graded recall, then restored

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** Removed 0.5.0, restored 0.6.1

**Decided.** 0.5.0 removed the MCQ round entirely — its distractor machinery and the `srQuizLen` / `srQuizScope` preferences went with it — on the reasoning that honest self-graded recall is the point of spaced repetition. 0.6.1 restored multiple choice for both modes and both directions.

**Why.** The reveal was awkward in practice, and badly so in the "which quote is from this work?" direction, where self-grading asks you to judge whether what you half-remembered counts. Restoring it named the old reasoning rather than pretending the removal had not happened; the schedule, the scores and the status dots are untouched, only the interaction changed.

**Reversal.** Fully. What I got wrong was treating a principle about retrieval practice as a principle about interface, and throwing away working distractor code on the strength of it.

**Approved.** Both decisions are mine and I approved both; the second one is the one I would defend.

<sub>Removed 0.5.0, restored 0.6.1 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
