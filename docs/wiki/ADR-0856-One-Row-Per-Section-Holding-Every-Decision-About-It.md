# ADR-0856: One row per section, holding every decision about it

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE PACK HAS ONE LIST AND THIS HAD TWO.** `sectionRows()`
(`settings-restructured.dc.html:2477`) returns one row per section carrying its name, its
sub-line, `kind: 'toggle'` AND `sortable: true`. This card drew a row of chips for
on-and-off, then a second list of the same four names for the order — the same four things
written twice, so a reader wanting the Catalogue off and second looked in two places and
counted eight controls for four sections.

The owner: *"Why have you added separate enable button and sorter? The prototype had both
together, right? Always try to make things simpler. Not more cluttered."*

**WHAT THE SPLIT WAS DEFENDING** was a real thought, recorded in the code it justified: a
chip row says which sections exist, and a reader dragging one would be guessing whether
they had moved it or switched it off. That is an argument against DRAGGING, not against one
row. The arrows survive; the second list does not.

**THE STANDING PROSE WENT WITH IT.** "Turn off what you do not keep, and on what you have
not tried yet" said what a switch per row now says by being there, and its reassurance —
nothing is deleted — was already in the card's own info dot, in more detail. Two sentences
of standing text removed rather than re-homed.

**AND `PrefGroup` IS A NAMED REGION NOW.** Its heading is a `MonoLabel`, not an `<h*>` —
it labels a group of rows rather than marking a step in the document outline — so nothing
gave the section an accessible name, and a screen reader listing regions found a run of
unlabelled ones. The name goes through `ariaLabelText`, which the repo's own ratchet
insists on: a title may be a node, and `aria-label={node}` stringifies to
"[object Object]". The ratchet caught this within a minute of the change.

*Unreleased — `web/frontend/src/Settings.jsx`, `web/frontend/src/prefRow.jsx`,
`web/frontend/test/dom/features-card.test.jsx`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
