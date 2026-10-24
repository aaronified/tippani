# ADR-0091: One board per quote, and the three that exist now are seeded and then ordinary

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** `utterances.board_id` replaces the fixed `category` column: one board per quote, like a book on a shelf. Migration seeds **Proverbs**, **Speeches** and **Others** from the three existing values and then knows nothing further about them — all three are renamable, deletable and reorderable. A board carries a name, a colour, a description and a **picture**, uploaded or pasted like a cover; nothing fetches one, because no supplier has a picture of a board.

**Why single membership.** It is the honest evolution of a column that already held one value, the counts add up to the total, and moving a quote is a move rather than a copy. Many-to-many was considered and refused for a specific reason: it is what **tags** already are, and two overlapping ways to group the same rows is worse than either alone.

**Why nothing in the code may know their names.** The moment `Others` is special-cased, renaming it breaks the special case silently. Where a fallback board is genuinely needed — the global ＋, and an import with no board named — it is the reader's **default board**, held as a preference pointing at a row, set to Others by the migration and changeable afterwards.

**Approved.** The reader's: "One board, like a book on a shelf" and "Seeded, then ordinary", with a picture "like a work has a cover".

<sub>Not shipped</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
