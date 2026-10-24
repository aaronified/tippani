# ADR-0131: One row per person keyed on name, with roles as a set

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/store/migrations/0027_people_one_row.sql`

**Decided.** Migration 0027 rebuilds `people` on `UNIQUE (user_id, name)` and moves the role into a `person_kinds` join table. Identity becomes the name; kinds become a set the person belongs to.

**Why.** Standalone quotes made the old key untenable rather than merely untidy. A speaker is very often already an author — the whole appeal of saving a line from a speech is that you have read the person too — so adding `speaker` to the old key would have manufactured a duplicate for exactly the people most likely to be enriched: two rows, two bios, two portraits, and enriching one leaving the other blank. The rebuild was cheap because nothing references `people(id)`, verified across every migration, so there were no cascading children to park. I got the original key wrong and this is the correction; I approved the rebuild rather than special-casing speakers, because the special case would have been the same bug with a name.

<sub>`internal/store/migrations/0027_people_one_row.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
