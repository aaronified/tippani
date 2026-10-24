# ADR-0123: A year is written, not signed, and 'c.' marks an estimate without moving anything

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.7.4

**Decided.** −380 renders as "380 BCE", never "−380". CE is unmarked. The field reads back everything it writes, so "380 BC", "-380", "c. 380 BCE" and "circa 380 BCE" all arrive at the same year. `circa` is display-only: it never participates in sorting, bucketing or comparison.

**Why.** A minus in front of a year reads as a countdown, and writing "1954 CE" on a novel is pedantry — the era only needs saying when it is the unusual one. A text written over a century does not have a publication date, it has a contested estimate, and storing −380 while rendering a flat "380 BCE" states a precision nobody has, in an app whose whole purpose is keeping other people's words accurately. A `circa` that changed the ordering would put the timeline and the shelf into disagreement about the same book.

**Instead of.** A nullable boolean for `circa` — rejected in favour of `INTEGER NOT NULL DEFAULT 0`, matching `favorite` and every other flag in this schema: SQLite has no boolean, and a NULL third state would mean "we do not know whether we know", which is not a thing.

**Approved.** I approved the display-only constraint on `circa` explicitly, in both the migration and the formatter, because it is the kind of flag someone later reaches for when they want an "approximate" bucket.

<sub>1.7.4 — `internal/store/migrations/0030_ancient_years.sql` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
