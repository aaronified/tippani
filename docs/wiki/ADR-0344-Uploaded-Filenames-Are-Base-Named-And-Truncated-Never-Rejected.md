# ADR-0344: Uploaded filenames are base-named and truncated, never rejected, because the name is displayed and never used as a path

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** The uploaded filename is reduced to its base name via `filepath.Base(filepath.ToSlash(...))`, blanked if it degenerates to `.` or a separator, and truncated to 128 runes. A long or odd name never fails the upload.

**Why.** The name is kept because the staging queue groups and filters by the file a batch came from, so "the Kindle export" and "the Goodreads page" stay distinguishable in one pending list. It is displayed and never touches the filesystem — nothing here writes a file — but stripping the directories keeps a hostile name from *rendering* as one. Truncating rather than rejecting is the right trade: a long name is not a reason to refuse someone's highlights.

**Instead of.** Rejecting names over the limit — rejected; the name is decoration and the quotes are the payload.

**Approved.** Mine, and I approved the "displayed, never a path" framing being written down, since it is what justifies sanitising lightly rather than defensively.

<sub>1.2.0 — `internal/httpapi/import_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
