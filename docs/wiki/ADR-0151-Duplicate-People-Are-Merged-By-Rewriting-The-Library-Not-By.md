# ADR-0151: Duplicate people are merged by rewriting the library, not by aliasing

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/people_handlers.go`

**Decided.** There is no alias table. Merging two spellings of one person is a rename: the credit strings across the library are rewritten, the metadata rows are folded onto the target, roles move before the losing row is deleted, and freed portrait files are unlinked after the commit.

**Why.** People are keyed by name, so an alias would be a second identity mechanism sitting beside the primary one and every read would have to consult both. Rewriting is the honest operation: after it, the library says one thing. The ordering matters and is commented — roles are copied to the survivor *before* the delete, because deleting the row cascades its `person_kinds` away and a speaker folded into an existing author row would otherwise quietly stop being a speaker. The rename is also looked up by name alone now; `kind` on the request says only which console you came from, because one row plays a set of roles and renaming Bose from the Authors console has to rewrite their speaker credits too. This was mine, and the cost — rename has no undo — is why `personCreditSQL` exists in the form it does.

<sub>`internal/httpapi/people_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
