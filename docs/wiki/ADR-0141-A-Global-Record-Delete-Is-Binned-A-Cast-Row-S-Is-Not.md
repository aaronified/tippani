# ADR-0141: A global record delete is binned; a cast row's is not

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** `DELETE /people/{id}` and `DELETE /characters/{id}` write a `person-delete` / `character-delete` bin entry and are undoable. `DELETE /cast/{id}` stays permanent. Both new kinds are reversals sharing the merges' branch in `handleRestoreTrash`, and 0060 enumerates all four.

**Why.** The owner's own distinction: *a work-character is attribution; a global character is not mere attribution*. A `work_cast` row says how one work bills somebody, and deleting it is a correction to that work. A `people` or `characters` row is **authored** — a sort name that was a judgement, a description, a portrait, every alias filed and every merge those aliases record — and that is what a bin is for. This overrides an earlier call in this same pass that left both permanent by analogy with `trash.go`'s "a person is a reference row"; that reading was about a row the app *re-fetches*, and it stopped being true when 0056 made the record the thing a reader edits.

**Why a delete is a reversal and not a snapshot.** It does insert its row back — but two of the three things it disturbs are `ON DELETE SET NULL` columns on rows that still exist: the cast rows and the quotes that pointed at the record. Putting those back is an UPDATE by id, and the bin's generic restore would return the record and leave every one of them pointing at nothing.

**Deleting a person who is still credited is REFUSED**, with the count: *"still credited on 6 works"*. `work_person.person_id` is `ON DELETE CASCADE`, so the delete would take the credit link rows with it while `books.author` went on printing the name — the faithful-column promise means nothing recomposes it — leaving the library in exactly the state `CreditsAgree` calls drift for as long as the entry sat in the bin, where a support check would report a fault that was really somebody's delete. The cast and quote links are *not* refused, because they are `SET NULL`: nothing cascades, nothing is recomposed, and every id is recorded and put back. A performer with lines but no credits is deletable and restorable.

**A restored alias is `INSERT OR IGNORE`.** A spelling the record held may have been filed under somebody else during the thirty days it was in the bin, and the alias tables are keyed on the key alone. Taking it back would be a restore silently unfiling a decision made after the delete; the record returns without that one spelling instead.

<sub>`internal/store/identity.go` · `internal/httpapi/trash_handlers.go` · `internal/httpapi/people_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
