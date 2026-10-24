# ADR-0326: A staged work with no quotes is still approved, or a whole-library round-trip would drop the unquoted shelf

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** `resolveStagedSelection` resolves works separately from quotes rather than deriving them, and `loadStagedForApproval` takes works from the selection's own work list. Approving a work with no quotes still creates its library row.

**Why.** A book or film exported with no quotes at all re-imports as exactly that, and the pre-1.2.0 importer still created its row. Deriving works from quotes would mean a whole-library export could not round-trip: every unquoted work on your shelf would vanish on the way back in. The one exception is an explicit id list, which names quotes — so its works are exactly the works those quotes sit under, because naming a quote must never drag its quoteless siblings in.

**Instead of.** Deriving works from the selected quotes — rejected on the round-trip.

**Approved.** My call, and the asymmetry between an id selector and a work/batch/all selector is one I approved deliberately rather than smoothing over.

<sub>1.2.0 — `internal/httpapi/import_staging.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
