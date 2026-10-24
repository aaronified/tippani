# ADR-0707: The type dial stops at 175%, and the rail drops its words rather than growing

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*Supersedes the "wide rail is not a px box" entry above, and closes the open question
beside it. The owner's answer: "Fall back to icon rail. And also get rid of 200%. Max 175%."*

- **200 is gone from `TYPE_FACTORS` and from the server's `sizeFactors`**, and a stored 200
  becomes 175 through a one-time pass rather than falling to 100. `clampFactor` sends an
  unknown factor to the DESIGNED size on purpose — a preference from a newer client must
  not be approximated — but 200 is not a number from the future, it is a position this app
  offered and withdrew, and a reader who chose it wants large text, not default text.
- **A new test reads `type.js` from Go** and fails when the two lists disagree. They are one
  dial in two languages with nothing between them, and the symptom of drift is a setting
  that silently will not stick.
- **Above `RAIL_WORDS_MAX` the rail keeps its glyphs.** Measured in a real browser at
  1280px, in both shipped languages: en 150% cuts *Catalogue* by 6px and *Metadata* by 24;
  bn only fails at 175%. So 125 is the last position where every label fits everywhere —
  and **English is the binding case, which is not the intuition.** The number had to be
  measured because guessing it wrong is invisible: six pixels off a word reads as a
  slightly odd word.
- **Growth was the wrong half of the trade** and is reverted. At 175% the growing rail
  wanted 413px of a 1180px window.
- **CSS cannot ask what the dial says** — a media query reads the viewport and nothing
  else — so `applyTypeScale` writes `[data-rail="icons"]` and every selector in the
  wide-rail block carries the guard. Not an undo-block afterwards: that would be a third
  copy of the icon rail's styles, and the third copy is the one that drifts.

<sub>Unreleased — `web/frontend/src/type.js` · `index.css` · `internal/httpapi/font_prefs.go` ·
`internal/store/onetime_3_1_0_type_dial_max.go` · `scripts/screenshots/typescale.mjs`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
