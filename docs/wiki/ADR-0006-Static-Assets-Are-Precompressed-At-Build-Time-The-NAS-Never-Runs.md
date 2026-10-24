# ADR-0006: Static assets are precompressed at build time; the NAS never runs Node and never gzips a byte at request time

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** 1.1.0 (reversal)

**Decided.** The Node half shipped and holds — the frontend builds in its own Docker stage and `web/dist` is embedded with `go:embed`, so the runtime image is distroless static with no Node in it. The precompression half never shipped.

**Why.** The plan promised "Precompressed (gzip + brotli) at build, served with `Content-Encoding` + `Cache-Control: immutable` → zero runtime compression CPU". That is not what is built: `vite.config.js` has no compression plugin, `spaHandler` is a plain `http.FileServerFS`, and `Cache-Control: immutable` is set on stored covers only.

**Reversal.** Reversed in 1.1.0, and I got the priority wrong rather than the arithmetic. I designed for the LAN case, where compression is invisible, and forgot the case the mobile client actually lives in. Quote text compresses roughly eight to one, and over Tailscale or cellular that is the difference between a library sync that feels instant and one that does not. So a stdlib `compress/gzip` middleware went in, opt-in per request via `Accept-Encoding` and skipped for content types that are already compressed — the NAS does gzip bytes at request time now, deliberately.

**Approved.** Both halves are mine. I approved the original plan and I approved overturning it once the phone made the cost visible; the honest summary is that I optimised for the wrong link.

<sub>1.1.0 (reversal) — `docs/wiki/Design-decisions.md` · `web/frontend/vite.config.js` · `internal/httpapi/server.go` · `internal/httpapi/gzip.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
