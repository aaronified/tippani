# ADR-0889: A glyph's baseline is its bottom edge

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner, over a screenshot of the release log: *"The chevrons are slightly up compared
to the version numbers. This is an alignment problem i see app wide. This kind of things
differentiate casual from professional."*

**THE CAUSE IS ONE SENTENCE AND IT IS NOT OBVIOUS.** An `<svg>` has no text in it, so its
baseline is its bottom margin edge — which means a glyph in an `align-items: baseline`
flex row hangs its ENTIRE body above the text baseline. `.cl-head` is exactly that: a
button holding a chevron, a 13px version and an 11px date, aligned by baseline so the two
type sizes read as one line. The chevron measured 3.8px high.

**THE ROW STAYS BASELINE AND ONLY THE GLYPH IS CENTRED.** Baseline is what makes two type
sizes look like one line, so changing the row would have fixed the chevron by breaking the
pair beside it. `.cl-head > svg { align-self: center }` is the whole repair: the thing with
no baseline of its own takes the line's centre instead.

**THE SECOND CAUSE WAS A CONTROL THAT KNEW IT HAD A GLYPH AND A COPY THAT DID NOT.**
`.tp-filter-chip.has-btn-icon` sets `display: inline-flex; align-items: center`; the plain
`.tp-filter-chip`, which also gets glyphs, set neither — so the same control drew its icon
4.5px high on one screen and on the line on another. That is the repo's own directive about
a control drawn twice, found by measurement rather than by reading.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
