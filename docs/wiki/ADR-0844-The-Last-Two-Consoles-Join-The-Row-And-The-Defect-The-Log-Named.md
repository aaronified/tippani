# ADR-0844: The last two consoles join the row, and the defect the log named is closed

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**Decided.** The people and character consoles draw `recordRow.jsx` like the works
console. Both were `<table class="ann-table">`; neither is now.

**Why this closes something already written down.** The entry introducing `recordRow.jsx`
cites the motivating defect: the person console's portrait opened an editor while the
character console's portrait opened nothing — the same picture in the same position doing
two different things, because they were two hand-rolled rows. That entry also said,
accurately, that only two of the four rows had moved and that the portrait defect was
"described, not repaired". It is repaired now: one function draws all four, and a
difference between two consoles has to be passed IN.

**A TABLE WAS COSTING MORE THAN IT BOUGHT.** The people table had five columns and a
phone dropped two of them — the roles and the reference links — so the screen most people
use simply did not have them. As chips on a row they wrap instead of vanishing.

**AND TWO THINGS NEARLY WENT MISSING IN THE MOVE**, both caught by the console's own
suite rather than by reading:

- The quotes count was a column, and a first draft dropped it with the columns. It is the
  record's own total across every spelling — the thing this console exists to show — so it
  joins the sub-line. Losing a fact is not the same as moving it.
- The fetch control's word became icon-only. That is right for a row action and matches
  the works console, but it means the test that read the visible word now reads the
  accessible name, which is what a screen reader and a hover both get.

**`onCount` AND `onOpen` ARRIVED WITH THEIR CALLERS**, which is the rule made after a
rater found three unreachable props in the first draft of this row. The people console's
works count is a door to a search; the character console's is not, because a character in
no work has nothing to search for — so the number is a button only where the caller gave
it somewhere to go, and never a button that does nothing.

**THE ROW HAS A CLASS NOW.** `.record-row` styles almost nothing; it exists so the row is
nameable — a console's tests locate it, and the two inline declarations have somewhere to
go the day they become three.

*Unreleased — `web/frontend/src/recordRow.jsx`, `web/frontend/src/MetadataPage.jsx`,
`web/frontend/test/dom/people-records.test.jsx`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
