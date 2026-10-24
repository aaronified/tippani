# ADR-0139: A restored quote is re-linked from its name, not from the id in the snapshot

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/trash_handlers.go`

**Decided.** `restoreSnapshot` drops `actor_id` / `speaker_id` from a `dialogues` or `utterances` row on the way in and calls `SyncQuotePerson` after the insert.

**Why.** The bin's snapshot is a `SELECT *` taken before the delete, and `handleDeleteDialogue` runs the orphan sweep immediately after binning — so the actor whose last line this was can be gone by the time the reader presses undo. With `foreign_keys(1)` the insert then fails the constraint and rolls back the **whole** restore, losing the quote to protect a number. Re-deriving is also the better answer rather than merely the safe one: the name is still on the row, so the person is re-created exactly as a fresh write would create them — which is what `gcOrphanPeople` already says a person row is ("a reference row that re-fetches, not part of the quote") — and an entry binned before 0059 comes back linked rather than bare.

<sub>`internal/httpapi/trash_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
