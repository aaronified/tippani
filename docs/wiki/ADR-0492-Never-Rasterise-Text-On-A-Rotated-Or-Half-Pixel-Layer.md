# ADR-0492: Never rasterise text on a rotated or half-pixel layer

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted

**Decided.** The import cards' paste-on wobble (±0.7°) moves to a chrome-only underlay with the text stack unrotated, and tooltip bubbles centre by flex layout instead of `translateX(-50%)`.

**Why.** "Whole import cards were tilted (±0.7°), rasterizing every glyph on a rotated layer, and the tooltip bubble was centered with `translateX(-50%)` onto half-pixels." Both produce soft text for the same reason — glyphs stop landing on the pixel grid. The rule that comes out of it: decorative transforms belong on a chrome layer beneath the text, and centring should be done by layout so glyphs stay pixel-snapped. I approved it as a standing rule rather than two fixes, which is why it reads as one entry.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
