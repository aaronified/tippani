# ADR-0594: Mutation testing is the gate for a new rule, and a surviving mutant is the finding

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.0

**Decided.** New rules ship with a mutation run: sixteen against migration 0029, eleven against the category rules, fifty-one across 1.7.2, and the downgrade guard disabled to confirm its test goes red. The tag ranking was replayed against the real tag list including the pair that collided.

**Why.** The value is entirely in the survivors. Removing 0029's FTS index rebuild changed nothing, which looked like proof the line was unnecessary — an external-content FTS5 index keeps its own entries, so dropping and recreating the content table does not clear them. But it was UNTESTED, not unnecessary: what the rebuild actually repairs is an index that had ALREADY drifted, which is now what the test asserts. In 1.7.2, deleting a middle width step passed every assertion because they only checked that the staircase starts low and ends high; the "last read" comparator's two unread-goes-last guards turned out to be unreachable, and an unreachable branch that looks like the rule is worse than no branch; and a server-side date filter could not be observed through the API at all, since a map miss and a stored empty string serialise to the same JSON. In 1.7.0, the "first slot cannot be hidden" rule was enforced in two places, so breaking either left the other covering for it — a rule guarded twice is a rule where neither guard can be shown to work.

**Instead of.** Coverage as the gate (would have reported all of the above as covered).

**Approved.** Mine, and I approved it as a gate rather than an occasional exercise.

<sub>1.7.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
