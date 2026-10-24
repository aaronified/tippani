# ADR-0846: A swatch is drawn from the palette it produces, not from the ground's own tokens

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE DEFECT, BECAUSE IT IS THE ARGUMENT.** Eight grounds ship — four light, four dark —
and the control that offers them drew every one of them transparent. It read `g.bg`, and a
ground is `{ label, tokens }`: the colours it CHANGES, not the colours it is. Worse, the
two most important grounds carry an empty token set on purpose — Cream and Night ARE the
shipped palettes, which is what makes an account that never opens the control see exactly
what it saw before. So the defect was hardest on the grounds that matter most, and the only
swatch a reader could see was the selected one, which draws its ring in the accent.

**WHY `paletteFor` AND NOT A SECOND TABLE.** The swatch could have carried its own three
hex values per ground. That is a second opinion about what a ground looks like, and the day
a token moves the two disagree silently — a picker showing a colour the theme no longer
applies. `paletteFor(dark, prefs)` is the same merge `applyTheme` performs, so the swatch
IS the ground rather than a picture of it.

**AND THE TEST KNOWS WHAT IT LOOKS LIKE, WHICH IS A DECLARED EXCEPTION.** A swatch's whole
job is to be the colour it selects, so "what colour is it" is not an implementation detail
of this control — it is the control. No accessible name, no text and no press can tell a
painted swatch from an unpainted one, which is exactly how three invisible buttons passed
a suite of 4,551 tests. `ground-swatches.test.jsx` reads the inline colour, says so in its
header, and goes red under the original mistake.

**WHAT FOUND IT WAS LOOKING AT THE SCREEN.** Nothing in the suite did, and nothing could:
every case about grounds was about the palette a ground produces, none about the picker.
It surfaced in a capture at three widths, which is the pass this branch had skipped.

*Unreleased — `web/frontend/src/Settings.jsx`,
`web/frontend/test/dom/ground-swatches.test.jsx`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
