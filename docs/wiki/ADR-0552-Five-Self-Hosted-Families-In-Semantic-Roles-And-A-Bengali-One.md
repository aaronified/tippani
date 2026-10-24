# ADR-0552: Five self-hosted families in semantic roles, and a Bengali one that is not decoration

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** Newsreader, Hanken Grotesk, IBM Plex Mono, Caveat and Noto Serif Bengali,
all self-hosted through `@fontsource` and imported in `main.jsx`, each bound to a role
rather than to a screen.

**Why.** Self-hosted because the app's CSP is `default-src 'self'` and a font CDN is an
outbound request on every load — which fails both the no-phoning-home rule and the
offline case. Roles rather than screens because a font chosen per screen drifts; a font
chosen per meaning cannot. The Bengali face is there because the app is named টিপ্পনী and
a wordmark that falls back to tofu is worse than not having one.

**Instead of.** A system font stack, which costs nothing and would have made the two
aesthetics indistinguishable — the type is half of what separates them.

<sub>pre-1.0 — `web/frontend/src/main.jsx` · `internal/httpapi/server.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
