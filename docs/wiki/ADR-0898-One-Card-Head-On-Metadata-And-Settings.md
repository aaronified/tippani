# ADR-0898: One card head on Metadata and Settings

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**The head.** The owner, shown three heading styles on two screens — Metadata's bold title,
Settings' mono label, and a number on some Settings cards but not others: *"equalise. metadata
and settings cards shall be similar."* Asked which, they chose the mono label, numbered by
position when a section has two or more cards. `CardHead` in prefRow.jsx is the one head.
`PrefGroup` draws it, and so does every Metadata card: Duplicate works, the speaker remap, the
three Sources cards, and Colours, Tags and Stickers.

**The number is counted, not typed.** `useCardNumbers` (cardNumbers.js) runs in SectionRail
and writes "1 · ", "2 · " into each head's empty `.card-num`, in document order. It leaves
them empty when the section has one card. The typed `index` it replaces had already drifted:
Accessibility read "4 ·" on a screen of three other groups and "5 ·" on another, and six groups
had no number. A card that renders only after a fetch renumbers the rest, because the count is
taken from the screen. The number is text rather than a CSS counter, because generated content
is not in `innerText`: a counter would put a number on screen that copying the heading, or a
journey reading it, would not see. Rejected: a React context handing out indices. Mount order
is not screen order once cards arrive after fetches, and it would be a second source of truth
beside the DOM.

**One paper.** A Settings group is now `hand-card pref-group`, so the material texture, glass
and contrast rules reach it as they reach a Metadata card. The two screens' cards had been
different paper, and no rule said so. Metadata cards take `pref-group` for the same padding and
fill. Two knock-ons had to be fixed:
- `.pref-group + .pref-group`'s top margin was meant for a single column, and in a grid it
  dropped every second-column card by one gap, so it no longer applies inside a grid.
- The credits card kept a divider and 36px of top space from when it hung under the keys card.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
