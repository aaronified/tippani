# ADR-0752: The three facts wear a pencil, where the artboard draws none

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

*The owner, over a work-level character sheet: "the part, first appears, age here:
these fields do not have the pencil to mark that they are editable." The standing rule
is that nothing deviates from the prototype unless it is expounded upon in detail, and
`character-popup.dc.html:659` draws each fact cell as a label and a value in a button and
nothing else. This is the detail, and it is the owner overruling their own artboard.*

**Why the absence is a defect and not a style.** The pencil is this app's signal for "this
row opens an editor", and it is used consistently everywhere else on the same screen —
`Credited as`, `In this work`, a credit's own name. A reader learns a signal from the rows
that carry it and then reads its absence as meaning. So three cells that open the same kind
of editor and wear no pencil are the app saying one thing two ways, which is the general
form of the repo's own directive: *"two things that look the same behave the same."* The
converse binds too, and this is the case that shows why.

**It is a SIGN, not a second target.** The whole cell remains the button. That is the
owner's own ruling about the sheet's grab bar — *"the bar is there just to make it
intuitive"* — and the arithmetic agrees: at 390px a fact cell is about 118px wide, so a
13px pencil is a worse tap target than the cell containing it, and two targets in one cell
is two behaviours where there is one.

**On the value's line, not the label's, and that is measured rather than chosen.**
`FIRST APPEARS` at `--type-mono-9` with `.13em` of tracking is roughly 85px of a ~98px
content box; a pencil beside it would take the label's last word. The values here are short
(`not set`, `00:02:14`, `Protagonist`) and a long one scrolls under the fade `NameScroll`
already gives it — so `.cs-fact-line` puts the two side by side with `min-width: 0` on the
value and `flex: none` on the pencil, because a sign that vanishes when the answer is long
is a sign absent exactly when the row is hardest to read.

**And only where there is an editor.** A cell whose caller passed no handler is already
`aria-disabled`; it draws no pencil. A pencil over a cell with nowhere to go promises an
editor that does not exist, which is the dead control `make controls` exists to catch
wearing a badge. `editable-says-so.test.jsx` fails on both mutations — removing the pencil
takes four cases with it, drawing it unconditionally takes the fifth.

**Rejected:** a pencil in the cell's top-right corner, which is where the row pencils sit.
It reads better on a desktop and clips `FIRST APPEARS` on a phone, and the phone is where
this screen is used.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
