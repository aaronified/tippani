# ADR-0891: Two lines, then an ellipsis, on a list row

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner, 21 September: *"uncommonly long titles will also get 2 rows and then get
ellipsised. Author list will get edgemasked."*

The standing rule is that a name is never truncated, and this is the eighth exception to
it. It wins on the argument the panel headers won on — a list row is not where a work is
read, and every title here is printed in full on the shelf it came from — plus one the
headers did not have: **the cover's width is derived from this row's height**, so an
unbounded title fed itself. Narrower column, taller row, wider cover, narrower column. It
is registered in `no-truncated-names.test.js` and in `clamp-has-a-way-out.test.js`, which
is what makes it a decision rather than a stylesheet edit.

**THE CHIP ROW NEEDED ONE MORE LINE TO MAKE ITS FADE POSSIBLE.** `Scroller` only paints an
edge mask when something is actually behind the edge, and a chip allowed to shrink squeezes
the row into place instead of overflowing it — a fade that never fires is a row that clips
with nothing saying so. `flex: none` on the chips is what gives the measurement something
to measure.

**AND THE SELECTOR FOR IT IS THE CHIP'S CLASS RATHER THAN `> *`**, which cost two header
assertions to learn. A universal child selector reads as "anything, anywhere" to the
cascade resolver `test/css-cascade.js` uses to answer "what wins for this element", so
`flex: none` inside one chip row beat `.tp-panel-slot`'s own declaration on the other side
of the app. The rule is about a chip; it says chip.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
