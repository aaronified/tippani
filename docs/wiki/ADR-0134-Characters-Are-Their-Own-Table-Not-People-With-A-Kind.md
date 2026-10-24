# ADR-0134: Characters are their own table, not people with a kind

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/store/migrations/0056_person_identity.sql`

**Decided.** `characters` is a separate table with its own aliases, sort name, description and image. `work_cast` gains `character_id`, `actor_id` (nullable) and a per-work `description`, and a quote's speaker points at the **cast row** rather than at the character.

**Why.** A person has a birth, a death and a photograph; a character has a description and an appearance that changes per work. A picker for "who wrote this" must never offer Woland and a picker for "who says this line" must never offer Bulgakov, and a `kind` column makes that a filter every existing query has to remember. Harry Potter is the case that shapes `work_cast`: same character, same actor, eight films, a different photograph in each — so identity is library-wide and appearance is per row. Pointing the speaker at the cast row means one join yields the character, the performer and *this* work's picture, and a quote can never name somebody who is not in the cast.

**Instead of** one table with `kind`, which `person-instructions.md` proposes and which halves the code. The cost of two tables is that aliases, merge and links exist twice; that is paid in Go, once, over two tables, with the two resolve functions written out in parallel so a divergence shows up in a diff.

**One half of this was superseded, went dead, and is live again.** `annotations.speaker_cast_id` and `dialogues.speaker_cast_id` were declared here, were never written or read for two releases — 0059 linked a quote's speaker to `people` instead, on a data-safety ground it states in full below — and now carry the link this entry always described. The note that stood here said "nothing should be built on them without reading 0059's entry first", and that is exactly what was done: see *A quote's speaker is a cast row as well as a person* below, which answers 0059's objection rather than talking past it.

<sub>`internal/store/migrations/0056_person_identity.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
