# ADR-0217: A searched quote wears its colour, falling back to the border

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.7.5

**Decided.** Colour stopped being decoration in 1.7.1, when the six slots became categories you name. Every surface carried it — the Library, a work's page, the export, the share card — and search did not, on an odd seam: standalone quotes were built later and built right, so they carried their colour, while every book annotation and every film line came back with none. A library sorted into six named categories looked uncategorised the moment it was searched. The quieter half is worse: the share sheet opened from a result reads the colour off the row, so sharing a quote you found by *searching* dropped its category line while sharing the same quote from its book kept it. Result rows now wear the same left bar the card they stand for wears, and a row whose colour is unrecognised falls back to the plain border rather than to slot 1 — because slot 1 is a category somebody may have named, and painting an unknown row with it would assert a choice nobody made. I approved the fallback direction explicitly; it is the same rule that keeps slot 1 from being treated as a deliberate category anywhere else.

**Instead of.** Defaulting an unknown colour to slot 1, which is what an ordinary `??` would have done.

**Reversal.** Yes, of an omission carried since 1.7.1.

<sub>1.7.5</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
