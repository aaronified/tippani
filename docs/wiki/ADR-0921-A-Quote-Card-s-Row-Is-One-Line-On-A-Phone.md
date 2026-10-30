# ADR-0921: A quote card's action row is one line on a phone

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [ADR-0485](ADR-0485-A-Card-S-Row-Is-Copy-Share-Colour-Then-A-Holding-Edit-And-Delete.md)

**What ADR-0485 decided.** The row is ♥ · copy · share · colour, then a ⋯ holding edit and delete, at every width. Copy and
share stand in the row because sending a saved line is the point of saving it.

**Why that was wrong on a phone.** At 390px the heart, the review mark, copy, share, the in-context glyph, the colour pick and
the ⋯ do not fit one line, so the row wrapped and the ⋯ sat alone on a second row ([#60](https://github.com/aaronified/tippani/issues/60)).

**Decided.** On a phone (the app's 768px breakpoint) the row holds the review mark, the heart, the colour pick and the ⋯, on
one line that does not wrap. Copy, share and in-context move into the ⋯, ahead of the actions that were already there, in the
registry's order. On a wider screen nothing changes. `useRowSplit` in `actions.jsx` makes the split, and the quote cards and the
Home favourites tile all call it, so no two cards divide the list differently.

**Rejected.** Shrinking the glyphs to fit: the touch size on a phone is 44px and the row would still wrap at the largest type
size. Dropping the colour pick from the phone row: it is the most-used action on a card after the heart.
