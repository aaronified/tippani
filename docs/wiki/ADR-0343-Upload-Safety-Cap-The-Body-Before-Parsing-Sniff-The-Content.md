# ADR-0343: Upload safety: cap the body before parsing, sniff the content, never trust the declared Content-Type

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** `readUpload` wraps the body in `http.MaxBytesReader(w, r.Body, maxImportBody)` — 5 MB — before `r.FormFile` is called. Routing between the quote, catalogue and book parsers is done by inspecting the bytes (`MarkdownKind`, `LooksLikeMovieMarkdown`), never by the declared type.

**Why.** Capping after parsing is not capping. And the declared content type on a multipart upload is whatever the client says it is, so routing on it means a mislabelled file takes the wrong parser — which, before staging existed, meant writing the wrong rows.

**Approved.** I approved the cap-before-parse ordering explicitly, because the natural way to write the handler puts it the other way round.

<sub>pre-1.0 — `internal/httpapi/import_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
