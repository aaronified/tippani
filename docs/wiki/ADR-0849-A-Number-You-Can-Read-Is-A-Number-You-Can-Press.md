# ADR-0849: A number you can read is a number you can press

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE OWNER'S RULING ON METADATA'S OVERVIEW:** it stays, and every number on it becomes a
door. The desktop's tiles already were one — press "22 no cover" and the works console
below filters to exactly those. The phone drew the same numbers as a sentence and pressed
nothing.

**THE OLD REASON HAD EXPIRED RATHER THAN BEEN WRONG.** `StatsLines` said a phone had "no
lists to feed" a filter, and while a section was a card on a long scroll that was true:
the press would have set a filter on a console the reader could not see. A phone opens a
section as its own screen now, so the press has somewhere to land.

**IT WAS ONE VERB WRITTEN THREE TIMES.** The desktop tiles, the phone's issue-sheet rows
and now the coverage numbers all mean "show me exactly the records with this problem", and
each carried its own copy of set-the-type, set-the-filter, go-to-the-section. Three copies
is how one goes on being right while another stops — and here the third copy was the one
that did not exist, which nothing anywhere reported. `pickGap` is the one function.

**A DIALOGUE'S GAP STAYS TEXT.** The works console holds books and films, so there is
nothing for that group's numbers to filter. Drawing them as presses that do nothing would
be worse than drawing them as what they are.

*Unreleased — `web/frontend/src/MetadataPage.jsx`,
`web/frontend/test/dom/metadata-sections.test.jsx`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
