# ADR-0865: Theme: three doors, a grid that fits, and prose that stopped being code

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE COLOURS ROW HAD BEEN DESCRIBING A CONTROL THAT DID NOT EXIST.** Its own sub-line
says *"Light ground · dark ground · accent. Each one opens its own options"* and the pack
draws exactly that — three swatch-pills, "Tap a colour for its options"
(`settings-restructured.dc.html:2590`). The app laid the palette out in the row instead:
the four grounds of whichever mode was on screen, then every accent beside them, eight or
nine swatches wide. It is three doors now, and each opens a panel where every option
carries its NAME as well as its colour — "Sepia" and "Tobacco" are recognisable words and
unrecognisable rectangles.

**AND BOTH GROUNDS ARE REACHABLE.** Offering only the mode you are standing in was
defensible — a swatch is an honest preview only in the ground it selects — and it left a
reader on a dark screen unable to set their daylight look without switching the whole app
to daylight to do it. A door is not a preview, so it can offer the pair; the swatch on
each door is still drawn in the ground it stands for.

**THE MATERIAL SETS WERE THREE TIMES THE SIZE THE PACK DRAWS THEM.** A fixed four-column
grid on a 1280px card gave eight enormous cards over two rows, and two to a phone screen.
The pack fits seven across with room for more. `auto-fill` with a floor lets one rule give
seven on a desk and two on a phone, and a set is recognised by its material and its colour
— both of which read at a glance, which is what the extra size was spending a screen to
say.

**PROSE WAS SET IN MONO EVERYWHERE, AND THAT IS MOST OF WHY THE APP LOOKED DATED.**
`.microcopy` is the app's standard explanatory line — an empty state, a hint under a
control, the sentence that says what a panel is for — and it was IBM Plex Mono with .06em
of tracking. The design system is explicit about which face does which job
(`docs/design/handoff/design-system.md:79-81`): `ui` carries "prose 13.5/1.6, a sub
12.5/1.45", and `mono` is for ".mono-label 11px/500 .14em uppercase, a badge, a role line,
a tag" — labels and counters, never sentences. Every explanatory line in the app now reads
in the interface face, which is one CSS rule and the single widest visual change in this
sweep.

**THE OPTIONS OPEN IN THE ROW, NOT OVER THE PAGE, AND THE FIRST CUT GOT THIS WRONG.** A
rating caught it: the pack answers inside the row — a full-measure panel under the doors
with its own Hide (`settings-restructured.dc.html:439-452`) — and this shipped a
full-screen dialog instead. The pack's shape is not decoration. Choosing a ground is a
comparison: you try one, look at the material under it, try the next, and a dialog is a
scrim over the very thing being compared. What the dialog was buying — room for the names
— the row gives anyway, because the panel runs the full measure.

**AND THE PACK'S THIRD ROW IN THAT GROUP IS NOT BUILT.** "Change one surface yourself →
Open the 27 tiles" (`:2597-2607`) has no equivalent in the app, and the machinery for it
is already here and unreachable: `TILE_NAMES` exported with no caller, `applyTheme`
reading `tileDesk`/`tileShell`/`tilePage`/`tileBinding`, a saved look carrying them. The
session was told to keep notes rather than add features, so it is `docs/plans/tile-slots.md`
with a roadmap entry, and `MaterialPhysics`'s comment no longer sends the next reader to
"the control one row up", which was a sentence pointing at nothing.

**AND THREE THINGS WERE IN THE WRONG GROUP.** True glass sat under "How much a control
says" — a group about words on buttons — when a lens is what a surface does with the light
behind it, so it is with the materials. The accessibility dial sat between groups 1 and 2,
unnumbered, which made the numbering read as a mistake; it is group 5, where Language and
font already puts its own. And the saved-looks block had a second heading under the group
heading that already named it, with its controls loose underneath rather than in rows.

*Unreleased — `web/frontend/src/Settings.jsx`, `web/frontend/src/index.css`,
`internal/i18n/en.txt`, `internal/i18n/bn.txt`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
