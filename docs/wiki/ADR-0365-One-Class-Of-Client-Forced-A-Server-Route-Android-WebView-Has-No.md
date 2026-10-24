# ADR-0365: One class of client forced a server route: Android WebView has no Web Share, and a blob URL is revoked mid-save

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `web/frontend/src/share.jsx` · `internal/httpapi/share_handlers.go`

**Decided.** Try `navigator.share` first. On mobile without it, POST the PNG to `/share/image` and navigate to the returned URL. The last-resort blob anchor revokes its object URL after 60 seconds, not immediately.

**Why.** Android WebView wrappers never implement Web Share, and a plain-HTTP origin strips it, so the "no server" rule had to bend for exactly one class of client — and the bend is a staged file with a short-lived token rather than a rendering service. The bridge in those wrappers mangles both the filename (the blob UUID) and the bytes (base64 truncation), while a real URL with `Content-Disposition` survives the DownloadManager boundary intact. The 60-second revoke is the other half: browsers save blob URLs asynchronously, mobile especially, and revoking immediately truncates the download into a corrupt file — a bug that looks like a broken image rather than a broken timer. An `AbortError` from the share sheet is a user closing it, not a failure, so it returns rather than falling through. I approved the exception with the token rules in §2 attached to it.

<sub>`web/frontend/src/share.jsx` · `internal/httpapi/share_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
