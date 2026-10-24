# ADR-0854: The tab row is the pack's, geometry for geometry

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE OWNER'S RULING, AND IT IS NARROWER THAN "FOLLOW THE PACK":** *"you need to follow it
strictly in terms of the top bar. It has achieved perfection visually. Only issues are in
content terms, which tabs, what to name them and what icons to use."* So the row's
geometry is copied exactly and its CONTENT stays the app's own — the tab set, the words,
the glyphs.

**WHAT IT WAS: CHIPS.** A 9px radius, a 1px border, a background on hover, an
accent-coloured outline on the selected one. Four pills in a row read as four buttons. The
pack's tabs read as one strip of a surface with the current one standing on it, which is
what a tab is: `settings-restructured.dc.html:122-131` — 26px gaps, tabs on the row's
baseline, a 2.5px accent underline overlapping the row's own border, and a round count
badge that takes the accent fill only on the selected tab.

**AND THE SECOND BAR IS GONE.** The section's name, its changed count, its info dot and
its Reset had a full-width row of their own under the tabs. The owner: *"You also added a
second header bar right under the tab. Why? Do not build redundant stuff."* They were
right, and the pack shows where the two controls belong — the same flex row as the
tablist, pushed to its right end, sharing its bottom border. The count needed no home at
all: the tab already carries it.

**THE WHOLE ROW STICKS, NOT THE TABLIST.** Sticking only the tabs would slide them under
the top bar while leaving the info dot and Reset behind on the page — one row coming apart
into two as you scroll.

**A RED COUNT STAYS RED ON THE SELECTED TAB.** The accent fill would otherwise win by
source order, and a count of PROBLEMS would read as the ordinary count at the one moment
it matters: when you have opened the section it belongs to.

*Unreleased — `web/frontend/src/index.css`, `web/frontend/src/sectionRail.jsx`,
`web/frontend/src/Settings.jsx`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
