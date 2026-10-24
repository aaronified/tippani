# ADR-0627: What is checked is published alongside what it does not cover

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.4.2 onward

**Decided.** `How-this-was-written.md` states what runs — the Go tests over real HTTP handlers against a real SQLite database, the frontend suite, the CI gates — and then lists, at greater length, what that honestly does not cover.

**Why.** "AI-assisted" describes everything from a tab-completed variable name to a wholly generated codebase, and a bare list of passing checks reads as a guarantee. The counter-list is the more useful half: passing tests are not proof, confident documentation is not verified documentation, consistency is not something you can review for, a bug report is a report of a symptom, and a confident diagnosis is worth no more than confident code. Counts are given with the command that produces them, because a number in a file like that one is stale the moment it is written.

**Approved.** Mine, and I approved the second list being longer than the first.

<sub>1.4.2 onward — `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
