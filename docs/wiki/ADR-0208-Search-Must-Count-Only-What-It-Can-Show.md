# ADR-0208: Search must count only what it can show

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** A tag worn only by standalone quotes rendered a chip reading `grief · 3` above an empty box, and a day on which you had saved only quotes rendered `Added on … · 0`. The counts were right about the library and wrong about the result: they counted rows the section had no scope to display. A count beside an empty box is not a small cosmetic defect — it tells you the search is broken and gives you no way to find out otherwise. Speakers got their own section in the same release, beside Authors and Actors, for the reason that governs the whole sectioning scheme: searching a person's name is asking about the person. I approved both, and they are one decision viewed from two sides — a section exists so that what matched can be shown, and a count is only honest about what the section will show.

**Instead of.** Showing the library-wide count with a note. Rejected: the note is the thing nobody reads.

**Reversal.** Yes, of the counting behaviour shipped with the standalone-quote work earlier in the same release.

<sub>1.5.0 — `internal/httpapi/search_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
