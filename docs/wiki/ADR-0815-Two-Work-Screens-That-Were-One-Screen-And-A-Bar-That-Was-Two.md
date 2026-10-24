# ADR-0815: Two work screens that were one screen, and a bar that was two

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner's report, and it is two faults in one sentence: *"The book work screen
and the movie/show/game work screens look very different (the group/filter/capture
bar). And in book, the colour category pickers do not show the colours! This is
also in desktop."*

### The colourless chips, which were never a colour at all

`CategoryFilter` painted each option's dot itself:

```jsx
style={{ background: `var(--${tok})` }}
```

and the tokens are `yellow`, `blue`, `pink`, `orange`, `green`, `purple` while the
properties this app declares are `--hl-1`…`--hl-6`. `var(--yellow)` names a custom
property that has never existed anywhere in `src`, and an undefined custom property
with no fallback is **invalid at computed-value time** — the declaration does not
apply, the fill does not happen, and the dot draws whatever its own rule says. Six
rows whose only distinguishing mark is a swatch, and the swatch said nothing.

**IT WAS THE ONLY SITE IN `src` INTERPOLATING A TOKEN INTO A PROPERTY NAME**, and
that is the whole shape of it. `ui.jsx` has known how to draw these since the dots
were drawn, in a private `colorDotClass` map, under a comment explaining that it is
private because "an exported name for a button style is exactly the kind of thing a
later screen adopts by accident". The screen that could not adopt it wrote its own
and got it wrong — the repo's own "two things that look the same behave the same"
failing in the direction that comment did not consider. The map is `theme.js`'s
`categoryDotClass` now, beside `categoryVar`, where the rest of "what colour is this
token" already lived.

**AND THE FALLBACK FILL IS WHAT MADE IT LOOK DELIBERATE.** `.cat-opt-dot` declared
`background: var(--faint)`, so an invalid declaration produced six plausible grey
dots rather than six missing ones. The base rule is geometry now — exactly as
`.color-dot` beside it already was — and the row with no category says so with its
own class instead of falling through to a default.

REJECTED: `!important`, and leaving the fill in place to be beaten on source order.
Both work today and both are invisible the day they stop.

### The bar, which both files had promised to fold

The PAGE has been one component for a while: `BookDetail` and `MovieDetail` both
render `WorkDetail` with `side` set. What was never shared is the BOARD, and both
files say so themselves — "the BOARD is still this file's, `Annotations`/`Dialogues`
is folded next, so it comes in as a render prop". Folded next never came, and the
two bars drifted exactly as two copies do:

| | the book's | the film's |
|---|---|---|
| frame | `.board-head` | a bare `flex flex-wrap` row |
| grouping | a field carrying the sort | **none at all** |
| colour | a named list | six bare dots |
| chips | three, as `FilterChip` | one hand-rolled `<button>` with its ♥ as a text character |
| capture | the accented `StickerButton` | a `GhostButton`, beside a view toggle wearing the accent |
| strings | keys | six written in English in the source |

**THE DIMENSIONS WERE ALREADY IN THE KIND TABLE** and had been since before either
board could use them — `workKinds.js` gives a show `episode`, a game `act` and
`quest`, all four kinds `character`. The film board grouped by none of them because
`GROUP_DIMS` was a module constant reading `KINDS.book.groupDims`, and `groupAnnotations`
guarded on it. So the fold is three landings rather than one: the bar moves to
`boardHead.jsx` and takes its dimensions as props; `boardOrder.js` becomes one sorter
and one grouper that answer for whichever list they are handed; then the film board
renders it.

### Where the film board was worse than "different"

Two things the report did not name and the fold had to fix anyway.

**THE ORDER REACHED THE TABLE ONLY.** `sortDialogues` ran in one branch of the
render; the tiles and the list drew `items` as served. A reader who set an order in
the table went back to the board and found it ignored — and the control that set it
was a column header, so there was nowhere to notice.

**AND IT ANSWERED FOUR OF ITS OWN SIX DIMENSIONS.** `default`, `date`, `length` and
`category` are all in the film's `sortDims` and all fell through to
alphabetical-by-quote-text.

### Where this turned out to be wrong

**MY FIRST READING OF THE SECOND FAULT WAS FALSE**, and it is recorded here rather
than quietly dropped: I said the book page was `WorkDetail`'s older cousin, inferred
from a route. Both screens have rendered `WorkDetail` since it was written. The seam
was one level in, in the render prop, which is a thing the code says out loud and I
had not read.

**AND THE KIND MUST BE RESOLVED, NOT INDEXED.** `KINDS[movie?.media_type]` returns a
row for a game that has no `board` block of its own — `game` declares `inherits:
'movie'` and `specFor` is what merges it. Indexing the table directly threw on the
game screen, and the game shelf's own suite is what said so.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
