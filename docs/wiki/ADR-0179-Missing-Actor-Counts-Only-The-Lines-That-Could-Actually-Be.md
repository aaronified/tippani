# ADR-0179: missing actor counts only the lines that could actually be filled

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/metadata_library.go`

**Decided.** The SQL counts dialogues with no actor **and** a non-empty character.

**Why.** Speakerless lines — narration, an unattributed line — have nothing to match against the cast, so no action can ever clear them. Counting them would inflate a warning tile with work that cannot be done, and a warning nobody can act on trains you to ignore the tile. I approved narrowing the count even though the headline number got smaller, which is the point.

<sub>`internal/httpapi/metadata_library.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
