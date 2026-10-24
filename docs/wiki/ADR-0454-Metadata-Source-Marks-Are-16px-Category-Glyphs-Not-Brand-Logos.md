# ADR-0454: Metadata source marks are 16px category glyphs, not brand logos or text pills

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.0.0

**Decided.** `SOURCE_META` maps a slug to a name and a hand-drawn glyph; the real supplier name rides the tooltip and the aria-label.

**Why.** The row used to show a 'GOOGLE BOOKS' text pill, which on a phone cost ~90px of a ~256px row and truncated the title to nothing. Category glyphs match the hand-drawn stroke set and need no licensing, and nothing is lost to a pointer or a screen reader because the name is in the label.

**Instead of.** Brand logos (licensing, and off-style). Text pills (the reversed decision).

**Approved.** My call, and I approved the slugs mirroring the Go side exactly — `google` | `openlibrary` | `amazon` for books, `tmdb` | `tvdb` for films — so the mapping has one spelling across the wire.

<sub>1.0.0 — `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
