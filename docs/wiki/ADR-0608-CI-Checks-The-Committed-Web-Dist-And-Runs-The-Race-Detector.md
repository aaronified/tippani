# ADR-0608: CI checks the committed web/dist and runs the race detector

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** `git diff --exit-code -- web/dist` after the frontend build, and `go test -race`.

**Why.** `web/dist` is a committed artifact embedded with `go:embed`, so a forgotten `make frontend` left the binary serving the old UI with nothing to say so — a rule that existed only as prose in the contributing notes. And `-race` had never once run, in a repo that had two tests written specifically to exercise it.

**Approved.** Mine, and I approved both as gates rather than as reminders; a rule only a human enforces is a rule that has already been forgotten.

<sub>1.5.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
