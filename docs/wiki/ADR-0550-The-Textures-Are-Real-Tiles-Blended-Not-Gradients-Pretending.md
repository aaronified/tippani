# ADR-0550: The textures are real tiles, blended — not gradients pretending

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** Six grayscale WebP tiles — paper, wood, metal, glass, fabric, rubber — are
blended into cards, buttons, thumbs and the shell. The accent controls carry grain: leather
(`fabric.webp`) on paper, rubber (`rubber.webp`) on film.

**Why.** A CSS gradient reads as a gradient at any size; a real tile reads as a surface.
The cost is six small files and one blend mode, which is affordable on a page that is
already sending fonts, and nothing about it touches the server.

**Instead of.** Procedural noise via SVG `feTurbulence`, which is what the app mark uses.
Rejected for surfaces because it is recomputed per element per repaint, and this app is
budgeted on the assumption that the *client* can spend what the NAS cannot — but not
without limit.

**Approved.** Mine. It is the single most visible decision in the app and the one people
notice first.

<sub>pre-1.0 — `web/frontend/src/textures/` · `web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
