# ADR-0182: Metadata API keys save per field, and a stored secret is write-only with a badge

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `web/frontend/src/Settings.jsx` · `internal/httpapi/metadata_handlers.go`

**Decided.** Each key field saves on its own; a saved secret shows a small floppy-with-tick badge beside the edit button rather than a row of dots. The Amazon *domain* is not a secret and is shown in full.

**Why.** A row of dots is a lie about length and invites the reader to try to read it back; the secret is write-only here precisely so that nothing can reveal it, and one badge carries the one bit that is actually known — whether something is stored. Six keys meant six explanatory lines saying the same thing, so the badge replaced the prose. Per-field saving matches the pointer semantics on the server: a single "Save keys" button is a convenience that quietly wipes its neighbours. The domain stays visible because "www.amazon.de" is a setting, not a credential, and hiding it behind "saved" would make the reader guess which marketplace they configured. Approved by me as part of the density pass.

<sub>`web/frontend/src/Settings.jsx` · `internal/httpapi/metadata_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
