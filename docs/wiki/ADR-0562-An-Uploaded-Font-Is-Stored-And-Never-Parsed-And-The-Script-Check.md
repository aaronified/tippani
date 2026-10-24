# ADR-0562: An uploaded font is stored and never parsed, and the script check runs in the browser

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** `POST /fonts` checks the first four bytes against the six font-container magics and writes the rest verbatim. The script check — does this face actually draw Bengali? — runs client-side, **by measuring text**, and is a warning rather than a refusal.

**Why the server never parses it.** Font parsers are a famously bad attack surface, the dependency budget here is three direct Go modules, and the only thing that needs to read this file is the browser that asked for it, which has a hardened parser and is going to run it whatever this package concludes. The file is served with `nosniff`, and only to its owner.

**Format by magic bytes, not by extension.** A `.woff2` that is really a ZIP is exactly the case an extension test misses, and the browser would refuse it later with nothing on screen to say why.

**Why measurement rather than parsing.** Reading the `cmap` table means a font parser; woff2 is Brotli-compressed, so in the browser it would mean shipping a decompressor as well — for a check whose answer is advisory either way. Instead: set a string of the target script in the candidate and in a control that certainly lacks it, and compare widths. A face without the script substitutes the same fallback the control does and measures identically.

**A warning, not a refusal.** It can be fooled both ways — a font with three Bengali glyphs passes — and refusing somebody's own font on the strength of a metrics heuristic is worse than telling them what looks wrong. Where it cannot measure at all it answers *undecidable* and says nothing: "I could not check" must never render as "your font is wrong".

**Deleting a font a preference still names rewrites nothing.** An unresolvable token falls back to the built-in, which is the rule that already covers a typo, an older client and a newer one.

**Approved.** The reader's, in the form "user can upload a new font to replace them. a verifier will verify if the language / script is the same".

<sub>1.15.0 — `internal/httpapi/font_handlers.go` · `internal/store/migrations/0039_user_fonts.sql` · `web/frontend/src/fonts.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
