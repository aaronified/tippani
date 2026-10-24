# ADR-0193: A studio and a director share one column, so every query keyed on either must name the media type

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** 0040

**Decided.** `orphanRefQuery`, `personCreditSQL` and `handlePeopleNames` all narrow their `director` arm to `media_type <> 'game'` and gain a `studio` arm scoped to `media_type = 'game'`. `validPersonKind` is backed by an enumerable `personKinds` slice, and the invariant tests range over it.

**Why.** This is the **third** appearance of a hazard this file already carries a twenty-line comment about. The first was `gcOrphanPeople`'s default-plus-overrides; the second was `handleRenamePerson`'s two separate switches; both were fixed. The third — `handlePeopleNames` — was missed, and the plan for this feature named only the first two. Left alone, the Metadata console's director list would have answered with every studio in the library, tallied, named as directors and **offered for renaming** — the identical sentence written up about translators and authors one kind earlier. Knowing the shape is not the same as having swept for it.

The rename's blast radius is the larger one: `metadata.ReplaceCredit` matches a name as a *component* inside a joined credit, and rename has no undo.

**What this also exposed.** Two invariant tests written specifically to catch this class were passing vacuously. `TestEveryValidKindHasAReferenceQuery` and `TestEveryValidKindIsRenameableOrExplicitlyNot` both carried hand-written kind lists under comments claiming they were "kept in step with validPersonKind by construction" — one listed six kinds, the other four, against a vocabulary of six. A seventh would have passed both without being checked. That is the same defect as the parity test in `How-this-was-written.md` that skipped embedded structs: **a test whose coverage is a copy of the thing under test agrees with it forever.** Both now enumerate `personKinds`, and a third test asserts the media-type predicate is present in all six director/studio query strings — a sweep rather than an example.

**Approved.** My call; the third-instance sweep was not in the plan and is the reason it was found.

<sub>0040 — `internal/httpapi/people_handlers.go`, `internal/httpapi/people_gc_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
