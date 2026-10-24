# ADR-0447: One glyph per meaning at one stroke weight, with the nav's private icon set deleted and duplicates caught by geometry comparison

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.6.0

**Decided.** One icon set, one stroke weight (1.85). Four icons in the set turned out to be other icons and were redrawn.

**Why.** The duplicates were found by comparing the drawings, not the names. `IconShare` and `IconUpload` were both a tray with an arrow in it, differing by about a pixel and a half of arrow — and they appear in the same rows, since a quote card offers share and the tag manager offers upload. `IconExport` and `IconMetadata` were the same three strokes at coordinates half a unit apart, sitting two buttons apart on the Metadata console, one pulling data in and one pushing it out. Meanwhile the nav carried its own copy of the set at 2.0 instead of 1.85, so the app drew a magnifier, an open book and a tray-download twice each — and the Library tab was the identical open book the "currently reading" cover badge wears, on screens that show both at once. Share is the node graph now, which is the universally-learned mark and shares no geometry with a tray; Metadata is an arrow landing *inside* a record card, because the arrow now has somewhere to arrive; Library is spines on a shelf.

**Reversal.** Reversed. The nav's private set was mine and it was a straightforward duplication I never went back to consolidate.

**Approved.** My call to delete it and redraw the four, and I approved the geometry test as the standard: the one thing a glyph has to do is be told apart at 24px without reading a label.

<sub>1.6.0 — `CHANGELOG.md` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
