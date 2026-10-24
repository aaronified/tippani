# ADR-0591: Round-trip tests keep asserting what they asserted before

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** When 1.2.0 put a staging stage between parse and write, the export → re-import round-trip tests went on asserting exactly what they had asserted, through an import-then-approve helper.

**Why.** The property under test is "a library's own export re-imported is a dedupe no-op", and that property did not change. Rewriting the assertions to match the new pipeline would have meant losing the only evidence that the pipeline preserved it. What did change is stated: re-importing the same file twice now gives two batches rather than one silent no-op write, and approving both adds the quotes once.

**Approved.** My call, and I approved the helper specifically so the assertions could stay untouched.

<sub>1.2.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
