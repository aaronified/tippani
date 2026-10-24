# ADR-0625: Every decision in the three feature plans is a settled answer, and the unsettled one says so

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.x

**Decided.** Each plan carries a Decisions table of question-and-answer pairs marked "All vetted", with the cost named where a decision cost something. The one point still open — what "ids reserved" actually costs — is written up as an open question with three options and a recommendation, and the rest of the plan is written to be independent of the answer.

**Why.** A plan whose decisions are implicit is a plan that gets relitigated mid-build, at the worst possible moment. Naming the single unsettled point is what lets the other forty be treated as closed.

**Approved.** Mine — every row in those tables is a decision I took and approved, and the open question is flagged precisely because I have not.

<sub>1.7.x — retired into this document at 1.14.2; the plans are in git</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
