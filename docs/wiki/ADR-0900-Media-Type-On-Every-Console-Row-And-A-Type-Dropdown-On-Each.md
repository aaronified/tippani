# ADR-0900: Media type on every console row, and a type dropdown on each

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**The ask.** *"character page needs one more filter: type (book, game, movie, show) same
character can have multiple type. the icons for all of them shall be there in the list itself.
on desktop, these glyphs will also have the type name. same for works, and people as well"*,
and *"simply, desktop has space, that deserves utilisation."*

**One component, three consoles.** `MediaMarks` in MetadataPage.jsx draws one glyph per
drawing, built from the character row's existing `characterMedia` grouping. A film and a show
share the clapper and list both words. On a desk the word is painted beside the glyph. On a
phone the glyph stands alone. The word stays the glyph's accessible name at every width, and
the painted copy is `aria-hidden` so it is not read twice. Works rows use the same component
with their own single medium, so the three lists cannot disagree about what a medium looks like.

**The filter matches any work.** `inMedium` keeps a record if any of its works is in the chosen
medium, so a character in a novel and its film is under both. For People, the client could not
compute this: `works_in` is capped at six per row on the wire. The server now sends `media`,
every medium over all the person's works, collected before the cap. The mutation that proves
it is named in `TestAPersonRowSaysWhichMediaTheirWorksAreIn`. Rejected: lifting the cap, which
would send hundreds of refs per prolific translator to draw a row that shows six.

**Works gains games.** Its type list stopped at shows, although games are rows of `movies` like
the other two. A game was reachable only under "all types".

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
