# ADR-0148: personCreditSQL returns the scan and the update together

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/people_handlers.go` · `internal/httpapi/people_gc_test.go`

**Decided.** One function, one switch, returning both statements plus an `ok` flag; a kind with no credit column cannot be renamed.

**Why.** They were previously two separate switches — each a default-plus-overrides over books — sitting forty lines apart inside `handleRenamePerson`, which is two ways to get the same thing wrong. Independently, either could inherit the books arm for a kind it does not know. Jointly, they could *disagree*: scan one table and write to another, reading every book's author and stamping the rewritten strings onto dialogue rows by matching id. The blast radius is larger than the orphan sweep's, because `ReplaceCredit` matches a name as a component inside a joined credit — a speaker renamed from "Bose" would rewrite the author line of every book credited to anyone called Bose, across the whole library, and rename has no undo. A test asserts that every kind `validPersonKind` accepts has a case here. Approved by me as a refactor with no behaviour change, which is the only kind worth doing to a path with no undo.

<sub>`internal/httpapi/people_handlers.go` · `internal/httpapi/people_gc_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
