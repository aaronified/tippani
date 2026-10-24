# ADR-0277: Cloze review computes the masked span at request time — no schema, no storage

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** The blanked phrase is chosen from the quote text at request time (longest run of non-stopwords, seeded by the quote id so it is stable per card).

**Why.** Follows the same "compute it in the query" discipline the forgetting curve already uses, so a new card type costs no table. Grading is a fuzzy match and the edit distance for it already exists in `internal/search/levenshtein.go` for the typo-tolerant search pass. It is the most natural way to test a *quote* as opposed to a fact, nobody in this space does it, and standalone quotes made it much stronger, because they are almost all famous lines.

**Instead of.** Storing masked spans per card — rejected as unnecessary schema.

**Approved.** Mine, and I approved the seeded-per-card rule so a reader is not asked a different blank each time they meet the same line.

<sub>1.15.0 — `internal/httpapi/cloze.go` · `internal/httpapi/cloze_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
