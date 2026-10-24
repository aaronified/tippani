# ADR-0590: A test must not assert against the wall clock, or against being the newest migration

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 0.6.1 / 1.1.0

**Decided.** `TestDailyQuizTimezone` now asserts the local-day shift deterministically. A migration-replay test steps forward from an older schema rather than deleting its own `schema_version` row.

**Why.** Two distinct traps, both recorded with the symptom. The timezone test "asserted a cross-midnight case off the wall clock and could fail depending on the hour CI ran (it broke 0.6.0's CI at 03:45 UTC though the code was fine)" — a red build with correct code is worse than no test. The migration test "silently stopped replaying once any newer migration existed, because `Migrate()` resumes from the highest recorded version" — a green build with no coverage, the worse of the two failures.

**Approved.** Both fixes are mine, and I approved recording the symptoms rather than only the corrections.

<sub>0.6.1 / 1.1.0</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
