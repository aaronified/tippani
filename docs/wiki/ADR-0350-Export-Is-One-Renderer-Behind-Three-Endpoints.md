# ADR-0350: Export is one renderer behind three endpoints

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `docs/wiki/Design-decisions.md` · `internal/httpapi/export_handlers.go`

**Decided.** `GET /books/{id}/export`, `GET /movies/{id}/export` and `GET /export` (a zip of `books/<title>.md` + `movies/<title>.md`) all render through the same code. Frontmatter carries the work's metadata; the body writes `- key: value` lines for **non-default** metadata only. Filenames sanitise `[/\:*?"<>|]` to `-` and collisions get a ` (2)` suffix, capped at 120 runes, falling back to `untitled`.

**Why.** Three renderers would drift, and drift in an exporter is invisible until someone re-imports a file written by the wrong one. Writing only non-default values keeps the file readable as a document rather than as a database dump — a file only mentions colour when a colour was chosen — and it is why the default colour is omitted everywhere. The filename rules exist because the zip has to extract on Windows as well as on the machine that made it. I approved the one-renderer shape before the second endpoint existed.

<sub>`docs/wiki/Design-decisions.md` · `internal/httpapi/export_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
