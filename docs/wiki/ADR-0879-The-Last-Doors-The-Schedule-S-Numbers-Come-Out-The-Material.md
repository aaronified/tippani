# ADR-0879: The last doors: the schedule's numbers come out, the material dials stay in

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Settings had two doors left when the sectioning was finished, and they were kept for the
same stated reason — that what is behind them is one decision a reader makes once. That
reason is about how OFTEN a control is used, and the repo's rule turns on something else.
The owner's, now the mantra: *"Use the space available. Think like the user. Whatever will
be used more needs to be up front."* What is genuinely RARE goes behind a door; what is
merely DETAILED goes lower on the same screen.

**THE TEN SCHEDULE NUMBERS ARE DETAILED.** They are now group 4 of the Review section, at
full measure, under everything a reader came for. The door they were behind was built when
Settings was one column of nine cards, where every extra row was a scroll past on the way
to the fonts — `CLAUDE.md` names this exact door as the worked example of one that survived
the reason for it. The pack draws a door here too ("The numbers behind the schedule → Open
the numbers") and the pack was drawn against the same long scroll.

**THE LINE HAD ALREADY MOVED ONCE**, and the argument it moved on is the argument that
finished the job. The four schedule switches came out earlier because "one decision made
once" is true of the multipliers and not of them. Having conceded that the test is what a
reader comes back for, the remaining case for the ten was that a door is tidier — and half
a phone screen of empty ground under a card of three rows is not tidiness.

**WHAT WENT WITH THE DOOR.** `SRDeepControls` became `SRTuning`: both halves of the old
name were stale, since the "controls" were down to the ten numbers and "deep" described a
door. Its "Done" button went too — it closed the door, and every row commits on release the
way every other row in Settings does, so it had never confirmed anything. The reset stayed:
ten sliders are ten things to put back by hand, and the blob's ABSENCE is what lets a later
change to the defaults reach an account that never edited them. Two locale keys held the
same English — the door's name and the room's, deliberately, so a reader knew they had
arrived — and one place needs one name.

**THE MATERIAL DIALS STAY, AND THE MEASUREMENT IS WHY.** A set fills four slots from three
or four distinct materials, four dials each, plus six more when the true-glass lens is on:
**twelve to twenty-two sliders**, on the section that already carries three groups, three
colour doors, an eight-tile grid and the saved looks. Unfolding it would put the densest
thing in Settings under the second densest. It is also reached for once or never — the
answer to "less shiny" is almost always about ONE material, which is why an edit is stored
per tile rather than as a global multiplier. That is the rare case the rule preserves, and
the number is recorded here so the next pass does not re-open it from scratch.

**ITS ROW SAYS HOW MANY ARE BEHIND IT.** "A door with four presses behind it costs more
than the rows it hides" cuts both ways: a reader deciding whether to press deserves to know
what they would get, and the number moves with the set. The count is computed from the same
two dial tables the panel draws from — hoisted to module scope for exactly that reason,
because a count derived from a copy is right until somebody adds a dial to one of the two
lists.

**AND THE FIRST CUT OF THAT COUNT WAS INVISIBLE.** It was passed as `aside`, a prop
`PrefGroup` has and `PrefRow` does not, so React dropped it and the row drew exactly as
before: nothing threw, nothing failed, the number simply was not there. `door-count.test.jsx`
found it on its first run. **The same file then caught its own second defect**: it handed
the material set in as a preference, and the Theme card reads the APPLIED theme off `<html>`
rather than the prop — deliberately, so a control cannot be a render behind what the reader
sees. So two cases that meant to compare different sets compared the default twice and
agreed, because they were the same number. Both are recorded because they are one lesson:
a guard written after the control, believing the control, measures the control's own
assumptions.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
