# ADR-0672: The fourth read of one column

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.7

**Decided.** The daily deck's book branch selects `character`.

**Four releases, four reads.** 2.2.3 put a highlight's character on the library card, the Home tile and the three share payloads. 2.2.5 found it missing from Shuffle and from the anthology's book branch. This one found the daily deck, whose field carried a doc comment reading "screen speaker" — accurate before 0047 and wrong ever since, which is precisely why it was not noticed: the comment agreed with the code.

**The rule for a field added to an existing table.** 0047 gave `annotations` a column that the film side already had. Every place that reads the film's version is a place that now has to read the book's, and there is no test that can enumerate them — but `grep` can. A stale comment describing the old world is the thing that makes the search fail.

<sub>2.2.7 — `internal/httpapi/review_handlers.go` · `web/frontend/src/review.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
