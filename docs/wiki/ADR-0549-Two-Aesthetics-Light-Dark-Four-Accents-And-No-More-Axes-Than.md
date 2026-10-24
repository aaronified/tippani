# ADR-0549: Two aesthetics × light/dark × four accents, and no more axes than that

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** `paper` and `film`, each in light and dark, with the accent chosen from
exactly four: terracotta, ochre, olive, slate. Everything else is derived. `theme.js`
holds each palette as literal tokens and writes them onto `<html>` as data attributes and
CSS custom properties.

**Why.** Two aesthetics are two arguments about what a commonplace book *is* — a paper
one and a film one — and they earn their keep because the app holds two kinds of thing.
Light and dark is not a preference, it is a room. The accent is the only free choice,
kept to four because a free colour picker produces a shelf of near-identical blues, and
because every accent has to work as a fill, a hairline, a focus ring and text on both
surfaces in both aesthetics.

**Instead of.** A free hex accent, which I turned down for the reason above; and one
aesthetic with a density toggle, which would have been cheaper and would have made the
film side a smaller paper side rather than its own thing.

**Approved.** Mine, from the UI instruction sheet onwards, and the four-value cap is the
part I would defend hardest.

<sub>pre-1.0 — `web/frontend/src/theme.js` · `web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
