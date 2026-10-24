# ADR-0170: missing only — a refetch mode that never replaces stored art

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** A boolean on the covers pass — the covers job's `missing_only`, and the same flag on `POST /covers/refetch` — that fills empty covers and posters only and never upgrades a stored low-resolution image. It is what the phone's Fetch key sends.

**Why.** The bulk refetch is otherwise happy to replace a thumbnail with a better scan, which is right when you asked for it on a desktop and watched the progress bar. A quick tap on a phone should not be able to churn art you are happy with — including art you uploaded or pasted yourself — and there is no undo for a replaced cover. Two intentions, one pass, one flag. My call.

<sub>`internal/httpapi/metadata_handlers.go` · `internal/httpapi/jobs_kinds.go` · `web/frontend/src/MetadataPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
