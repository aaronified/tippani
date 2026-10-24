# ADR-0353: "A default needn't be stated" cost round-trip fidelity: a film's own export re-imported as a book

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `internal/httpapi/export_handlers.go`

**Decided.** Reversed. `type:` was written for shows only, on the reasoning that "movie" is the default and a default needn't be stated. **Why I was wrong.** `POST /import/markdown` takes one endpoint for both kinds and decides which by inspecting the file, and that decision rested entirely on *optional* content: `director:` / `creator:` / `collection:` in the frontmatter, or `character:` / `actor:` / `timestamp:` on a line. A film with none of them — no director recorded, no collection, its lines unattributed — carried nothing that said "film", so it fell through to the book importer and came back as a **book with annotations**, silently, with the dialogue fields dropped. The general error is worth naming: a default is a fine thing to omit from a form, and a terrible thing to omit from a file whose reader has to work out what it is. Colour could not be pressed into service as a substitute signal either, because migration 0021 put it on both kinds. Files exported before the fix are not retroactively repaired; they have to be re-exported or hand-edited. This was my reasoning and my mistake.

<sub>`internal/httpapi/export_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
