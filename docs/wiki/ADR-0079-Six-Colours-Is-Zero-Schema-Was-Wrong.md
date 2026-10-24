# ADR-0079: "Six colours is zero schema" was wrong

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.7.1

**Decided.** Migration 0029 widens the CHECK by rebuilding five tables: `annotations`, `dialogues`, `utterances`, `staged_quotes` and `tags`.

**Why.** Naming the colours was zero schema, as predicted. Growing the *set* was not. `color` carries a `CHECK (color IN (…))` on five live tables and SQLite cannot alter a CHECK. Three of them are foreign-key parents with cascading children and `PRAGMA foreign_keys` is a no-op inside a transaction — every migration runs inside one — so the join rows are parked in backup tables and restored after the rename, since losing them would silently untag a whole library and no error and no row count would notice. Three back external-content FTS5 indexes whose triggers vanish with the table, so the index rebuild is the last statement for each. `DROP TABLE` fires no triggers but does cascade, which is why the joins need parking and the FTS index does not self-empty. Ids are carried across verbatim, because everything pointing at a quote matches by id. `tags` is the fifth and the table 0018 explicitly declined to rebuild; it could not be left out, because `tags.color` is validated by the same allowlist the quote colours use, so widening one and not the other turns a green tag into a 500 on a valid request.

**Reversal.** Of my own roadmap note, which had recorded naming the colours as costing zero schema. That much held. Growing the set did not, and the prediction is kept here beside what actually happened rather than quietly edited out.

**Approved.** I approved this one after reading the migration line by line; it is the most dangerous migration in the project and I would not have signed it off on a summary.

<sub>1.7.1 — `internal/store/migrations/0029_six_colours.sql` · `docs/roadmap.html` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
