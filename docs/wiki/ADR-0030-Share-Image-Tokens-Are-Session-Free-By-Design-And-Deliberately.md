# ADR-0030: Share-image tokens are session-free by design, and deliberately not single-use

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted
- **Version:** `internal/httpapi/share_handlers.go`

**Decided.** `POST /share/image` stages a PNG under a 128-bit random token with a three-minute TTL in a 16-entry capped map; `GET /share/image/{token}` serves it with no session, and does not consume it.

**Why.** Android's DownloadManager fetches outside the WebView's cookie jar, so requiring a session would make the download fail for exactly the clients the route exists for. The token is the credential instead: unguessable, short-lived, capped, swept on read and on the next upload. Uploads are PNG-only — the GET reflects bytes without a session, so it must only ever serve what a canvas produced.

**Reversal.** It was single-use, and that was wrong. A WebView `<a download>` handed to DownloadManager commonly fetches the URL more than once — the WebView's own navigation plus the manager's fetch, or a probe followed by a ranged request — so consuming the token on the first hit made the real download 404. I had reasoned about the security property and not about the client. Serving it a few times over three minutes is safe; the file header still says "single-use" and is now stale against the handler twenty lines below it.

<sub>`internal/httpapi/share_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
