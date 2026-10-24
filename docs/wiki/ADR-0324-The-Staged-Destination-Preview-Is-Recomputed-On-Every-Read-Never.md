# ADR-0324: The staged destination preview is recomputed on every read, never stored, because the library moves while quotes wait

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** Every group heading in the queue says where its quotes are going — an existing title they will join, or a new one that will be created — and that preview is computed by `listStagedWorks` on each read. `previewStagedTarget` runs the same resolution approval will run, writing nothing.

**Why.** The queue holds quotes indefinitely, across sessions. A book added yesterday should change the answer for a batch staged last week, and a stored preview would go stale silently and be believed.

**Instead of.** Storing the resolved target at import — rejected; it is a cached answer to a question whose inputs keep changing.

**Approved.** Mine, and I approved the read-only split of `findImportBook` specifically so the preview and the real resolution cannot diverge.

<sub>1.2.0 — `internal/httpapi/import_staging.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
