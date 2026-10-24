# ADR-0573: Stored images have random, never-reused names

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** from 0.3.0

**Decided.** Covers, posters, avatars and stickers are stored under 16 lowercase hex characters plus an extension sniffed from the decoded image, in `<DataDir>/MediaCover`. Because a name is random and never reused, `/covers` can set `Cache-Control: public, max-age=31536000, immutable` — there is no invalidation problem, because a changed image is a different name. The handler serves only names matching `^[0-9a-f]{16}\.(jpg|png|webp|gif|svg)$`, so there is no path traversal and nothing is served that we did not store ourselves; anything else is a JSON 404 rather than `ServeFile`'s plain text. Uploaded SVG stickers additionally get `Content-Security-Policy: default-src 'none'; …; sandbox` and an explicit `Content-Type`, so even a direct navigation cannot execute embedded script — upload rejects `<script>` too, but this is the authoritative barrier. I approved the naming scheme for the caching and kept it for the validation.

**Instead of.** Content-hash names (same caching, but a hash tells you the file's content is already known to someone) or original filenames.

<sub>from 0.3.0 — `internal/httpapi/covers_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
