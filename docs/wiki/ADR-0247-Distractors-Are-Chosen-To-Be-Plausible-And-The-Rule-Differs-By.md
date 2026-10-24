# ADR-0247: Distractors are chosen to be plausible, and the rule differs by medium

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.6.1

**Decided.** `distractorScore` prefers the same medium strongly. Within books, the same author dominates and shared genres break ties. Within films and shows, shared genres dominate and a shared actor breaks ties — never the director. A standalone quote follows the book rule with its speaker in the author's place. Cross-medium candidates score only on weak genre overlap.

**Why.** A random wrong answer is a question about nothing. Two books by one author are each other's hardest wrong answer, and two speeches by one person are so for the same reason. The director is excluded deliberately: a director is not what a viewer remembers a line by, so it produces a distractor that looks plausible to the schema and not to the reader. A standalone quote gets the author rule because there are no genres to break the tie with.

**Approved.** The per-medium rule is mine and I approved it in that exact form, director included.

<sub>0.6.1 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
