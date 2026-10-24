# ADR-0804: An anthology is pointed at something, not composed out of a query

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Six asks in one pass, and the one that reframes the rest is the second: *"the fill from a
search in the add anthology popup feels bad, drop it."*

**It was right, and the reason is posture.** A search bar is where you ASK A QUESTION; a
form is where you DECLARE WHAT A THING IS. Nobody making an anthology of Seneca wants to
compose `author=Seneca` — they want to point at Seneca. So the sources are NAMED: the whole
library, a book, a film, a tag, an author, a colour, a shelf, favourites, a stretch of time.
Each maps to a facet the search already indexes, so what the row promises is exactly what
the fill takes rather than a second grammar to keep in step.

**A BOARD IS NOT AMONG THEM AND THAT IS NOT AN OVERSIGHT.** The owner chose it; there is no
`board` facet. Boards hold standalone quotes only, so `board=X` would have to decide what it
means for highlights and film lines — every one, or none — and that is a change to the
shared search grammar rather than to this form. Recorded rather than quietly dropped.

**The switch rows became chips that show their own output.** *"do not use the hide show
buttons, instead use text buttons with the labels. each label should also hold an example."*
Two things were wrong with the pair: a row read "Who said it — Hide | Show", so the reader
answered a question about a FIELD NAME with no idea what turning it on would put on the page
— "Who said it" could be a name, a name and a role, or a name and dates — and the pair spent
a whole row saying what a pressed state says for nothing. The chip carries the label and a
sample, and ON is the accent fill `.tp-filter-chip.active` already means everywhere else. A
fourth way of saying on would be a new thing to learn for no new meaning.

**And the headers stopped naming a category and started naming an act.** "About who said it"
does not say anything gets PRINTED. "Also show about the person" does.

**A selection of works gathers its passages.** The bulk bar gated this on the selection not
being works, with a comment reading "a book is not a passage, and an anthology of covers is
not a thing". Both true, and neither was the reason: `quoteOwned` settles the first, so what
a selection of books can mean is the highlights inside them. It goes as a RULE and not as
entries, because the ids in hand are books and the things wanted hang off them.

**A nested popup steps back rather than closing.** `FormModal`'s in-panel branch has drawn a
back key naming its parent since it existed, on the reasoning that "a nested surface's two
exits are answer and back, and a third key that closes the lot is a destructive control
wearing a dismiss key's clothes". A modal nested in a modal is the same shape and was still
drawing the ✕ — over a half-filled form, which is where it reads worst.

### Two defects found while building this, both in the new code

**The picker ate what you typed.** The combobox derived its contents from the RESOLVED key,
so a keystroke that did not yet match a known title set the value to empty and the box
cleared itself under the reader's hands. It did that reliably for the first word of every
title, because the vocabulary arrives over the network and the box is typeable before it
lands. The typed text is now its own state and the key is resolved beside it; the tick stays
blocked until a name matches, rather than the box rewriting what was typed.

**A selection of works cannot open its own ⋯ in a browser.** This is NOT new and not this
change: "Set fields" has been in that menu since 1.16.0 and is equally unreachable there, on
the Library and the Catalogue alike, while jsdom opens it fine. So the bulk-works claim is
held at the DOM tier with its reason written down, and the browser defect is recorded here
rather than papered over by a journey that avoids it.

<small>Unreleased — `web/frontend/src/anthologies.jsx`, `anthologyGather.jsx`, `actions.jsx`,
`SelectionBar.jsx`, `SearchPage.jsx`, `ui.jsx`, `index.css`</small>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
