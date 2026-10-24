# ADR-0886: What the Never-asked-about list was not saying

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**A NUMBER WITH NO DENOMINATOR ANSWERS THE WRONG QUESTION.** The row said "27 SKIPPED"
against a book, and the reader auditing their own exclusions wants to know whether that is
the whole book or a corner of it. The pair needs a figure the endpoint was not sending —
the work's own count, correlated on the parent rather than grouped, because the query is
already filtered to excluded rows and a GROUP BY there counts what is left rather than
what there is.

**AND THE CREDITS WERE DRAWING THE GREY STAND-IN, on a list whose whole argument is that
a reader should recognise their own shelf.** `PersonChip` draws `person.image_path` and
was handed a bare string. It was invisible because a stand-in is also the right answer for
a credit nobody has fetched a person for: the defect and the correct state are the same
picture. The path comes off the people row now, looked up once for the whole list rather
than once per group.

**THE COVER'S HEIGHT IS THE TEXT'S HEIGHT, AND THE FIRST ATTEMPT AT THAT DREW A 453px
COVER.** Stretching the row and asking the image for `height: 100%; width: auto` is
circular — the row's height is its tallest item, the tallest item was the art, and the
art's height came from its own width, so the cover took the column's full width and came
out five times the height of the title beside it. The column carries the RATIO and is
stretched; the picture is absolutely positioned inside it and contributes nothing back.
A journey measuring the pair is what said so; by eye it is a big cover on a screen that
scrolls.

**AND THE MUTATION THAT PROVES IT IS NOT THE OBVIOUS ONE.** Putting `align-items:
flex-start` back on the row changes nothing, because a child's `align-self` outranks its
container's alignment — the load-bearing line is `align-self: stretch` on the art column.
That was found by trying the obvious mutation and watching the case stay green, which is
the whole reason the rule says to try it.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
