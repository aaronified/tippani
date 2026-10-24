# ADR-0621: Every roadmap write is guarded and keeps a backup

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.3.2

**Decided.** Each write keeps the previous page in `docs/roadmap.backup.html` and is refused outright if the render loses a marker, unbalances `<details>` or shrinks the page implausibly. `tracker.json` only re-stamps its timestamp when the tracker state actually moved.

**Why.** A bad run should be a failed job, not a broken published page. The timestamp rule exists because any issue event at all — a comment, a label edit — rewrote the file and the bot committed: two label edits produced three commits whose entire content was a new timestamp.

**Approved.** My call, and I approved the shrink heuristic even though it is crude — an implausibly short page is the failure that would otherwise ship.

<sub>1.3.2 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
