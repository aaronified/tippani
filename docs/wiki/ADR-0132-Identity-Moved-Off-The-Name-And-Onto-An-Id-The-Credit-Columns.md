# ADR-0132: Identity moved off the name and onto an id; the credit columns became a derived cache

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** Migration 0056 rebuilds `people` without `UNIQUE (user_id, name)` and adds `sort_name`; `work_person` holds `person_id` + `role` + `credit_as` + `ordering`; `person_alias` and `character_alias` hold every other spelling that should *find* a record. `books.author`, `books.translator`, `books.editor` and `movies.director` survive as a **cache recomposed from the link rows** by one store function, and `store.CreditsAgree` walks the library asserting the two agree.

**Why.** 0027 made the name the identity and that is the same mistake as 0012, one level down. Bulgakov is printed four ways across four editions — "Mikhail Bulgakov", "M. Bulgakov", "Михаил Булгаков", "মিখাইল বুলগাকভ" — so a name-keyed library holds four people each with a quarter of the quotes, and the "Works: 6" on every one of them is a lie by construction. No amount of care at the call sites fixes it, because the model has nowhere to put the fact that the four are one. How somebody is *credited* is a property of the work, which is what `credit_as` now holds.

**Instead of** dropping the four columns, which is the purer data model and the wrong trade. `books_fts` is external-content FTS5 (`content='books'`), and external-content FTS5 **cannot index a joined table** — there is no `CREATE VIRTUAL TABLE` form that reaches into `work_person`. Dropping the column does not remove the write-through problem, it moves it into the search index: `books_fts` would have to become contentless and be populated by hand on every credit change, costing `INSERT INTO books_fts(books_fts) VALUES('rebuild')`, the one line that today re-derives the whole index from the content rows. A search index that can silently disagree with the library and has nothing to recompute it from is a worse bug than a derived column with a test on it. It would also have migrated all 630 sites in `internal/` that touch those four columns, against 21 that write them.

**Approved.** Mine, and the one I would defend hardest in this section — with the cache named as a cache in three places (the migration header, `credits.go`, and the invariant function) precisely because a derived column that is not documented as derived is how the next person writes to it directly.

<sub>`internal/store/migrations/0056_person_identity.sql` · `internal/store/credits.go` · `internal/httpapi/credits.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
