# ADR-0135: A quote's speaker is a column on the quote, not a work person row

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** Migration 0059 adds `dialogues.actor_id` and `utterances.speaker_id`, both `ON DELETE SET NULL`, each with a partial index. The printed `actor` / `speaker` strings stay. `store.SyncQuotePerson` is the only thing that writes the ids, `QuoteLinksAgree` walks both tables asserting the name and the record describe one person, and a 3.1.0 one-time pass links what already exists.

**Why.** `work_person` is keyed `(user_id, kind, work_id, role, ordering)` — it says *this work is credited to this person*. An actor on a dialogue is not a credit on the film: two lines of one film routinely name two actors, and a standalone quote has no work at all. So the link belongs on the quote, which is where the column already was. The strings stay for the reason `books.author` stayed — `dialogues_fts` and `utterances_fts` are external-content FTS5 and cannot index a joined table.

**Instead of** two more `CreditRole` values on `work_person` with `kind = 'dialogue'`, which was the shape first proposed and approved in outline, and which reuses `SetCredits`, `RecomposeCredit` and the merge's re-pointing wholesale. It was dropped on a **data-safety** ground found while wiring it: the bin snapshots a quote with `SELECT *` and restores it row by row, so a column comes back for free while a polymorphic link table needs its own place in `restoreOrder`, its own entry in the snapshot writer, and two `AFTER DELETE` triggers — new plumbing on the one path whose failure loses a reader's quote. `work_person` also has no foreign key on `work_id`, so a deleted quote would orphan its rows silently, which is a leak `books` and `movies` already have and this would have multiplied by every quote in the library.

**The cost, stated:** the resolve/sync/merge machinery now exists twice, once per shape — `credits.go` for works, `quote_person.go` for quotes. That is the same trade 0056 took for characters, and it is paid the same way: the two files are written in parallel so a divergence shows up in a diff.

**The read side has now landed.** `GET /people/id/{id}` carries `lines` — the quotes pointing at the record, capped at 50 — and `shared_lines`, which is how many *further* quotes name the record alongside somebody else and are therefore unlinked. The count is computed the way the linker computes its answer, `metadata.SplitCredits` under the account's own separators folded against the record's name and aliases, rather than by a looser rule such as a `LIKE`: a second rule here would report a number `QuoteLinksAgree` disagrees with, and the two would drift the moment either changed. The cap bounds what a panel draws; the count is not capped, because it is the number that would otherwise be silently wrong.

<sub>`internal/store/quote_person.go` (`PersonLines`) · `internal/httpapi/identity_handlers.go`</sub>

<sub>`internal/store/migrations/0059_quote_person.sql` · `internal/store/quote_person.go` · `internal/store/onetime_3_1_0_quote_person.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
