# ADR-0595: Assertions about a destructive migration are about values, not counts

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.1

**Decided.** `six_colours_test.go` opens a store at the pre-0029 schema, seeds every table the migration touches plus every child and side table it could lose, and asserts values across the rebuild. Its header states the rule: "EVERY ASSERTION HERE IS ABOUT VALUES, not counts."

**Why.** A cascade that ate the tag joins leaves a table that is empty rather than wrong, and a test counting rows before and after would pass on a database where every tag had been stripped from every quote. The precedent is named: 0018's own `dialogue_tags` restore had no assertion at all.

**Approved.** My call, and I approved starting from a populated pre-migration schema rather than a fresh one, which is what makes the loss observable.

<sub>1.7.1 — `internal/store/six_colours_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
