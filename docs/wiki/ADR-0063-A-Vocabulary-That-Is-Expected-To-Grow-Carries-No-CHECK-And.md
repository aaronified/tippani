# ADR-0063: A vocabulary that is expected to grow carries no CHECK, and boards.kind gave up the one it had

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 2.2.0

**Decided.** 0047 widens a board's kind from `plain | proverb` to `plain | proverb | speech | letter | essay` by **dropping the CHECK entirely** and validating the list in Go, beside `media_type` (0006), `status` (0024) and `person_kinds` (0027). The mechanism is `ALTER TABLE ... DROP COLUMN` followed by `ADD COLUMN`, with every board's kind parked in a scratch table for the two statements in between.

**Why not widen it.** 0045 already wrote the argument for a different table — *"a CHECK on six columns is six things SQLite cannot later alter (0029 rebuilt four tables to widen one CHECK, which is the whole argument)"* — and this is the same vocabulary a second time. Poem, Lyrics and Article are expected kinds; two of the columns 0047 adds are deliberately named `work_title` and `locator` rather than `essay_title` and `essay_page` so that each of those is a label rather than a migration. A CHECK would make them a migration anyway.

It also fixed a live 500 rather than a future risk. `boardKindSpeech = "speech"` has been defined and accepted since 1.15.0, the Quotes page has POSTed it from its **Speeches** starter since the same release, and 0037's CHECK refused it — so pressing that starter answered 500. Nothing tested it, which is how a Go validator and a schema managed to disagree for a release.

**Instead of 0029's rebuild dance,** which is the house idiom for changing a constraint and **does not transfer here.** `boards` is the parent of a `RESTRICT` child — `utterances.board_id`, deliberately, so deleting a populated board refuses rather than cascading — and all three ways round that were probed on the real schema: `DROP TABLE boards` fails outright with FK 1811 (it does not cascade, so there is nothing parking the children can buy); `PRAGMA defer_foreign_keys=1` lets the DROP through and fails at COMMIT with 787, because RESTRICT is not deferrable; and `PRAGMA foreign_keys=OFF` is a no-op inside a transaction, which is where every migration runs. A rebuild would additionally have to park and re-point `board_id` and recreate `idx_boards_user` and the UNIQUE by hand.

**The cost, stated rather than discovered.** `kind` moves to the end of the table's column order. The only positional reader of a base table is `store.Recover`, whose `INSERT INTO main."t" SELECT * FROM old."t"` runs *after* a successful `Migrate` against a fresh database built by the same migrations, so both sides always move together; trash and restore discover columns by name and the backup is a file-level `VACUUM INTO`. `DROP COLUMN` needs SQLite ≥ 3.35 and modernc's is 3.53.2.

**Approved.** Mine. There is no replacement index either: a reader has tens of boards, and `idx_boards_user (user_id, hidden, pos)` already covers the only query that lists them.

<sub>2.2.0 — `internal/store/migrations/0047_per_kind_fields.sql` · `internal/store/per_kind_fields_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
