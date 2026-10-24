# ADR-0212: Structured facets parse the raw query only, never the fuzzy re-run

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 0.9.1 (facets), 0.6.9 (fuzzy interaction)

**Decided.** The decade facet (`1990s`, `90s`, `90's`) and the date-added facet (`2026-07-14`, `14 July 2026`) parse the raw query and are guarded on whether it *parsed* as one, not on whether it *found rows*. A date or a decade is not a typo. "80s" with nothing from the 1980s must stay empty and must never be "corrected" into "90s" — the user asked a precise question and got a precise, empty answer. The Stats activity calendar links straight into the date facet with the ISO form, so this path also has to be exactly literal. My call, and the comment in the handler says so at the point where it would be easy to get wrong.

**Instead of.** Letting a zero-hit decade fall through to the fuzzy pass like any other query.

<sub>0.9.1 (facets), 0.6.9 (fuzzy interaction) — `internal/httpapi/search_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
