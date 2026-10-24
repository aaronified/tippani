# ADR-0120: 'Last read' sorts on the finish date, falls back to the start, counts every outcome, and puts never-logged works last

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.7.2

**Decided.** `lastReadAt` takes `MAX(CASE WHEN finished_at <> '' THEN finished_at ELSE started_at END)` per work, over every outcome. The client comparator inverts a lexical compare, so `''` — a prefix of every string — sorts last.

**Why.** A read you are still in the middle of has no finish date and is the one you touched most recently, so sorting on `finished_at` alone would file the book currently open under "never". Every outcome counts because the question is "when did I last have this in my hands", and abandoning something in November is an answer to it — which is also why this cannot reuse `readCounts`, which asks how many times I got to the end and is right to filter on the outcome. Anything never logged sits at the end alphabetically, which in a library built to hold quotes is usually most of it.

**Instead of.** Two explicit `if (!da) return 1` guards in the comparator — written, then deleted: a mutation proved them unreachable, because the inverted direction was already doing their work. The invariant now lives in the test rather than in a branch that cannot run.

**Approved.** My call, and I approved deleting the dead guards rather than keeping them for comfort — a branch that cannot run is a line a later change trusts.

<sub>1.7.2 — `internal/httpapi/shelf.go` · `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
