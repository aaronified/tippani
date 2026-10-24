# ADR-0112: Progress is derived from a position in the work's own units, and a count with no total is refused rather than stored

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.3.0

**Decided.** `progress` (0–100) is the canonical value and drives the bar, the export and every client. Where a position is set — page 96 of 214, season 2 of 3 episode 6 of 10 — the server derives the percentage from it, and the client's own percentage is consulted only when there is nothing to derive from. A page or episode number with no total is a 400.

**Why.** People count in the units the thing is made of, not in percentages, but two numbers that can disagree is worse than one. Deriving server-side means the bar, the file and every client read one number. A count with no total cannot become a percentage, and silently storing it would leave a bar that never moves. For a show, whole earlier seasons count in full, which is the only reading that makes the bar advance monotonically through a run.

**Instead of.** Storing the position and computing the percentage per client — rejected; that is how clients disagree.

**Approved.** My call, and the refusal is the part I approved most deliberately: a validation error at the door beats a broken bar nobody can explain.

<sub>1.3.0 — `internal/httpapi/shelf.go` · `internal/store/migrations/0024_in_progress.sql` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
