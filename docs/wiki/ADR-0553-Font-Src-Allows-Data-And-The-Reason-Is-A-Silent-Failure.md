# ADR-0553: font-src allows data:, and the reason is a silent failure

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** `internal/httpapi/server.go`

**Decided.** The CSP is `default-src 'self'` with `font-src 'self' data:` carved out.

**Why.** Vite inlines `@fontsource` subset files under about 4 KB as base64 `data:` URIs.
Without the carve-out `default-src` blocks them and those glyphs fall back to a system
face **silently** — no console error a user would see, no broken layout, just slightly
wrong letters. A `data:` font is inert: parsed, never executed, the same reasoning that
already applied to `data:` images.

**Approved.** Mine, and I widened the policy rather than fighting the bundler, because
the alternative was a rule that looked stricter and shipped worse type.

<sub>`internal/httpapi/server.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
