# ADR-0060: Ids are never reused, via an allocation floor rather than AUTOINCREMENT

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** `id_floor(table_name, next_id)` is a high-water mark the create paths allocate above, for the five binnable tables. Nine create paths take an id explicitly; the three import loops take a block per batch. A restore raises the floor past everything it puts back. From 3.1.0 a sixth table allocates from it, for a reason of its own: `import_batches`, whose id is how a queued approval tells the files there were at its press from the ones staged after it (*An import and its approval are queued jobs*). The bin still holds only the five.

**Why.** `id INTEGER PRIMARY KEY` is a rowid alias, so SQLite hands out `max(rowid) + 1` — which reuses a freed id whenever the deleted row held the table's highest, and that is the common case rather than an edge one: you delete the thing you just added. A bin holding that row's snapshot then cannot put it back.

The two alternatives were worse in opposite directions. AUTOINCREMENT is a column definition, so adding it means rebuilding five foreign-key parents with cascading children — precisely the migration class 0018 refused to attempt, and the most dangerous kind in this repo. Renumbering on restore means an id remap across every child row and join table, running on the one code path whose entire purpose is putting things back exactly as they were.

It also closed a bug older than itself: `item_reviews` is keyed `(kind, item_id)` with no FK, so a reused annotation id inherited the deleted quote's half-life, review count and lapse count.

**Instead of** "original id if free, a new one otherwise", which needs no migration and no create-path changes — and hands the id remap to the restore anyway, which is where it can do the most damage.

**Reversal.** This settles the open question the plan left open, in favour of its own recommendation.

**Approved.** Mine. The cost is a new subtlety on nine create paths, and the test is behavioural — create, delete, create, compare — because a test that asserted "the code calls nextID" would pass for a call that passes the wrong table name.

<sub>1.8.0 — `internal/httpapi/id_floor.go` · `internal/httpapi/id_floor_test.go` · `internal/store/migrations/0031_trash.sql` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
