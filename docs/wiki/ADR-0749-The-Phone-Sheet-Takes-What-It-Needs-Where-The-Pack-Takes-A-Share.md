# ADR-0749: The phone sheet takes what it needs, where the pack takes a share

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*A second departure argued here rather than in a CSS comment, which is the lesson of the
last one: `docs/wiki/Design-decisions.md` is where CLAUDE.md says a design departure goes, and a comment
beside the line serves the reader of that line and nobody asking what the app owes the
pack.*

**The pack ceilings a mobile sheet at a share of the screen, and by which kind it is** —
`max-height:calc(${sheet && sheet.form ? '94%' : '76%'}` (`book-detail.dc.html:4208`).
Two numbers, because the artboard has two kinds of sheet: a picker keeps a quarter of the
page visible so you can see what you are choosing FOR, and a form takes almost everything
because its context is its own fields.

**This app's panel is one surface and cannot answer "which kind am I".** `usePanelStack`
holds panels that are lists, panels that are forms, and panels that are both at once — a
character sheet is a column of displays with an editor behind every row. A ceiling chosen
by kind needs a kind, and inventing one so a stylesheet can branch on it is a
classification the app does not otherwise have and would have to keep true.

**So the ceiling is a fixed strip of page rather than a share of it**: `calc(100dvh -
56px)`. The strip is what the pack's 76% is FOR — the reader is on top of something, and
can see they are — and 56px is the smallest band that reads as page rather than as a
gap, at the width this rule applies to. It is also what the scrim's blur is drawn on: a
sheet with nothing behind it has nothing to blur, and the blur is how this app says
"focus" (the owner's, this round).

**The rejected alternative is 76% flat.** On a 390×844 phone that is 203px of scrim above
every sheet, and the panels a reader opens most — a field's editor, a chooser with three
rows — are far shorter than their ceiling anyway, so the number would decide nothing for
them and would crop the two that are long. A ceiling should bind the tall case; a share
binds the short ones by moving them down the screen.

**What holds it:** `phone-sheet.test.js` requires a ceiling of the shape `calc(100dvh -
N)` with N above zero — the rule (a strip of page survives) rather than the number, so a
later hand may widen the band and may not take it to nothing.

**Superseded, within the same release, by the entry below.** The owner asked for a sheet
with anchors, and anchors answer the question this entry could not: a surface that is a
list and a form at once does not have to CHOOSE a share of the screen if the reader can
move it between them. The strip of page survives — it is now the smaller of the pack's own
two numbers rather than a band in px — so the reasoning above still holds and only its
conclusion is replaced.

<sub>Unreleased — `web/frontend/src/index.css` · `web/frontend/test/pure/phone-sheet.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
