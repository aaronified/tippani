# ADR-0741: Every name on a line gets a chip, and the discs that stood in for them retire

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner: "if there are multiple speakers or characters in an annotation, then they both
shall have their own character/people chip. If too long, it will be edgemasked and
sidescrolled." Then, on the first attempt: "what merge! You already have all the character
info for the book. All you need to do is stack one chip to the right of another and then
make them scrollable. There is no data issue at all."*

**THE CORRECTION IS THE MOST USEFUL THING IN THIS ENTRY.** The first pass read "multiple
speakers" as a storage problem and started widening `cast_images.go` to serve a richer
payload. It was already served: `character_images` has ridden the quote payload since the
cast pass — one entry per character named on the line, each with the picture stored for
them — because that is exactly the question it answers (`quote_speaker.go` states the split:
`character_images` is WHO IS NAMED, `speaker_cast_id` is WHO SAID IT). The whole change is
therefore client-side, in one function, and needed no migration and no new query. A feature
that looks like it needs a migration is worth reading the existing payload for first.

*Corrected below, in "The rating pass found the chips half-built": the server WAS touched in
the end, and had to be. The payload carried one entry per PICTURED character rather than per
named one, which the card's new habit of suppressing its own character text turned into
lost names — a one-`if` fix in the same query, not the merge the first attempt reached for.*

**WHAT THE DISCS WERE, AND WHY THEY GO.** A line with one resolvable speaker drew one chip;
an ensemble line — several names, which the linker deliberately refuses to guess between —
drew a row of small faceless discs, and the comment beside it said so: "the linker refuses
to guess between them, and then this row is the only thing saying who is in it." A stack of
discs says how MANY people are in a line and not one of their names, which is the one thing
a reader wants from it. `chipRows(images, speaker)` now returns the speaker first, then
every other name the line carries, folded on a case- and space-insensitive key so a reader
who typed "Woland, Woland" gets one chip rather than what looks like a rendering fault. Both
cards call the same builder, because they had drifted once already — the film card had the
actor-face fall-back and the book card did not, which is how that missing-face bug survived
on one side after being fixed on the other.

**A CHARACTER WITH NO PICTURE IS STILL A CHIP.** The discs dropped them, and correctly: a
disc with no picture is a picture of nobody. A chip carries a name, so it reads without one.

**THE ONE-CHIP RULE THAT DIED WITH THEM, AND THE HALF OF IT THAT SURVIVES.** Three states
used to draw no chip at all: no link, no `characters` record behind the link, no panel stack
to open into. On a row those become the ordinary case — not one of the non-speaker chips has
a record — so refusing to draw them would hide every name on the line but the linked one.
What survives is the PRESS: such a chip is drawn and is **not a button**, it is a `span`, so
the keyboard walks past it and no reader is told about a press that never happens. That was
the true half of the old reasoning ("a chip that cannot open anything is a dead control")
and it costs three lines in `PersonChip` to keep. `span.person-chip` also drops the hand
cursor and the hover accent: a highlight that leads nowhere is a promise the row cannot keep.

**THE ROW SCROLLS UNDER A MEASURED FADE**, which is the standing rule and not a choice here
— `Scroller axis="x"`, so a row that fits wears no fade and a long one both masks and
drags. The names inside still clip at a character count, which is the departure already
recorded under "The speaker chip is two lines, and a name is clipped": these pills must not
wrap, because a reflow moves every other chip on the row.

**AND IT DID NOT, FOR ONE ROUND, WHICH IS WORTH RECORDING.** `.speaker-chips` shipped
through a green suite declaring no `overflow-x` at all, so the box grew to fit its chips,
`scrollWidth` equalled `clientWidth` for ever, `useEdgeScroll` never wrote `data-scroll-x`
and the 26px mask never landed. The row test had a case named "scrolls under the fade rather
than wrapping" whose body asserted the box wore the class `speaker-chips` — a hollow claim
that could not fail. jsdom has no layout, so it genuinely cannot measure a fade; what it can
do is read the stylesheet, and `test/rules/scroller-boxes.test.js` now sweeps every
`<Scroller>` in the source for a class that declares an overflow on the axis it was handed.
It is the complement of `scroll-containment.test.js`, which audits the boxes that DO scroll:
that one catches "somebody adds an overflow and never thinks about chaining", this one
catches "somebody asks for a fade and never gives the box anything to scroll". Run against
the seventeen Scrollers in the app it named exactly one, and the one it named was this. The
same shape of test would have caught it before the screenshot.

**HOME'S FAVOURITES GET THE SAME PILLS** — the owner's instruction — and no door, which the
rule above now permits: the favourites tile is itself the press, and Home owns no panel
stack to open a character into. **`SearchPage` is deliberately left on its discs.** It is a
denser surface than a card, it was not in the ask, and it has its own `omitSpeaker` handling
that a chip row would have to be reconciled with; when it moves it should move as its own
change.

**THE PLUS CARD IS ON THE GLOBAL SCOPES ONLY** — also the owner's instruction, *"in the
character / actor page (only globals), do have a plus card in the works carousel."*
`AppearanceStrip` takes `onAdd` and draws a dashed tile at the END of the strip. Only the
globals pass it: on a local scope the strip is this identity's OTHER appearances seen from
inside one work, so an add there would read as adding a work to the book you are already in.
It sits last rather than first because the strip's order is the release order — the prototype
says so in its own hint — and a control ahead of the first work would displace the earliest
appearance from the position that means "earliest".

<sub>Unreleased — `web/frontend/src/people.jsx` · `Library.jsx` · `Movies.jsx` · `Home.jsx` ·
`characterRows.jsx` · `index.css` · `test/dom/speaker-chips-row.test.jsx` ·
`test/dom/quote-speaker-chip.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
