# ADR-0906: Context is read once and stored, so it outlives the file

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Attaching a file reads it once and stores, for each quote it can place, the lines or paragraphs around it (up to 15 cues or 10
paragraphs) as the **file** has them. **In context** reads one stored row and never opens a file, so it works when the file was
pruned, or sat on a folder that is unplugged.

**Store wide, render narrow.** The window shown is a choice of the look; **Show more** widens it up to what is stored. A span stops
at a chapter edge and at a silence longer than 30 seconds, and says so.

**Matching is fuzzy on both sides** (fold punctuation, accents and case; align with a 15% error budget) and a quote that appears in
several places is reported as ambiguous and given no context, never guessed at. **A rescan fills and never overwrites.**

**Rejected.** Reading the file on every open (breaks when the file is gone, and pays for it every time).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
