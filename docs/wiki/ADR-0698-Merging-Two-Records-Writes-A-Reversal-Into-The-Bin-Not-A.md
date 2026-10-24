# ADR-0698: Merging two records writes a reversal into the bin, not a snapshot

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted, then changed or withdrawn: the entry says how
- **Version:** Unreleased

- **Decided** — `store.MergePeople` returns a `MergeUndo` and `POST /people/merge` parks
  it in the bin under a new kind, `person-merge`. `handleRestoreTrash` branches on that
  kind **before** it decodes a snapshot.
- **Why it cannot be the generic restore.** Every other bin entry is *rows that were
  deleted, put them back*. A merge deletes almost nothing — it re-points — so the generic
  insert-by-insert restore would collide on its first write, because the keys it wants are
  still held by the rows the merge changed. The payload is therefore a reversal, and the
  branch that reads it is the only thing that knows how.
- **The central rule is that no cover changes.** A link with an empty `credit_as` is given
  the dropped record's *name* as its spelling, so the shelf goes on printing exactly what
  it printed before. Without this, merging "Orson Welles Jr" into "Orson Welles" would
  silently rewrite a book's author line — which is the one thing a reader tidying their
  library is not expecting to happen.
- **Duplicates collapse to the lowest ordering** and the collapse is recorded in the undo,
  because a work that credited *both* records must not end up crediting one person twice,
  and putting the merge back has to know which row it removed and where it sat.
- **A refusal and a fault are different answers**, so `store.Refusal` says which one is
  coming back. Both handlers here turned every store error into a `409` carrying
  `err.Error()` — which reports a broken database as a disagreement about identity and
  puts the SQL in a toast. "You cannot merge a record into itself" is the reader's to see;
  a failed write is not.
- **Widening the bin's `kind` cost a table rebuild** (`0058`), since SQLite cannot ALTER a
  CHECK. The enumeration was kept rather than dropped: a kind the schema does not know is
  an entry that lists, sits for thirty days and then fails when somebody presses Undo.

<sub>Unreleased — `internal/store/identity.go` · `internal/httpapi/trash_handlers.go` · `internal/store/migrations/0058_trash_person_merge.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
