# ADR-0158: Provider secrets are booleans on read and pointers on write, and traces redact query-param keys

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/metadata_handlers.go` · `internal/metadata/metadata.go`

**Decided.** `GET /admin/metadata-keys` returns `tmdb_key_set`, `tvdb_key_set`, `google_books_key_set`, `amazon_cookie_set` — booleans — plus the Amazon domain, which is not secret. `PUT` takes `*string` per field: `nil` means "omitted, leave as-is", `""` means "clear".

**Why.** A stored secret is never echoed, so there is nothing for a compromised session or a screenshot to read back. Pointers are what make a partial save safe: a plain string cannot distinguish "the client did not send this field" from "the user cleared it", so saving just the Amazon cookie would wipe every other key. The trace layer closes the other leak — the v3 TMDB key travels as `api_key=` and the Google Books key as `key=`, both in the query string, so `redactURL` rewrites them before the URL reaches a debug line, and returns the URL byte-for-byte when there is nothing to hide. The v4 token and the TVDB JWT travel in the Authorization header and never reach a trace at all. Approved by me; the pointer half was a bug fix first and a decision second.

<sub>`internal/httpapi/metadata_handlers.go` · `internal/metadata/metadata.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
