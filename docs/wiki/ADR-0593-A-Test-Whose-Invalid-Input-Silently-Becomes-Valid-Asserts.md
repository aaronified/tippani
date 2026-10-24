# ADR-0593: A test whose invalid input silently becomes valid asserts nothing

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.1

**Decided.** Three tests used `green` as their example of an invalid colour. When 0029 made green valid they were rewritten to use a value that never will be.

**Why.** All three would have gone on passing while testing nothing. An invalid-input test is a claim about the boundary, so its input has to stay on the wrong side of it — and nothing in the type system says so.

**Approved.** My call during the same release that widened the set; I approved hunting for the class rather than fixing the one that surfaced.

<sub>1.7.1 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
