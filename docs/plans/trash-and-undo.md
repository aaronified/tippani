# Plan — the bin: a 30-day undo for anything deleted

**Target: 1.8.0. Ships first, and alone.**

Every delete in this app is final. There is no undo anywhere in it, and there
never has been. That was tolerable while deleting meant one row at a time behind
a confirm dialog — it stops being tolerable the moment a selection can delete
forty things at once, which is what the next release wants to add.

So the bin comes first, on its own merits: it makes every delete the app
*already has* recoverable, and it is the precondition for bulk delete existing at
all. If the two features that follow it are cut, this one is still worth having.

Nothing here is written yet. This is the plan.

---

## What already exists

Verified against `09f8a5b` (v1.7.3). Named rather than line-numbered.

| Thing | Where | Bearing on this |
|---|---|---|
| Ten delete handlers | `internal/httpapi/*_handlers.go` | `handleDeleteBook`, `…Movie`, `…Annotation`, `…Dialogue`, `…Utterance`, `…Person`, `…Tag`, `…Sticker`, `…Avatar`, `…User`. Five are in scope. |
| 45 `ON DELETE CASCADE` edges | 15 migrations | A book delete takes **seven** child tables with it. "Restore" is a subtree, not a row. |
| `userCoverFiles` / `removeCoverFile` | `admin_handlers.go` | Already collects image filenames *before* the cascade and removes them after, because "the cascade only frees DB rows". The exact precedent for parking files. |
| FTS `_ai` / `_ad` / `_au` triggers | `0001_init.sql`, `0003_movies.sql` | Every content table reindexes itself on INSERT. **A restore that re-inserts rows reindexes for free** — no manual FTS work, contrary to what the earlier draft of this plan assumed. |
| `gcGenres(tx, uid)` | `book_handlers.go` | Genres are garbage-collected after a delete. A restore has to put them back. |
| `st.Migrate()` at startup | `cmd/tippani/main.go:123` | The one place a purge can hang off with no scheduler and no goroutine. |
| `creditSeparators` pref | `auth_handlers.go` | The trail to copy for a new preference: normaliser, default-on-read, reject-before-canonicalise, plus the mirror struct in `ui_test.go`. |
| Typed-confirm precedent | factory reset | `{"confirm":"RESET"}`. Bulk delete reuses the shape in 1.9.0. |

### Three findings from verification

1. **`id INTEGER PRIMARY KEY` is a rowid alias on every one of these tables**, so
   SQLite allocates `max(existing rowid) + 1` and **does reuse a freed id** — but
   only when the deleted row held the table's highest id. This is exactly the
   common case: you delete the thing you just added. See the open question below.

2. **The FTS worry was unfounded.** Triggers already cover insert and delete, so
   the index follows the rows. Worth stating because the earlier draft budgeted
   work for it and 1.7.1 genuinely was bitten by an external-content index.

3. **`utterances.updated_at` exists**, so a standalone quote round-trips through
   the same snapshot shape as everything else with no special case.

---

## Decisions

All vetted. Where a decision cost something, the cost is named.

| Question | Decision |
|---|---|
| What gets a bin | The **five content kinds** — book, movie, annotation, dialogue, quote. Tags, people, stickers and avatars still delete outright: a tag is vocabulary and a person is a reference row. |
| Deleting an account | **Also binned**, as a single all-or-nothing entry covering the whole library. |
| Mechanism | **A `trash` table holding a JSON snapshot.** The rows are really deleted. Nothing else in the app changes — every query, count, stat and search keeps working untouched. |
| Restore unit | **One entry per user action.** Deleting a book is one row: *The Dispossessed + 40 quotes*, restored whole. There is no way to end up with a quote whose book is missing. |
| Ids on restore | **Always the original, reserved.** See the open question. |
| Retention | **A setting**, default 30 days. |
| The purge | **On startup, then at most once a day**, on the first request that notices the date changed. No ticker, no goroutine. |
| Cover and poster files | **Parked**, restored with the row, deleted only when the row is purged. |
| Where it lives | A **Trash card in Settings**, beside Backup. Plus an **Undo in the toast** immediately after the delete. |
| Trash rows | **Summary, expandable.** Kind, title, when, child count; expand to list what is inside, read-only. |

### Open question — what "ids reserved" actually costs

The decision taken is *always restore the original id*. Verification says that is
more expensive than it sounds, and the difference is worth a deliberate answer
rather than a discovery halfway through.

SQLite reuses a freed id when the deleted row held the table's highest. To stop
that permanently you need `AUTOINCREMENT`, which records the high-water mark in
`sqlite_sequence` and never reuses — and `AUTOINCREMENT` is part of the column
definition, so adding it means **rebuilding all five tables**.

Those five tables are FK parents with cascading children. That is precisely the
shape `0018_retire_ratings.sql` refused to touch, warning that "a DROP-TABLE
rebuild would cascade-delete the child rows", and the shape this repo has
repeatedly called its most dangerous migration class.

What the reservation buys over *original if free*: a restored item keeps a URL
you had bookmarked, in the narrow window where the deleted row was its table's
highest id **and** something new was created before you restored.

Three ways to have it, cheapest first:

- **Original if free, new id otherwise.** No migration risk at all. The restore
  reports which ids moved. Loses the bookmark guarantee in the narrow case.
- **An allocation floor.** A `id_floor(table_name, next_id)` table; the five
  create handlers allocate explicitly above the floor instead of letting SQLite
  choose. No rebuild, five handlers touched, and a new subtlety on every create.
- **`AUTOINCREMENT` on all five.** Permanent, invisible afterwards, and requires
  the five-table rebuild described above.

**Recommendation: the allocation floor.** It delivers the decision as taken —
ids genuinely never reused, restores always identical — without rebuilding a
single FK parent. The cost is confined to five INSERT paths that already run
inside immediate transactions. *This one point is not yet settled; everything
else below is written to be independent of the answer.*

---

## Part 1 — migration `0030`

`internal/store/migrations/0030_trash.sql`. Append-only, single transaction.
`0029_six_colours.sql` is the current highest — verified.

```sql
CREATE TABLE trash (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('book','movie','annotation','dialogue','quote','account')),
  label       TEXT NOT NULL,            -- what the row says on the shelf: a title, or a quote's first words
  child_count INTEGER NOT NULL DEFAULT 0,
  deleted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  payload     TEXT NOT NULL,            -- JSON: the row and every cascaded child, by table
  files       TEXT NOT NULL DEFAULT '[]' -- JSON array of parked image filenames
);
CREATE INDEX trash_user_time ON trash(user_id, deleted_at);
```

`payload` is `{"books": [ {...} ], "annotations": [ {...}, ... ], ...}` — a map
of table name to whole rows, written by reading `PRAGMA table_info` rather than
by naming columns. **A snapshot that lists columns by hand is a snapshot that
silently stops carrying the column added next release**, and the failure only
shows up on a restore, months later, as a field quietly reset to its default.

`kind = 'account'` is deliberately in the same table rather than beside it: the
purge, the retention setting and the ownership check are the same code for both,
and a second table would mean a second place to forget.

**No FK from `trash` to anything it holds.** The rows it describes do not exist.

The one schema-shape test the repo's helper already supports gets a snapshot of
this table, so a later rebuild cannot quietly drop the CHECK or the default.

---

## Part 2 — the writer

One helper, and every in-scope delete handler routes through it:

```go
func (s *Server) trashAndDelete(tx *sql.Tx, uid int64, kind string, id int64) error
```

It does five things in **one transaction**, in this order, and the order is the
design:

1. **Read the subtree** — the row, then every table with an FK to it, following
   the cascade edges rather than a hand-written list.
2. **Collect image filenames** the way `userCoverFiles` already does, *before*
   anything is deleted, because the cascade frees rows and not files.
3. **Write the `trash` row** with the JSON payload and the filename list.
4. **Delete the row**, letting the existing cascade do exactly what it does
   today. No delete logic changes.
5. **Park the files** — move, not copy, into `MediaCover/trash/`.

The file move is last and outside the DB's control, so it is the one step that
can leave a mismatch. It fails towards keeping the file: a parked file with no
trash row is garbage the purge collects, while a trash row pointing at a deleted
file is a restore that silently loses a cover.

**Ownership is filtered in the same statement as the read**, never as a separate
check — a foreign id answers **404, never 403**, per the house rule.

---

## Part 3 — restore

`POST /trash/{id}/restore`.

One transaction: insert parents before children in FK order, with explicit ids;
move the parked files back; delete the trash row. The FTS triggers reindex on
insert, so nothing else is needed there. `gcGenres` ran on the way out, so the
genres in the payload are re-inserted on the way back.

Three refusals, each of which is a wrong answer if taken the other way:

- **A trash row belonging to someone else** → 404, and nothing is written.
- **An id collision** → depends on the open question above; under the
  recommendation it cannot happen, and the endpoint asserts that rather than
  assuming it.
- **A restore of an `account` entry** → admin only, and it re-creates the user
  row too, so it is the one restore that can fail on a username now taken.

---

## Part 4 — the purge

Two triggers, no scheduler:

- **At startup**, immediately after `st.Migrate()` in `cmd/tippani/main.go`.
- **Once a day**, on the first request that observes the date has changed since
  the last sweep. A date stamp in settings, not a ticker — nothing to leak, and
  nothing running on an idle instance.

A sweep deletes `trash` rows past the retention window and the files they name,
then collects parked files no trash row references. Deliberately **not** on a
timer: nothing is expiring while nothing is running, so "30 days" means 30 days
of the app being alive, and that is the honest reading on a self-hosted box that
gets switched off.

`trashDays` is a new preference — `7 | 30 | 90 | 0` where 0 means never expire —
following `creditSeparators` exactly, **including the mirror struct in
`ui_test.go`**, or four equality assertions break.

---

## Part 5 — the client

- **A toast with Undo**, on every in-scope delete. The label is one word, which
  is comfortably inside the five-word rule.
- **A Trash card in Settings**, beside Backup — where you already go when
  something has gone wrong. Summary rows; expanding one lists its contents
  read-only, straight from the payload, so no second read path per kind.
- **A retention select** in the same card.
- **"Empty now"**, because the real reason to want a shorter window is wanting
  something gone *now*.
- `help.jsx` entry and a `docs/ui-glossary.html` row for both new controls.

---

## Commits

| # | Commit | Contains |
|---|---|---|
| 1 | `feat: migration 0030 — somewhere for deleted things to go` | `trash` table, schema snapshot test |
| 2 | `feat: a delete that can be taken back` | `trashAndDelete`, five handlers rerouted, file parking |
| 3 | `feat: putting it back where it was` | restore endpoint, ordering, ownership |
| 4 | `feat: thirty days, then gone` | purge, startup + daily, `trashDays` pref |
| 5 | `feat: the bin, and a way into it` | Settings card, expandable rows, retention select |
| 6 | `feat: undo, while you still remember` | toast |
| 7 | `feat: deleting a member is not final either` | account entries |
| 8 | `docs: what happens to something you delete` | README, AI.md, ui-glossary, help.jsx |
| 9 | `chore(release): 1.8.0` | CHANGELOG, tag |

---

## Verification

No local server run — `go test` + Vitest + review; Playwright is CI-only.

1. `go vet ./...`, `go test ./...`, **`-race` on the trash transactions.**
2. `npm test`, both projects.
3. `make frontend` in the same commit as any frontend change; CI enforces it.
4. New Go tests, each asserting **values, not counts**:
   - a book's 40 annotations, their tag joins, their review rows and its genres
     all come back, with the same ids and the same content;
   - a foreign trash id answers 404 and restores nothing;
   - a parked cover survives the round trip and is on disk afterwards;
   - a purge past the window removes the row **and** its files, and leaves
     everything inside the window alone;
   - `trashDays = 0` never purges;
   - the snapshot carries a column added after the snapshot code was written —
     the `PRAGMA table_info` claim, tested rather than asserted in a comment;
   - deleting an account bins it whole and restoring it returns the library.
5. **Mutation-test the destructive paths**: drop the ownership filter, drop the
   transaction, delete the file-parking step, invert the retention comparison.
   Each must go red.
6. `node scripts/roadmap-data.mjs --check` and `scripts/glossary-css.mjs --check`.

---

## Risk

The snapshot is the whole feature, and its failure mode is delayed: a payload
that quietly stops carrying a column produces a restore that looks like it
worked. Hence reading the shape from `PRAGMA table_info` rather than naming
columns, and hence the test that adds a column and expects it to survive.

The file parking is the only step outside the transaction, and it is deliberately
biased towards keeping a file that no longer has a row.

Everything else in this release either writes a row nobody reads yet or deletes
one the app had already agreed to delete.

Next: [context menu and multiselect](context-menu-and-multiselect.md), which
depends on this one for bulk delete.
