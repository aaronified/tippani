# ADR-0592: A passing test you have not seen fail is a decoration

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** An audit found six tests in the tree asserting nothing, and every claim in that release was then checked by breaking the code on purpose, watching the test go red, and putting it back.

**Why.** The worst of the six was a share-format test where swapping the character and the actor inside the payload left all twenty-one tests green — for a file whose entire subject is that a wrong attribution is a misquote. They were four `toContain` calls. AI-written tests can be confidently wrong about their own coverage, and a green suite is exactly the shape of evidence that stops anyone looking.

**Approved.** Mine, and I approved the break-it-first procedure as the standing rule rather than a one-off audit.

<sub>1.5.0 — `CHANGELOG.md` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
