# ADR-0332: Staged tag edits can remove as well as add, and the reason the live endpoint still cannot is structural

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** `POST /import/staged/bulk` takes `add_tags` and `remove_tags`. `POST /annotations/bulk` still only unions.

**Why.** Staged tags are denormalised text on the row, so a removal is a set operation on that string — no join rows, no vocabulary entry created for a tag nobody approved. The live endpoint's one additive helper is all it has, and the full-state alternative would need every row's current tag set, which the request does not carry. So the asymmetry is not an oversight; it is what the two storage shapes each make cheap.

**Approved.** I approved shipping the asymmetry with the reason written at the top of the file, rather than either holding the staged feature back or rushing a full-state bulk endpoint to match.

<sub>1.2.0 — `internal/httpapi/import_staged_bulk.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
