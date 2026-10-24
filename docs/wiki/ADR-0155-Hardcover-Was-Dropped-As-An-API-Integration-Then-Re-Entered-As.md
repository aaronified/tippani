# ADR-0155: Hardcover was dropped as an API integration, then re-entered as an HTML scraper

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** V2 dropped Hardcover read *and* write — no documented write mutation exists for `reading_journals`, per-quote push is likely impossible via the public API, and the read half was not worth keeping alone. Removed with it: `hardcover_id`, `sync_state`, `/sync/*`, token handling. What exists now is `POST /import/hardcover-html`, which parses a saved journal page.

**Why.** The integration was dropped for the right reason and the *data* was never the problem. A saved page carries everything HTML-escaped as JSON in the `data-page` attribute of the Inertia root div, so the parser scans between markers and decodes — no API, no token, no sync state, and no HTML-parser dependency. The structs mirror only the slice needed and are tolerant: missing fields stay zero, variable-shaped ones (`entry` is a string on quotes and null elsewhere, `tags` varies) are kept raw and parsed defensively per entry. Journals that are not quotes are ignored. Mine, and the second form is strictly better than the one I abandoned — it needs no credential at all.

<sub>`docs/wiki/Design-decisions.md` · `internal/importer/hardcover.go` · `internal/httpapi/import_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
