# ADR-0847: A phone gets an index of the sections, not a field that names one

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE RULING, AND IT REVERSED THIS FILE'S OWN PREVIOUS ONE.** `sectionRail.jsx` argued
for a `Select` on a phone: five tabs at 390px show two and a half, so the strip was the
wrong control, and a field "states the section you are in and opens the whole list, in
the width of one row". The first half of that is right and the conclusion does not follow.
The owner: *"why should i suffer a dropdown when you were told to build a list of options
in the screen as shortcuts?"*

**WHAT THE PACK ACTUALLY DRAWS**, and what was never read closely enough:
`settings-restructured.dc.html:749-780` is a section index — a title, a total-changed
pill, then one tall row per section carrying its glyph, its name, its own count and a
chevron — and `770-780` is the drill-down it opens, with a back arrow, the section's name
and its info dot. The plan approved at the start of this work said the same thing in five
words, "section list → drill-down on a phone". Both were in front of this session and a
`Select` was written anyway.

**A LIST OF SHORTCUTS IS THE NAVIGATION.** A field shows one word and hides the rest
behind a press; the index shows all of them and spends the press on arriving. That is
also the only difference a capture can show, which is why the journey's first assertion
is three section names visible before anything is pressed — the dom tier passed against
both designs, because a helper that opens a dropdown and a helper that presses a row end
up in the same section either way.

**THE RAIL OWNS THE FRAME NOW.** Drilling needs a third state — whether a section has
been entered — and both screens had the same four lines of frame around the same two
elements. Holding that state in each caller would have been the shape retyped, which is
the thing this component was extracted to stop. The body arrives as children.

**ENTERING IS NOT ONLY A PRESS ON THE INDEX.** Metadata's issue sheet lands a reader on
the console filtered to the gap they pressed, and a search result opens the section that
holds it. Without that, the address changed under a reader still looking at the index and
the press appeared to do nothing. First render is exempt: arriving at the screen is not
choosing a section.

**AND A BUTTON MAY NOT WEAR `role="listitem"`.** The rows were written as a `role="list"`
of `role="listitem"` buttons. An explicit role REPLACES the implicit one, so every row
stopped being announced as pressable — the journey reported "nothing a person could press
is named Review" over a screen with Review plainly on it. It is a `<nav>` of buttons now:
a list of the places you can go is a navigation, the rows are buttons, and both halves are
true at once. Nothing in the dom tier could see this; the browser tier found it on its
first run.

*Unreleased — `web/frontend/src/sectionRail.jsx`, `web/frontend/src/Settings.jsx`,
`web/frontend/src/MetadataPage.jsx`,
`web/frontend/test/journeys/reaching-a-setting-on-a-phone.journey.mjs`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
