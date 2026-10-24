# ADR-0334: Bulk staged edits apply in a fixed order — assignments, tags, formula, retarget — and an assignment re-bases the reset snapshot

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** `handleBulkStaged` applies plain column assignments first, then tags, then the formula, then the retarget, in one transaction. Assigning `location` or `timestamp` writes the `_orig` snapshot as well.

**Why.** A request carrying both a `location` and a `formula` re-bases the snapshot first and then shifts from the value just set, which is the reading a user would predict from the form they filled in. And the value you just typed is what `reset` should return to, not the one the file happened to carry. Season and episode get no `_orig` pair, because no formula renumbers episodes and there is therefore nothing to restore.

**Instead of.** Applying whatever arrives in whatever order — rejected; the combination of an assignment and a formula is exactly where an unspecified order produces a surprising result.

**Approved.** I approved fixing the order and writing it into the comment rather than leaving it implicit in the code's sequence, which is the same thing until someone reorders two blocks.

<sub>1.2.0 — `internal/httpapi/import_staged_bulk.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
