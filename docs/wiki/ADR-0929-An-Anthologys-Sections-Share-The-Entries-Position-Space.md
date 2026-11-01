# ADR-0929: An anthology's sections share the entries' position space

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [Plan: anthology enhancements](Plan-Anthology-Enhancements.md)

**What was decided.** A reader's heading in an anthology (a section, with optional text under it) is a row in
`anthology_sections` (0089) whose `position` is in the same space as the entries'. The view `anthology_slots` reads both, and every
query that asks for the next position or for what follows a slot goes through it: appending, the reorder route, the fill, an import's
approval and the renumber. A section is a slot kind (`section`) of the one order route, so "after this one" means the same for a
passage and for a heading.

**Why not a section id on each entry.** Entries would then belong to a section, and moving a heading would mean rewriting its
passages. With one position space a heading is only a marker: the passages under it are the ones after it, up to the next heading.
Deleting a heading deletes the marker and the passages stay.

**Grouping** (by work, person or character) is a display setting, `anthologies.group_by`, with its own route so a form that has not
heard of it cannot clear it. It reorders nothing, draws a header at the start of each run of passages with the same key, and a
section of the reader's ends a run.

**In files.** Markdown writes a section as `# Heading` with its text, one level above an entry's `## `. The importer reads it back
onto the entry it opens, because staging is per quote (`staged_quotes.anthology_section`); a heading with no entry after it is not
imported. The EPUB opens a chapter at each section and a new page begins at each in print.

**Not yet:** group headers in the Markdown export, and carrying a section's run when it is dragged (the drag is a later slice).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
