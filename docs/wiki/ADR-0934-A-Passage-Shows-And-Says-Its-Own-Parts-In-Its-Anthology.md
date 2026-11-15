# ADR-0934: A passage shows and says its own parts in its anthology

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted and built; extends [ADR-0801](ADR-0801-An-Anthology-S-Switches-Become-A-Registry-And-The-Work-Behind-A.md)
- **The owner, 15 November 2026:** "there is no option to show the notes/translations of the quote. Everything that a quote has (even context) must be available to show in the anthology on a global basis with per quote override. And these shall be editable within the anthology (editing the context in anthology will only change it for the particular anthology, for example)."

**What was decided.** The anthology's field registry (0074) gains the parts the quote itself carries: its own note, its translation,
its language, its tags, and the source text before and after it (`context`). Each is a switch on the anthology like the work and person
fields. Migration 0094 puts two JSON columns on `anthology_entries` (and on `anthology_removed`, so a passage taken out and put back keeps
them): `fields`, an override per key (`true` shows, `false` hides, absent inherits), and `edits`, replacement text for the quote, its note, its
translation and the context before and after it.

**One join, in one place.** `anthologyFields.forEntry` lays an entry's override over the anthology's switches; the page, the reading view,
the Markdown and the EPUB all ask the result, so what is on the screen is what is in the file (the EPUB gained the quote's note in this change, which it had never printed). A restatement is applied to the entry row after
it is read, so no renderer knows there is one; the library's own words ride along in `originals` for "put it back". Context is read through
`renderContext`, the function the quote's own panel uses, so an anthology shows the context under the same rules the quote does.

**The quote is never written.** `PUT /anthologies/{id}/entries/{kind}/{item}/display` sets the entry's `fields` and `edits` and touches nothing
else. Another anthology holding the same quote, and the library, keep what they had. A `null` clears a key.

**The quote's note keeps showing.** It has always been drawn under an entry, so it is the one switch that is on until turned off: stored as
`hide_note` in `fields`, so an empty column still means "nobody configured this" and an anthology saved before the switch loses nothing.

**Not built.** Restating a passage's language or tags (they have a switch and a per-passage show or hide, and no replacement text: they are facts about the quote, not words an anthology says). A quote's kind and its favourite mark have no switch. Transliteration (the column was dropped in 0072). Editing the credit, source, locator or date of a passage: those are
attributions of the document and have their own switches, not words an anthology restates. The picture fields (portrait, character, signature)
have a switch and no restatement.

**Rejected.** Editing the quote through the anthology with a warning (it is the one thing the owner said must not happen); a column per part
(the registry exists so that "everything" is not capped again); copying the quote into the anthology on first edit (a second copy to keep true).

See also: [ADR-0378](ADR-0378-An-Anthology-Decides-What-Its-Own-Passages-Show-And-The-Choice.md) · [ADR Index](ADR-Index.md) · [Home](Home.md)
