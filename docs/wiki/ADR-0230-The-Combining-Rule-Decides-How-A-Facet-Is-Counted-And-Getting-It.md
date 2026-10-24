# ADR-0230: The combining rule decides how a facet is counted, and getting it uniform makes one of the two lie

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.16.0

**Decided.** Every facet value carries a count of the hits it would give under the current search. An **AND** field (tag, genre) is counted *with* its own chips applied; an **OR** field (colour, shelf, series, year, every credit, the work ids) is counted *without* them.

**Why.** `combine` has said since 1.10.0 that a second tag intersects and a second author unions, and that is exactly the question a count has to answer: *what happens if I press this*. Pressing a second tag narrows, so the number beside it must be the intersection. Pressing a second author widens, so the number beside it must be what allowing that author **as well** would give.

Count them the same way and one of the two is a lie, in a direction that looks like a bug either way. Under an all-with rule every unpicked colour reads 0 for ever — the panel looks broken at precisely the moment it is working correctly. Under an all-without rule a second tag advertises a number nothing will ever show you.

**What the deferral got right and wrong.** The 1.16.0 note said counts were not worth *fifteen queries per value per field*, and that counting the library rather than the result is worse than nothing. The second half still holds and is the reason this is computed per query. The first half was a bad estimate of a design I had not worked out: it is one `GROUP BY` per field per applicable kind — about thirty in total, over indexed columns of a personal library — on its own route, so the panel pays for them and the 200 ms-debounced typeahead does not.

**A zero is reported rather than omitted**, and the pill greys and stays pressable. A value that vanishes when you narrow leaves a reader wondering whether they mis-remembered their own library; a grey one says *not under this question*, which is both the answer and a pointer at the chip to remove. What is omitted is anything that is not a value at all: an empty credit column is not an author called `""`, and `year 0` is "no year recorded".

**A joined credit's count lands on each name**, so the sum across the map exceeds the number of rows. That is correct rather than a rounding error — a book credited to two people is one hit under each, and pressing either finds it.

**Instead of.** Folding the counts into `/search` (thirty GROUP BYs behind every keystroke); or sharing one table of field-applicability with `where()` — the counter keeps its own and a test walks both, because a shared table that has to be read two different ways is how the last three drifts in this file started.

<sub>1.16.0 — `internal/httpapi/search_facet_counts.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
