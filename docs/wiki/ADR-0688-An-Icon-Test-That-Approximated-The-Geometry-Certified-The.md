# ADR-0688: An icon test that approximated the geometry certified the approximation

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — `extentOf` in `icons.test.jsx` computes the true extent of an SVG arc:
  endpoint parameterisation converted to centre form, then the extrema that fall inside
  the swept range. Fourteen of the nineteen filled glyphs had their `viewBox` corrected.
- **Why** — it read an arc by its ENDPOINTS. A Phosphor fill draws a disc as one arc
  whose endpoints sit near each other while the curve travels half the box away, so
  `IconNavCatalogue` measured 152 wide against a true 216 — and the `viewBox` cropped from
  that measurement **cut the drawing**. The film reel lost its left edge on screen, in the
  rail, and the test called it correct. The owner spotted it by eye.
- **Reversal** — this corrects the icon pass logged above, which introduced the crop. The
  0.82 normalisation was sound; the measurement feeding it was not.
- **Approved** — mine, after watching the corrected test fail on the old value.

<sub>Unreleased — `web/frontend/src/App.jsx` · `web/frontend/src/index.css` · `web/frontend/src/ui.jsx` · `web/frontend/src/routes.js` · `web/frontend/test/dom/icons.test.jsx` · `web/frontend/test/dom/text-readability.test.jsx` · `internal/i18n/en.txt` · `internal/i18n/bn.txt`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
