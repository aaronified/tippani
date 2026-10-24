# ADR-0787: The Library sorts by year, and the absence leaves the number line

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The request was one line — "book sort needs release date" — and the Movies list already had
the answer: a *Year* entry on the same menu, over `release_year`. A book's column is
`published_year` and holds the same kind of fact, so the entry is the same entry and wears
the same word. Nothing here is new design.

WHAT WAS NEW is that the comparator Movies used cannot be copied. `(b.year || 0) - (a.year ||
0)` reads correctly for films because every film has a year and the earliest is 1888. Books
are not that: since 0030 the column stores a year before the era as a NEGATIVE, and since
0001 it has stored "nobody recorded one" as 0 — so the absence sits on the number line
*between the two eras*. Subtracting files the one undated book above 380 BCE and below 1890,
in the middle of the shelf, and does it without failing anything.

So the sentinel is sent to the end explicitly, the way `byLastRead` sends the never-read
there — and unlike `byLastRead`'s guards, which a mutation proved unreachable because the
inverted comparison was already doing their work, this one is reachable: a BCE year really
does sort below zero.

ONE COMPARATOR, TWO ACCESSORS. `byYear(get)` takes the column name because the two shelves
spell one fact differently. The repo's rule is that a control drawn on two screens has one
behaviour living in one function both screens call, not a line each — and this is what that
rule is for: the Movies line was right by luck, the Library's copy of it would not have
been, and nothing would have said so. Adopting the shared function changes one thing on the
Movies list that was not asked for and is recorded here as a deliberate departure: a year
tie there now breaks alphabetically rather than by insertion order, which is what the Title
and Series sorts on the same menu already did.

`circa` is not consulted, per 0030's own ruling that it is display-only: c. 380 BCE sorts
exactly where 380 BCE does, so the shelf and the timeline cannot disagree about one book.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
