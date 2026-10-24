# ADR-0329: Approval converts staged rows back into the importers' own intermediate shape and replays the existing persist path

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** Approval rebuilds `importer.Annotation` / `importer.Dialogue` from the staged rows and runs the existing write path, rather than writing from staging directly.

**Why.** Dedupe, duplicate enrichment and the ISBN → ASIN → title/author resolution then behave exactly as they did when the importers wrote straight through. There is one implementation of those rules, not two. It needed one refactor and no behaviour change: the target-resolving half of the old `importOneBook` / `importOneMovie` is now separate from the loop that writes the quotes, so the loop can also be handed a target the *user* picked when they retarget a misdetected file.

**Instead of.** A second write path reading staging directly — rejected; two implementations of dedupe is two implementations that will disagree.

**Approved.** My call. Round-tripping through the intermediate shape looks wasteful and I approved it anyway, because the alternative is a duplicate rule set nobody will keep in step.

<sub>1.2.0 — `internal/httpapi/import_staging.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
