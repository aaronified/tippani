# ADR-0423: The at-scale Metadata console is desktop-only, and the phone says so

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 0.4.4

**Decided.** On phones the Metadata tab is a maintenance screen — fetch covers and metadata, scan for duplicates, speaker remap, people fetch-missing — with the coverage tiles collapsed to plain text lines and no browsable list. The filterable console stays desktop-only, and the mobile header carries an info dot saying where the full console lives.

**Why.** A filterable table over a whole library is a desktop artefact, and shrinking it produces something that is neither. The info dot exists because a feature that is absent without explanation reads as missing rather than as elsewhere.

**Approved.** Mine, and I approved the note more than the omission.

<sub>0.4.4 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
